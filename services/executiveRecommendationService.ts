import { ExecutiveEventType, type ExecutiveEvent } from "@/domain/event";
import { ProjectWorkspace, type Project } from "@/domain/project";
import {
  RecommendationCategory,
  RecommendationEffort,
  type ProjectRecommendation,
  type RecommendationResult,
} from "@/domain/recommendation";
import { Priority, ProjectStatus } from "@/domain/shared";
import { executivePrioritizationService } from "./executivePrioritizationService";

const categoryWeights: Record<RecommendationCategory, number> = {
  [RecommendationCategory.Start]: 14,
  [RecommendationCategory.Continue]: 18,
  [RecommendationCategory.Review]: 26,
  [RecommendationCategory.Approve]: 28,
  [RecommendationCategory.Publish]: 22,
  [RecommendationCategory.ResolveBlocker]: 30,
  [RecommendationCategory.Archive]: 8,
};

const priorityWeights: Record<Priority, number> = {
  [Priority.Low]: 6,
  [Priority.Medium]: 14,
  [Priority.High]: 22,
  [Priority.Critical]: 30,
};

const workspaceWeights: Record<ProjectWorkspace, number> = {
  [ProjectWorkspace.ExecutiveOffice]: 8,
  [ProjectWorkspace.IntelligenceCenter]: 5,
  [ProjectWorkspace.ProductionStudio]: 5,
  [ProjectWorkspace.StrategyRoom]: 4,
  [ProjectWorkspace.ProductLab]: 3,
  [ProjectWorkspace.Library]: 2,
};

const actionLabels: Record<RecommendationCategory, string> = {
  [RecommendationCategory.Start]: "Start",
  [RecommendationCategory.Continue]: "Continue",
  [RecommendationCategory.Review]: "Review",
  [RecommendationCategory.Approve]: "Approve",
  [RecommendationCategory.Publish]: "Publish",
  [RecommendationCategory.ResolveBlocker]: "Resolve Blocker",
  [RecommendationCategory.Archive]: "Archive",
};

const serviceCompletionTypes = new Set([
  ExecutiveEventType.ResearchCompleted,
  ExecutiveEventType.OutlineCompleted,
  ExecutiveEventType.ProductionCompleted,
  ExecutiveEventType.ApprovalCompleted,
  ExecutiveEventType.PublishingCompleted,
]);

function projectState(project: Project) {
  return project.state || project.status;
}

function recommendationCategory(project: Project, serviceCompletion: ExecutiveEventType | null) {
  const state = projectState(project);
  const approvalReady =
    project.currentStep.toLowerCase().includes("approval") ||
    project.recommendedNextAction.toLowerCase().includes("confirm approval");

  if (project.currentBlocker) return RecommendationCategory.ResolveBlocker;
  if (state === ProjectStatus.Published) return RecommendationCategory.Archive;
  if (state === ProjectStatus.Approved) return RecommendationCategory.Publish;
  if (state === ProjectStatus.Review) {
    return approvalReady ? RecommendationCategory.Approve : RecommendationCategory.Review;
  }
  if (state === ProjectStatus.Production && serviceCompletion === ExecutiveEventType.ProductionCompleted) {
    return RecommendationCategory.Review;
  }
  if (state === ProjectStatus.Draft) return RecommendationCategory.Start;
  return RecommendationCategory.Continue;
}

function latestServiceCompletion(project: Project, events: ExecutiveEvent[]) {
  return events
    .filter((event) => event.projectId === project.id && serviceCompletionTypes.has(event.eventType))
    .sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp))[0]?.eventType || null;
}

function relevantServiceCompletion(project: Project, eventType: ExecutiveEventType | null) {
  const state = projectState(project);
  return (
    (state === ProjectStatus.Outline && eventType === ExecutiveEventType.ResearchCompleted) ||
    (state === ProjectStatus.Production && eventType === ExecutiveEventType.OutlineCompleted) ||
    (state === ProjectStatus.Production && eventType === ExecutiveEventType.ProductionCompleted) ||
    (state === ProjectStatus.Approved && eventType === ExecutiveEventType.ApprovalCompleted) ||
    (state === ProjectStatus.Published && eventType === ExecutiveEventType.PublishingCompleted)
  );
}

