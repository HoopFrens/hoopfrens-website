import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc, setLogLevel } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { publicAddress } from "@/server/content-intelligence/sources";
import { Gateway } from "@/server/content-intelligence/gateway";
import { IntelligenceRepository, collections, assertBinding } from "@/server/content-intelligence/repository";
import { authenticate, authenticationFailure } from "@/server/content-intelligence/firebase";
import type { Run, PackageBinding } from "@/domain/content-intelligence/types";
import type { SchoolSpotlightPackage } from "@/domain/founder-simple/types";

setLogLevel("silent");

const binding: PackageBinding = { projectId: "project-fixture", packageId: "package-fixture", version: 2, schoolId: "school-malone-university", ownerId: "founder", workspaceId: "executive-workspace", schoolName: "Malone University", contentHash: "fixture" };
const run: Run = { id: "run-fixture", ownerId: "founder", binding, kind: "research", inputHash: "fixture", status: "running", createdAt: "2026-09-06T12:00:00Z", updatedAt: "2026-09-06T12:00:00Z", expiresAt: "2099-01-01T00:00:00Z", reservedMicros: 500_000, budgetMonth: "2026-09", callBoundMicros: 0, calls: [] };

test("private and special IP representations cannot enter source fetch", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.169.254", "172.16.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fe80::1", "198.18.1.1"]) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("absent authentication fails before server configuration or provider use", async () => {
  await assert.rejects(authenticate(new Request("https://local.test/api/content-intelligence")), /sign-in-required/);
});
test("wrong-owner and stale version bindings fail before package hydration validation", () => {
  const pkg = { ...binding, id: binding.packageId, active: true } as unknown as SchoolSpotlightPackage;
  assert.throws(() => assertBinding({ ownerId: "other" }, pkg, "founder"), /record-not-available/);
  assert.throws(() => assertBinding({ ownerId: "founder", state: "review" }, pkg, "founder"), /approved-version-required/);
});
test("gateway retries eligible errors once, redacts provider errors, and records each attempt", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-credential";
  let attempts = 0; let recorded = 0;
  const repository = { checkRun: async () => {}, recordCall: async () => recorded++, finishCall: async () => {} } as unknown as IntelligenceRepository;
  const transport: typeof fetch = async () => { attempts++; return new Response("sensitive-provider-error-body", { status: 429 }); };
  const gateway = new Gateway(repository, run, new AbortController().signal, transport);
  await assert.rejects(gateway.call("test", { input: "safe fixture" }), error => error instanceof Error && error.message === "provider-request-failed");
  assert.equal(attempts, 2); assert.equal(recorded, 2); delete process.env.OPENAI_API_KEY;
});
test("ambiguous network failures never retry and cancellation never dispatches", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-credential";
  let attempts = 0;
  const repository = { checkRun: async () => {}, recordCall: async () => 0, finishCall: async () => {} } as unknown as IntelligenceRepository;
  const transport: typeof fetch = async () => { attempts++; throw new Error("do not expose this"); };
  await assert.rejects(new Gateway(repository, run, new AbortController().signal, transport).call("test", {}), /provider-connection-failed/);
  assert.equal(attempts, 1);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(new Gateway(repository, run, abort.signal, transport).call("test", {})); assert.equal(attempts, 1);
  delete process.env.OPENAI_API_KEY;
});

test("server collections deny browser admins, members and unauthenticated clients", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  const environment = await initializeTestEnvironment({ projectId: "demo-content-intelligence-rules", firestore: { host, port: Number(port), rules: await readFile("firestore.rules", "utf8") } });
  try {
    await environment.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), "users", "founder"), { role: "admin" }); });
    for (const context of [environment.authenticatedContext("founder"), environment.authenticatedContext("member"), environment.unauthenticatedContext()]) {
      for (const collection of Object.values(collections)) {
        const ref = doc(context.firestore(), collection, "fixture");
        await assertFails(setDoc(ref, { ownerId: "founder", published: true })); await assertFails(getDoc(ref)); await assertFails(deleteDoc(ref));
      }
    }
  } finally { await environment.cleanup(); }
});

