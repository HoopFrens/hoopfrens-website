import { platforms, requireCondition, type Platform, type PlatformDraft, type PlatformContent, type DraftBlock, type ResearchPackage } from "./types";

export const voiceRegistry = {
  version: "hf-editorial-1",
  voice: "Basketball-first, clear, confident, educational, premium sports editorial, respectful of every level, useful to athletes and parents. No hype, invented facts or recruiting promises.",
  patterns: {
    court: { title: "Start With the Court", hook: "Start with the basketball. Look closely at the setting.", bridge: "Here is what the source record supports.", cta: "Save this for your next school conversation." },
    details: { title: "The Basketball Details", hook: "Give the details a closer look.", bridge: "Use these details to shape your next questions.", cta: "Bring your questions to a campus visit." },
    perspective: { title: "A Closer School Look", hook: "Build your own view of a basketball program.", bridge: "For athletes and families, start with the evidence.", cta: "Keep exploring. Ask what fits your goals." },
  },
  visualDirections: ["Open with rights-cleared court or campus footage when available.", "Pair each sourced detail with a readable Hoop Frens text card.", "Close with the series title and a clear question for the viewer."],
} as const;
export type PatternId = keyof typeof voiceRegistry.patterns;
export interface DraftSelection { platform: Platform; patternId: PatternId; claimIds: string[] }
const formats: Record<Platform, string> = { instagram: "Carousel outline and caption", tiktok: "Vertical video script", youtube: "Short video script", facebook: "Editorial post", x: "Post thread", website: "Spotlight article draft" };

export function createPlatformDrafts(research: ResearchPackage, input: unknown): PlatformDraft[] {
  requireCondition(Array.isArray(input) && input.length === platforms.length, "invalid-platform-plan");
  const seen = new Set<string>();
  return input.map((raw: unknown) => {
    requireCondition(raw && typeof raw === "object" && !Array.isArray(raw), "invalid-platform-plan");
    const item = raw as DraftSelection;
    requireCondition(Object.keys(item).sort().join() === "claimIds,patternId,platform", "unapproved-output-field");
    requireCondition(platforms.includes(item.platform) && !seen.has(item.platform), "invalid-platform-plan");
    seen.add(item.platform);
    requireCondition(Object.hasOwn(voiceRegistry.patterns, item.patternId), "unapproved-editorial-pattern");
    requireCondition(Array.isArray(item.claimIds) && item.claimIds.length > 0 && item.claimIds.length <= 6
      && new Set(item.claimIds).size === item.claimIds.length, "invalid-claim-selection");
    const base = voiceRegistry.patterns[item.patternId];
    const football = research.binding.team === "Football";
    const pattern = {...base, title: football ? base.title.replaceAll("Court","Field").replaceAll("Basketball","Football") : base.title, hook: football ? base.hook.replaceAll("basketball","football") : base.hook};
    const directions = voiceRegistry.visualDirections.map(text => football ? text.replace("court", "field") : text);
    const claims = item.claimIds.map(id => {
      const claim = research.claims.find(candidate => candidate.id === id);
      requireCondition(claim?.confidence === "supported" && claim.evidence.length > 0 && claim.review?.decision === "supported", "unsupported-claim-rejected");
      return claim;
    });
    const blocks = [
      { text: pattern.hook, claimId: null, citations: [] },
      { text: pattern.bridge, claimId: null, citations: [] },
      ...claims.map(claim => {
        const citations = claim.evidence.map(evidence => {
          const source = research.sources.find(source => source.id === evidence.sourceId);
          requireCondition(source, "missing-claim-evidence");
          return source;
        });
        requireCondition(item.platform !== "x" || claim.text.length <= 240, "x-claim-too-long");
        return { text: claim.text, claimId: claim.id, citations };
      }),
      { text: pattern.cta, claimId: null, citations: [] },
    ];
    return { platform: item.platform, format: formats[item.platform], title: `${research.binding.schoolName} | ${pattern.title}`,
      blocks, visualDirections: directions, content: platformContent(item.platform, `${research.binding.schoolName} | ${pattern.title}`, blocks, directions), status: "draft" };
  });
}


function platformContent(platform: Platform, title: string, blocks: DraftBlock[], directions: string[]): PlatformContent {
  const scenes = blocks.map((block, index) => ({ onScreenText: block.text, narration: block, visualDirection: directions[index === 0 ? 0 : index === blocks.length - 1 ? 2 : 1] }));
  switch (platform) {
    case "instagram": return { type: platform, slides: blocks.filter((_block, index) => index !== 1), caption: blocks };
    case "tiktok": return { type: platform, scenes };
    case "youtube": return { type: platform, title, description: [blocks[0], blocks.at(-1)!], scenes };
    case "facebook": return { type: platform, post: blocks };
    case "x": {
      for (const block of blocks) requireCondition(block.text.length + block.citations.length * 24 <= 280, "x-claim-too-long");
      return { type: platform, posts: blocks };
    }
    case "website": return { type: platform, headline: title, deck: blocks[0], sections: [
      { heading: title.includes("Football") || directions[0].includes("field") ? "The football details" : "The basketball details", body: blocks.slice(1, -1) }, { heading: "For your next school conversation", body: [blocks.at(-1)!] },
    ] };
  }
}
export function draftSections(draft: PlatformDraft): { label: string; blocks: DraftBlock[] }[] {
  const content = draft.content;
  switch (content.type) {
    case "instagram": return [...content.slides.map((block, index) => ({ label: `Carousel slide ${index + 1}`, blocks: [block] })), { label: "Caption", blocks: content.caption }];
    case "tiktok": return content.scenes.map((scene, index) => ({ label: `Scene ${index + 1} · Narration / on-screen text`, blocks: [scene.narration] }));
    case "youtube": return [{ label: "Description", blocks: content.description }, ...content.scenes.map((scene, index) => ({ label: `Scene ${index + 1} · Narration / on-screen text`, blocks: [scene.narration] }))];
    case "facebook": return [{ label: "Post", blocks: content.post }];
    case "x": return content.posts.map((block, index) => ({ label: `Post ${index + 1} of ${content.posts.length}`, blocks: [block] }));
    case "website": return [{ label: "Opening", blocks: [content.deck] }, ...content.sections.map(section => ({ label: section.heading, blocks: section.body }))];
  }
}
