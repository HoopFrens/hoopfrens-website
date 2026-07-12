import type { PriorityAssessment, RankedPriorityAssessment } from "./PriorityAssessment";

export interface PrioritizationResult {
  assessments: PriorityAssessment[];
  topFounderPriorities: RankedPriorityAssessment[];
  projectsAtRisk: RankedPriorityAssessment[];
  projectsWaitingOnFounder: RankedPriorityAssessment[];
  projectsReadyToAdvance: RankedPriorityAssessment[];
}