test("durable reservations serialize concurrent requests, deduplicate retries, and never release cancelled spend", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const app = initializeApp({ projectId: `demo-content-intelligence-repository-${process.pid}` }, "content-intelligence-test");
  const db = getFirestore(app);
  const repository = new IntelligenceRepository(db);
  // Isolate transaction semantics from the separately tested canonical package validation.
  repository.binding = async (_tx, _project, ownerId) => ({ ...binding, ownerId });
  try {
    const jobs = await Promise.allSettled([repository.begin("concurrent", binding.projectId, "request-a", "research", {}), repository.begin("concurrent", binding.projectId, "request-b", "research", {})]);
    assert.equal(jobs.filter(job => job.status === "fulfilled").length, 1);
    const first = jobs.find(job => job.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof repository.begin>>>;
    const id = first.value.run.id;
    const requestId = jobs[0].status === "fulfilled" ? "request-a" : "request-b";
    const duplicate = await repository.begin("concurrent", binding.projectId, requestId, "research", {});
    assert.equal(duplicate.created, false); assert.equal(duplicate.run.id, id);
    await assert.rejects(repository.begin("concurrent", binding.projectId, requestId, "generate", {}), /request-id-reused/);
    await assert.rejects(repository.cancel(id, "wrong-owner"), /record-not-available/);
    await repository.cancel(id, "concurrent");
    assert.equal((await repository.getRun(id, "concurrent")).status, "cancelled");
    await assert.rejects(repository.recordCall(first.value.run, { stage: "late", attempt: 1, boundMicros: 1, status: "started", startedAt: new Date().toISOString() }), /request-cancelled/);
    const month = new Date().toISOString().slice(0, 7);
    const budgetRef = repository.ref(collections.budget, month);
    assert.equal((await budgetRef.get()).data()?.reservedMicros, 500_000);
    await budgetRef.set({ reservedMicros: 9_500_000 });
    const boundary = await Promise.allSettled([repository.begin("budget-a", binding.projectId, "cap-a", "research", {}), repository.begin("budget-b", binding.projectId, "cap-b", "research", {})]);
    assert.equal(boundary.filter(job => job.status === "fulfilled").length, 1);
    assert.equal((await budgetRef.get()).data()?.reservedMicros, 10_000_000);
  } finally { await db.terminate(); await deleteApp(app); }
});


test("real package validation binds the approved version and rejects changed content before save", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const { approvedMaloneFixture } = await import("./content-intelligence-fixture");
  const { pkg, project } = await approvedMaloneFixture();
  const app = initializeApp({ projectId: `demo-content-intelligence-binding-${process.pid}` }, "binding-fixture");
  const db = getFirestore(app); const repository = new IntelligenceRepository(db);
  try {
    await db.collection("users").doc(project.ownerId).set({ role: "admin" });
    await db.collection("internalProjects").doc(project.id).set(project);
    await db.collection("internalProductionPackages").doc(pkg.id).set(pkg);
    const binding = await db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId));
    assert.equal(binding.version, 2); assert.equal(binding.schoolId, "school-malone-university");
    const before = await db.collection("internalProductionPackages").doc(pkg.id).get();
    const { run } = await repository.begin(project.ownerId, project.id, "exact-version-request", "research", {});
    await db.collection("internalProductionPackages").doc(pkg.id).update({ instagramCaption: "Changed fixture copy" });
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId, run.binding)), /approved-version-changed/);
    await repository.cancel(run.id, project.ownerId);
    await db.collection("internalProductionPackages").doc(pkg.id).set(before.data()!);
    await db.collection("internalProjects").doc(project.id).update({ approvedSchoolSpotlightPackageVersion: 1 });
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId)), /approved-version-required/);
    await db.collection("internalProjects").doc(project.id).set(project);
    await db.collection("users").doc(project.ownerId).set({ role: "member" });
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId)), /administrator-required/);
  } finally { await db.terminate(); await deleteApp(app); }
});


