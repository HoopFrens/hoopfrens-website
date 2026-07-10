import type { ExecutiveAttentionItem, ExecutiveOpportunityItem } from "@/domain/briefing";
import type { PriorityAssessment } from "@/domain/prioritization";
import type { ProjectRecommendation } from "@/domain/recommendation";
import { Priority, ProjectStatus } from "@/domain/shared";

function attentionReason(assessment: PriorityAssessment): ExecutiveAttentionItem | null {
  const project = assessment.project;
  const missingNextAction = !project.currentStep && !project.recommendedNextAction;
  const staleHighPriority =
    (assessment.daysSinceLastActivity || 0) >= 14 &&
    [Priority.High, Priority.Critical].includes(project.priority);

  if (project.currentBlocker) {
    return {
      project,
      label: "Blocked",
      reason: project.currentBlocker,
      severity: project.priority === Priority.Critical ? "critical" : "attention",
    };
  }
  if (assessment.dueStatus === "overdue") {
    return {
      project,
      label: "Overdue",
      reason: assessment.riskReasons.find((reason) => reason.toLowerCase().includes("overdue")) || "The due date has passed.",
      severity: project.priority === Priority.Critical ? "critical" : "attention",
    };
  }
  if ((project.state || project.status) === ProjectStatus.Production) {
    const productionComplete =
      project.completedSoFar?.includes("Production package generated") ||
      project.lastActivity.toLowerCase().includes("production complete");
    return productionComplete
      ? {
          project,
          label: "Ready for Review",
          reason: "Production is complete. Founder Review can begin.",
          severity: "attention",
        }
      : {
          project,
          label: "Needs Production",
          reason: project.recommendedNextAction || "Generate the Production Package.",
          severity: "attention",
        };
  }
  if (assessment.waitingOnFounder) {
    return {
      project,
      label: (project.state || project.status) === ProjectStatus.Review ? "Founder Review" : "Founder Action",
      reason: project.recommendedNextAction || project.currentStep,
      severity: "attention",
    };
  }
  if ((project.state || project.status) === ProjectStatus.Draft && [Priority.High, Priority.Critical].includes(project.priority)) {
    return {
      project,
      label: "High Priority Draft",
      reason: "Research has not started.",
      severity: project.priority === Priority.Critical ? "critical" : "attention",
    };
  }
  if (missingNextAction) {
    return {
      project,
      label: "Missing Next Action",
      reason: "The project cannot advance until a next action is defined.",
      severity: "attention",
    };
  }
  if (staleHighPriority) {
    return {
      project,
      label: "Stale Priority",
      reason: `No project activity for ${assessment.daysSinceLastActivity} days.`,
      severity: "attention",
    };
  }
  return null;
}

export const executiveIntelligenceService = {
  generate(
    assessments: PriorityAssessment[],
    recommendations: ProjectRecommendation[],
    topRecommendationProjectId: string | null,
  ) {
    const allAttention = assessments
      .map(attentionReason)
      .filter((item): item is ExecutiveAttentionItem => Boolean(item))
      .sort((first, second) => {
        if (first.severity !== second.severity) return first.severity === "critical" ? -1 : 1;
        const firstAssessment = assessments.find((assessment) => assessment.project.id === first.project.id);
        const secondAssessment = assessments.find((assessment) => assessment.project.id === second.project.id);
        return (secondAssessment?.riskScore || 0) - (firstAssessment?.riskScore || 0);
      });
    const attentionIds = new Set(allAttention.map((item) => item.project.id));
    const recommendationByProject = new Map(
      recommendations.map((recommendation) => [recommendation.project.id, recommendation]),
    );
    const opportunitiesAndRecommendations = assessments
      .filter(
        (assessment) =>
          assessment.readyToAdvance &&
          assessment.project.id !== topRecommendationProjectId &&
          !attentionIds.has(assessment.project.id),
      )
      .map((assessment): ExecutiveOpportunityItem => {
        const recommendation = recommendationByProject.get(assessment.project.id);
        return {
          project: assessment.project,
          action: recommendation?.headline || assessment.recommendation,
          whyItMatters: recommendation?.whyNow || assessment.reasons.slice(0, 2).join(" "),
          recommendationScore: recommendation?.score || assessment.priorityScore,
        };
      })
      .sort((first, second) => {
        const scoreDifference = second.recommendationScore - first.recommendationScore;
        return scoreDifference !== 0 ? scoreDifference : first.project.title.localeCompare(second.project.title);
      })
      .slice(0, 5);

    return {
      needsAttention: allAttention.filter((item) => item.project.id !== topRecommendationProjectId).slice(0, 5),
      needsAttentionCount: allAttention.length,
      opportunitiesAndRecommendations,
    };
  },
};
