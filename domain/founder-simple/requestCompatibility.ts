import {
  SpotlightAudience,
  SpotlightEmphasis,
  SpotlightGoal,
  SpotlightMedia,
  type FounderWorkflowDraft,
  type SchoolSpotlightRequest,
} from "./types";

export const spotlightGoalLabels: Readonly<Record<SpotlightGoal, string>> = {
  [SpotlightGoal.IntroduceSchool]: "Introduce the school",
  [SpotlightGoal.ShowcaseFacilities]: "Showcase basketball facilities",
  [SpotlightGoal.ExplainBasketballProgram]: "Explain the basketball program",
  [SpotlightGoal.HighlightStudentAthleteExperience]: "Highlight the student-athlete experience",
  [SpotlightGoal.HelpRecruitsEvaluate]: "Help recruits evaluate the school",
  [SpotlightGoal.CorrectMisconception]: "Correct a misconception",
  [SpotlightGoal.PromoteSpecificStrength]: "Promote a specific strength",
  [SpotlightGoal.TellUniqueSchoolStory]: "Tell a unique school story",
  [SpotlightGoal.IncreaseAwareness]: "Increase awareness",
  [SpotlightGoal.Other]: "Other",
};

export const spotlightAudienceLabels: Readonly<Record<SpotlightAudience, string>> = {
  [SpotlightAudience.Players]: "Players",
  [SpotlightAudience.ParentsAndFamilies]: "Parents and families",
  [SpotlightAudience.HighSchoolCoaches]: "High school coaches",
  [SpotlightAudience.CollegeCoaches]: "College coaches",
  [SpotlightAudience.Recruits]: "Recruits",
  [SpotlightAudience.CurrentStudents]: "Current students",
  [SpotlightAudience.Alumni]: "Alumni",
  [SpotlightAudience.BasketballFans]: "Basketball fans",
  [SpotlightAudience.Other]: "Other",
};

export const spotlightEmphasisLabels: Readonly<Record<SpotlightEmphasis, string>> = {
  [SpotlightEmphasis.Facilities]: "Facilities",
  [SpotlightEmphasis.BasketballProgram]: "Basketball program",
  [SpotlightEmphasis.CoachingStaff]: "Coaching staff",
  [SpotlightEmphasis.AcademicOpportunities]: "Academic opportunities",
  [SpotlightEmphasis.CampusExperience]: "Campus experience",
  [SpotlightEmphasis.Location]: "Location",
  [SpotlightEmphasis.RecruitingOpportunity]: "Recruiting opportunity",
  [SpotlightEmphasis.PlayerDevelopment]: "Player development",
  [SpotlightEmphasis.Affordability]: "Affordability",
  [SpotlightEmphasis.SchoolCulture]: "School culture",
  [SpotlightEmphasis.Other]: "Other",
};

export const spotlightMediaLabels: Readonly<Record<SpotlightMedia, string>> = {
  [SpotlightMedia.SchoolProvidedPhotos]: "School-provided photos",
  [SpotlightMedia.CampusPhotos]: "Campus photos",
  [SpotlightMedia.FacilityPhotos]: "Gym or facility photos",
  [SpotlightMedia.GameFootage]: "Game footage",
  [SpotlightMedia.PracticeFootage]: "Practice footage",
  [SpotlightMedia.PlayerPhotos]: "Player photos",
  [SpotlightMedia.CoachPhotos]: "Coach photos",
  [SpotlightMedia.Logos]: "Logos",
  [SpotlightMedia.NoMediaYet]: "No media yet",
  [SpotlightMedia.Other]: "Other",
};

export const spotlightGoalOptions = Object.entries(spotlightGoalLabels).map(([value, label]) => ({
  value: value as SpotlightGoal,
  label,
}));

export const spotlightAudienceOptions = Object.entries(spotlightAudienceLabels).map(([value, label]) => ({
  value: value as SpotlightAudience,
  label,
}));

export const spotlightEmphasisOptions = Object.entries(spotlightEmphasisLabels).map(([value, label]) => ({
  value: value as SpotlightEmphasis,
  label,
}));

export const spotlightMediaOptions = Object.entries(spotlightMediaLabels).map(([value, label]) => ({
  value: value as SpotlightMedia,
  label,
}));

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function comparable(value: string) {
  return value.trim().toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
}

function enumByLabel<T extends string>(labels: Readonly<Record<T, string>>) {
  return new Map(Object.entries(labels).map(([value, label]) => [comparable(String(label)), value as T]));
}

const goalByLabel = enumByLabel(spotlightGoalLabels);
const audienceByLabel = enumByLabel(spotlightAudienceLabels);
const emphasisByLabel = enumByLabel(spotlightEmphasisLabels);
const mediaByLabel = enumByLabel(spotlightMediaLabels);