function dueWeight(dueStatus: "none" | "scheduled" | "due-soon" | "overdue") {
  if (dueStatus === "overdue") return 22;
  if (dueStatus === "due-soon") return 14;
  if (dueStatus === "scheduled") return 4;
  return 0;
}

function recencyWeight(daysSinceLastActivity: number | null) {
  if (daysSinceLastActivity === null) return 0;
  if (daysSinceLastActivity >= 30) return 10;
  if (daysSinceLastActivity >= 14) return 7;
  if (daysSinceLastActivity >= 7) return 4;
  return 0;
}

function progressWeight(project: Project, category: RecommendationCategory) {
  if (category === RecommendationCategory.ResolveBlocker) return Math.min(10, Math.floor(project.progressPercent / 10));
  if ([RecommendationCategory.Review, RecommendationCategory.Approve, RecommendationCategory.Publish].includes(category)) {
    return Math.min(6, Math.floor(project.progressPercent / 15));
  }
  if (category === RecommendationCategory.Archive) return 4;
  if (category === RecommendationCategory.Continue) return project.progressPercent >= 25 ? 6 : 3;
  return project.progressPercent < 25 ? 4 : 2;
}

function explanationReasons(
  project: Project,
  category: RecommendationCategory,
  serviceCompletion: ExecutiveEventType | null,
) {
  const state = projectState(project);
  let reasons: string[];

  if (category === RecommendationCategory.ResolveBlocker) {
    reasons = [`The project is blocked by ${project.currentBlocker}.`, "Work cannot advance until the blocker is resolved."];
  } else if (category === RecommendationCategory.Start) {
    reasons = ["The project is ready to begin.", "Research has not started."];
  } else if (category === RecommendationCategory.Review) {
    reasons = ["Production is complete.", "Founder review is required."];
  } else if (category === RecommendationCategory.Approve) {
    reasons = ["Founder review is complete.", "Approval is required before publishing."];
  } else if (category === RecommendationCategory.Publish) {
    reasons = ["Founder approval is complete.", "The project is ready to publish."];
  } else if (category === RecommendationCategory.Archive) {
    reasons = ["Publishing is complete.", "The project can leave the active portfolio."];
  } else if (state === ProjectStatus.Outline && serviceCompletion === ExecutiveEventType.ResearchCompleted) {
    reasons = ["Research is complete.", "Outline has not been started."];
  } else if (state === ProjectStatus.Production && serviceCompletion === ExecutiveEventType.OutlineCompleted) {
    reasons = ["Outline is complete.", "Production is ready to continue."];
  } else if (state === ProjectStatus.Research) {
    reasons = ["Research is in progress.", "The current project stage is not complete."];
  } else if (state === ProjectStatus.Outline) {
    reasons = ["The project is in Outline.", "The outline has not been completed."];
  } else {
    reasons = ["Production is in progress.", "The project has an active next step."];
  }

  if (!project.currentBlocker) reasons.push("No blockers exist.");
  if ([Priority.High, Priority.Critical].includes(project.priority)) reasons.push(`The project is ${project.priority} priority.`);
  return reasons.slice(0, 4);
}

function whyNow(
  project: Project,
  category: RecommendationCategory,
  dueStatus: "none" | "scheduled" | "due-soon" | "overdue",
  waitingOnFounder: boolean,
  daysSinceLastActivity: number | null,
  serviceCompletionRelevant: boolean,
) {
  if (category === RecommendationCategory.ResolveBlocker) return "The blocker is preventing all downstream work from advancing.";
  if (dueStatus === "overdue") return "The project is overdue and requires action now.";
  if (dueStatus === "due-soon") return "The due date is approaching and the next step is still open.";
  if (waitingOnFounder) return "The project cannot advance without Founder action.";
  if (serviceCompletionRelevant) return "The previous service is complete, so the next stage can begin without delay.";
  if ((daysSinceLastActivity || 0) >= 14) return "The project has been inactive long enough to risk losing momentum.";
  if ([Priority.High, Priority.Critical].includes(project.priority)) return "Its declared priority makes the current next step timely.";
  return "Its current state, progress, and workspace make this the strongest available next step.";
}

