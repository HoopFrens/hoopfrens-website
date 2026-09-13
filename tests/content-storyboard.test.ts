import assert from "node:assert/strict";
import test from "node:test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { startStoryboard, validateStoryboard, storyIssues, type Storyboard, type StoryAsset } from "@/domain/content-intelligence/storyboard";
import type { ResearchPackage } from "@/domain/content-intelligence/types";
import { IntelligenceRepository, collections, digest } from "@/server/content-intelligence/repository";

export const storyboardResearch: ResearchPackage = {
  id: "research-story-fixture", kind: "governed-research", version: 1, revision: 2,
  binding: { projectId: "story-fixture-project", packageId: "fixture-package-v2", version: 2, schoolId: "school-malone-university", ownerId: "story-fixture-owner", workspaceId: "executive-workspace", contentHash: "fixture-only", schoolName: "Malone University" },
  sources: [{ id: "source-fixture", url: "https://malonepioneers.com/fixture", title: "Synthetic test evidence", accessedAt: "2026-09-09T00:00:00Z", contentHash: "fixture-source" }],
  claims: [1, 2].map(n => ({ id: `claim-${n}`, field: `fixture-${n}`, value: String(n), text: `Synthetic basketball detail ${n}.`, evidence: [{ sourceId: "source-fixture", quote: `Synthetic basketball detail ${n}.` }], confidence: "supported", review: { decision: "supported", actorId: "story-fixture-owner", at: "2026-09-09T00:00:00Z" } })),
  missingInformation: [], conflicts: [], createdAt: "2026-09-09T00:00:00Z", policyVersion: "fixture", originatingRunId: "fixture-run",
};
const brief = { type: "court", audience: "Athletes and parents", action: "Save for a visit", angle: "Fixture-only court story" } as const;
const starter = () => startStoryboard(storyboardResearch, brief, 4, ["claim-1", "claim-2"]);
const asset: StoryAsset = { id: "photo-fixture", label: "Fixture gym", imageUrl: "https://malonepioneers.com/images/fixture.jpg", sourceUrl: "https://malonepioneers.com/fixture", credit: "Fixture credit", capturedOn: "", rights: "pending", permissionNote: "" };
const persisted = (board = starter()): Storyboard => ({ ...board, id: "storyboard-fixture", kind: "instagram-storyboard", revision: 1, binding: storyboardResearch.binding, researchPackageId: storyboardResearch.id, researchRevision: 2, updatedAt: storyboardResearch.createdAt, updatedBy: storyboardResearch.binding.ownerId });

