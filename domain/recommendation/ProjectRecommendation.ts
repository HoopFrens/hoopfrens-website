import type { ExecutiveEventType } from "../event";
import type { Project } from "../project";
import type { ISODateString } from "../shared";
import type { RecommendationCategory } from "./RecommendationCategory";
import type { RecommendationEffort } from "./RecommendationEffort";

export interface ProjectRecommendation {
  project: Project;
  category: RecommendationCategory;
  score: number;
  actionLabel: string;
  headline: string;
  reason: string[];
  whyNow: string;
  delayImpact: string;
  estimatedEffort: RecommendationEffort;
  waitingOnFounder: boolean;
  serviceCompletion: ExecutiveEventType | null;
  generatedAt: ISODateString;
}

export interface RecommendationResult {
  recommendations: ProjectRecommendation[];
  topRecommendation: ProjectRecommendation | null;
  generatedAt: ISODateString;
}
