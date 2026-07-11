import type { DailyBriefAction, FounderDailyBrief } from "@/domain/briefing";
import { ExecutiveEventType, type ExecutiveEvent } from "@/domain/event";
import type { PriorityAssessment } from "@/domain/prioritization";
import type { Project } from "@/domain/project";
import { RecommendationCategory, type ProjectRecommendation } from "@/domain/recommendation";
import { Priority, ProjectStatus } from "@/domain/shared";
import { companyHealthService } from "./companyHealthService";
import { executiveIntelligenceService } from "./executiveIntelligenceService";
import { executivePrioritizationService } from "./executivePrioritizationService";
import { executiveRecommendationService } from "./executiveRecommendationService";
import { executiveTimelineService } from "./executiveTimelineService";
import { founderWorkloadService } from "./founderWorkloadService";

const millisecondsPerDay = 86_400_000;
const maximumActivityItems = 5;

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning, Antwone.";
  if (hour < 17) return "Good afternoon, Antwone.";
  return "Good evening, Antwone.";
}

function recommendedAction(recommendation: ProjectRecommendation | null): DailyBriefAction | null {
  if (!recommendation) return null;

  let type: DailyBriefAction["type"] = "open-project";
  let label = "Open Project";

  if (
    recommendation.category === RecommendationCategory.Continue &&
    (recommendation.project.state || recommendation.project.status) === ProjectStatus.Outline &&
    recommendation.serviceCompletion === ExecutiveEventType.ResearchCompleted
  ) {
    type = "open-research-package";
    label = recommendation.actionLabel;
  } else if (recommendation.category === RecommendationCategory.Continue) {
    type = "continue";
    label = recommendation.actionLabel;
  } else if (recommendation.category === RecommendationCategory.Review) {
    type = "review";
    label = recommendation.actionLabel;
  } else if (recommendation.category === RecommendationCategory.Approve) {
    type = "approve";
    label = recommendation.actionLabel;
  }

  return {
    type,
    label,
    project: recommendation.project,
    explanation: recommendation.whyNow,
  };
}

function requiresRiskAttention(assessment: PriorityAssessment) {
  const staleHighPriorityProject =
    (assessment.daysSinceLastActivity || 0) >= 14 &&
    [Priority.High, Priority.Critical].includes(assessment.project.priority);
  const missingNextAction = assessment.riskReasons.some((reason) => reason.includes("No next action"));

  return assessment.blocked || assessment.dueStatus === "overdue" || staleHighPriorityProject || missingNextAction;
}

function rankDailyBriefRisks(assessments: PriorityAssessment[]) {
  return assessments
    .filter(requiresRiskAttention)
    .sort((first, second) => {
      const riskDifference = second.riskScore - first.riskScore;
      if (riskDifference !== 0) return riskDifference;
      const priorityDifference = second.priorityScore - first.priorityScore;
      return priorityDifference !== 0 ? priorityDifference : first.project.title.localeCompare(second.project.title);
    })
    .slice(0, maximumActivityItems)
    .map((assessment, index) => ({ ...assessment, rank: index + 1 }));
}

export const founderDailyBriefService = {
  generate(
    projects: Project[],
    events: ExecutiveEvent[],
    lastVisitAt: string | null,
    now = new Date(),
    founderId = "founder",
  ): FounderDailyBrief {
    const prioritization = executivePrioritizationService.prioritize(projects, now);
    const projectsAtRisk = rankDailyBriefRisks(prioritization.assessments);
    const sinceLastVisit = executiveTimelineService.since(events, lastVisitAt).slice(0, maximumActivityItems);
    const completedWorkCutoff = new Date(now.getTime() - 7 * millisecondsPerDay).toISOString();
    const recentlyCompletedWork = executiveTimelineService
      .completedSince(events, completedWorkCutoff, projects)
      .slice(0, maximumActivityItems);
    const recommendationResult = executiveRecommendationService.rank(projects, events, now);
    const firstAction = recommendedAction(recommendationResult.topRecommendation);
    const executiveIntelligence = executiveIntelligenceService.generate(
      prioritization.assessments,
      recommendationResult.recommendations,
      recommendationResult.topRecommendation?.project.id || null,
    );

    return {
      generatedAt: now.toISOString(),
      greeting: greeting(now),
      lastVisitAt,
      sinceLastVisit,
      topPriority: prioritization.topFounderPriorities[0] || null,
      projectsWaitingOnFounder: prioritization.projectsWaitingOnFounder,
      projectsAtRisk,
      projectsReadyToAdvance: prioritization.projectsReadyToAdvance,
      recentlyCompletedWork,
      companyHealth: companyHealthService.evaluate(projects, events, now),
      todaysRecommendation: recommendationResult.topRecommendation,
      recommendedFirstAction: firstAction,
      estimatedWorkload: founderWorkloadService.calculate(
        projects,
        recommendationResult.recommendations,
        founderId,
      ),
      ...executiveIntelligence,
      empty: projects.length === 0,
    };
  },
};
