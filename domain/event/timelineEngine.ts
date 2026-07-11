import { ProjectWorkspace, type Project } from "../project/types";
import { ProjectStatus } from "../shared";
import type { ExecutiveEvent, ExecutiveTimelineGroup, ExecutiveTimelineGroupLabel } from "./ExecutiveEvent";
import { ExecutiveEventType } from "./ExecutiveEventType";

const timelineGroupOrder: ExecutiveTimelineGroupLabel[] = ["Today", "Yesterday", "Earlier"];

function formatValue(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventId(projectId: string, eventType: ExecutiveEventType, timestamp: string, qualifier = "") {
  const timestampKey = timestamp.replace(/[^0-9A-Za-z]/g, "");
  const qualifierKey = qualifier.replace(/[^0-9A-Za-z-]/g, "-");
  return [projectId, eventType, timestampKey, qualifierKey].filter(Boolean).join("_");
}

function eventTypeForTransition(fromState: ProjectStatus, state: ProjectStatus) {
  if (fromState === ProjectStatus.Review && state === ProjectStatus.Production) return ExecutiveEventType.RevisionRequested;
  if (state === ProjectStatus.Outline) return ExecutiveEventType.ResearchCompleted;
  if (state === ProjectStatus.Production) return ExecutiveEventType.OutlineCompleted;
  if (state === ProjectStatus.Review) return ExecutiveEventType.ReviewRequested;
  if (state === ProjectStatus.Approved) return ExecutiveEventType.ApprovalCompleted;
  if (state === ProjectStatus.Published) return ExecutiveEventType.PublishingCompleted;
  return ExecutiveEventType.ProjectStateChanged;
}

function stateSummary(fromState: ProjectStatus, toState: ProjectStatus) {
  if (fromState === ProjectStatus.Review && toState === ProjectStatus.Production) {
    return "Founder requested revision. Prior production readiness was invalidated.";
  }
  if (toState === ProjectStatus.Outline) return "Research completed. Project advanced to Outline.";
  if (toState === ProjectStatus.Production) return "Outline completed. Project advanced to Production.";
  if (toState === ProjectStatus.Review) return "Founder Review requested.";
  if (toState === ProjectStatus.Approved) return "Founder approval completed.";
  if (toState === ProjectStatus.Published) return "Publishing completed.";
  return `Project moved from ${formatValue(fromState)} to ${formatValue(toState)}.`;
}

function projectReference(project: Project) {
  return { id: project.id, title: project.title };
}

function projectHref(projectId: string) {
  return `/executive-workspace/projects?projectId=${encodeURIComponent(projectId)}`;
}

function projectCreatedEvent(project: Project, actorId: string, relatedWorkspace: ProjectWorkspace): ExecutiveEvent {
  return {
    id: eventId(project.id, ExecutiveEventType.ProjectCreated, project.createdAt),
    workspaceId: project.workspaceId,
    actorId,
    timestamp: project.createdAt,
    eventType: ExecutiveEventType.ProjectCreated,
    projectId: project.id,
    project: projectReference(project),
    summary: "Project created.",
    relatedWorkspace,
    projectHref: projectHref(project.id),
  };
}

function stateChangedEvent(
  project: Project,
  actorId: string,
  fromState: ProjectStatus,
  toState: ProjectStatus,
  timestamp: string,
  relatedWorkspace: ProjectWorkspace,
): ExecutiveEvent {
  const eventType = eventTypeForTransition(fromState, toState);
  return {
    id: eventId(project.id, eventType, timestamp, `${fromState}-${toState}`),
    workspaceId: project.workspaceId,
    actorId,
    timestamp,
    eventType,
    projectId: project.id,
    project: projectReference(project),
    summary: stateSummary(fromState, toState),
    relatedWorkspace,
    projectHref: projectHref(project.id),
  };
}

function workspaceChangedEvent(
  project: Project,
  actorId: string,
  fromWorkspace: ProjectWorkspace,
  toWorkspace: ProjectWorkspace,
  timestamp: string,
): ExecutiveEvent {
  return {
    id: eventId(project.id, ExecutiveEventType.WorkspaceChanged, timestamp, `${fromWorkspace}-${toWorkspace}`),
    workspaceId: project.workspaceId,
    actorId,
    timestamp,
    eventType: ExecutiveEventType.WorkspaceChanged,
    projectId: project.id,
    project: projectReference(project),
    summary: `Project moved from ${formatValue(fromWorkspace)} to ${formatValue(toWorkspace)}.`,
    relatedWorkspace: toWorkspace,
    projectHref: projectHref(project.id),
  };
}

function productionCompletedEvent(project: Project, actorId: string, timestamp: string): ExecutiveEvent {
  return {
    id: eventId(project.id, ExecutiveEventType.ProductionCompleted, timestamp),
    workspaceId: project.workspaceId,
    actorId,
    timestamp,
    eventType: ExecutiveEventType.ProductionCompleted,
    projectId: project.id,
    project: projectReference(project),
    summary: "Production Package completed. Project is ready for Founder Review.",
    relatedWorkspace: project.currentWorkspace,
    projectHref: projectHref(project.id),
  };
}

function workspaceAt(project: Project, timestamp: string) {
  const targetTime = Date.parse(timestamp);
  const matchingWorkspaces = [...project.workspaceHistory]
    .filter((entry) => Date.parse(entry.enteredAt) <= targetTime)
    .sort((first, second) => Date.parse(first.enteredAt) - Date.parse(second.enteredAt));
  const matchingWorkspace = matchingWorkspaces[matchingWorkspaces.length - 1];
  return matchingWorkspace?.workspace || project.currentWorkspace;
}

export function sortExecutiveEvents(events: ExecutiveEvent[]) {
  return [...events].sort((first, second) => {
    const timestampDifference = Date.parse(second.timestamp) - Date.parse(first.timestamp);
    return timestampDifference !== 0 ? timestampDifference : first.id.localeCompare(second.id);
  });
}

export function createProjectHistoryEvents(project: Project, actorId = project.ownerId) {
  const events: ExecutiveEvent[] = [];
  const workspaceHistory = [...project.workspaceHistory].sort(
    (first, second) => Date.parse(first.enteredAt) - Date.parse(second.enteredAt),
  );
  const stateHistory = [...(project.stateHistory || [])].sort(
    (first, second) => Date.parse(first.enteredAt) - Date.parse(second.enteredAt),
  );

  events.push(projectCreatedEvent(project, actorId, workspaceHistory[0]?.workspace || project.currentWorkspace));

  for (let index = 1; index < workspaceHistory.length; index += 1) {
    const previousEntry = workspaceHistory[index - 1];
    const entry = workspaceHistory[index];
    if (previousEntry.workspace !== entry.workspace) {
      events.push(workspaceChangedEvent(project, actorId, previousEntry.workspace, entry.workspace, entry.enteredAt));
    }
  }

  for (let index = 1; index < stateHistory.length; index += 1) {
    const previousEntry = stateHistory[index - 1];
    const entry = stateHistory[index];
    if (previousEntry.state !== entry.state) {
      events.push(
        stateChangedEvent(project, actorId, previousEntry.state, entry.state, entry.enteredAt, workspaceAt(project, entry.enteredAt)),
      );
    }
  }

  if (project.completedSoFar?.includes("Production package generated")) {
    events.push(productionCompletedEvent(project, actorId, project.productionCompletedAt || project.updatedAt));
  }

  return sortExecutiveEvents(events);
}

export function createProjectUpdateEvents(previousProject: Project, updatedProject: Project, actorId = updatedProject.ownerId) {
  const events: ExecutiveEvent[] = [];
  const previousState = previousProject.state || previousProject.status;
  const updatedState = updatedProject.state || updatedProject.status;

  if (previousState !== updatedState) {
    const stateTimestamp = [...(updatedProject.stateHistory || [])]
      .reverse()
      .find((entry) => entry.state === updatedState)?.enteredAt || updatedProject.updatedAt;
    events.push(
      stateChangedEvent(updatedProject, actorId, previousState, updatedState, stateTimestamp, updatedProject.currentWorkspace),
    );
  }

  if (previousProject.currentWorkspace !== updatedProject.currentWorkspace) {
    const workspaceTimestamp = [...updatedProject.workspaceHistory]
      .reverse()
      .find((entry) => entry.workspace === updatedProject.currentWorkspace)?.enteredAt || updatedProject.updatedAt;
    events.push(
      workspaceChangedEvent(
        updatedProject,
        actorId,
        previousProject.currentWorkspace,
        updatedProject.currentWorkspace,
        workspaceTimestamp,
      ),
    );
  }

  if (
    !previousProject.completedSoFar?.includes("Production package generated") &&
    updatedProject.completedSoFar?.includes("Production package generated")
  ) {
    events.push(
      productionCompletedEvent(
        updatedProject,
        actorId,
        updatedProject.productionCompletedAt || updatedProject.updatedAt,
      ),
    );
  }

  return sortExecutiveEvents(events);
}

export function groupExecutiveEvents(events: ExecutiveEvent[], now = new Date()): ExecutiveTimelineGroup[] {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const groupedEvents = new Map<ExecutiveTimelineGroupLabel, ExecutiveEvent[]>([
    ["Today", []],
    ["Yesterday", []],
    ["Earlier", []],
  ]);

  for (const event of sortExecutiveEvents(events)) {
    const eventTime = Date.parse(event.timestamp);
    const label = eventTime >= todayStart ? "Today" : eventTime >= yesterdayStart ? "Yesterday" : "Earlier";
    groupedEvents.get(label)?.push(event);
  }

  return timelineGroupOrder
    .map((label) => ({ label, events: groupedEvents.get(label) || [] }))
    .filter((group) => group.events.length > 0);
}

export const executiveEventLabels: Record<ExecutiveEventType, string> = {
  [ExecutiveEventType.ProjectCreated]: "Project Created",
  [ExecutiveEventType.ProjectStateChanged]: "State Changed",
  [ExecutiveEventType.WorkspaceChanged]: "Workspace Changed",
  [ExecutiveEventType.ResearchCompleted]: "Research Completed",
  [ExecutiveEventType.OutlineCompleted]: "Outline Completed",
  [ExecutiveEventType.ProductionCompleted]: "Production Completed",
  [ExecutiveEventType.RevisionRequested]: "Revision Requested",
  [ExecutiveEventType.ReviewRequested]: "Review Requested",
  [ExecutiveEventType.ApprovalCompleted]: "Approval Completed",
  [ExecutiveEventType.PublishingCompleted]: "Publishing Completed",
};
