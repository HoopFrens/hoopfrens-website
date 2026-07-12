import type { Project } from "../project";

export type ProjectDueStatus = "none" | "scheduled" | "due-soon" | "overdue";

export interface PriorityAssessment {
  project: Project;
  priorityScore: number;
  riskScore: number;
  reasons: string[];
  riskReasons: string[];
  recommendation: string;
  blocked: boolean;
  waitingOnFounder: boolean;
  readyToAdvance: boolean;
  atRisk: boolean;
  dueStatus: ProjectDueStatus;
  daysSinceLastActivity: number | null;
}

export interface RankedPriorityAssessment extends PriorityAssessment {
  rank: number;
}
