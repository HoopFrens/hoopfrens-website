import "server-only";
import { zipSync, strToU8 } from "fflate";
import { bindingSchool, identifier } from "@/domain/content-intelligence/policy";
import { requireCondition, type ResearchPackage } from "@/domain/content-intelligence/types";
import { photoCaption } from "@/domain/content-intelligence/photos";
import { finalRenderBlockers, renderPolicy, type RenderJob, type RenderFile } from "@/domain/content-intelligence/rendering";
import type { Storyboard } from "@/domain/content-intelligence/storyboard";
import { digest } from "@/server/content-intelligence/repository";
import { decodePhoto, fetchPhoto, sha256 } from "./media";
import { renderSlide } from "./renderer";
import { RenderStore } from "./store";

type Snapshot = { board: Storyboard; research: ResearchPackage };
type SnapshotReader = (id: string, revision: number, owner: string) => Promise<Snapshot>;
const controllers = new Map<string, AbortController>();
const now = () => new Date().toISOString();
const event = (job: RenderJob, action: string) => ({ at: now(), action, actorId: job.ownerId });
const safeErrors = new Set(["render-image-rejected", "render-image-unavailable", "render-text-does-not-fit", "render-glyph-unsupported", "render-photo-missing", "render-storage-full", "render-storage-busy", "render-timeout", "render-cancelled", "storyboard-revision-changed", "research-review-changed", "approved-version-changed", "render-artifact-unavailable"]);
export class RenderService {
  constructor(readonly store: RenderStore, readonly snapshot: SnapshotReader, readonly retrieve = fetchPhoto) {}
  async current(job: RenderJob) {
    const current = await this.snapshot(job.board.id, job.board.revision, job.ownerId);
    requireCondition(digest(current) === digest({ board: job.board, research: job.research }), "storyboard-revision-changed", 409);
  }
  async start(owner: string, boardId: string, revision: number, requestId: string, signal?: AbortSignal) {
    identifier(requestId); const snapshot = await this.snapshot(boardId, revision, owner);
    const time = now();
    const job: RenderJob = { id: `render-${digest([owner, requestId])}`, ownerId: owner, requestId, inputHash: digest([snapshot, renderPolicy.version]), status: "running", attempt: 1, createdAt: time, updatedAt: time, expiresAt: new Date(Date.now() + renderPolicy.timeoutMs).toISOString(), progress: 0, ...snapshot, photos: [], files: [], blockers: finalRenderBlockers(snapshot.board), events: [{ at: time, action: "proof-requested", actorId: owner }] };
    const result = await this.store.create(job);
    if (!result.created) return this.get(owner, result.job.id);
    return this.execute(job, signal);
  }
  async get(owner: string, id: string) {
    const job = await this.store.read(owner, id);
    if (job.status === "running" && job.expiresAt <= now()) return this.store.update(owner, id, j => j.status === "running" ? { ...j, status: "failed", errorCode: "render-timeout", updatedAt: now(), events: [...j.events, event(j, "interrupted-or-timeout")] } : j);
    return job;
  }
  async active(job: RenderJob, signal: AbortSignal) {
    const current = await this.get(job.ownerId, job.id);
    requireCondition(current.status === "running", current.errorCode || "render-cancelled", 409);
    requireCondition(current.expiresAt > now(), "render-timeout", 408); signal.throwIfAborted();
  }
  async execute(job: RenderJob, external?: AbortSignal) {
    const controller = new AbortController(); controllers.set(job.id, controller);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(renderPolicy.timeoutMs), ...(external ? [external] : [])]);
    let storedBytes = 0; const files: RenderFile[] = []; const photos: RenderJob["photos"] = []; const blockers = [...job.blockers];
    const put = async (name: string, bytes: Buffer, type?: RenderFile["type"]) => {
      storedBytes += bytes.length; requireCondition(storedBytes <= renderPolicy.maxJobBytes / 2, "render-storage-full");
      await this.active(job, signal); await this.store.write(job.ownerId, job.id, name, bytes);
      if (type) files.push({ name, sha256: sha256(bytes), bytes: bytes.length, type });
    };
    try {
      const images = new Map<string, Buffer>();
      const used = [...new Set(job.board.slides.filter(s => s.layout === "photo").map(s => s.assetId))];
      for (const [i, assetId] of used.entries()) {
        await this.active(job, signal);
        const asset = job.board.assets.find(a => a.id === assetId); requireCondition(asset, "render-photo-missing");
        const download = await this.retrieve(asset.imageUrl, bindingSchool(job.board.binding).domains, AbortSignal.any([signal, AbortSignal.timeout(20_000)]));
        const decoded = await decodePhoto(download.bytes);
        await put(`source-${String(i + 1).padStart(2, "0")}.bin`, download.bytes);
        images.set(asset.id, decoded.image);
        photos.push({ assetId: asset.id, originalHash: decoded.originalHash, normalizedHash: decoded.normalizedHash, bytes: download.bytes.length, width: decoded.width, height: decoded.height, resolvedUrl: download.resolvedUrl, retrievedAt: now() });
      }
      const typography = [];
      for (const [i, slide] of job.board.slides.entries()) {
        await this.active(job, signal);
        const output = await renderSlide(job.board, i, slide.layout === "photo" ? images.get(slide.assetId!) : undefined);
        if (output.upscaled) blockers.push(`Slide ${i + 1}: choose a larger photo; this crop requires upscaling.`);
        typography.push({ slideId: slide.id, ...output.typography, fontHashes: output.fontHashes });
        await put(`slide-${String(i + 1).padStart(2, "0")}.png`, output.bytes, "image/png");
        await this.store.update(job.ownerId, job.id, current => { requireCondition(current.status === "running", "render-cancelled"); return { ...current, progress: i + 1, updatedAt: now() }; });
      }
      if (photoCaption(job.board).length > 2200) blockers.push("Shorten the caption so it fits Instagram with photo credits (2,200 characters).");
      const alt = job.board.slides.map((s, i) => `${i + 1}. ${s.layout === "photo" ? `Photo: ${job.board.assets.find(a => a.id === s.assetId)!.label}. ` : "Text card. "}${s.headline}${s.body ? `. ${s.body}` : ""}`).join("\n\n");
      await put("caption.txt", Buffer.from(photoCaption(job.board) + "\n"), "text/plain");
      await put("alt-text.txt", Buffer.from(alt + "\n"), "text/plain");
      await put("sources.json", Buffer.from(JSON.stringify({ renderer: renderPolicy.version, dimensions: [1080, 1350], storyboard: { id: job.board.id, revision: job.board.revision, hash: digest(job.board) }, binding: job.board.binding, research: { id: job.research.id, revision: job.research.revision }, slides: job.board.slides.map(s => ({ id: s.id, headline: s.headline, body: s.body, crop: { x: s.focalX, y: s.focalY }, claims: s.claimIds.map(id => job.research.claims.find(c => c.id === id)) })), sources: job.research.sources, photos: photos.map(p => ({ ...p, permission: job.board.assets.find(a => a.id === p.assetId) })), typography, notice: "Internal graphics. Source credits do not grant usage rights. Unknown photo rights do not block graphic download; any recorded permission is separate. Alt text requires Founder review." }, null, 2)), "application/json");
      await this.active(job, signal); await this.current(job);
      return await this.store.update(job.ownerId, job.id, current => { requireCondition(current.status === "running", "render-cancelled"); return { ...current, status: "proof", updatedAt: now(), photos, files, blockers, events: [...current.events, event(current, "proof-completed")] }; });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = controller.signal.aborted || external?.aborted ? "render-cancelled" : signal.aborted ? "render-timeout" : safeErrors.has(message) ? message : "render-image-unavailable";
      await this.store.removeFiles(job.ownerId, job.id);
      return await this.store.update(job.ownerId, job.id, current => current.status !== "running" ? current : { ...current, status: code === "render-cancelled" ? "cancelled" : "failed", errorCode: code, updatedAt: now(), files: [], photos: [], events: [...current.events, event(current, code)] });
    } finally { controllers.delete(job.id); }
  }
  async cancel(owner: string, id: string) {
    const result = await this.store.update(owner, id, job => job.status !== "running" ? job : { ...job, status: "cancelled", updatedAt: now(), events: [...job.events, event(job, "cancelled")] });
    controllers.get(id)?.abort(); return result;
  }
  async retry(owner: string, id: string, signal?: AbortSignal) {
    const previous = await this.get(owner, id); await this.current(previous);
    const job = await this.store.update(owner, id, current => {
      requireCondition(current.status === "failed" || current.status === "cancelled", "render-in-progress", 409);
      requireCondition(current.attempt < renderPolicy.maxAttempts && !controllers.has(id), "render-retry-limit", 409);
      return { ...current, status: "running", attempt: current.attempt + 1, updatedAt: now(), expiresAt: new Date(Date.now() + renderPolicy.timeoutMs).toISOString(), errorCode: undefined, files: [], photos: [], progress: 0, events: [...current.events, event(current, "retry-requested")] };
    }, true);
    await this.store.removeFiles(owner, id); return this.execute(job, signal);
  }
  async approve(owner: string, id: string) {
    const job = await this.get(owner, id); await this.current(job);
    requireCondition(job.status === "proof", "render-proof-required", 409);
    requireCondition(job.blockers.length === 0 && finalRenderBlockers(job.board).length === 0, "render-review-required", 409);
    requireCondition(photoCaption(job.board).length <= 2200, "render-caption-too-long", 409);
    const data: Record<string, Uint8Array> = {};
    for (const file of job.files) { const bytes = await this.store.bytes(owner, id, file.name); requireCondition(sha256(bytes) === file.sha256, "render-artifact-unavailable"); data[file.name] = bytes; }
    const approvalHash = digest(job.files); const time = now();
    data["approval.json"] = strToU8(JSON.stringify({ approvedAt: time, approvedBy: owner, proofHash: approvalHash, storyboardHash: digest(job.board), notice: "Approved for final graphic download; publishing not authorized." }, null, 2));
    const zip = Buffer.from(zipSync(data, { level: 0, mtime: new Date(2000, 0, 1) }));
    requireCondition(zip.length <= renderPolicy.maxJobBytes / 2, "render-storage-full");
    await this.current(job);
    return this.store.lock(async () => {
      const current = await this.store.read(owner, id); requireCondition(current.status === "proof" && digest(current.files) === approvalHash, "render-proof-required", 409);
      await this.store.write(owner, id, "instagram.zip", zip);
      const approved: RenderJob = { ...current, status: "approved", approvedAt: time, approvedBy: owner, approvalHash, updatedAt: time, files: [...current.files, { name: "instagram.zip", bytes: zip.length, sha256: sha256(zip), type: "application/zip" }], events: [...current.events, event(current, "proof-and-alt-text-approved")] };
      await this.store.write(owner, id, "job.json", Buffer.from(JSON.stringify(approved))); return approved;
    });
  }
  async download(owner: string, id: string, name: string, proof: boolean) {
    const job = await this.get(owner, id); await this.current(job);
    requireCondition(job.status === "approved" || proof && job.status === "proof" && /^slide-0[1-8]\.png$/.test(name), "render-not-approved", 403);
    const file = job.files.find(f => f.name === name); requireCondition(file, "render-artifact-unavailable", 404);
    const bytes = await this.store.bytes(owner, id, name); requireCondition(sha256(bytes) === file.sha256, "render-artifact-unavailable");
    return { bytes, file };
  }
  async remove(owner: string, id: string) {
    await this.store.update(owner, id, job => { requireCondition(job.status !== "running" && !controllers.has(id), "render-in-progress", 409); return { ...job, status: "deleted", updatedAt: now(), files: [], photos: [], events: [...job.events, event(job, "files-deleted")] }; });
    await this.store.removeFiles(owner, id); return this.store.read(owner, id);
  }
}
