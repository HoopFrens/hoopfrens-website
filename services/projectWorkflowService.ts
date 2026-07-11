import type { Project, ProjectStateHistoryEntry, ProjectWorkspaceHistoryEntry } from "@/domain/project";
import { ProjectWorkspace } from "@/domain/project";
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

export const projectWorkflowService = {
  canApply(project: Project, action: ProjectWorkflowAction, context: LifecycleTransitionContext = {}) {
    const state = currentState(project);
    if (action === "continue") return ![ProjectStatus.Published, ProjectStatus.Archived].includes(state);
    if (action === "complete-production") return state === ProjectStatus.Production;
    if (action === "complete-research") return state === ProjectStatus.Draft || state === ProjectStatus.Research;
    const target = targetState(action);
    return target ? projectLifecyclePolicy.canProjectTransition(project, target, context) : false;
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
