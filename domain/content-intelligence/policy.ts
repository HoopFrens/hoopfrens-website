import { type PackageBinding, requireCondition } from "./types";

export const policy = {
  version: "hf-content-4.1-2026-09-08",
  model: "gpt-4.1-mini", searchModel: "gpt-5-mini", moderationModel: "omni-moderation-latest",
  requestMicros: 500_000, monthlyMicros: 10_000_000,
  maxOutputTokens: 4000, maxCalls: 8, maxAttempts: 2,
  callTimeoutMs: 45_000, jobTimeoutMs: 240_000,
  maxSourceBytes: 1_000_000, maxSourceText: 10_000, maxSources: 5,
  maxClaims: 12, maxQuoteLength: 450,
  inputMicrosPerToken: 0.4, outputMicrosPerToken: 1.6,
  searchCallMicros: 10_000, searchInputTokens: 128_000,
  searchInputMicrosPerToken: 0.25, searchOutputMicrosPerToken: 2,
} as const;

// School identities are exact, reviewed policy entries; caller URLs never expand them.
export const schoolSourcePolicy: Record<string, { name: string; domains: string[]; priorityUrls?: string[] }> = {
  "school-malone-university": { name: "Malone University", priorityUrls: ["https://malonepioneers.com/sports/2010/8/11/GEN_0811104901.aspx"], domains: ["malone.edu", "malonepioneers.com", "greatmidwestsports.com", "ncaa.org"] },
  "school-ashland-university": { name: "Ashland University", domains: ["ashland.edu", "goashlandeagles.com", "greatmidwestsports.com", "ncaa.org"] },
};
export function approvedSchool(schoolId: string) {
  const school = schoolSourcePolicy[schoolId];
  requireCondition(school, "source-policy-not-configured");
  return school;
}
export function bindingSchool(binding: PackageBinding) {
  return binding.sourcePolicy || approvedSchool(binding.schoolId);
}
export function approvedUrl(value: string, domains: readonly string[]): URL {
  requireCondition(typeof value === "string" && value.length <= 2048, "source-url-rejected");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("source-url-rejected"); }
  requireCondition(url.protocol === "https:" && !url.username && !url.password && !url.port, "source-url-rejected");
  requireCondition(domains.some(domain => url.hostname === domain || url.hostname === `www.${domain}`), "source-domain-rejected");
  url.hash = "";
  return url;
}
export function callCostBound(inputBytes: number, outputTokens: number, search: boolean) {
  // UTF-8 bytes upper-bound text tokens. Search reserves the entire 128k tool context,
  // including any returned search content, plus protocol overhead and maximum output/reasoning.
  return Math.ceil((inputBytes + 8192 + (search ? policy.searchInputTokens : 0)) * (search ? policy.searchInputMicrosPerToken : policy.inputMicrosPerToken)
    + outputTokens * (search ? policy.searchOutputMicrosPerToken : policy.outputMicrosPerToken) + (search ? policy.searchCallMicros : 0));
}
export function identifier(value: unknown): string {
  requireCondition(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value), "invalid-request");
  return value;
}
