import assert from "node:assert/strict";
import test from "node:test";
import { approvedSchool, approvedUrl, callCostBound, policy } from "@/domain/content-intelligence/policy";
import { extractLedger, reviewLedger, type FetchedSource } from "@/domain/content-intelligence/ledger";
import { createPlatformDrafts } from "@/domain/content-intelligence/editorial";
import { platforms, type ResearchPackage } from "@/domain/content-intelligence/types";

const source: FetchedSource = { id: "source-1", title: "Official test fixture", url: "https://malonepioneers.com/test-fixture", text: "Fixture only. The school is in Canton. This is not live Malone evidence.", contentHash: "fixture-hash", accessedAt: "2026-09-06T12:00:00.000Z" };
const candidate = { field: "city", value: "Canton", text: "The school is in Canton.", sourceId: source.id, quote: "The school is in Canton." };
function research(): ResearchPackage {
  return { id: "research-fixture", kind: "governed-research", version: 1, revision: 1,
    binding: { projectId: "project-fixture", packageId: "package-fixture", version: 2, schoolId: "school-malone-university", ownerId: "founder", workspaceId: "executive-workspace", schoolName: "Malone University", contentHash: "fixture" },
    sources: [source], ...extractLedger({ claims: [candidate], missingInformation: ["Fixture facilities information is missing."] }, [source]),
    createdAt: source.accessedAt, policyVersion: policy.version, originatingRunId: "run-fixture" };
}
function supportedResearch() { return reviewLedger(research(), [{ id: "claim-1", decision: "supported" }], "founder", source.accessedAt); }
const selections = () => platforms.map(platform => ({ platform, patternId: "court", claimIds: ["claim-1"] }));

test("source policy rejects credential URLs, other protocols, ports, suffix hosts and unapproved schools", () => {
  const domains = approvedSchool("school-malone-university").domains;
  assert.equal(approvedUrl("https://www.malone.edu/page#fragment", domains).href, "https://www.malone.edu/page");
  for (const url of ["http://malone.edu", "https://malone.edu.attacker.test", "https://evilmalone.edu", "https://a:b@malone.edu", "https://malone.edu:444", "file:///etc/passwd", "https://127.0.0.1", "https://sub.malone.edu"]) assert.throws(() => approvedUrl(url, domains));
  assert.throws(() => approvedSchool("unapproved-school"));
});
test("unmatched quotes and invented source IDs are rejected instead of promoted to claims", () => {
  const result = extractLedger({ claims: [{ ...candidate, quote: "Invented stadium capacity" }, { ...candidate, sourceId: "invented" }], missingInformation: [] }, [source]);
  assert.equal(result.claims.length, 0); assert.equal(result.missingInformation.length, 2);
});
test("a quote match produces a candidate requiring semantic Founder review", () => {
  const result = research(); assert.equal(result.claims[0].confidence, "needs-review");
  assert.throws(() => createPlatformDrafts(result, selections()), /unsupported-claim/);
});
test("competing values are retained and cannot both become supported", () => {
  const second = { ...source, id: "source-2", text: "The school is in Cleveland." };
  const result = { ...research(), ...extractLedger({ claims: [candidate, { ...candidate, value: "Cleveland", text: second.text, quote: second.text, sourceId: second.id }], missingInformation: [] }, [source, second]) };
  assert.deepEqual(result.conflicts, ["city"]); assert.ok(result.claims.every(claim => claim.confidence === "conflicting"));
  assert.throws(() => reviewLedger(result, result.claims.map(claim => ({ id: claim.id, decision: "supported" })), "founder", source.accessedAt), /conflict/);
  const reviewed = reviewLedger(result, [{ id: "claim-1", decision: "supported" }, { id: "claim-2", decision: "rejected" }], "founder", source.accessedAt);
  assert.equal(reviewed.revision, 2); assert.equal(reviewed.claims[1].confidence, "rejected"); assert.deepEqual(reviewed.conflicts, ["city"]);
});
test("incomplete and duplicate evidence decisions fail closed", () => {
  assert.throws(() => reviewLedger(research(), [], "founder", source.accessedAt));
  assert.throws(() => reviewLedger(research(), [{ id: "wrong", decision: "supported" }], "founder", source.accessedAt));
});
test("six platform outputs preserve evidence for every factual block", () => {
  const result = createPlatformDrafts(supportedResearch(), selections());
  assert.equal(new Set(result.map(draft => draft.platform)).size, 6);
  for (const draft of result) { assert.equal(draft.status, "draft"); assert.equal(draft.content.type, draft.platform); for (const block of draft.blocks) if (block.claimId) { assert.equal(block.text, candidate.text); assert.equal(block.citations[0].url, source.url); } }
});
test("freeform factual hooks and unknown editorial patterns are rejected", () => {
  assert.throws(() => createPlatformDrafts(supportedResearch(), selections().map(item => ({ ...item, hook: "Guaranteed scholarship" }))), /unapproved-output/);
  assert.throws(() => createPlatformDrafts(supportedResearch(), selections().map(item => ({ ...item, patternId: "other-creator-template" }))), /unapproved-editorial/);
});
test("invented, rejected, missing and duplicate platform/claim references are rejected", () => {
  const approved = supportedResearch();
  assert.throws(() => createPlatformDrafts(approved, selections().map(item => ({ ...item, claimIds: ["unknown"] }))));
  assert.throws(() => createPlatformDrafts(approved, selections().map(item => ({ ...item, claimIds: ["claim-1", "claim-1"] }))));
  assert.throws(() => createPlatformDrafts(approved, selections().map(item => ({ ...item, platform: "instagram" }))));
  assert.throws(() => createPlatformDrafts(approved, selections().slice(1)));
  const rejected = reviewLedger(research(), [{ id: "claim-1", decision: "rejected" }], "founder", source.accessedAt);
  assert.throws(() => createPlatformDrafts(rejected, selections()));
});
test("the confirmed limits and conservative call bound include search and output costs", () => {
  assert.equal(policy.requestMicros, 500_000); assert.equal(policy.monthlyMicros, 10_000_000);
  assert.ok(callCostBound(10_000, 4000, true) > callCostBound(10_000, 4000, false));
  assert.ok(callCostBound(70_000, 4000, true) * policy.maxAttempts * 3 < policy.requestMicros);
});

test("priority facility sources remain inside the reviewed school domain policy", () => {
  const school = approvedSchool("school-malone-university");
  assert.ok(school.priorityUrls?.length);
  for (const url of school.priorityUrls || []) assert.equal(approvedUrl(url, school.domains).href, url);
});

test("explicit Founder wording edits preserve evidence and require bounded nonempty text", () => {
  const original = research();
  const edited = reviewLedger(original, [{ id: "claim-1", decision: "supported", text: "This school is located in Canton." }], "founder", source.accessedAt);
  assert.equal(edited.claims[0].text, "This school is located in Canton.");
  assert.deepEqual(edited.claims[0].evidence, original.claims[0].evidence);
  assert.equal(edited.revision, original.revision + 1); assert.equal(original.claims[0].text, candidate.text);
  for (const text of [" ", "x".repeat(241), 123]) assert.throws(() => reviewLedger(original, [{ id: "claim-1", decision: "supported", text }], "founder", source.accessedAt), /invalid-claim-wording/);
});
