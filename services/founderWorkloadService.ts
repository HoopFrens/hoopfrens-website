import type { FounderFocusArea, FounderWorkload } from "@/domain/briefing";
import type { Project } from "@/domain/project";
import type { ProjectRecommendation } from "@/domain/recommendation";
import { Priority, ProjectStatus } from "@/domain/shared";

function projectState(project: Project) {
  return project.state || project.status;
}

function approvalIsWaiting(project: Project) {
  if (projectState(project) !== ProjectStatus.Review) return false;
  const actionContext = `${project.currentStep} ${project.recommendedNextAction}`.toLowerCase();
  return actionContext.includes("approval") || actionContext.includes("approve");
}

function reviewIsWaiting(project: Project) {
  return projectState(project) === ProjectStatus.Review && !approvalIsWaiting(project);
}

function founderOwnedTask(project: Project, founderId: string) {
  if (project.ownerId !== founderId) return false;
  const actionContext = `${project.currentBlocker || ""} ${project.currentStep} ${project.recommendedNextAction}`.toLowerCase();
  return ["founder", "clarification", "decision", "review", "approval", "approve"].some((keyword) =>
    actionContext.includes(keyword),
  );
}

function focusReason(project: Project, founderId: string) {
  if (project.currentBlocker) return `Resolve the blocker: ${project.currentBlocker}.`;
  if (approvalIsWaiting(project)) return "Founder approval is waiting.";
  if (reviewIsWaiting(project)) return "Founder review is waiting.";
  if ([Priority.High, Priority.Critical].includes(project.priority)) return `The project is ${project.priority} priority.`;
  if (founderOwnedTask(project, founderId)) return "The current step is assigned to the Founder.";
  return "The project has an open Founder action.";
}

export const founderWorkloadService = {
  calculate(projects: Project[], recommendations: ProjectRecommendation[], founderId: string): FounderWorkload {
    const activeProjects = projects.filter(
      (project) => ![ProjectStatus.Published, ProjectStatus.Archived].includes(projectState(project)),
    );
    const reviewsWaiting = activeProjects.filter(reviewIsWaiting);
    const approvalsWaiting = activeProjects.filter(approvalIsWaiting);
    const highPriorityProjects = activeProjects.filter((project) =>
      [Priority.High, Priority.Critical].includes(project.priority),
    );
    const blockedProjects = activeProjects.filter((project) => Boolean(project.currentBlocker));
    const founderOwnedTasks = activeProjects.filter((project) => founderOwnedTask(project, founderId));
    const actionProjectIds = new Set(
      [...reviewsWaiting, ...approvalsWaiting, ...highPriorityProjects, ...blockedProjects, ...founderOwnedTasks].map(
        (project) => project.id,
      ),
    );
    const recommendationByProject = new Map(
      recommendations.map((recommendation) => [recommendation.project.id, recommendation]),
    );
    const topFocusAreas = [...actionProjectIds]
      .map((projectId): FounderFocusArea | null => {
        const project = activeProjects.find((candidate) => candidate.id === projectId);
        if (!project) return null;
        return {
          projectId,
          title: project.title,
          reason: focusReason(project, founderId),
          recommendationScore: recommendationByProject.get(projectId)?.score || 0,
        };
      })
      .filter((focusArea): focusArea is FounderFocusArea => Boolean(focusArea))
      .sort((first, second) => {
        const scoreDifference = second.recommendationScore - first.recommendationScore;
        return scoreDifference !== 0 ? scoreDifference : first.title.localeCompare(second.title);
      })
      .slice(0, 3);
    const actionCount = actionProjectIds.size;

    return {
      actionCount,
      label: actionCount <= 2 ? "Light" : actionCount <= 5 ? "Moderate" : "Heavy",
      breakdown: {
        reviewsWaiting: reviewsWaiting.length,
        approvalsWaiting: approvalsWaiting.length,
        highPriorityProjects: highPriorityProjects.length,
        blockedProjects: blockedProjects.length,
        founderOwnedTasks: founderOwnedTasks.length,
      },
      topFocusAreas,
    };
  },
};
