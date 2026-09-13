import { approvedStoryClaims, startStoryboard, type StoryboardInput, type StoryAsset } from "./storyboard";
import { requireCondition, type PackageBinding, type ResearchPackage } from "./types";

export const teamChoices = ["Men's basketball", "Women's basketball", "Football"] as const;
export interface SchoolRequestInput { schoolName: string; location: string; team: typeof teamChoices[number] }
export interface SchoolRequest extends SchoolRequestInput { id: string; ownerId: string; createdAt: string; status: "needs-setup" | "ready"; sourcePolicy?: import("./types").SourcePolicy; sourcePreview?: { title: string; excerpt: string; url: string; contentHash: string }; sourceApprovedAt?: string; sourcePreviewHash?: string; approvedPackageId?: string }
export function validateSchoolRequest(input: unknown): SchoolRequestInput {
  requireCondition(input && typeof input === "object" && !Array.isArray(input), "invalid-school-request");
  const v = input as Record<string, unknown>;
  requireCondition(Object.keys(v).sort().join() === "location,schoolName,team", "invalid-school-request");
  requireCondition(typeof v.schoolName === "string" && v.schoolName.trim().length >= 2 && v.schoolName.length <= 120 && !/[\u0000-\u001f]/.test(v.schoolName), "invalid-school-request");
  requireCondition(typeof v.location === "string" && v.location.length <= 120 && !/[\u0000-\u001f]/.test(v.location), "invalid-school-request");
  requireCondition(teamChoices.includes(v.team as SchoolRequestInput["team"]), "invalid-school-request");
  return { schoolName: v.schoolName.trim(), location: v.location.trim(), team: v.team as SchoolRequestInput["team"] };
}
export function latestSchoolPackages(packages: PackageBinding[]) {
  const result = new Map<string, PackageBinding>();
  for (const p of packages) {
    const key = `${p.schoolId}:${p.team || "Men's basketball"}`;
    const previous = result.get(key);
    if (!previous || p.version > previous.version || (p.version === previous.version && p.packageId.localeCompare(previous.packageId) > 0)) result.set(key, p);
  }
  return [...result.values()].sort((a,b) => a.schoolName.localeCompare(b.schoolName));
}
// Reviewed documentary photo candidates. Permission is always a separate Founder decision.
const malonePhotos: StoryAsset[] = [
  { id: "malone-osborne-court", label: "Osborne Hall basketball court", imageUrl: "https://malonepioneers.com/images/2026/7/15/DJI_0051_tWra0.jpeg", sourceUrl: "https://malonepioneers.com/sports/2010/8/11/GEN_0811104901.aspx", credit: "Malone University Athletics", capturedOn: "", rights: "pending", permissionNote: "" },
  { id: "malone-hal-smith", label: "Hal Smith Court signature", imageUrl: "https://malonepioneers.com/images/2026/7/15/hal_smith.png", sourceUrl: "https://malonepioneers.com/sports/2010/8/11/GEN_0811104901.aspx", credit: "Malone University Athletics", capturedOn: "", rights: "pending", permissionNote: "" },
];
export function simpleCarousel(research: ResearchPackage): StoryboardInput {
  const all = approvedStoryClaims(research);
  const football = research.binding.team === "Football";
  const team = research.binding.team || "Men's basketball";
  const name = research.binding.schoolName.replace(/ University$| College$/, "");
  const coverName = name.length > 70 ? `${name.slice(0,67).trimEnd()}...` : name;
  const facilities = all.filter(c => /court|hall|seat|capacit|facilit|arena|stadium|weight|field|locker|campus/i.test(c.text));
  const chosen = (facilities.length ? facilities : all).slice(0, 3);
  const board = startStoryboard(research, { type: football ? "facilities" : "court", audience: "Athletes and parents", action: "Save for a visit", angle: `A closer look at the ${team.toLowerCase()} setting` }, chosen.length + 2, chosen.map(c => c.id));
  const useMalone = !football && research.binding.schoolId === "school-malone-university" && chosen.every(c => /Osborne|Hal Smith/i.test(c.text));
  board.assets = useMalone ? structuredClone(malonePhotos) : [];
  board.slides = board.slides.map((s, i) => {
    const claim = chosen[i - 1];
    const photo = useMalone && s.role !== "takeaway" ? board.assets[claim && /Hal Smith/.test(claim.text) ? 1 : 0] : undefined;
    return { ...s, layout: photo ? "photo" : "text", assetId: photo?.id || null,
      headline: s.role === "cover" ? `${coverName}, from the ${football ? "field" : "court"}` : s.role === "takeaway" ? "Ask more on your visit" : claim && /Hal Smith/.test(claim.text) ? "The story on the floor" : claim && /seats|capacity/i.test(claim.text) ? "Room for the crowd" : football ? "Inside the program" : "Inside the gym",
      body: s.role === "takeaway" ? "When can players use the gym?\nWhat does a practice week look like?\nHow does the team support class time?" : s.body };
  });
  if (chosen.length >= 2) {
    // Put the first supported fact on the cover instead of repeating its image on another slide.
    board.slides[0] = { ...board.slides[0], body: chosen[0].text, claimIds: [chosen[0].id] };
    board.slides.splice(1, 1);
  }
  if (football) board.slides.at(-1)!.body = "Where does the team train?\nWhat does a practice week look like?\nHow does the team support class time?";
  board.caption = `Inside ${research.binding.schoolName} ${team.toLowerCase()}.\n\n${chosen.map(c => c.text).join("\n\n")}\n\nSave for a visit.`;
  return board;
}
