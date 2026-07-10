import type { ExecutiveEvent } from "../event";
import type { RankedPriorityAssessment } from "../prioritization";
import type { Project } from "../project";
import type { ProjectRecommendation } from "../recommendation";
import type { ISODateString } from "../shared";

export type CompanyHealthTone = "healthy" | "attention" | "offline" | "neutral";

export interface CompanyHealthItem {
  label: string;
  status: "Green" | "Yellow" | "Red" | "Offline";
  summary: string;
  tone: CompanyHealthTone;
}

export type FounderWorkloadLabel = "Light" | "Moderate" | "Heavy";

export interface FounderWorkloadBreakdown {
  reviewsWaiting: number;
  approvalsWaiting: number;
  highPriorityProjects: number;
  blockedProjects: number;
  founderOwnedTasks: number;
}

export interface FounderFocusArea {
  projectId: string;
  title: string;
  reason: string;
  recommendationScore: number;
}

export interface FounderWorkload {
  actionCount: number;
  label: FounderWorkloadLabel;
  breakdown: FounderWorkloadBreakdown;
  topFocusAreas: FounderFocusArea[];
}

export type ExecutiveAttentionSeverity = "critical" | "attention";

export interface ExecutiveAttentionItem {
  project: Project;
  label: string;
  reason: string;
  severity: ExecutiveAttentionSeverity;
}

export interface ExecutiveOpportunityItem {
  project: Project;
  action: string;
  whyItMatters: string;
  recommendationScore: number;
}

export type DailyBriefActionType = "continue" | "review" | "approve" | "open-research-package" | "open-project";

export interface DailyBriefAction {
  type: DailyBriefActionType;
  label: string;
  project: Project;
  explanation: string;
}

export interface FounderDailyBrief {
  generatedAt: ISODateString;
  greeting: string;
  lastVisitAt: ISODateString | null;
  sinceLastVisit: ExecutiveEvent[];
  topPriority: RankedPriorityAssessment | null;
  projectsWaitingOnFounder: RankedPriorityAssessment[];
  projectsAtRisk: RankedPriorityAssessment[];
  projectsReadyToAdvance: RankedPriorityAssessment[];
  recentlyCompletedWork: ExecutiveEvent[];
  companyHealth: CompanyHealthItem[];
  todaysRecommendation: ProjectRecommendation | null;
  recommendedFirstAction: DailyBriefAction | null;
  estimatedWorkload: FounderWorkload;
  needsAttention: ExecutiveAttentionItem[];
  needsAttentionCount: number;
  opportunitiesAndRecommendations: ExecutiveOpportunityItem[];
  empty: boolean;
}
