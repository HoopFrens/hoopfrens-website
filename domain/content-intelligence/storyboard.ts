import { bindingSchool, approvedUrl, identifier } from "./policy";
import { requireCondition, type ResearchPackage, type PackageBinding } from "./types";

export const storyTypes = { court: "Court spotlight", facilities: "Facility tour", journey: "Athlete journey", guide: "Campus visit guide" } as const;
export const audiences = ["Athletes and parents", "Athletes", "Parents"] as const;
export const readerActions = ["Save for a visit", "Explore the school", "Follow Court Notes"] as const;
export const slideRoles = ["cover", "detail", "milestone", "takeaway"] as const;
export type StoryType = keyof typeof storyTypes;
export interface StoryBrief { type: StoryType; audience: typeof audiences[number]; action: typeof readerActions[number]; angle: string }
export interface StoryAsset {
  id: string; label: string; imageUrl: string; sourceUrl: string; credit: string;
  capturedOn: string; rights: "pending" | "cleared"; permissionNote: string;
}
export interface StorySlide {
  id: string; role: typeof slideRoles[number]; headline: string; body: string; claimIds: string[];
  assetId: string | null; focalX: number; focalY: number; layout: "photo" | "text";
  locked: boolean; copyReviewed: boolean;
}
export interface StoryboardInput { brief: StoryBrief; slides: StorySlide[]; assets: StoryAsset[]; caption: string; captionReviewed: boolean }
export interface Storyboard extends StoryboardInput {
  id: string; kind: "instagram-storyboard"; revision: number; binding: PackageBinding;
  researchPackageId: string; researchRevision: number; updatedAt: string; updatedBy: string;
}
export interface StoryIssue { severity: "review" | "suggestion"; message: string }

function object(value: unknown, keys: string[]): Record<string, unknown> {
  requireCondition(value && typeof value === "object" && !Array.isArray(value), "invalid-storyboard");
  const record = value as Record<string, unknown>;
  requireCondition(Object.keys(record).sort().join() === [...keys].sort().join(), "invalid-storyboard");
  return record;
}
function text(value: unknown, max: number, required = false): string {
  requireCondition(typeof value === "string" && value.length <= max && (!required || !!value.trim()) && !/[\u0000-\u0008\u000b-\u001f]/.test(value), "invalid-storyboard-text");
  return value.trim();
}
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  requireCondition(typeof value === "string" && options.includes(value as T), "invalid-storyboard"); return value as T;
}
function flag(value: unknown): boolean { requireCondition(typeof value === "boolean", "invalid-storyboard"); return value; }
function focal(value: unknown): number { requireCondition(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100, "invalid-storyboard"); return value; }
function equal(a: unknown, b: unknown): boolean {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalize(x)])) : v;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
export function approvedStoryClaims(research: ResearchPackage) {
  return research.claims.filter(c => c.confidence === "supported" && c.review?.decision === "supported" && c.evidence.length > 0 && c.evidence.every(e => research.sources.some(s => s.id === e.sourceId)));
}
export function assertStoryResearch(research: ResearchPackage) {
  requireCondition(research.binding.scope !== "school-request", "approved-version-required");
  requireCondition(approvedStoryClaims(research).length > 0 && research.claims.every(c => ["supported", "rejected"].includes(c.confidence)), "research-review-required");
}

