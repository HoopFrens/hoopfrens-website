import type { Project, ProjectStateHistoryEntry, ProjectWorkspaceHistoryEntry } from "@/domain/project";
import { ProjectWorkspace } from "@/domain/project";
import { ProductionReadinessStatus } from "@/domain/services";
import { ProjectStatus } from "@/domain/shared";
import { projectLifecyclePolicy, type LifecycleTransitionContext } from "./projectLifecyclePolicy";

export type ProjectWorkflowAction =
  | "continue"
  | "review"
  | "approve"
  | "request-revision"
  | "complete-research"
  | "complete-outline"
  | "complete-production"
  | "publish"
  | "archive";

export class ProjectWorkflowActionNotAllowedError extends Error {
  readonly action: ProjectWorkflowAction;

  constructor(action: ProjectWorkflowAction) {
    super(`Project workflow action is not allowed: ${action}`);
    this.name = "ProjectWorkflowActionNotAllowedError";
    this.action = action;
  }
}

export type ProjectWorkflowActionAvailability = {
  allowed: boolean;
  reason: string | null;
};

function currentState(project: Project) {
  return project.state || project.status;
}

function stateHistory(project: Project): ProjectStateHistoryEntry[] {
  if (project.stateHistory?.length) return project.stateHistory;
  return [{ state: currentState(project), enteredAt: project.createdAt, reason: "Project created" }];
}

function workspaceHistory(project: Project): ProjectWorkspaceHistoryEntry[] {
  if (project.workspaceHistory?.length) return project.workspaceHistory;
  return [{ workspace: project.currentWorkspace, enteredAt: project.createdAt, reason: "Project created" }];
}

function transitionPath(
  project: Project,
  transitions: Array<{ state: ProjectStatus; reason: string }>,
  enteredAt: string,
  context: LifecycleTransitionContext = {},
) {
  let from = currentState(project);
  const history = [...stateHistory(project)];

  for (const transition of transitions) {
    projectLifecyclePolicy.assertTransition(from, transition.state, context);
    history.push({ state: transition.state, enteredAt, reason: transition.reason });
    from = transition.state;
  }

  return { state: from, status: from, stateHistory: history };
}

function transitionWorkspace(project: Project, workspace: ProjectWorkspace, reason: string, enteredAt: string) {
  const history = workspaceHistory(project);
  return {
    currentWorkspace: workspace,
    workspaceHistory: project.currentWorkspace === workspace
      ? history
      : [...history, { workspace, enteredAt, reason }],
  };
}

function addCompletedNote(project: Project, note: string) {
  return project.completedSoFar?.includes(note) ? project.completedSoFar : [...(project.completedSoFar || []), note];
}

function removeCompletedNote(project: Project, note: string) {
  return (project.completedSoFar || []).filter((entry) => entry !== note);
}

export function createInitialProjectStateHistory(createdAt: string): ProjectStateHistoryEntry[] {
  return [{ state: ProjectStatus.Draft, enteredAt: createdAt, reason: "Founder created project" }];
}

function targetState(action: ProjectWorkflowAction) {
  if (action === "review") return ProjectStatus.Review;
  if (action === "approve") return ProjectStatus.Approved;
  if (action === "request-revision") return ProjectStatus.Production;
  if (action === "complete-outline") return ProjectStatus.Production;
  if (action === "publish") return ProjectStatus.Published;
  if (action === "archive") return ProjectStatus.Archived;
  return null;
}

