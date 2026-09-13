import { NextResponse } from "next/server";
import { authenticate, serverFirebase } from "@/server/content-intelligence/firebase";
import { assemblePost } from "@/server/content-intelligence/assemble";
import { previewSchoolSource } from "@/server/content-intelligence/request-package";
import { IntelligenceRepository, digest } from "@/server/content-intelligence/repository";
import { runIntelligence } from "@/server/content-intelligence/service";
import { findSchoolPhotos, photoSearchPolicy } from "@/server/content-intelligence/photos";
import type { PhotoSearch } from "@/domain/content-intelligence/photos";
import { abortLocalRun } from "@/server/content-intelligence/gateway";
import { IntelligenceError, requireCondition } from "@/domain/content-intelligence/types";
import { identifier, bindingSchool } from "@/domain/content-intelligence/policy";

const photoCache = new Map<string, { expires: number; value: PhotoSearch }>();
const photoActive = new Set<string>();
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
function failure(error: unknown) { return json({ error: error instanceof IntelligenceError ? error.code : "server-connection-unavailable" }, error instanceof IntelligenceError ? error.status : 503); }

export async function GET(request: Request) {
  try { const uid = await authenticate(request); return json(await new IntelligenceRepository(serverFirebase().db).state(uid)); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    requireCondition(!origin || origin === new URL(request.url).origin, "request-origin-rejected", 403);
    const uid = await authenticate(request);
    requireCondition(request.headers.get("content-type")?.split(";")[0] === "application/json", "invalid-request", 400);
    const reader = request.body?.getReader(); requireCondition(reader, "invalid-request", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 64_000) { await reader.cancel(); throw new IntelligenceError("request-too-large", 413); } chunks.push(chunk.value); }
    let body: Record<string, unknown>;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new IntelligenceError("invalid-request", 400); }
    requireCondition(body && typeof body === "object" && !Array.isArray(body), "invalid-request", 400);
    const repository = new IntelligenceRepository(serverFirebase().db);
    if (body.action === "preview-school-source") {
      requireCondition(Object.keys(body).sort().join() === "action,id,website", "invalid-request", 400);
      const requestRecord=await repository.schoolRequest(identifier(body.id),uid);
      requireCondition(!requestRecord.sourceApprovedAt,"school-source-already-confirmed",409);
      const preview=await previewSchoolSource(requestRecord,body.website,request.signal);
      const saved=await repository.saveSchoolSource(requestRecord.id,uid,preview);
      return json({...saved,previewHash:digest(saved.sourcePreview)});
    }
    if (body.action === "approve-school-source") {
      requireCondition(Object.keys(body).sort().join() === "action,id,previewHash", "invalid-request", 400);
      return json(await repository.approveSchoolSource(identifier(body.id),uid,identifier(body.previewHash)));
    }
    if (body.action === "assemble-post") {
      requireCondition(Object.keys(body).sort().join() === "action,researchId", "invalid-request", 400);
      return json(await assemblePost(repository,uid,identifier(body.researchId),request.signal));
    }
    if (body.action === "find-photos") {
      requireCondition(Object.keys(body).sort().join() === "action,researchId", "invalid-request", 400);
      const research = await repository.research(identifier(body.researchId), uid);
      await repository.db.runTransaction(tx => repository.binding(tx, research.binding.projectId, uid, research.binding));
      const key = `${uid}:${research.binding.schoolId}:${research.binding.contentHash}`;
      const cached = photoCache.get(key);
      if (cached && cached.expires > Date.now()) return json(cached.value);
      requireCondition(!photoActive.has(uid), "photo-search-running", 409);
      photoActive.add(uid);
      try {
        const value = await findSchoolPhotos(research.binding.schoolId, research.sources.map(s => s.url), request.signal, undefined, bindingSchool(research.binding));
        await repository.db.runTransaction(tx => repository.binding(tx, research.binding.projectId, uid, research.binding));
        for (const [id, entry] of photoCache) if (entry.expires <= Date.now()) photoCache.delete(id);
        if (photoCache.size >= 20) photoCache.delete(photoCache.keys().next().value!);
        photoCache.set(key,{expires:Date.now()+photoSearchPolicy.cacheMs,value});
        return json(value);
      } finally { photoActive.delete(uid); }
    }
    if (body.action === "submit-school") {
      requireCondition(Object.keys(body).sort().join() === "action,request,requestId", "invalid-request", 400);
      return json(await repository.submitSchool(uid, identifier(body.requestId), body.request));
    }
    if (body.action === "save-storyboard") {
      requireCondition(Object.keys(body).sort().join() === "action,board,researchId,researchRevision,revision", "invalid-request", 400);
      requireCondition(Number.isInteger(body.revision) && Number.isInteger(body.researchRevision), "invalid-request", 400);
      return json(await repository.saveStoryboard(identifier(body.researchId), uid, Number(body.researchRevision), Number(body.revision), body.board));
    }
    requireCondition(size <= 16_000, "request-too-large", 413);
    if (body.action === "cancel") { const id = identifier(body.runId); await repository.cancel(id, uid); abortLocalRun(id); return json({ cancelled: true }); }
    if (body.action === "review") {
      requireCondition(Number.isInteger(body.revision), "invalid-request", 400);
      return json(await repository.review(identifier(body.researchId), uid, Number(body.revision), body.decisions));
    }
    requireCondition(body.action === "research" || body.action === "generate", "invalid-request", 400);
    requireCondition(Object.keys(body).every(key => ["action", "projectId", "requestId", "researchId", "researchRevision"].includes(key)), "invalid-request", 400);
    const result = await runIntelligence(repository, uid, { kind: body.action, projectId: identifier(body.projectId), requestId: identifier(body.requestId),
      ...(body.action === "generate" ? { researchId: identifier(body.researchId), researchRevision: Number(body.researchRevision) } : {}) }, request.signal);
    return json(result);
  } catch (error) { return failure(error); }
}