const audienceAliases = new Map<string, SpotlightAudience>([
  ["player", SpotlightAudience.Players],
  ["parent", SpotlightAudience.ParentsAndFamilies],
  ["parents", SpotlightAudience.ParentsAndFamilies],
  ["family", SpotlightAudience.ParentsAndFamilies],
  ["families", SpotlightAudience.ParentsAndFamilies],
  ["high school coach", SpotlightAudience.HighSchoolCoaches],
  ["college coach", SpotlightAudience.CollegeCoaches],
  ["recruit", SpotlightAudience.Recruits],
  ["current student", SpotlightAudience.CurrentStudents],
  ["basketball fan", SpotlightAudience.BasketballFans],
]);

function unique<T extends string>(values: T[]) {
  return [...new Set(values)];
}

function legacyString(data: UnknownRecord, key: string) {
  return key in data ? data[key] as string : "";
}

function optionalLegacyString(data: UnknownRecord, key: string) {
  return key in data ? data[key] as string : undefined;
}

function legacyStringList(data: UnknownRecord, key: string) {
  return key in data ? data[key] as string[] : [];
}

function deriveGoals(objective: unknown) {
  if (typeof objective !== "string" || !objective.trim()) return { goals: [] as SpotlightGoal[] };
  const recognized = goalByLabel.get(comparable(objective));
  return recognized
    ? { goals: [recognized] }
    : { goals: [SpotlightGoal.Other], goalOther: objective };
}

function audienceParts(audience: string) {
  return audience.split(/\s*(?:,|;|\/|&|\band\b)\s*/i).filter((value) => value.trim());
}

function deriveAudiences(audience: unknown) {
  if (typeof audience !== "string" || !audience.trim()) return { audiences: [] as SpotlightAudience[] };
  const audiences: SpotlightAudience[] = [];
  const unmatched: string[] = [];
  for (const part of audienceParts(audience)) {
    const key = comparable(part);
    const recognized = audienceByLabel.get(key) || audienceAliases.get(key);
    if (recognized && recognized !== SpotlightAudience.Other) audiences.push(recognized);
    else unmatched.push(part);
  }
  if (unmatched.length) audiences.push(SpotlightAudience.Other);
  return {
    audiences: unique(audiences),
    ...(unmatched.length ? { audienceOther: unmatched.join(", ") } : {}),
  };
}

function deriveEmphasis(centralEmphasis: unknown) {
  if (typeof centralEmphasis !== "string" || !centralEmphasis.trim()) return {};
  const recognized = emphasisByLabel.get(comparable(centralEmphasis));
  return recognized
    ? { primaryEmphasis: recognized }
    : { primaryEmphasis: SpotlightEmphasis.Other, emphasisOther: centralEmphasis };
}

function mediaParts(media: string[]) {
  return media.flatMap((value) => value.split(/\s*(?:,|;)\s*/).filter((part) => part.trim()));
}

function deriveMedia(availableMedia: unknown) {
  if (!Array.isArray(availableMedia) || availableMedia.some((value) => typeof value !== "string")) {
    return { media: [] as SpotlightMedia[] };
  }
  const media: SpotlightMedia[] = [];
  const unmatched: string[] = [];
  for (const part of mediaParts(availableMedia)) {
    const recognized = mediaByLabel.get(comparable(part));
    if (recognized && recognized !== SpotlightMedia.Other) media.push(recognized);
    else unmatched.push(part);
  }
  if (unmatched.length) media.push(SpotlightMedia.Other);
  const selected = unique(media);
  // A malformed legacy freeform value remains intact in availableMedia. Prefer
  // its concrete media choices over a contradictory "No media yet" projection.
  const compatible = selected.includes(SpotlightMedia.NoMediaYet) && selected.length > 1
    ? selected.filter((value) => value !== SpotlightMedia.NoMediaYet)
    : selected;
  return {
    media: compatible,
    ...(unmatched.length ? { mediaOther: unmatched.join(", ") } : {}),
  };
}

/**
 * Adds the structured request fields to a legacy draft without discarding its
 * original freeform compatibility values. Supplied structured fields are kept
 * intact so validation can reject unsupported or malformed values.
 */
