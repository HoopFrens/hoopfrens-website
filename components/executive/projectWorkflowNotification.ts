import { formatProjectState, getProjectState } from "@/components/executive/projectWorkspaceUtils";
import type { Project } from "@/domain/project";
import { ProjectWorkflowActionNotAllowedError, type ProjectWorkflowAction } from "@/services";

const actionHeadlines: Record<ProjectWorkflowAction, string> = {
  continue: "Continue is not available for this project.",
  review: "Review is not available yet.",
  approve: "Founder approval is not available yet.",
  "request-revision": "Revision is not available yet.",
  "complete-research": "Research completion is not available yet.",
  "complete-outline": "Outline completion is not available yet.",
  "complete-production": "Production completion is not available yet.",
  publish: "Publishing is not available yet.",
  archive: "Archiving is not available yet.",
};

const actionRequirements: Partial<Record<ProjectWorkflowAction, string>> = {
  review: "This project must complete the Production stage before it can enter Founder Review.",
  approve: "This project must enter Founder Review before it can receive Founder approval.",
  "request-revision": "This project must be in Founder Review before a revision can be requested.",
  publish: "This project must receive Founder approval before it can be published.",
  archive: "This project must be published before it can be archived.",
};

export function projectWorkflowNotification(error: unknown, project: Project) {
  if (!(error instanceof ProjectWorkflowActionNotAllowedError)) return null;

  const requirement = actionRequirements[error.action] || "This action is not available from the project's current lifecycle state.";
  return [
    actionHeadlines[error.action],
    "",
    requirement,
    "",
    `Current state:\n${formatProjectState(getProjectState(project))}`,
    "",
    `Next required action:\n${project.recommendedNextAction || project.currentStep || "Continue the required workflow stage"}`,
  ].join("\n");
}
