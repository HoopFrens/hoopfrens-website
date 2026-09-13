import { NextResponse } from "next/server";
import { authenticate, serverFirebase } from "@/server/content-intelligence/firebase";
import { IntelligenceRepository } from "@/server/content-intelligence/repository";
import { IntelligenceError, requireCondition } from "@/domain/content-intelligence/types";
import { identifier } from "@/domain/content-intelligence/policy";
import { renderMessages, renderSummary } from "@/domain/content-intelligence/rendering";
import { RenderStore, localRenderRoot } from "@/server/instagram-render/store";
import { RenderService } from "@/server/instagram-render/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });
function failure(error: unknown) {
  const code = error instanceof IntelligenceError ? error.code : error instanceof Error && renderMessages[error.message] ? error.message : "render-artifact-unavailable";
  return json({ error: code }, error instanceof IntelligenceError ? error.status : 409);
}
async function context(request: Request) {
  const url = new URL(request.url);
  requireCondition(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "rendering-local-only", 403);
  const origin = request.headers.get("origin");
  requireCondition(!origin || origin === url.origin, "request-origin-rejected", 403);
  const owner = await authenticate(request);
  const store = new RenderStore(localRenderRoot());
  const repo = new IntelligenceRepository(serverFirebase().db);
  return { owner, store, service: new RenderService(store, repo.renderSnapshot.bind(repo)) };
}
export async function GET(request: Request) {
  try {
    const { owner, store, service } = await context(request); const params = new URL(request.url).searchParams;
    if (params.has("file")) {
      const result = await service.download(owner, identifier(params.get("id")), params.get("file")!, params.get("proof") === "1");
      return new Response(new Uint8Array(result.bytes), { headers: { ...headers, "Content-Type": result.file.type, "Content-Disposition": `${params.get("proof") === "1" ? "inline" : "attachment"}; filename="${result.file.name}"` } });
    }
    const boardId = identifier(params.get("boardId"));
    const jobs = (await store.list(owner)).filter(j => j.board.id === boardId && j.status !== "deleted").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(await Promise.all(jobs.map(async j => renderSummary(await service.get(owner, j.id)))));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const { owner, service } = await context(request);
    requireCondition(request.headers.get("content-type")?.split(";")[0] === "application/json", "invalid-request");
    const reader = request.body?.getReader(); requireCondition(reader, "invalid-request");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2048) { await reader.cancel(); throw new IntelligenceError("request-too-large", 413); } chunks.push(value); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new IntelligenceError("invalid-request"); }
    requireCondition(body && typeof body === "object" && !Array.isArray(body), "invalid-request");
    let job;
    if (body.action === "start") {
      requireCondition(Object.keys(body).sort().join() === "action,boardId,requestId,revision" && Number.isInteger(body.revision), "invalid-request");
      job = await service.start(owner, identifier(body.boardId), body.revision, identifier(body.requestId), request.signal);
    } else {
      requireCondition(["retry", "cancel", "approve", "delete"].includes(body.action) && Object.keys(body).sort().join() === "action,id", "invalid-request");
      const id = identifier(body.id);
      if (body.action === "retry") job = await service.retry(owner, id, request.signal);
      else if (body.action === "cancel") job = await service.cancel(owner, id);
      else if (body.action === "approve") job = await service.approve(owner, id);
      else job = await service.remove(owner, id);
    }
    return json(renderSummary(job));
  } catch (error) { return failure(error); }
}
