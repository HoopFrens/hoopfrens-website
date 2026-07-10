import type { Project, ProjectStateHistoryEntry, ProjectWorkspaceHistoryEntry } from "@/domain/project";
import { ProjectWorkspace } from "@/domain/project";
import { ProjectStatus } from "@/domain/shared";

export type ProjectWorkflowAction =
  | "continue"
  | "review"
  | "approve"
  | "request-revision"
  | "complete-research"
  | "complete-outline"
  | "complete-production"
  | "archive";

function currentState(project: Project) {
  return project.state || project.status;
}

function stateHistory(project: Project): ProjectStateHistoryEntry[] {
  if (project.stateHistory?.length) return project.stateHistory;

  return [
    {
      state: currentState(project),
      enteredAt: project.createdAt,
      reason: "Project created",
    },
  ];
}

function workspaceHistory(project: Project): ProjectWorkspaceHistoryEntry[] {
  if (project.workspaceHistory?.length) return project.workspaceHistory;

  return [
    {
      workspace: project.currentWorkspace,
      enteredAt: project.createdAt,
      reason: "Project created",
    },
  ];
}

function transitionState(project: Project, state: ProjectStatus, reason: string, enteredAt: string) {
  const history = stateHistory(project);

  return {
    state,
    status: state,
    stateHistory:
      currentState(project) === state
        ? history
        : [
            ...history,
            {
              state,
              enteredAt,
              reason,
            },
          ],
  };
}

function transitionWorkspace(project: Project, workspace: ProjectWorkspace, reason: string, enteredAt: string) {
  const history = workspaceHistory(project);

  return {
    currentWorkspace: workspace,
    workspaceHistory:
      project.currentWorkspace === workspace
        ? history
        : [
            ...history,
            {
              workspace,
              enteredAt,
              reason,
            },
          ],
  };
}

function addCompletedNote(project: Project, note: string) {
  return project.completedSoFar?.includes(note) ? project.completedSoFar : [...(project.completedSoFar || []), note];
}

export function createInitialProjectStateHistory(createdAt: string): ProjectStateHistoryEntry[] {
  return [
    {
      state: ProjectStatus.Draft,
      enteredAt: createdAt,
      reason: "Founder created project",
    },
  ];
}

export const projectWorkflowService = {
  createUpdate(project: Project, action: ProjectWorkflowAction, updatedAt = new Date().toISOString()): Partial<Project> {
    if (action === "continue") {
      const currentStep = project.currentStep || project.remainingNextStep || "Research";
      return {
        ...transitionWorkspace(project, ProjectWorkspace.ProductionStudio, "Project continued for production planning", updatedAt),
        workspace: "Production Studio",
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
        ...transitionState(project, ProjectStatus.Review, "Founder review opened", updatedAt),
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
        ...transitionState(project, ProjectStatus.Approved, "Founder approval completed", updatedAt),
        workspace: "Executive Office",
        progressPercent: 90,
        updatedAt,
        completedSoFar: addCompletedNote(project, "Founder approval complete"),
        currentStep: "Prepare next approved step",
        remainingNextStep: "Prepare next approved step",
        recommendedNextAction: "Prepare next approved step",
        lastActivity: "Founder approval complete",
      };
    }

    if (action === "request-revision") {
      return {
        ...transitionWorkspace(project, ProjectWorkspace.ProductionStudio, "Revision routed to Production Studio", updatedAt),
        ...transitionState(project, ProjectStatus.Draft, "Founder revision requested", updatedAt),
        workspace: "Production Studio",
        progressPercent: 15,
        updatedAt,
        completedSoFar: addCompletedNote(project, "Founder revision requested"),
        currentStep: "Revise project brief",
        remainingNextStep: "Revise project brief",
        recommendedNextAction: "Revise project brief",
        lastActivity: "Founder requested revision",
      };
    }

    if (action === "complete-research") {
      return {
        ...transitionState(project, ProjectStatus.Outline, "Research completed", updatedAt),
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
        ...transitionState(project, ProjectStatus.Production, "Outline completed", updatedAt),
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
        ...transitionState(project, ProjectStatus.Production, "Production completed", updatedAt),
        workspace: "Production Studio",
        progressPercent: Math.max(project.progressPercent || 0, 70),
        updatedAt,
        productionCompletedAt: updatedAt,
        completedSoFar: addCompletedNote(project, "Production package generated"),
        currentStep: "Founder Review",
        remainingNextStep: "Founder Review",
        recommendedNextAction: "Begin Founder Review",
        lastActivity: "Production complete",
      };
    }

    return {
      ...transitionState(project, ProjectStatus.Archived, "Project archived", updatedAt),
      updatedAt,
      currentStep: "Archived",
      remainingNextStep: "Archived",
      recommendedNextAction: "No action required",
      lastActivity: "Project archived",
    };
  },
};
