import { storyIssues, type Storyboard } from "./storyboard";
import type { ResearchPackage } from "./types";

export const renderPolicy = { version: "instagram-stills-v3-team-aware", width: 1080, height: 1350, maxImageBytes: 8_000_000, maxPixels: 32_000_000, maxJobBytes: 80_000_000, maxStoredBytes: 512_000_000, maxJobs: 50, timeoutMs: 120_000, maxAttempts: 2 } as const;
export type RenderStatus = "running" | "proof" | "approved" | "failed" | "cancelled" | "deleted";
export interface RenderFile { name: string; sha256: string; bytes: number; type: "image/png" | "text/plain" | "application/json" | "application/zip" }
export interface RenderPhoto { assetId: string; originalHash: string; normalizedHash: string; bytes: number; width: number; height: number; resolvedUrl: string; retrievedAt: string }
export interface RenderEvent { at: string; action: string; actorId: string }
export interface RenderJob {
  id: string; ownerId: string; requestId: string; inputHash: string; status: RenderStatus; attempt: number;
  createdAt: string; updatedAt: string; expiresAt: string; progress: number; errorCode?: string;
  board: Storyboard; research: ResearchPackage; photos: RenderPhoto[]; files: RenderFile[];
  blockers: string[]; events: RenderEvent[]; approvedAt?: string; approvedBy?: string; approvalHash?: string;
}
export type RenderSummary = Pick<RenderJob, "id" | "status" | "attempt" | "createdAt" | "updatedAt" | "expiresAt" | "progress" | "errorCode" | "blockers" | "files" | "approvedAt"> & { boardRevision: number; boardId: string };
export function renderSummary(job: RenderJob): RenderSummary {
  const { id, status, attempt, createdAt, updatedAt, expiresAt, progress, errorCode, blockers, files, approvedAt } = job;
  return { id, status, attempt, createdAt, updatedAt, expiresAt, progress, ...(errorCode ? { errorCode } : {}), blockers, files, ...(approvedAt ? { approvedAt } : {}), boardRevision: job.board.revision, boardId: job.board.id };
}
export function finalRenderBlockers(board: Storyboard) {
  return storyIssues(board).filter(i => i.severity === "review").map(i => i.message);
}
export const renderMessages: Record<string, string> = {
  "rendering-local-only": "Rendering is available only on the configured local workstation. Cloud rendering is not enabled.",
  "rendering-not-configured": "The private local rendering folder needs setup.",
  "render-storage-full": "The local rendering limit is reached. Delete old render files before retrying.",
  "render-storage-busy": "Another local save is finishing. Try again shortly.",
  "render-in-progress": "A render is already running. Wait or cancel it first.",
  "render-retry-limit": "This render reached its two-attempt limit. Fix the cause and start a new proof.",
  "render-timeout": "Rendering timed out. Your saved storyboard is safe; you can retry once.",
  "render-cancelled": "Rendering was cancelled.",
  "render-caption-too-long": "Shorten the caption so it fits Instagram with photo credits.",
  "render-text-does-not-fit": "Some copy does not fit at readable size. Shorten the headline or wording, save, and create a new proof.",
  "render-glyph-unsupported": "Some characters are unavailable in the export font. Remove emoji or unsupported characters and save again.",
  "render-image-rejected": "A source photo could not be safely decoded. Use a JPG, PNG or WebP within the image limits.",
  "render-image-unavailable": "A source photo could not be retrieved from its approved domain. Check its link and retry.",
  "render-photo-missing": "Choose a source photo for every photo layout before rendering.",
  "render-proof-required": "Create and inspect a completed proof before approving the graphics.",
  "render-review-required": "Copy review or image quality still needs attention. Save your corrections and create a new proof.",
  "render-not-approved": "Approve the exact rendered proof before downloading the final package.",
  "render-artifact-unavailable": "These render files are missing or changed. Create a new proof.",
  "storyboard-revision-changed": "The storyboard changed. Save and create a proof of its current revision.",
  "research-review-changed": "The evidence changed. Reopen the current evidence and storyboard.",
  "approved-version-changed": "The approved school version changed. Reopen its current storyboard.",
};