test("released split-package storage hydrates all seven integrity parts and rejects tampering", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const { approvedMaloneFixture } = await import("./content-intelligence-fixture");
  const { createFirestoreProjectRepository } = await import("@/domain/project/firestoreProjectRepository");
  const { pkg, project } = await approvedMaloneFixture();
  const projectId = `demo-content-intelligence-split-${process.pid}`;
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  const environment = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port) } });
  const app = initializeApp({ projectId }, "split-binding-fixture");
  const db = getFirestore(app); const repository = new IntelligenceRepository(db);
  try {
    // Seed through the released client serializer, only in an isolated emulator project.
    await environment.withSecurityRulesDisabled(async context => {
      const client = context.firestore() as unknown as import("firebase/firestore").Firestore;
      const fullProject = { ...project, createdAt: pkg.createdAt, updatedAt: pkg.updatedAt, workspaceHistory: [], stateHistory: [], version: 1 };
      await setDoc(doc(client, "users", project.ownerId), { role: "admin" });
      await setDoc(doc(client, "internalProjects", project.id), fullProject);
      await createFirestoreProjectRepository(client, project.ownerId).updateWithArtifacts(project.id, {}, [pkg]);
    });
    const binding = await db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId));
    assert.equal(binding.version, 2);
    const contentRef = db.collection("internalSchoolSpotlightPackageContent").doc(pkg.id);
    const content = (await contentRef.get()).data()!;
    await contentRef.update({ instagramCaption: "Changed after approval fixture" });
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId, binding)), /approved-version-changed/);
    await contentRef.set(content);
    await contentRef.update({ workflowDraftId: "another-workflow" });
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId)), /package-integrity-failed/);
    await contentRef.set(content);
    const factsRef = db.collection("internalSchoolSpotlightPackageFactsA").doc(`${pkg.id}-1`);
    const facts = (await factsRef.get()).data()!;
    await factsRef.update({ ownerId: "other-owner" });
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId)), /package-integrity-failed/);
    await factsRef.set(facts);
    await factsRef.delete();
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId)), /package-integrity-failed/);
    await factsRef.set(facts);
    const rebound = await db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId, binding));
    assert.equal(rebound.contentHash, binding.contentHash);
    await db.collection("internalProductionPackages").doc(pkg.id).update({ status: "staged" });
    await assert.rejects(db.runTransaction(tx => repository.binding(tx, project.id, project.ownerId)));
  } finally { await environment.cleanup(); await db.terminate(); await deleteApp(app); }
});


test("authentication failures distinguish expired sign-in from unavailable server credentials without leaking details", () => {
  assert.equal(authenticationFailure({ code: "auth/id-token-expired", message: "private fixture detail" }).status, 401);
  assert.equal(authenticationFailure({ code: "auth/id-token-revoked" }).code, "sign-in-required");
  const unavailable = authenticationFailure({ code: "app/invalid-credential", message: "private fixture detail" });
  assert.equal(unavailable.status, 503); assert.equal(unavailable.message, "server-connection-unavailable");
  assert.equal(authenticationFailure(new Error("private fixture detail")).message, "server-connection-unavailable");
});


test("disabled gateway rejects paid work before reservations or provider calls", async () => {
  const { runIntelligence } = await import("@/server/content-intelligence/service");
  const original = process.env.HOOPFRENS_CONTENT_INTELLIGENCE_ENABLED;
  delete process.env.HOOPFRENS_CONTENT_INTELLIGENCE_ENABLED;
  let reservations = 0;
  const repository = { begin: async () => { reservations++; throw new Error("must not reserve"); } } as unknown as IntelligenceRepository;
  try {
    await assert.rejects(runIntelligence(repository, "founder", { kind: "research", projectId: "fixture", requestId: "fixture" }, new AbortController().signal), /gateway-not-enabled/);
    assert.equal(reservations, 0);
  } finally {
    if (original === undefined) delete process.env.HOOPFRENS_CONTENT_INTELLIGENCE_ENABLED;
    else process.env.HOOPFRENS_CONTENT_INTELLIGENCE_ENABLED = original;
  }
});

