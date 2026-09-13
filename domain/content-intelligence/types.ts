export const platforms = ["instagram", "tiktok", "youtube", "facebook", "x", "website"] as const;
export type Platform = typeof platforms[number];
export type ResearchTeam = "Men's basketball" | "Women's basketball" | "Football";
export interface SourcePolicy { name: string; domains: string[]; priorityUrls?: string[] }
export interface PackageBinding {
  team?: ResearchTeam; sourcePolicy?: SourcePolicy; scope?: "school-request" | "request-package";
  projectId: string; packageId: string; version: number; schoolId: string;
  ownerId: string; workspaceId: string; contentHash: string; schoolName: string;
}
export interface EvidenceSource {
  id: string; url: string; title: string; accessedAt: string; contentHash: string;
}
export interface Claim {
  id: string; field: string; value: string; text: string;
  evidence: { sourceId: string; quote: string }[];
  confidence: "needs-review" | "supported" | "rejected" | "conflicting";
  review?: { actorId: string; at: string; decision: "supported" | "rejected" };
}
export interface ResearchPackage {
  id: string; kind: "governed-research"; version: 1; revision: number;
  binding: PackageBinding; sources: EvidenceSource[]; claims: Claim[];
  missingInformation: string[]; conflicts: string[]; createdAt: string;
  policyVersion: string; originatingRunId: string;
}
export interface DraftBlock { text: string; claimId: string | null; citations: EvidenceSource[] }
export interface ScriptScene { onScreenText: string; narration: DraftBlock; visualDirection: string }
export type PlatformContent =
  | { type: "instagram"; slides: DraftBlock[]; caption: DraftBlock[] }
  | { type: "tiktok"; scenes: ScriptScene[] }
  | { type: "youtube"; title: string; description: DraftBlock[]; scenes: ScriptScene[] }
  | { type: "facebook"; post: DraftBlock[] }
  | { type: "x"; posts: DraftBlock[] }
  | { type: "website"; headline: string; deck: DraftBlock; sections: { heading: string; body: DraftBlock[] }[] };
export interface PlatformDraft {
  platform: Platform; format: string; title: string; blocks: DraftBlock[];
  visualDirections: string[]; content: PlatformContent; status: "draft";
}
export interface DraftPackage {
  id: string; kind: "governed-platform-drafts"; binding: PackageBinding;
  researchPackageId: string; researchRevision: number; registryVersion: string;
  createdAt: string; originatingRunId: string; drafts: PlatformDraft[];
}
export interface Run {
  id: string; ownerId: string; binding: PackageBinding; kind: "research" | "generate";
  inputHash: string; status: "running" | "completed" | "cancelled" | "failed";
  createdAt: string; updatedAt: string; expiresAt: string; reservedMicros: number;
  budgetMonth: string; callBoundMicros: number; calls: CallAudit[];
  resultId?: string; errorCode?: string;
}
export interface CallAudit {
  stage: string; attempt: number; boundMicros: number; startedAt: string;
  status: "started" | "completed" | "failed";
  inputTokens?: number; outputTokens?: number; requestId?: string;
}
export class IntelligenceError extends Error {
  constructor(public code: string, public status = 422) { super(code); this.name = "IntelligenceError"; }
}
export function requireCondition(condition: unknown, code: string, status = 422): asserts condition {
  if (!condition) throw new IntelligenceError(code, status);
}
