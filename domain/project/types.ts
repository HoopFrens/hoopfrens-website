import type { Priority, ProjectStatus, Region, Scope } from "../shared/enums";
import type { EntityId, ISODateString } from "../shared/types";

export enum ProjectType {
  SchoolSpotlight = "school-spotlight",
  PodcastEpisode = "podcast-episode",
  NewsStory = "news-story",
  RecruitingAnalysis = "recruiting-analysis",
  SocialVideo = "social-video",
  ResourceGuide = "resource-guide",
  Partnership = "partnership",
  WebsiteImprovement = "website-improvement",
  Merchandise = "merchandise",
}

export enum ProjectWorkspace {
  ExecutiveOffice = "executive-office",
  IntelligenceCenter = "intelligence-center",
  ProductionStudio = "production-studio",
  StrategyRoom = "strategy-room",
  ProductLab = "product-lab",
  Library = "library",
}

export interface ProjectWorkspaceHistoryEntry {
  workspace: ProjectWorkspace;
  enteredAt: ISODateString;
  reason: string;
}

export interface ProjectStateHistoryEntry {
  state: ProjectStatus;
  enteredAt: ISODateString;
  reason: string;
}

export interface ProjectState {
  type: ProjectType;
  projectType: ProjectType;
  state: ProjectStatus;
  status: ProjectStatus;
  currentWorkspace: ProjectWorkspace;
  workspaceHistory: ProjectWorkspaceHistoryEntry[];
  stateHistory?: ProjectStateHistoryEntry[];
  progressPercent: number;
  priority: Priority;
  ownerId: EntityId;
  dueDate?: ISODateString;
  dependencies: EntityId[];
  currentBlocker: string | null;
  currentStep: string;
  recommendedNextAction: string;
  lastActivity: string;
  productionCompletedAt?: ISODateString | null;
}

export interface Project extends ProjectState {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  summary?: string;
  workspace?: string;
  region?: Region;
  scope: Scope;
  contributorIds: EntityId[];
  knowledgeEntityIds: EntityId[];
  assetIds: EntityId[];
  decisionIds: EntityId[];
  sourceIds: EntityId[];
  completedSoFar?: string[];
  remainingNextStep?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  version?: number;
  creationRequestId?: string;
  activeProductionVersion?: number | null;
  productionReadinessInvalidatedAt?: ISODateString | null;
}