function unavailableActionReason(
  project: Project,
  action: ProjectWorkflowAction,
  context: LifecycleTransitionContext,
) {
  const state = currentState(project);

  if (state === ProjectStatus.Archived) return "This project has been archived. No further workflow actions are available.";
  if (state === ProjectStatus.Published && action !== "archive") return "This project has already been published. The next available action is Archive.";

  if (action === "review") {
    if (state === ProjectStatus.Draft) return "Review is unavailable. Complete Research, Outline, and Production first.";
    if (state === ProjectStatus.Research) return "Review is unavailable. Complete Research, Outline, and Production first.";
    if (state === ProjectStatus.Outline) return "Review is unavailable. Complete Outline and Production first.";
    if (state === ProjectStatus.Production && context.productionReadiness?.status !== ProductionReadinessStatus.ReadyForReview) {
      return "Review is unavailable. Complete all production-readiness requirements first.";
    }
    if (state === ProjectStatus.Review) return "Review is unavailable because this project is already in Founder Review. The next available action is Approve or Request Revision.";
    if (state === ProjectStatus.Approved) return "Review is unavailable because this project is already approved. The next available action is Publish.";
  }

  if (action === "approve") {
    if (state === ProjectStatus.Approved) return "This project is already approved. The next available action is Publish.";
    return `Approve is unavailable from ${state}. Complete Founder Review first.`;
  }

  if (action === "publish") return `Publish is unavailable from ${state}. Complete Founder approval first.`;
  if (action === "archive") return `Archive is unavailable from ${state}. Publish this project first.`;
  if (action === "continue") return `Continue is unavailable from ${state}. Follow the project's recommended next action.`;
  if (action === "request-revision") return `Revision is unavailable from ${state}. Enter Founder Review first.`;
  return `This action is unavailable from ${state}. Follow the project's recommended next action.`;
}