test("filtered research uses a compatible fixed route and reserves the full search context", async () => {
  process.env.OPENAI_API_KEY = "test-only-not-a-credential";
  let reserved = 0;
  const repository = { checkRun: async () => {}, recordCall: async (_run: unknown, call: { boundMicros: number }) => { reserved = call.boundMicros; return 0; }, finishCall: async () => {} } as unknown as IntelligenceRepository;
  const transport: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-5-mini"); assert.equal(body.max_tool_calls, 1); assert.equal(body.store, false);
    assert.deepEqual(body.tools[0].filters.allowed_domains, ["malone.edu"]);
    assert.ok(reserved >= 128_000 * 0.25 + 4000 * 2 + 10_000);
    return Response.json({ status: "completed", usage: { input_tokens: 100, output_tokens: 10 }, output: [] });
  };
  try { await new Gateway(repository, run, new AbortController().signal, transport).search("Malone University", ["malone.edu"]); }
  finally { delete process.env.OPENAI_API_KEY; }
});

test("public articles inside site-wide forms retain evidence while scripts and form controls are removed", async () => {
  const { extractSourceText } = await import("../server/content-intelligence/sources");
  const article = "Fixture basketball facility information stays readable. ".repeat(3);
  const result = extractSourceText(`<title>Fixture source</title><form><main><article>${article}</article><script>untrusted executable text</script><input value="private-control-value"><textarea>private-control-text</textarea></main></form>`, "fixture.test");
  assert.equal(result.title, "Fixture source"); assert.equal(result.text, article.trim());
  assert.ok(!result.text.includes("private-control")); assert.ok(!result.text.includes("untrusted executable"));
});

test("Founder wording review persists an atomic before/after audit and rejects stale or wrong-owner edits", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const app = initializeApp({ projectId: `demo-content-intelligence-review-${process.pid}` }, "review-wording-test");
  const db = getFirestore(app); const repository = new IntelligenceRepository(db);
  repository.binding = async () => binding;
  const source = { id: "source-review", url: "https://malonepioneers.com/fixture", title: "Fixture only", accessedAt: "2026-09-08T00:00:00Z", contentHash: "fixture" };
  const original = { id: "research-review-fixture", kind: "governed-research", version: 1, revision: 1, binding, sources: [source], claims: [{ id: "claim-review", field: "city", value: "Canton", text: "Fixture school is in Canton.", evidence: [{ sourceId: source.id, quote: "Fixture school is in Canton." }], confidence: "needs-review" }], missingInformation: [], conflicts: [], createdAt: source.accessedAt, policyVersion: "fixture", originatingRunId: "fixture-run" };
  try {
    await repository.ref(collections.research, original.id).set(original);
    const decisions = [{ id: "claim-review", decision: "supported", text: "This fixture school is located in Canton." }];
    await assert.rejects(repository.review(original.id, "wrong-owner", 1, decisions), /record-not-available/);
    const reviewed = await repository.review(original.id, binding.ownerId, 1, decisions);
    assert.equal(reviewed.revision, 2); assert.deepEqual(reviewed.claims[0].evidence, original.claims[0].evidence);
    const audit = (await repository.ref(collections.reviews, `${original.id}-review-2`).get()).data()!;
    assert.equal(audit.decisions[0].previousText, original.claims[0].text);
    assert.equal(audit.decisions[0].reviewedText, decisions[0].text);
    await assert.rejects(repository.review(original.id, binding.ownerId, 1, decisions), /research-review-changed/);
    assert.equal((await repository.ref(collections.research, original.id).get()).data()?.revision, 2);
  } finally { await db.terminate(); await deleteApp(app); }
});
