import {
  SpotlightBrandingPreset,
  SpotlightFactStatus,
  SpotlightLength,
  SpotlightPlatform,
  SpotlightTone,
} from "@/domain/founder-simple";

export const platformLabels: Record<SpotlightPlatform, string> = {
  [SpotlightPlatform.InstagramReel]: "Instagram Reel",
  [SpotlightPlatform.TikTok]: "TikTok",
  [SpotlightPlatform.YouTubeShort]: "YouTube Short",
};

export const factStatusLabels: Record<SpotlightFactStatus, string> = {
  [SpotlightFactStatus.Verified]: "Verified",
  [SpotlightFactStatus.Supported]: "Supported by a Reliable Source",
  [SpotlightFactStatus.NeedsConfirmation]: "Needs Confirmation",
  [SpotlightFactStatus.Conflicting]: "Conflicting Information",
  [SpotlightFactStatus.NotAvailable]: "Not Available Yet",
};

export const toneLabels: Record<SpotlightTone, string> = {
  [SpotlightTone.ClearAndConfident]: "Clear and Confident",
  [SpotlightTone.Energetic]: "Energetic",
  [SpotlightTone.CommunityFocused]: "Community Focused",
};

export const lengthLabels: Record<SpotlightLength, string> = {
  [SpotlightLength.Short]: "Short",
  [SpotlightLength.Standard]: "Standard",
  [SpotlightLength.Extended]: "Extended",
};

export const brandingLabels: Record<SpotlightBrandingPreset, string> = {
  [SpotlightBrandingPreset.Headquarters]: "Hoop Frens Headquarters",
  [SpotlightBrandingPreset.SchoolFirst]: "School First",
  [SpotlightBrandingPreset.CommunityStory]: "Community Story",
};