export const projectWorkflowService = {
  canApply(project: Project, action: ProjectWorkflowAction, context: LifecycleTransitionContext = {}) {
    const state = currentState(project);
    if (action === "continue") return ![ProjectStatus.Published, ProjectStatus.Archived].includes(state);
    if (action === "complete-production") return state === ProjectStatus.Production;
    if (action === "complete-research") return state === ProjectStatus.Draft || state === ProjectStatus.Research;
    const target = targetState(action);
    return target ? projectLifecyclePolicy.canProjectTransition(project, target, context) : false;
  },

  availability(
    project: Project,
    action: ProjectWorkflowAction,
    context: LifecycleTransitionContext = {},
  ): ProjectWorkflowActionAvailability {
    const allowed = this.canApply(project, action, context);
    return {
      allowed,
      reason: allowed ? null : unavailableActionReason(project, action, context),
    };
  },

  createUpdate(
    project: Project,
    action: ProjectWorkflowAction,
    updatedAt = new Date().toISOString(),
    context: LifecycleTransitionContext = {},
  ): Partial<Project> {
    if (!this.canApply(project, action, context)) {
      throw new ProjectWorkflowActionNotAllowedError(action);
    }

    if (action === "continue") {
      const currentStep = project.currentStep || project.remainingNextStep || "Research";
      return {
        updatedAt,
        lastActivity: "Project continued",
        currentStep,
        remainingNextStep: currentStep,
        recommendedNextAction: project.recommendedNextAction || currentStep,
      };
    }

    if (action === "review") {
      return {
        ...transitionWorkspace(project, ProjectWorkspace.ExecutiveOffice, "Founder review opened", updatedAt),
        ...transitionPath(project, [{ state: ProjectStatus.Review, reason: "Founder review opened" }], updatedAt, context),
        workspace: "Executive Office",
        progressPercent: Math.max(project.progressPercent || 0, 70),
        updatedAt,
        completedSoFar: addCompletedNote(project, "Founder review opened"),
        currentStep: "Founder Review",
        remainingNextStep: "Founder Review",
        recommendedNextAction: "Review the package and choose approval, revision, or return.",
        lastActivity: "Founder review opened",
      };
    }

    if (action === "approve") {
      return {
        ...transitionWorkspace(project, ProjectWorkspace.ExecutiveOffice, "Founder approval completed", updatedAt),
        ...transitionPath(project, [{ state: ProjectStatus.Approved, reason: "Founder approval completed" }], updatedAt),
        workspace: "Executive Office",
        progressPercent: 90,
        updatedAt,
        completedSoFar: addCompletedNote(project, "Founder approval complete"),
        currentStep: "Publishing",
        remainingNextStep: "Publishing",
        recommendedNextAction: "Publish the approved project",
        lastActivity: "Founder approval complete",
      };
    }

    if (action === "request-revision") {
      return {
        ...transitionWorkspace(project, ProjectWorkspace.ProductionStudio, "Revision routed to Production Studio", updatedAt),
        ...transitionPath(project, [{ state: ProjectStatus.Production, reason: "Founder revision requested" }], updatedAt),
        workspace: "Production Studio",
        progressPercent: 55,
        updatedAt,
        productionCompletedAt: null,
        activeProductionVersion: null,
        productionReadinessInvalidatedAt: updatedAt,
        completedSoFar: addCompletedNote(
          { ...project, completedSoFar: removeCompletedNote(project, "Production package generated") },
          "Founder revision requested",
        ),
        currentStep: "Revise Production Package",
        remainingNextStep: "Revise Production Package",
        recommendedNextAction: "Generate a new Production Package",
        lastActivity: "Founder requested revision",
      };
    }

    if (action === "complete-research") {
      const transitions = currentState(project) === ProjectStatus.Draft
        ? [
            { state: ProjectStatus.Research, reason: "Research started" },
            { state: ProjectStatus.Outline, reason: "Research completed" },
          ]
        : [{ state: ProjectStatus.Outline, reason: "Research completed" }];
      return {
        ...transitionPath(project, transitions, updatedAt),
        progressPercent: Math.max(project.progressPercent || 0, 35),
        updatedAt,
        completedSoFar: addCompletedNote(project, "Research package generated"),
        currentStep: "Outline",
        remainingNextStep: "Outline",
        recommendedNextAction: "Create the project outline",
        lastActivity: "Research complete",
      };
    }

    if (action === "complete-outline") {
      return {
        ...transitionWorkspace(project, ProjectWorkspace.ProductionStudio, "Outline completed and routed to Production Studio", updatedAt),
        ...transitionPath(project, [{ state: ProjectStatus.Production, reason: "Outline completed" }], updatedAt),
        workspace: "Production Studio",
        progressPercent: Math.max(project.progressPercent || 0, 55),
        updatedAt,
        completedSoFar: addCompletedNote(project, "Outline package generated"),
        currentStep: "Production",
        remainingNextStep: "Production",
        recommendedNextAction: "Generate the Production Package",
        lastActivity: "Outline complete",
      };
    }

    if (action === "complete-production") {
      return {
        ...transitionWorkspace(project, ProjectWorkspace.ProductionStudio, "Production completed in Production Studio", updatedAt),
        workspace: "Production Studio",
        progressPercent: Math.max(project.progressPercent || 0, 70),
        updatedAt,
        productionCompletedAt: updatedAt,
        productionReadinessInvalidatedAt: null,
        completedSoFar: addCompletedNote(project, "Production package generated"),
        currentStep: "Founder Review",
        remainingNextStep: "Founder Review",
        recommendedNextAction: "Begin Founder Review",
        lastActivity: "Production complete",
      };
    }

    if (action === "publish") {
      return {
        ...transitionWorkspace(project, ProjectWorkspace.Library, "Publishing completed", updatedAt),
        ...transitionPath(project, [{ state: ProjectStatus.Published, reason: "Publishing completed" }], updatedAt),
        workspace: "Library",
        progressPercent: 100,
        updatedAt,
        currentStep: "Published",
        remainingNextStep: "Archive when appropriate",
        recommendedNextAction: "Archive completed project",
        lastActivity: "Publishing complete",
      };
    }

    return {
      ...transitionPath(project, [{ state: ProjectStatus.Archived, reason: "Project archived" }], updatedAt),
      updatedAt,
      currentStep: "Archived",
      remainingNextStep: "Archived",
      recommendedNextAction: "No action required",
      lastActivity: "Project archived",
    };
  },
};
