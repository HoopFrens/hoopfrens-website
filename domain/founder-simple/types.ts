import type { KnowledgeConfidence, KnowledgeSourceReliability } from "../knowledge";
import type { ProductionPackage } from "../services";
import type { EntityId, ISODateString } from "../shared";

export enum FounderWorkflowKind {
  SchoolSpotlight = "school-spotlight",
}

export enum FounderWorkflowStep {
  Request = "request",
  Review = "review",
  Customize = "customize",
  Approve = "approve",
}

export enum FounderWorkflowStatus {
  Active = "active",
  Completed = "completed",
  Archived = "archived",
}

export enum SpotlightPlatform {
  InstagramReel = "instagram-reel",
  TikTok = "tiktok",
  YouTubeShort = "youtube-short",
}

export enum SpotlightGoal {
  IntroduceSchool = "introduce-school",
  ShowcaseFacilities = "showcase-facilities",
  ExplainBasketballProgram = "explain-basketball-program",
  HighlightStudentAthleteExperience = "highlight-student-athlete-experience",
  HelpRecruitsEvaluate = "help-recruits-evaluate",
  CorrectMisconception = "correct-misconception",
  PromoteSpecificStrength = "promote-specific-strength",
  TellUniqueSchoolStory = "tell-unique-school-story",
  IncreaseAwareness = "increase-awareness",
  Other = "other",
}

export enum SpotlightAudience {
  Players = "players",
  ParentsAndFamilies = "parents-and-families",
  HighSchoolCoaches = "high-school-coaches",
  CollegeCoaches = "college-coaches",
  Recruits = "recruits",
  CurrentStudents = "current-students",
  Alumni = "alumni",
  BasketballFans = "basketball-fans",
  Other = "other",
}

export enum SpotlightEmphasis {
  Facilities = "facilities",
  BasketballProgram = "basketball-program",
  CoachingStaff = "coaching-staff",
  AcademicOpportunities = "academic-opportunities",
  CampusExperience = "campus-experience",
  Location = "location",
  RecruitingOpportunity = "recruiting-opportunity",
  PlayerDevelopment = "player-development",
  Affordability = "affordability",
  SchoolCulture = "school-culture",
  Other = "other",
}

export enum SpotlightMedia {
  SchoolProvidedPhotos = "school-provided-photos",
  CampusPhotos = "campus-photos",
  FacilityPhotos = "facility-photos",
  GameFootage = "game-footage",
  PracticeFootage = "practice-footage",
  PlayerPhotos = "player-photos",
  CoachPhotos = "coach-photos",
  Logos = "logos",
  NoMediaYet = "no-media-yet",
  Other = "other",
}

export enum SpotlightFactStatus {
  Verified = "verified",
  Supported = "supported",
  NeedsConfirmation = "needs-confirmation",
  Conflicting = "conflicting",
  NotAvailable = "not-available",
}

export enum SpotlightTone {
  ClearAndConfident = "clear-and-confident",
  Energetic = "energetic",
  CommunityFocused = "community-focused",
}

export enum SpotlightLength {
  Short = "short",
  Standard = "standard",
  Extended = "extended",
}

export enum SpotlightBrandingPreset {
  Headquarters = "headquarters",
  SchoolFirst = "school-first",
  CommunityStory = "community-story",
}

export interface GuidedSchoolDraft {
  officialName: string;
  city: string;
  state: string;
  schoolWebsite?: string;
  athleticsWebsite?: string;
  governingBody?: string;
  division?: string;
}

export interface SchoolSpotlightRequest {
  /** Legacy freeform value retained losslessly for existing drafts and packages. */
  objective: string;
  goals: SpotlightGoal[];
  goalOther?: string;
  supplementalGoalText?: string;
  /** Legacy freeform value retained losslessly for existing drafts and packages. */
  audience: string;
  audiences: SpotlightAudience[];
  audienceOther?: string;
  platforms: SpotlightPlatform[];
  /** Legacy freeform value retained losslessly for existing drafts and packages. */
  centralEmphasis: string;
  primaryEmphasis?: SpotlightEmphasis;
  emphasisOther?: string;
  specificAngle?: string;
  /** Legacy freeform values retained losslessly for existing drafts and packages. */
  availableMedia: string[];
  media: SpotlightMedia[];
  mediaOther?: string;
  mediaDescription?: string;
  needShotList: boolean;
  callToAction: string;
}

export interface SchoolSpotlightFact {
  id: string;
  category: string;
  label: string;
  value?: string;
  status: SpotlightFactStatus;
  confidence?: KnowledgeConfidence;
  sourceIds: EntityId[];
  included: boolean;
  founderText?: string;
  position: number;
}

export interface SchoolSpotlightCustomization {
  tone: SpotlightTone;
  length: SpotlightLength;
  hook: string;
  emphasis: string;
  callToAction: string;
  mediaAvailability: string[];
  brandingPreset: SpotlightBrandingPreset;
  verticalVideoScript: string;
  instagramCaption: string;
  shotList: string[];
  rightsConfirmed: boolean;
}

export interface FounderWorkflowDraft {
  id: EntityId;
  workspaceId: EntityId;
  ownerId: EntityId;
  kind: FounderWorkflowKind.SchoolSpotlight;
  step: FounderWorkflowStep;
  status: FounderWorkflowStatus;
  schoolDraft?: GuidedSchoolDraft;
  schoolId?: EntityId;
  projectId?: EntityId;
  request: SchoolSpotlightRequest;
  facts: SchoolSpotlightFact[];
  customization: SchoolSpotlightCustomization;
  currentPackageId?: EntityId;
  currentPackageVersion?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: EntityId;
  updatedBy: EntityId;
  revision: number;
}

export type FounderWorkflowDraftCreateInput = Omit<
  FounderWorkflowDraft,
  "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "revision"
>;

export type FounderWorkflowDraftUpdate = Partial<Omit<
  FounderWorkflowDraft,
  "id" | "workspaceId" | "ownerId" | "kind" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "revision"
>>;

export interface SpotlightSourceEvidence {
  sourceId: EntityId;
  sourceVersion: number;
  title: string;
  publisher?: string;
  reliability: KnowledgeSourceReliability;
  accessedAt: ISODateString;
}

export interface SpotlightFactSnapshot {
  id: string;
  category: string;
  label: string;
  value: string;
  status: SpotlightFactStatus;
  founderAuthored: boolean;
  sources: SpotlightSourceEvidence[];
  position: number;
}

export interface VerticalVideoScene {
  id: string;
  heading: string;
  narration: string;
  visualDirection: string;
}

export interface SchoolSpotlightPackage extends ProductionPackage {
  packageKind: FounderWorkflowKind.SchoolSpotlight;
  workflowDraftId: EntityId;
  schoolId: EntityId;
  request: SchoolSpotlightRequest;
  customization: SchoolSpotlightCustomization;
  selectedFacts: SpotlightFactSnapshot[];
  excludedFactIds: string[];
  unresolvedWarnings: string[];
  verticalVideo: {
    title: string;
    hook: string;
    scenes: VerticalVideoScene[];
    callToAction: string;
  };
  instagramCaption: string;
  shotList: string[];
  verificationSources: SpotlightSourceEvidence[];
  rightsConfirmed: boolean;
  changeSummary: string;
  previousPackageId?: EntityId;
}

export interface FounderWorkflowMutationContext {
  actorId: EntityId;
}

export interface FounderWorkflowMutationOptions {
  expectedRevision?: number;
}