function delayImpact(category: RecommendationCategory) {
  const impacts: Record<RecommendationCategory, string> = {
    [RecommendationCategory.Start]: "The project remains in Draft and no research begins.",
    [RecommendationCategory.Continue]: "The next lifecycle stage remains idle and project momentum slows.",
    [RecommendationCategory.Review]: "Founder review and every downstream approval step remain delayed.",
    [RecommendationCategory.Approve]: "Publishing cannot begin until Founder approval is complete.",
    [RecommendationCategory.Publish]: "Approved work remains unpublished and unavailable to its audience.",
    [RecommendationCategory.ResolveBlocker]: "The project remains blocked and no dependent work can advance.",
    [RecommendationCategory.Archive]: "Completed work continues to occupy the active project portfolio.",
  };
  return impacts[category];
}

function estimatedEffort(project: Project, category: RecommendationCategory) {
  if ([RecommendationCategory.Start, RecommendationCategory.Review, RecommendationCategory.Approve, RecommendationCategory.Archive].includes(category)) {
    return RecommendationEffort.Low;
  }
  if (category === RecommendationCategory.ResolveBlocker) return RecommendationEffort.High;
  if (category === RecommendationCategory.Publish) return RecommendationEffort.Moderate;
  if (projectState(project) === ProjectStatus.Outline) return RecommendationEffort.Low;
  if (projectState(project) === ProjectStatus.Production) return RecommendationEffort.High;
  return RecommendationEffort.Moderate;
}

function compareRecommendations(first: ProjectRecommendation, second: ProjectRecommendation) {
  const scoreDifference = second.score - first.score;
  if (scoreDifference !== 0) return scoreDifference;

  const firstDueDate = first.project.dueDate ? Date.parse(first.project.dueDate) : Number.POSITIVE_INFINITY;
  const secondDueDate = second.project.dueDate ? Date.parse(second.project.dueDate) : Number.POSITIVE_INFINITY;
  if (firstDueDate !== secondDueDate) return firstDueDate - secondDueDate;
  return first.project.title.localeCompare(second.project.title);
}

export const executiveRecommendationService = {
  evaluate(project: Project, events: ExecutiveEvent[], now = new Date()): ProjectRecommendation {
    const priorityAssessment = executivePrioritizationService.assess(project, now);
    const serviceCompletion = latestServiceCompletion(project, events);
    const category = recommendationCategory(project, serviceCompletion);
    const serviceCompletionRelevant = relevantServiceCompletion(project, serviceCompletion);
    const score = Math.min(
      100,
      categoryWeights[category] +
        priorityWeights[project.priority] +
        workspaceWeights[project.currentWorkspace] +
        dueWeight(priorityAssessment.dueStatus) +
        recencyWeight(priorityAssessment.daysSinceLastActivity) +
        progressWeight(project, category) +
        (project.currentBlocker ? 20 : 0) +
        (priorityAssessment.waitingOnFounder ? 14 : 0) +
        (serviceCompletionRelevant ? 12 : 0),
    );
    const actionLabel =
      category === RecommendationCategory.Review && projectState(project) === ProjectStatus.Production
        ? "Begin Review"
        : actionLabels[category];

    return {
      project,
      category,
      score,
      actionLabel,
      headline: `${actionLabel} ${project.title}`,
      reason: explanationReasons(project, category, serviceCompletion),
      whyNow: whyNow(
        project,
        category,
        priorityAssessment.dueStatus,
        priorityAssessment.waitingOnFounder,
        priorityAssessment.daysSinceLastActivity,
        serviceCompletionRelevant,
      ),
      delayImpact: delayImpact(category),
      estimatedEffort: estimatedEffort(project, category),
      waitingOnFounder: priorityAssessment.waitingOnFounder,
      serviceCompletion,
      generatedAt: now.toISOString(),
    };
  },

  rank(projects: Project[], events: ExecutiveEvent[], now = new Date()): RecommendationResult {
    const recommendations = projects
      .filter((project) => projectState(project) !== ProjectStatus.Archived)
      .map((project) => this.evaluate(project, events, now))
      .sort(compareRecommendations);

    return {
      recommendations,
      topRecommendation: recommendations[0] || null,
      generatedAt: now.toISOString(),
    };
  },
};