test("starter makes a school-specific story, preserves approved facts and exposes missing coverage", () => {
  const board = starter();
  assert.match(board.slides[0].headline, /Malone/);
  assert.equal(board.slides[1].body, storyboardResearch.claims[0].text);
  assert.equal(board.slides.at(-1)?.role, "takeaway");
  assert.deepEqual(validateStoryboard(board, storyboardResearch), board);
  assert.ok(storyIssues(board).some(i => i.message.includes("choose a photo")));
  const sparse = startStoryboard(storyboardResearch, brief, 8, ["claim-1"]);
  assert.equal(sparse.slides.filter(s => s.claimIds.length).length, 1);
  assert.ok(storyIssues(sparse).some(i => i.message.includes("select supporting evidence")));
});
test("storyboards reject invented/rejected evidence, fake binding fields and malformed inputs", () => {
  const board = starter(); board.slides[1].claimIds = ["invented"];
  assert.throws(() => validateStoryboard(board, storyboardResearch), /unsupported-claim/);
  const unapproved = structuredClone(storyboardResearch); unapproved.claims[0].confidence = "rejected";
  assert.throws(() => validateStoryboard(starter(), unapproved), /unsupported-claim/);
  assert.throws(() => validateStoryboard({ ...starter(), binding: {} }, storyboardResearch), /invalid-storyboard/);
  for (const mutate of [(b: ReturnType<typeof starter>) => b.slides[0].headline = "", (b: ReturnType<typeof starter>) => b.slides[0].focalX = Infinity, (b: ReturnType<typeof starter>) => b.slides[0].assetId = "missing"]) {
    const b = starter(); mutate(b); assert.throws(() => validateStoryboard(b, storyboardResearch));
  }
});
test("photo references enforce approved HTTPS hosts, safe image types and permission notes", () => {
  for (const url of ["https://127.0.0.1/fixture.jpg", "https://malonepioneers.com.evil.test/fixture.jpg", "http://malonepioneers.com/a.jpg", "https://user:pass@malonepioneers.com/a.jpg", "https://malonepioneers.com/a.svg", "data:image/png;base64,abc"]) {
    const b = starter(); b.assets = [{ ...asset, imageUrl: url }]; assert.throws(() => validateStoryboard(b, storyboardResearch));
  }
  const b = starter(); b.assets = [{ ...asset, rights: "cleared" }];
  assert.throws(() => validateStoryboard(b, storyboardResearch), /photo-permission-required/);
  b.assets[0].permissionNote = "Fixture permission only";
  assert.equal(validateStoryboard(b, storyboardResearch).assets[0].rights, "cleared");
  b.assets[0].capturedOn = "2026-02-30"; assert.throws(() => validateStoryboard(b, storyboardResearch));
});
test("saved locks protect slide copy, position, deletion and referenced asset even during unlock", () => {
  const previous = persisted(); previous.assets = [asset]; previous.slides[1].assetId = asset.id; previous.slides[1].locked = true;
  const content = () => { const { brief, slides, assets, caption, captionReviewed } = structuredClone(previous); return { brief, slides, assets, caption, captionReviewed }; };
  const unlock = content(); unlock.slides[1].locked = false;
  assert.doesNotThrow(() => validateStoryboard(unlock, storyboardResearch, previous));
  unlock.slides[1].headline = "Changed during unlock"; assert.throws(() => validateStoryboard(unlock, storyboardResearch, previous), /story-slide-locked/);
  const removed = content(); removed.slides.splice(1, 1); assert.throws(() => validateStoryboard(removed, storyboardResearch, previous), /story-slide-locked/);
  const reordered = content(); [reordered.slides[1], reordered.slides[2]] = [reordered.slides[2], reordered.slides[1]]; assert.throws(() => validateStoryboard(reordered, storyboardResearch, previous), /story-slide-locked/);
  const changedAsset = content(); changedAsset.assets[0].imageUrl = "https://malonepioneers.com/changed.jpg"; assert.throws(() => validateStoryboard(changedAsset, storyboardResearch, previous), /story-slide-locked/);
  const other = content(); other.slides[2].headline = "An independent edit"; assert.doesNotThrow(() => validateStoryboard(other, storyboardResearch, previous));
});
test("readiness distinguishes permission/copy review from repeated imagery and never approves publication", () => {
  const b = starter(); b.assets = [asset]; b.slides.forEach(s => { s.assetId = asset.id; s.copyReviewed = true; }); b.captionReviewed = true;
  assert.ok(storyIssues(b).some(i => i.message.includes("permission")));
  b.assets[0] = { ...asset, rights: "cleared", permissionNote: "Fixture only" };
  assert.equal(storyIssues(b).filter(i => i.severity === "review").length, 0);
  assert.ok(storyIssues(b).some(i => i.severity === "suggestion" && i.message.includes("repeats")));
});
test("storyboard saves preserve immutable audit revisions, scope and concurrency without budget or canonical writes", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const app = initializeApp({ projectId: `demo-storyboard-${process.pid}` }, "storyboard-test");
  const db = getFirestore(app); const repository = new IntelligenceRepository(db);
  const { approvedMaloneFixture } = await import("./content-intelligence-fixture");
  const { pkg, project } = await approvedMaloneFixture();
  try {
    await db.collection("users").doc(project.ownerId).set({ role: "admin" });
    await db.collection("internalProjects").doc(project.id).set(project);
    await db.collection("internalProductionPackages").doc(pkg.id).set(pkg);
    const binding = await db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId));
    const research = { ...storyboardResearch, binding };
    await repository.ref(collections.research, research.id).set(research);
    const before = digest((await db.collection("internalProductionPackages").doc(pkg.id).get()).data());
    const save = (revision: number, board = starter(), owner = project.ownerId, evidenceRevision = 2) => repository.saveStoryboard(research.id, owner, evidenceRevision, revision, board);
    await assert.rejects(save(0, starter(), "wrong-owner"), /record-not-available/);
    await assert.rejects(save(0, starter(), project.ownerId, 1), /research-review-changed/);
    const first = await save(0); assert.equal(first.revision, 1); assert.equal(first.binding.contentHash, binding.contentHash);
    const changed = starter(); changed.slides[1].headline = "Revised fixture heading";
    const concurrent = await Promise.allSettled([save(1, changed), save(1, starter())]);
    assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
    const snapshot = (await repository.ref(collections.storyboardVersions, `${first.id}-v1`).get()).data()!;
    assert.equal(snapshot.slides[1].headline, first.slides[1].headline);
    const stored = (await repository.ref(collections.storyboards, first.id).get()).data()!;
    assert.equal(stored.revision, 2);
    assert.equal((await repository.renderSnapshot(first.id, 2, project.ownerId)).board.revision, 2);
    await assert.rejects(repository.renderSnapshot(first.id, 1, project.ownerId), /storyboard-revision-changed/);
    await assert.rejects(repository.renderSnapshot(first.id, 2, "wrong-owner"), /record-not-available/);
    assert.equal((await repository.state(project.ownerId)).storyboards.length, 1);
    assert.equal((await db.collection(collections.budget).get()).size, 0);
    assert.equal((await db.collection(collections.runs).get()).size, 0);
    assert.equal(digest((await db.collection("internalProductionPackages").doc(pkg.id).get()).data()), before);
    await db.collection("internalProductionPackages").doc(pkg.id).update({ instagramCaption: "Changed approved content" });
    await assert.rejects(save(2), /approved-version-changed/);
    await assert.rejects(repository.renderSnapshot(first.id, 2, project.ownerId), /approved-version-changed/);
  } finally { await db.terminate(); await deleteApp(app); }
});