export function normalizeSchoolSpotlightRequest(value: unknown): SchoolSpotlightRequest {
  const data = record(value);
  const objective = legacyString(data, "objective");
  const audience = legacyString(data, "audience");
  const centralEmphasis = legacyString(data, "centralEmphasis");
  const availableMedia = legacyStringList(data, "availableMedia");
  const derivedGoals = deriveGoals(objective);
  const derivedAudiences = deriveAudiences(audience);
  const derivedEmphasis = deriveEmphasis(centralEmphasis);
  const derivedMedia = deriveMedia(availableMedia);
  const goalOther = optionalLegacyString(data, "goalOther") ?? derivedGoals.goalOther;
  const supplementalGoalText = optionalLegacyString(data, "supplementalGoalText");
  const audienceOther = optionalLegacyString(data, "audienceOther") ?? derivedAudiences.audienceOther;
  const primaryEmphasis = ("primaryEmphasis" in data ? data.primaryEmphasis : derivedEmphasis.primaryEmphasis) as SpotlightEmphasis | undefined;
  const emphasisOther = optionalLegacyString(data, "emphasisOther") ?? derivedEmphasis.emphasisOther;
  const specificAngle = optionalLegacyString(data, "specificAngle");
  const mediaOther = optionalLegacyString(data, "mediaOther") ?? derivedMedia.mediaOther;
  const mediaDescription = optionalLegacyString(data, "mediaDescription");
  return {
    objective,
    goals: ("goals" in data ? data.goals : derivedGoals.goals) as SpotlightGoal[],
    ...(goalOther !== undefined ? { goalOther } : {}),
    ...(supplementalGoalText !== undefined ? { supplementalGoalText } : {}),
    audience,
    audiences: ("audiences" in data ? data.audiences : derivedAudiences.audiences) as SpotlightAudience[],
    ...(audienceOther !== undefined ? { audienceOther } : {}),
    platforms: legacyStringList(data, "platforms") as SchoolSpotlightRequest["platforms"],
    centralEmphasis,
    ...(primaryEmphasis !== undefined ? { primaryEmphasis } : {}),
    ...(emphasisOther !== undefined ? { emphasisOther } : {}),
    ...(specificAngle !== undefined ? { specificAngle } : {}),
    availableMedia,
    media: ("media" in data ? data.media : derivedMedia.media) as SpotlightMedia[],
    ...(mediaOther !== undefined ? { mediaOther } : {}),
    ...(mediaDescription !== undefined ? { mediaDescription } : {}),
    needShotList: ("needShotList" in data ? data.needShotList : false) as boolean,
    callToAction: legacyString(data, "callToAction"),
  };
}

export function normalizeFounderWorkflowDraft(value: unknown): FounderWorkflowDraft {
  const data = record(value);
  return {
    ...data,
    request: normalizeSchoolSpotlightRequest(data.request),
  } as unknown as FounderWorkflowDraft;
}

function present(values: Array<string | undefined>) {
  return values.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
}

export type SchoolSpotlightRequestProjectionSection = "goal" | "audience" | "emphasis" | "media";

/**
 * Refreshes only the explicitly edited legacy projection. Requiring the caller
 * to name the edited section prevents an unrelated structured choice (such as
 * needShotList) from rewriting a legacy Founder's original freeform wording.
 */
export function synchronizeSchoolSpotlightRequest(
  value: SchoolSpotlightRequest,
  editedSections: readonly SchoolSpotlightRequestProjectionSection[],
): SchoolSpotlightRequest {
  const request = normalizeSchoolSpotlightRequest(value);
  const objective = present([
    ...request.goals.filter((goal) => goal !== SpotlightGoal.Other).map((goal) => spotlightGoalLabels[goal]),
    request.goals.includes(SpotlightGoal.Other) ? request.goalOther : undefined,
    request.supplementalGoalText,
  ]).join("; ");
  const audience = present([
    ...request.audiences.filter((item) => item !== SpotlightAudience.Other).map((item) => spotlightAudienceLabels[item]),
    request.audiences.includes(SpotlightAudience.Other) ? request.audienceOther : undefined,
  ]).join(", ");
  const centralEmphasis = present([
    request.primaryEmphasis && request.primaryEmphasis !== SpotlightEmphasis.Other
      ? spotlightEmphasisLabels[request.primaryEmphasis]
      : undefined,
    request.primaryEmphasis === SpotlightEmphasis.Other ? request.emphasisOther : undefined,
    request.specificAngle,
  ]).join(": ");
  const availableMedia = present([
    ...request.media.filter((item) => item !== SpotlightMedia.Other).map((item) => spotlightMediaLabels[item]),
    request.media.includes(SpotlightMedia.Other) ? request.mediaOther : undefined,
    request.mediaDescription,
  ]);
  const edited = new Set(editedSections);
  return {
    ...request,
    ...(edited.has("goal") ? { objective } : {}),
    ...(edited.has("audience") ? { audience } : {}),
    ...(edited.has("emphasis") ? { centralEmphasis } : {}),
    ...(edited.has("media") ? { availableMedia } : {}),
  };
}
