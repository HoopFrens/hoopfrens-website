import { policy } from "./policy";
import { requireCondition, type Claim, type EvidenceSource, type ResearchPackage } from "./types";

export interface FetchedSource extends EvidenceSource { text: string }
export const normalizeEvidence = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
export function extractLedger(value: unknown, sources: FetchedSource[]) {
  requireCondition(value && typeof value === "object", "invalid-research-output");
  const result = value as { claims?: unknown; missingInformation?: unknown };
  requireCondition(Array.isArray(result.claims) && result.claims.length <= policy.maxClaims, "invalid-research-output");
  requireCondition(Array.isArray(result.missingInformation) && result.missingInformation.length <= 12
    && result.missingInformation.every(item => typeof item === "string" && item.length <= 300), "invalid-research-output");
  const rejected: string[] = [];
  const claims: Claim[] = [];
  for (const [index, raw] of result.claims.entries()) {
    if (!raw || typeof raw !== "object") { rejected.push(`Candidate ${index + 1}: invalid structure.`); continue; }
    const item = raw as Record<string, unknown>;
    const source = sources.find(source => source.id === item.sourceId);
    if (![item.field, item.value, item.text, item.quote].every(field => typeof field === "string" && field.trim().length > 0)
      || String(item.field).length > 80 || String(item.value).length > 160 || String(item.text).length > 240
      || String(item.quote).length > policy.maxQuoteLength || !source
      || !normalizeEvidence(source.text).includes(normalizeEvidence(String(item.quote)))) {
      rejected.push(`Candidate ${index + 1}: missing or unmatched source evidence; excluded.`);
      continue;
    }
    claims.push({ id: `claim-${index + 1}`, field: normalizeEvidence(String(item.field)).toLowerCase(),
      value: normalizeEvidence(String(item.value)), text: String(item.text),
      evidence: [{ sourceId: source.id, quote: String(item.quote) }], confidence: "needs-review" });
  }
  const fields = [...new Set(claims.map(claim => claim.field))];
  const conflicts = fields.filter(field => new Set(claims.filter(claim => claim.field === field).map(claim => claim.value.toLowerCase())).size > 1);
  claims.forEach(claim => { if (conflicts.includes(claim.field)) claim.confidence = "conflicting"; });
  return { claims, conflicts, missingInformation: [...result.missingInformation as string[], ...rejected] };
}
export function reviewLedger(research: ResearchPackage, decisions: unknown, actorId: string, at: string): ResearchPackage {
  requireCondition(Array.isArray(decisions) && decisions.length === research.claims.length, "review-every-claim");
  const seen = new Set<string>();
  const claims = decisions.map((item: { id: string; decision: string; text?: string }) => {
    requireCondition(item && typeof item.id === "string" && !seen.has(item.id)
      && ["supported", "rejected"].includes(item.decision), "invalid-evidence-review");
    seen.add(item.id);
    const claim = research.claims.find(claim => claim.id === item.id);
    requireCondition(claim && claim.evidence.length > 0, "missing-claim-evidence");
    requireCondition(item.text === undefined || typeof item.text === "string" && item.text.trim().length > 0 && item.text.length <= 240, "invalid-claim-wording");
    const decision = item.decision as "supported" | "rejected";
    return { ...claim, text: item.text?.trim() ?? claim.text, confidence: decision, review: { actorId, at, decision } };
  });
  for (const field of new Set(claims.map(claim => claim.field))) {
    const values = new Set(claims.filter(claim => claim.field === field && claim.confidence === "supported").map(claim => claim.value.toLowerCase()));
    requireCondition(values.size <= 1, "conflict-needs-resolution");
  }
  return { ...research, revision: research.revision + 1, claims };
}
