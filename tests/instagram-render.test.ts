import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile, symlink, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { unzipSync } from "fflate";
import type { ResearchPackage } from "@/domain/content-intelligence/types";
import { startStoryboard, type Storyboard } from "@/domain/content-intelligence/storyboard";
import { finalRenderBlockers, renderPolicy } from "@/domain/content-intelligence/rendering";
import { RenderStore, localRenderRoot } from "@/server/instagram-render/store";
import { RenderService } from "@/server/instagram-render/service";
import { renderSlide, cropRect } from "@/server/instagram-render/renderer";
import { approvedPhotoRedirect, decodePhoto, sha256 } from "@/server/instagram-render/media";

const research: ResearchPackage = {
  id: "render-fixture-research", kind: "governed-research", version: 1, revision: 2, createdAt: "2026-09-10T00:00:00Z", originatingRunId: "fixture-run", policyVersion: "test", conflicts: [], missingInformation: [],
  binding: { schoolId: "school-malone-university", schoolName: "Malone University", ownerId: "fixture-owner", projectId: "fixture-project", packageId: "fixture-package", version: 2, workspaceId: "executive-workspace", contentHash: "synthetic-only" },
  sources: [{ id: "fixture-source", url: "https://malonepioneers.com/fixture", title: "Synthetic test evidence", contentHash: "fixture-hash", accessedAt: "2026-09-10T00:00:00Z" }],
  claims: [{ id: "claim-1", field: "fixture", value: "test", text: "Synthetic basketball detail for testing.", confidence: "supported", review: { actorId: "fixture-owner", at: "2026-09-10T00:00:00Z", decision: "supported" }, evidence: [{ sourceId: "fixture-source", quote: "Synthetic basketball detail for testing." }] }],
};
function board(): Storyboard {
  const b = startStoryboard(research, { type: "court", audience: "Athletes and parents", action: "Save for a visit", angle: "Synthetic fixture" }, 3, ["claim-1"]);
  b.slides.forEach(s => { s.layout = "text"; s.copyReviewed = true; }); b.captionReviewed = true;
  return { ...b, id: "storyboard-render-fixture", kind: "instagram-storyboard", revision: 1, binding: research.binding, researchPackageId: research.id, researchRevision: research.revision, updatedAt: research.createdAt, updatedBy: research.binding.ownerId };
}
const photoBoard = (cleared = true) => {
  const b = board(); b.assets = [{ id: "fixture-photo", label: "Synthetic color field", imageUrl: "https://malonepioneers.com/images/fixture.png", sourceUrl: "https://malonepioneers.com/fixture", credit: "Test fixture", capturedOn: "", rights: cleared ? "cleared" : "pending", permissionNote: cleared ? "Synthetic test fixture only" : "" }];
  b.slides[0].layout = "photo"; b.slides[0].assetId = b.assets[0].id; return b;
};
async function setup(b = board(), retrieve?: ConstructorParameters<typeof RenderService>[2]) {
  const root = await mkdtemp(path.join(tmpdir(), "hf-render-test-")); const store = new RenderStore(root);
  let stale = false;
  const snapshot = async (id: string, revision: number, owner: string) => { assert.equal(owner, b.binding.ownerId); if (stale || id !== b.id || revision !== b.revision) throw new Error("storyboard-revision-changed"); return { board: b, research }; };
  return { store, service: new RenderService(store, snapshot, retrieve), root, b, stale: () => { stale = true; }, clean: () => rm(root, { recursive: true, force: true }) };
}
test("renderer creates deterministic exact-size PNGs and rejects overflow and unsupported glyphs", async () => {
  const b = board(); const first = await renderSlide(b, 0); const second = await renderSlide(b, 0);
  assert.equal(sha256(first.bytes), sha256(second.bytes));
  const meta = await sharp(first.bytes).metadata(); assert.equal(meta.width, 1080); assert.equal(meta.height, 1350); assert.equal(meta.format, "png");
  assert.ok(first.typography.headline >= 64); assert.ok(first.typography.body >= 32);
  b.slides[0].headline = "W".repeat(100); await assert.rejects(renderSlide(b, 0), /render-text-does-not-fit/);
  b.slides[0].headline = "Basketball 🏀"; await assert.rejects(renderSlide(b, 0), /render-glyph-unsupported/);
  assert.deepEqual(cropRect(2000, 1000, 1080, 710, 0, 0), { left: 0, top: 0, width: 1521, height: 1000 });
  assert.equal(cropRect(2000, 1000, 1080, 710, 100, 100).left, 479);
});
test("image intake rejects SVG, oversized and truncated bytes and strips image metadata", async () => {
  await assert.rejects(decodePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>')), /render-image-rejected/);
  await assert.rejects(decodePhoto(Buffer.alloc(renderPolicy.maxImageBytes + 1)), /render-image-rejected/);
  await assert.rejects(decodePhoto(Buffer.from([137, 80, 78, 71])), /render-image-rejected/);
  const bytes = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "red" } }).jpeg().toBuffer();
  const decoded = await decodePhoto(bytes); assert.equal(decoded.originalHash, sha256(bytes)); assert.equal(decoded.width, 1200);
  assert.equal((await sharp(decoded.image).metadata()).exif, undefined);
});
test("media redirects permit only the observed Malone image delivery path, never arbitrary proxy targets", () => {
  const source = new URL("https://malonepioneers.com/images/2026/gym.jpg");
  const original = "https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/malonepioneers.com/images/2026/gym.jpg";
  const proxy = (target: string) => `https://images.sidearmdev.com/convert?url=${encodeURIComponent(target)}&type=webp`;
  assert.equal(approvedPhotoRedirect(proxy(original), ["malonepioneers.com"], source).hostname, "images.sidearmdev.com");
  for (const target of ["http://127.0.0.1/secret", original.replace("malonepioneers.com/", "other-school/"), original + "?other=true", original.replace("gym.jpg", "other.jpg")]) assert.throws(() => approvedPhotoRedirect(proxy(target), ["malonepioneers.com"], source));
  assert.throws(() => approvedPhotoRedirect(proxy(original) + "&url=http://127.0.0.1/", ["malonepioneers.com"], source));
  assert.throws(() => approvedPhotoRedirect(proxy(original), ["goashlandeagles.com"], new URL("https://goashlandeagles.com/images/2026/gym.jpg")));
});
test("proof approval preserves exact PNG hashes and ordered ZIP, while downloads remain protected", async () => {
  const x = await setup(); const owner = x.b.binding.ownerId;
  try {
    const proof = await x.service.start(owner, x.b.id, 1, "request-a"); assert.equal(proof.status, "proof");
    assert.equal(proof.files.filter(f => f.type === "image/png").length, 3);
    assert.equal((await x.service.start(owner, x.b.id, 1, "request-a")).id, proof.id);
    assert.equal((await x.store.list(owner)).length, 1);
    await assert.rejects(x.service.download(owner, proof.id, "slide-01.png", false), /render-not-approved/);
    await assert.rejects(x.service.download("other-owner", proof.id, "slide-01.png", true));
    assert.ok((await x.service.download(owner, proof.id, "slide-01.png", true)).bytes.length > 1000);
    const approved = await x.service.approve(owner, proof.id); assert.equal(approved.status, "approved");
    const archive = await x.service.download(owner, proof.id, "instagram.zip", false); const entries = unzipSync(archive.bytes);
    assert.deepEqual(Object.keys(entries), ["slide-01.png", "slide-02.png", "slide-03.png", "caption.txt", "alt-text.txt", "sources.json", "approval.json"]);
    assert.equal(sha256(entries["slide-01.png"]), proof.files[0].sha256);
    const sources = JSON.parse(Buffer.from(entries["sources.json"]).toString()); assert.equal(sources.research.revision, 2); assert.equal(sources.binding.contentHash, research.binding.contentHash);
    const secondStore = new RenderStore(x.root); assert.equal((await secondStore.read(owner, proof.id)).status, "approved");
    assert.equal((await stat(await x.store.ownerDir(owner))).mode & 0o077, 0);
    assert.equal((await stat(path.join(await x.store.dir(owner, proof.id), "slide-01.png"))).mode & 0o077, 0);
    await x.service.remove(owner, proof.id); await assert.rejects(x.service.download(owner, proof.id, "instagram.zip", false));
    assert.deepEqual(await readdir(await x.store.dir(owner, proof.id)), ["job.json"]);
  } finally { await x.clean(); }
});
test("unknown photo rights do not block proofs; inadequate resolution still blocks approval", async () => {
  const bytes = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#eaeaea" } }).png().toBuffer();
  const x = await setup(photoBoard(false), async () => ({ bytes, resolvedUrl: "https://malonepioneers.com/images/fixture.png" }));
  try {
    assert.equal(finalRenderBlockers(x.b).some(b => b.includes("permission")), false);
    const job = await x.service.start(x.b.binding.ownerId, x.b.id, 1, "rights-test"); assert.equal(job.status, "proof");
    assert.ok(job.blockers.some(b => b.includes("upscaling"))); assert.equal(job.blockers.some(b => b.includes("permission")), false);
    await assert.rejects(x.service.approve(job.ownerId, job.id), /render-review-required/);
  } finally { await x.clean(); }
});
test("changed source binding and changed artifact bytes invalidate approval/download", async () => {
  const x = await setup();
  try {
    const job = await x.service.start(x.b.binding.ownerId, x.b.id, 1, "stale-test");
    await x.store.write(job.ownerId, job.id, "slide-01.png", Buffer.from("tampered"));
    await assert.rejects(x.service.approve(job.ownerId, job.id), /render-artifact-unavailable/);
    await assert.rejects(x.service.download(job.ownerId, job.id, "slide-01.png", true), /render-artifact-unavailable/);
    x.stale(); await assert.rejects(x.service.download(job.ownerId, job.id, "slide-02.png", true), /storyboard-revision-changed/);
    await assert.rejects(x.service.approve(job.ownerId, job.id), /storyboard-revision-changed/);
  } finally { await x.clean(); }
});
test("cancellation prevents completion and simultaneous jobs, then permits only one explicit retry", async () => {
  let entered!: () => void; const ready = new Promise<void>(r => { entered = r; });
  let calls = 0;
  const x = await setup(photoBoard(), async (_url, _domains, signal) => {
    calls++; entered();
    if (calls > 1) throw new Error("render-image-unavailable");
    await new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("render-cancelled")), { once: true }));
    throw new Error("unreachable");
  });
  try {
    const run = x.service.start(x.b.binding.ownerId, x.b.id, 1, "cancel-test"); await ready;
    const job = (await x.store.list(x.b.binding.ownerId))[0];
    await assert.rejects(x.service.start(job.ownerId, x.b.id, 1, "simultaneous"), /render-in-progress/);
    await x.service.cancel(job.ownerId, job.id); assert.equal((await run).status, "cancelled");
    assert.deepEqual(await readdir(await x.store.dir(job.ownerId, job.id)), ["job.json"]);
    assert.equal((await x.service.retry(job.ownerId, job.id)).status, "failed");
    await assert.rejects(x.service.retry(job.ownerId, job.id), /render-retry-limit/);
    assert.equal(calls, 2);
  } finally { await x.clean(); }
});
test("interrupted job status is durable and private store refuses symlink artifacts", async () => {
  const x = await setup();
  try {
    const j = await x.service.start(x.b.binding.ownerId, x.b.id, 1, "expiry-test");
    await x.store.update(j.ownerId, j.id, current => ({ ...current, status: "running", expiresAt: "2000-01-01T00:00:00Z" }));
    assert.equal((await x.service.get(j.ownerId, j.id)).errorCode, "render-timeout");
    const dir = await x.store.dir(j.ownerId, j.id); await rm(path.join(dir, "slide-01.png"));
    await writeFile(path.join(x.root, "outside.txt"), "must not expose"); await symlink(path.join(x.root, "outside.txt"), path.join(dir, "slide-01.png"));
    await assert.rejects(x.store.bytes(j.ownerId, j.id, "slide-01.png"), /render-artifact-unavailable/);
    await assert.rejects(x.store.bytes(j.ownerId, j.id, "../../outside.txt"));
  } finally { await x.clean(); }
});
test("render routes deny signed-out, external-host and cross-origin requests before rendering", async () => {
  const route = await import("@/app/api/instagram-render/route");
  assert.equal((await route.GET(new Request("http://localhost:3017/api/instagram-render?boardId=fixture"))).status, 401);
  assert.equal((await route.GET(new Request("https://hoopfrens.com/api/instagram-render?boardId=fixture"))).status, 403);
  assert.equal((await route.POST(new Request("http://localhost:3017/api/instagram-render", { method: "POST", headers: { Origin: "https://other.example" } }))).status, 403);
  const old = process.env.HOOPFRENS_RENDERING_MODE;
  try { delete process.env.HOOPFRENS_RENDERING_MODE; assert.throws(localRenderRoot, /rendering-local-only/); }
  finally { if (old !== undefined) process.env.HOOPFRENS_RENDERING_MODE = old; }
});

test("credited photos with unknown rights can export without forging a permission record", async () => {
  const bytes = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#eaeaea" } }).png().toBuffer();
  const x = await setup(photoBoard(false), async () => ({ bytes, resolvedUrl: "https://malonepioneers.com/images/fixture.png" }));
  try {
    const proof = await x.service.start(x.b.binding.ownerId, x.b.id, 1, "unknown-rights-export");
    assert.equal(proof.status,"proof"); assert.deepEqual(proof.blockers,[]);
    const approved = await x.service.approve(proof.ownerId,proof.id);
    const archive = await x.service.download(proof.ownerId,proof.id,"instagram.zip",false);
    const entries=unzipSync(archive.bytes);
    assert.match(Buffer.from(entries["caption.txt"]).toString(),/Photo credits \/ sources: Test fixture/);
    const manifest=JSON.parse(Buffer.from(entries["sources.json"]).toString());
    assert.equal(manifest.photos[0].permission.rights,"pending");
    assert.equal(manifest.photos[0].permission.permissionNote,"");
    assert.equal(approved.board.assets[0].rights,"pending");
  } finally { await x.clean(); }
});