// The browser supplies IDs and draft copy, never source/citation authority or package bindings.
export function validateStoryboard(input: unknown, research: ResearchPackage, previous?: Storyboard): StoryboardInput {
  assertStoryResearch(research);
  const root = object(input, ["brief", "slides", "assets", "caption", "captionReviewed"]);
  const brief = object(root.brief, ["type", "audience", "action", "angle"]);
  const resultBrief: StoryBrief = { type: choice(brief.type, Object.keys(storyTypes) as StoryType[]), audience: choice(brief.audience, audiences), action: choice(brief.action, readerActions), angle: text(brief.angle, 180) };
  requireCondition(Array.isArray(root.assets) && root.assets.length <= 12, "invalid-storyboard");
  const domains = bindingSchool(research.binding).domains;
  const assets = root.assets.map(raw => {
    const a = object(raw, ["id", "label", "imageUrl", "sourceUrl", "credit", "capturedOn", "rights", "permissionNote"]);
    const imageUrl = approvedUrl(text(a.imageUrl, 2048, true), domains);
    requireCondition(/\.(png|jpe?g|webp)$/i.test(imageUrl.pathname), "story-image-url-rejected");
    const capturedOn = text(a.capturedOn, 10);
    requireCondition(!capturedOn || (/^\d{4}-\d{2}-\d{2}$/.test(capturedOn) && Number.isFinite(Date.parse(capturedOn)) && new Date(capturedOn).toISOString().slice(0, 10) === capturedOn), "invalid-storyboard");
    const asset: StoryAsset = { id: identifier(a.id), label: text(a.label, 80, true), imageUrl: imageUrl.href, sourceUrl: approvedUrl(text(a.sourceUrl, 2048, true), domains).href,
      credit: text(a.credit, 100, true), capturedOn, rights: choice(a.rights, ["pending", "cleared"]), permissionNote: text(a.permissionNote, 300) };
    requireCondition(asset.rights !== "cleared" || asset.permissionNote.length > 0, "photo-permission-required");
    return asset;
  });
  requireCondition(new Set(assets.map(a => a.id)).size === assets.length, "invalid-storyboard");
  requireCondition(Array.isArray(root.slides) && root.slides.length >= 2 && root.slides.length <= 8, "invalid-storyboard");
  const approved = new Set(approvedStoryClaims(research).map(c => c.id));
  const slides = root.slides.map((raw, index) => {
    const s = object(raw, ["id", "role", "headline", "body", "claimIds", "assetId", "focalX", "focalY", "layout", "locked", "copyReviewed"]);
    requireCondition(Array.isArray(s.claimIds) && s.claimIds.length <= 4 && s.claimIds.every(id => typeof id === "string" && approved.has(id)) && new Set(s.claimIds).size === s.claimIds.length, "unsupported-claim-rejected");
    requireCondition(s.assetId === null || assets.some(a => a.id === s.assetId), "story-asset-missing");
    const slide: StorySlide = { id: identifier(s.id), role: choice(s.role, slideRoles), headline: text(s.headline, 100, true), body: text(s.body, 320), claimIds: s.claimIds as string[],
      assetId: s.assetId as string | null, focalX: focal(s.focalX), focalY: focal(s.focalY), layout: choice(s.layout, ["photo", "text"]), locked: flag(s.locked), copyReviewed: flag(s.copyReviewed) };
    // A locked slide must be unlocked in a separate save before its copy, placement or image changes.
    const old = previous?.slides.find(p => p.id === slide.id);
    if (old?.locked) requireCondition(equal({ ...slide, locked: false }, { ...old, locked: false })
      && previous!.slides.findIndex(p => p.id === slide.id) === index
      && equal(assets.find(a => a.id === slide.assetId) || null, previous!.assets.find(a => a.id === old.assetId) || null), "story-slide-locked");
    return slide;
  });
  requireCondition(new Set(slides.map(s => s.id)).size === slides.length, "invalid-storyboard");
  for (const old of previous?.slides || []) if (old.locked) requireCondition(slides.some(s => s.id === old.id), "story-slide-locked");
  requireCondition(slides.some(s => s.claimIds.length > 0), "research-review-required");
  return { brief: resultBrief, slides, assets, caption: text(root.caption, 1800), captionReviewed: flag(root.captionReviewed) };
}

