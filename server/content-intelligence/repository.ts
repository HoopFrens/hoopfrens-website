import "server-only";
import { createHash } from "node:crypto";
import type { DocumentData, Firestore, Transaction } from "firebase-admin/firestore";
import { validateSchoolSpotlightPackage, assertSchoolSpotlightPackageApprovable } from "@/domain/founder-simple/validation";
import type { SchoolSpotlightPackage } from "@/domain/founder-simple/types";
import { approvedSchool, identifier, policy } from "@/domain/content-intelligence/policy";
import { requireCondition, type PackageBinding, type ResearchPackage, type DraftPackage, type Run, type CallAudit } from "@/domain/content-intelligence/types";
import { reviewLedger } from "@/domain/content-intelligence/ledger";
import { validateStoryboard, type Storyboard } from "@/domain/content-intelligence/storyboard";

import { requestPackage } from "./request-package";
import { validateSchoolRequest, type SchoolRequest } from "@/domain/content-intelligence/simple-post";

export const collections = { requestPackages: "internalContentIntelligenceRequestPackages", requests: "internalContentIntelligenceSchoolRequests", runs: "internalContentIntelligenceRuns", budget: "internalContentIntelligenceBudget", research: "internalContentIntelligenceResearch", drafts: "internalContentIntelligenceDrafts", owners: "internalContentIntelligenceOwners", reviews: "internalContentIntelligenceReviews", storyboards: "internalContentIntelligenceStoryboards", storyboardVersions: "internalContentIntelligenceStoryboardVersions" } as const;
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const omit = (value: DocumentData, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

export function assertBinding(project: DocumentData, pkg: SchoolSpotlightPackage, actorId: string) {
  requireCondition(project.ownerId === actorId && pkg.ownerId === actorId, "record-not-available", 404);
  requireCondition(project.state === "approved" && project.status === "approved"
    && project.id === pkg.projectId && project.workspaceId === pkg.workspaceId
    && project.activeSchoolSpotlightPackageId === pkg.id && project.approvedSchoolSpotlightPackageId === pkg.id
    && project.approvedSchoolSpotlightPackageVersion === pkg.version && project.activeProductionVersion === pkg.version
    && pkg.active !== false && !pkg.supersededAt && !project.productionReadinessInvalidatedAt
    && project.knowledgeEntityIds?.includes(pkg.schoolId), "approved-version-required");
  validateSchoolSpotlightPackage(pkg);
  assertSchoolSpotlightPackageApprovable(pkg);
}

export class IntelligenceRepository {
  constructor(public db: Firestore) {}
  ref(collection: string, id: string) { return this.db.collection(collection).doc(identifier(id)); }

  async binding(tx: Transaction, projectId: string, actorId: string, expected?: PackageBinding): Promise<PackageBinding> {
    const profile = (await tx.get(this.ref("users", actorId))).data();
    requireCondition(profile?.role === "admin", "administrator-required", 403);
    if (projectId.startsWith("school-request-")) {
      const request = (await tx.get(this.ref(collections.requests, projectId))).data() as SchoolRequest | undefined;
      requireCondition(request?.ownerId === actorId, "record-not-available", 404);
      requireCondition(request.sourceApprovedAt && request.sourcePolicy && request.status === "ready", "school-source-confirmation-required");
      let result: PackageBinding = {projectId, packageId:request.id, version:0, schoolId:`school-${digest([request.schoolName,request.sourcePolicy.domains]).slice(0,32)}`, ownerId:actorId, workspaceId:"executive-workspace", schoolName:request.schoolName, team:request.team, sourcePolicy:request.sourcePolicy, scope:"school-request", contentHash:digest([request.schoolName,request.team,request.sourcePolicy,request.sourceApprovedAt])};
      if (request.approvedPackageId) {
        const record = (await tx.get(this.ref(collections.requestPackages, request.approvedPackageId))).data();
        requireCondition(record?.ownerId === actorId && record.requestId === request.id && record.approvedBy === actorId && record.approvedAt, "approved-version-required");
        const pkg = record.pkg as SchoolSpotlightPackage;
        validateSchoolSpotlightPackage(pkg);
        requireCondition(pkg.id === request.approvedPackageId && pkg.projectId === request.id && pkg.ownerId === actorId && pkg.schoolId === result.schoolId
          && pkg.metadata.team === request.team && record.contentHash === digest(pkg), "package-integrity-failed");
        result = {...result, packageId:pkg.id, version:pkg.version, scope:"request-package", contentHash:digest([pkg,request.sourcePolicy,request.sourceApprovedAt])};
      }
      if (expected) requireCondition(digest(result) === digest(expected), "approved-version-changed");
      return result;
    }
    const p = (await tx.get(this.ref("internalProjects", projectId))).data();
    requireCondition(p && p.id === projectId && p.ownerId === actorId, "record-not-available", 404);
    const id = identifier(p.approvedSchoolSpotlightPackageId);
    const header = (await tx.get(this.ref("internalProductionPackages", id))).data();
    requireCondition(header && header.id === id && header.ownerId === actorId, "approved-version-required");
    let pkg = header as SchoolSpotlightPackage;
    if (header.factsIntegrityId) {
      for (const field of ["factsIntegrityId", "contentIntegrityId", "deliveryIntegrityId", "requestIntegrityId", "customizationIntegrityId"]) requireCondition(header[field] === id, "package-integrity-failed");
      const parts = await tx.getAll(...[
        ["internalSchoolSpotlightPackageFacts", id], ["internalSchoolSpotlightPackageFactsA", `${id}-1`],
        ["internalSchoolSpotlightPackageFactsB", `${id}-2`], ["internalSchoolSpotlightPackageContent", id],
        ["internalSchoolSpotlightPackageDelivery", id], ["internalSchoolSpotlightPackageRequest", id],
        ["internalSchoolSpotlightPackageCustomization", id],
      ].map(([collection, key]) => this.ref(collection, key)));
      const data = parts.map(part => {
        const data = part.data();
        requireCondition(data && data.packageId === id && data.ownerId === actorId && data.workspaceId === p.workspaceId, "package-integrity-failed");
        return data;
      });
      const [facts, a, b, content, delivery, request, customization] = data;
      requireCondition(a.part === 1 && b.part === 2, "package-integrity-failed");
      for (const part of [content, delivery, request, customization]) requireCondition(part.workflowDraftId === header.workflowDraftId, "package-integrity-failed");
      const sources = facts.verificationSources as DocumentData[];
      requireCondition(Array.isArray(sources) && Array.isArray(a.selectedFacts) && Array.isArray(b.selectedFacts), "package-integrity-failed");
      const selectedFacts: DocumentData[] = [...a.selectedFacts, ...b.selectedFacts].map(fact => ({
        ...omit(fact, ["sourceIds"]), sources: (fact.sourceIds as string[]).map(id => {
          const source = sources.find(source => source.sourceId === id);
          requireCondition(source, "package-integrity-failed"); return source;
        }),
      }));
      requireCondition(selectedFacts.length === facts.selectedFactCount
        && digest(selectedFacts.map(fact => fact.id)) === digest(facts.selectedFactIds)
        && digest(selectedFacts.map(fact => fact.position)) === digest(facts.selectedFactPositions)
        && digest(sources.map(source => source.sourceId)) === digest(facts.verificationSourceIds), "package-integrity-failed");
      const strip = (value: DocumentData) => omit(value, ["packageId", "workspaceId", "ownerId", "workflowDraftId"]);
      pkg = { ...header, ...omit(facts, ["packageId", "workspaceId", "ownerId", "selectedFactCount", "verificationSourceIds", "selectedFactIds", "selectedFactPositions"]),
        selectedFacts, ...strip(content), ...strip(delivery), ...strip(request), ...strip(customization) } as SchoolSpotlightPackage;
    }
    assertBinding(p, pkg, actorId);
    const school = approvedSchool(pkg.schoolId);
    const result: PackageBinding = { projectId, packageId: pkg.id, version: pkg.version, schoolId: pkg.schoolId,
      ownerId: actorId, workspaceId: pkg.workspaceId, contentHash: digest(pkg), schoolName: school.name };
    if (expected) requireCondition(digest(result) === digest(expected), "approved-version-changed");
    return result;
  }

  async approvedPackages(ownerId: string) {
    const candidates = await this.db.collection("internalProjects").where("ownerId", "==", ownerId).limit(100).get();
    const results: PackageBinding[] = [];
    for (const doc of candidates.docs) {
      if (doc.data().state !== "approved" || !doc.data().approvedSchoolSpotlightPackageId) continue;
      try { results.push(await this.db.runTransaction(tx => this.binding(tx, doc.id, ownerId))); } catch { /* Ineligible packages cannot enable research. */ }
    }
    const requests = await this.db.collection(collections.requests).where("ownerId", "==", ownerId).limit(50).get();
    for (const doc of requests.docs) {
      if (!doc.data().sourceApprovedAt) continue;
      try { results.push(await this.db.runTransaction(tx => this.binding(tx, doc.id, ownerId))); } catch { /* Never expose invalid package authority. */ }
    }
    return results;
  }

  async begin(ownerId: string, projectId: string, requestId: string, kind: Run["kind"], input: unknown) {
    const runId = `run-${digest([ownerId, identifier(requestId)])}`;
    const inputHash = digest([projectId, kind, input]);
    return this.db.runTransaction(async tx => {
      const previous = (await tx.get(this.ref(collections.runs, runId))).data() as Run | undefined;
      if (previous) { requireCondition(previous.ownerId === ownerId && previous.inputHash === inputHash, "request-id-reused"); return { run: previous, created: false }; }
      const binding = await this.binding(tx, projectId, ownerId);
      const now = new Date(); const month = now.toISOString().slice(0, 7);
      const [budget, owner] = await tx.getAll(this.ref(collections.budget, month), this.ref(collections.owners, ownerId));
      requireCondition(!budget.data()?.disabled, "budget-policy-disabled", 503);
      requireCondition(Number(budget.data()?.reservedMicros || 0) + policy.requestMicros <= policy.monthlyMicros, "monthly-budget-exhausted", 429);
      requireCondition(!owner.data()?.activeUntil || owner.data()!.activeUntil <= now.toISOString(), "another-request-is-running", 409);
      const run: Run = { id: runId, ownerId, binding, inputHash, kind, status: "running", createdAt: now.toISOString(), updatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + policy.jobTimeoutMs).toISOString(), reservedMicros: policy.requestMicros, budgetMonth: month, callBoundMicros: 0, calls: [] };
      tx.set(this.ref(collections.budget, month), { reservedMicros: Number(budget.data()?.reservedMicros || 0) + policy.requestMicros, capMicros: policy.monthlyMicros, updatedAt: now.toISOString() }, { merge: true });
      tx.set(this.ref(collections.owners, ownerId), { runId, activeUntil: run.expiresAt });
      tx.create(this.ref(collections.runs, runId), run);
      return { run, created: true };
    });
  }

  async getRun(id: string, ownerId: string): Promise<Run> {
    const run = (await this.ref(collections.runs, id).get()).data() as Run | undefined;
    requireCondition(run && run.ownerId === ownerId, "record-not-available", 404); return run;
  }
  async checkRun(run: Run) {
    const current = await this.getRun(run.id, run.ownerId);
    requireCondition(current.status === "running", "request-cancelled", 409);
    requireCondition(current.expiresAt > new Date().toISOString(), "request-timeout", 408);
  }
  async recordCall(run: Run, call: CallAudit) {
    return this.db.runTransaction(async tx => {
      const current = (await tx.get(this.ref(collections.runs, run.id))).data() as Run;
      requireCondition(current.status === "running" && current.expiresAt > new Date().toISOString(), "request-cancelled", 409);
      requireCondition(current.calls.length < policy.maxCalls && current.callBoundMicros + call.boundMicros <= policy.requestMicros, "request-budget-exhausted", 429);
      tx.update(this.ref(collections.runs, run.id), { callBoundMicros: current.callBoundMicros + call.boundMicros, calls: [...current.calls, call], updatedAt: new Date().toISOString() });
      return current.calls.length;
    });
  }
  async finishCall(run: Run, index: number, fields: Partial<CallAudit>) {
    await this.db.runTransaction(async tx => {
      const current = (await tx.get(this.ref(collections.runs, run.id))).data() as Run;
      const calls = current.calls.map((call, i) => i === index ? { ...call, ...fields } : call);
      tx.update(this.ref(collections.runs, run.id), { calls });
    });
  }
  async finish(run: Run, result?: ResearchPackage | DraftPackage, errorCode?: string) {
    await this.db.runTransaction(async tx => {
      const current = (await tx.get(this.ref(collections.runs, run.id))).data() as Run;
      if (current.status !== "running") return;
      if (result) {
        requireCondition(current.expiresAt > new Date().toISOString(), "request-timeout", 408);
        await this.binding(tx, run.binding.projectId, run.ownerId, run.binding);
        if (result.kind === "governed-platform-drafts") {
          const research = (await tx.get(this.ref(collections.research, result.researchPackageId))).data() as ResearchPackage;
          requireCondition(research && research.revision === result.researchRevision && digest(research.binding) === digest(run.binding), "research-review-changed");
        }
      }
      const owner = (await tx.get(this.ref(collections.owners, run.ownerId))).data();
      if (result) tx.create(this.ref(result.kind === "governed-research" ? collections.research : collections.drafts, result.id), result);
      tx.update(this.ref(collections.runs, run.id), { status: result ? "completed" : "failed", updatedAt: new Date().toISOString(), ...(result ? { resultId: result.id } : { errorCode: errorCode || "request-failed" }) });
      if (owner?.runId === run.id) tx.delete(this.ref(collections.owners, run.ownerId));
    });
  }
  async cancel(id: string, ownerId: string) {
    await this.db.runTransaction(async tx => {
      const current = (await tx.get(this.ref(collections.runs, id))).data() as Run | undefined;
      requireCondition(current && current.ownerId === ownerId, "record-not-available", 404);
      const owner = (await tx.get(this.ref(collections.owners, ownerId))).data();
      if (current.status !== "running") return;
      tx.update(this.ref(collections.runs, id), { status: "cancelled", updatedAt: new Date().toISOString() });
      if (owner?.runId === id) tx.delete(this.ref(collections.owners, ownerId));
    });
  }
  async research(id: string, ownerId: string) {
    const result = (await this.ref(collections.research, id).get()).data() as ResearchPackage;
    requireCondition(result?.binding.ownerId === ownerId, "record-not-available", 404); return result;
  }
  async review(id: string, ownerId: string, revision: number, decisions: unknown) {
    return this.db.runTransaction(async tx => {
      const research = (await tx.get(this.ref(collections.research, id))).data() as ResearchPackage;
      requireCondition(research?.binding.ownerId === ownerId, "record-not-available", 404);
      requireCondition(research.revision === revision, "research-review-changed", 409);
      await this.binding(tx, research.binding.projectId, ownerId, research.binding);
      let result = reviewLedger(research, decisions, ownerId, new Date().toISOString());
      if (research.binding.projectId.startsWith("school-request-") && result.claims.some(c => c.confidence === "supported")) {
        const ref = this.ref(collections.requests, research.binding.projectId);
        const request = (await tx.get(ref)).data() as SchoolRequest;
        const previous = request.approvedPackageId ? (await tx.get(this.ref(collections.requestPackages,request.approvedPackageId))).data()?.pkg as SchoolSpotlightPackage : undefined;
        const pkg = requestPackage(request,result,previous);
        validateSchoolSpotlightPackage(pkg);
        const binding: PackageBinding = {...research.binding,packageId:pkg.id,version:pkg.version,scope:"request-package",contentHash:digest([pkg,request.sourcePolicy,request.sourceApprovedAt])};
        result = {...result,binding};
        tx.create(this.ref(collections.requestPackages,pkg.id),{pkg,ownerId,requestId:request.id,approvedBy:ownerId,approvedAt:new Date().toISOString(),contentHash:digest(pkg),researchId:id,researchRevision:result.revision});
        tx.update(ref,{approvedPackageId:pkg.id});
      }
      tx.create(this.ref(collections.reviews, `${id}-review-${result.revision}`), { researchId: id, revision: result.revision, ownerId, at: new Date().toISOString(), decisions: result.claims.map(claim => ({ id: claim.id, decision: claim.confidence, previousText: research.claims.find(previous => previous.id === claim.id)!.text, reviewedText: claim.text })), previousRevision: research.revision, binding: result.binding });
      tx.set(this.ref(collections.research, id), result); return result;
    });
  }
  async saveStoryboard(researchId: string, ownerId: string, researchRevision: number, revision: number, input: unknown) {
    requireCondition(Number.isInteger(revision) && revision >= 0 && Number.isInteger(researchRevision), "invalid-storyboard");
    return this.db.runTransaction(async tx => {
      const research = (await tx.get(this.ref(collections.research, researchId))).data() as ResearchPackage;
      requireCondition(research?.binding.ownerId === ownerId, "record-not-available", 404);
      requireCondition(research.revision === researchRevision, "research-review-changed", 409);
      await this.binding(tx, research.binding.projectId, ownerId, research.binding);
      const id = `storyboard-${digest([researchId, researchRevision])}`;
      const ref = this.ref(collections.storyboards, id);
      const previous = (await tx.get(ref)).data() as Storyboard | undefined;
      requireCondition((previous?.revision || 0) === revision, "storyboard-revision-changed", 409);
      const content = validateStoryboard(input, research, previous);
      const result: Storyboard = { ...content, id, kind: "instagram-storyboard", revision: revision + 1, binding: research.binding,
        researchPackageId: researchId, researchRevision, updatedAt: new Date().toISOString(), updatedBy: ownerId };
      // Immutable revisions contain copy/permission attestations and their actor; canonical records are read-only.
      tx.create(this.ref(collections.storyboardVersions, `${id}-v${result.revision}`), result);
      tx.set(ref, result);
      return result;
    });
  }
  async renderSnapshot(id: string, revision: number, ownerId: string) {
    return this.db.runTransaction(async tx => {
      const board = (await tx.get(this.ref(collections.storyboards, id))).data() as Storyboard | undefined;
      requireCondition(board?.binding.ownerId === ownerId, "record-not-available", 404);
      requireCondition(board.revision === revision, "storyboard-revision-changed", 409);
      const research = (await tx.get(this.ref(collections.research, board.researchPackageId))).data() as ResearchPackage | undefined;
      requireCondition(research?.binding.ownerId === ownerId && research.revision === board.researchRevision && digest(research.binding) === digest(board.binding), "research-review-changed", 409);
      await this.binding(tx, board.binding.projectId, ownerId, board.binding);
      validateStoryboard({ brief: board.brief, slides: board.slides, assets: board.assets, caption: board.caption, captionReviewed: board.captionReviewed }, research);
      return { board, research };
    });
  }
  async schoolRequest(id: string, ownerId: string): Promise<SchoolRequest> {
    const request = (await this.ref(collections.requests,id).get()).data() as SchoolRequest;
    requireCondition(request?.ownerId === ownerId,"record-not-available",404); return request;
  }
  async saveSchoolSource(id: string, ownerId: string, preview: Pick<SchoolRequest,"sourcePolicy"|"sourcePreview">) {
    return this.db.runTransaction(async tx => {
      const ref=this.ref(collections.requests,id); const request=(await tx.get(ref)).data() as SchoolRequest;
      requireCondition(request?.ownerId===ownerId,"record-not-available",404);
      requireCondition(!request.sourceApprovedAt,"school-source-already-confirmed",409);
      const result={...request,...preview,sourcePreviewHash:digest(preview.sourcePreview)}; tx.set(ref,result); return result;
    });
  }
  async approveSchoolSource(id: string, ownerId: string, previewHash: string) {
    return this.db.runTransaction(async tx => {
      const ref=this.ref(collections.requests,id); const request=(await tx.get(ref)).data() as SchoolRequest;
      const user=(await tx.get(this.ref("users",ownerId))).data();
      requireCondition(user?.role==="admin","administrator-required",403);
      requireCondition(request?.ownerId===ownerId,"record-not-available",404);
      requireCondition(request.sourcePolicy && request.sourcePreview && digest(request.sourcePreview)===previewHash,"school-source-preview-changed",409);
      if(request.sourceApprovedAt)return request;
      const result:SchoolRequest={...request,sourceApprovedAt:new Date().toISOString(),status:"ready"};
      tx.set(ref,result); return result;
    });
  }
  async submitSchool(ownerId: string, requestId: string, input: unknown): Promise<SchoolRequest> {
    const checked = validateSchoolRequest(input);
    const id = `school-request-${digest([ownerId, identifier(requestId)])}`;
    return this.db.runTransaction(async tx => {
      const profile = (await tx.get(this.ref("users", ownerId))).data();
      requireCondition(profile?.role === "admin", "administrator-required", 403);
      const ref = this.ref(collections.requests, id);
      const previous = (await tx.get(ref)).data() as SchoolRequest | undefined;
      if (previous) {
        requireCondition(previous.ownerId === ownerId && digest(validateSchoolRequest({ schoolName: previous.schoolName, location: previous.location, team: previous.team })) === digest(checked), "request-id-reused", 409);
        return previous;
      }
      const queue = await tx.get(this.db.collection(collections.requests).where("ownerId", "==", ownerId).limit(50));
      requireCondition(queue.size < 50, "school-request-limit", 429);
      const result: SchoolRequest = { ...checked, id, ownerId, createdAt: new Date().toISOString(), status: "needs-setup" };
      tx.create(ref, result);
      return result;
    });
  }
  async state(ownerId: string) {
    const [packages, runs, research, drafts, budget, storyboards, requests] = await Promise.all([
      this.approvedPackages(ownerId),
      this.db.collection(collections.runs).where("ownerId", "==", ownerId).limit(100).get(),
      this.db.collection(collections.research).where("binding.ownerId", "==", ownerId).limit(100).get(),
      this.db.collection(collections.drafts).where("binding.ownerId", "==", ownerId).limit(100).get(),
      this.ref(collections.budget, new Date().toISOString().slice(0, 7)).get(),
      this.db.collection(collections.storyboards).where("binding.ownerId", "==", ownerId).limit(100).get(),
      this.db.collection(collections.requests).where("ownerId", "==", ownerId).limit(50).get(),
    ]);
    return { requests: requests.docs.map(doc => doc.data() as SchoolRequest), observedAt: new Date().toISOString(), packages, runs: runs.docs.map(doc => doc.data() as Run), research: research.docs.map(doc => doc.data() as ResearchPackage),
      drafts: drafts.docs.map(doc => doc.data() as DraftPackage), storyboards: storyboards.docs.map(doc => doc.data() as Storyboard), reservedMicros: budget.data()?.reservedMicros || 0, monthlyMicros: policy.monthlyMicros };
  }
}
