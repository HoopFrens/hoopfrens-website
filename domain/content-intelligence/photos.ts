import type { StoryboardInput, StoryAsset } from "./storyboard";
export const photoCategories = ["Courts", "Fields", "Weight rooms", "Campus", "Locker rooms", "Game action", "Other"] as const;
export type PhotoCategory = typeof photoCategories[number];
export interface PhotoCandidate { asset: StoryAsset; category: PhotoCategory; context: string; width?: number; height?: number }
export interface PhotoSearch { photos: PhotoCandidate[]; searchedPages: number; foundAt: string; notes: string[] }
export function photoCaption(board: StoryboardInput): string {
  const used = board.assets.filter(a => board.slides.some(s => s.layout === "photo" && s.assetId === a.id));
  const credits = [...new Set(used.map(a => a.credit.trim()))];
  return board.caption.trim() + (credits.length ? `\n\nPhoto credits / sources: ${credits.join("; ")}.` : "");
}