export function storyHooks(type: StoryType, school: string, team?: string): string[] {
  const name = school.replace(/ University$| College$/, "");
  const variants: Record<StoryType, string[]> = {
    court: [`Inside ${name} basketball`, `${name}, from the court`, `Get to know the court at ${name}`],
    facilities: [`A closer look at ${name}`, `Explore the spaces at ${name}`, `${name}: beyond the game`],
    journey: [`A basketball story from ${name}`, `Follow the journey at ${name}`, `${name}: the people behind the game`],
    guide: [`Visiting ${name}? Start here.`, `Your ${name} visit questions`, `Look closer at ${name}`],
  }; return team === "Football" ? variants[type].map(hook=>hook.replaceAll("basketball","football").replaceAll("court","field")) : variants[type];
}
export function startStoryboard(research: ResearchPackage, brief: StoryBrief, count: number, claimIds: string[]): StoryboardInput {
  assertStoryResearch(research);
  requireCondition(Number.isInteger(count) && count >= 3 && count <= 8, "invalid-storyboard");
  const claims = claimIds.map(id => { const c = approvedStoryClaims(research).find(c => c.id === id); requireCondition(c, "unsupported-claim-rejected"); return c; });
  requireCondition(claims.length > 0 && new Set(claimIds).size === claimIds.length, "research-review-required");
  const slides: StorySlide[] = Array.from({ length: count }, (_, i) => {
    const role = i === 0 ? "cover" : i === count - 1 ? "takeaway" : brief.type === "journey" ? "milestone" : "detail";
    const claim = role === "detail" || role === "milestone" ? claims[i - 1] : undefined;
    return { id: `slide-${i + 1}`, role, headline: role === "cover" ? storyHooks(brief.type, research.binding.schoolName, research.binding.team)[0] : role === "takeaway" ? brief.action : claim ? research.binding.team === "Football" ? "A football detail" : "A basketball detail" : "Add a supported detail",
      body: claim?.text || (role === "takeaway" ? "What would you ask on a campus visit?" : ""), claimIds: claim ? [claim.id] : [], assetId: null, focalX: 50, focalY: 50, layout: role === "takeaway" ? "text" : "photo", locked: false, copyReviewed: false };
  });
  return { brief, slides, assets: [], caption: `${storyHooks(brief.type, research.binding.schoolName, research.binding.team)[0]}.\n\n${claims.slice(0, count - 2).map(c => c.text).join("\n\n")}\n\n${brief.action}.`, captionReviewed: false };
}
export function storyIssues(board: StoryboardInput): StoryIssue[] {
  const issues: StoryIssue[] = [];
  const add = (message: string, severity: StoryIssue["severity"] = "review") => issues.push({ message, severity });
  if (board.slides[0]?.role !== "cover") add("Start with a cover slide.");
  if (board.slides.at(-1)?.role !== "takeaway") add("End with a clear reader takeaway.");
  for (const [i, slide] of board.slides.entries()) {
    const name = `Slide ${i + 1}`;
    if (!slide.copyReviewed) add(`${name}: review the headline and wording against the linked evidence.`);
    if (["detail", "milestone"].includes(slide.role) && !slide.claimIds.length) add(`${name}: select supporting evidence or change its story role.`);
    const asset = board.assets.find(a => a.id === slide.assetId);
    if (slide.layout === "photo" && !asset) add(`${name}: choose a photo.`);
    if (asset?.rights === "pending") add(`${name}: photo usage rights are unverified. Credit alone does not grant permission.`, "suggestion");
    if (slide.headline.length > 65 || slide.body.length > 190) add(`${name}: shorten the copy for a phone screen.`, "suggestion");
    if (asset && board.slides.slice(0, i).some(p => board.assets.find(a => a.id === p.assetId)?.imageUrl === asset.imageUrl)) add(`${name}: this photo repeats an earlier image.`, "suggestion");
    if (board.slides.slice(0, i).some(p => p.headline === slide.headline && p.body === slide.body)) add(`${name}: this repeats earlier copy.`, "suggestion");
  }
  if (!board.caption.trim() || !board.captionReviewed) add("Review the caption and ensure its facts are covered by the selected evidence.");
  if (board.brief.type === "journey") add("Check milestone dates and athlete identity; an exceptional outcome is not a recruiting promise.", "suggestion");
  return issues;
}
