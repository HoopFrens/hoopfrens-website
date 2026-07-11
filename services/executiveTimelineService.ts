import { ExecutiveEventType, groupExecutiveEvents, sortExecutiveEvents, type ExecutiveEvent } from "@/domain/event";
import type { Project } from "@/domain/project";

const completedEventTypes = new Set([
  ExecutiveEventType.ResearchCompleted,
  ExecutiveEventType.OutlineCompleted,
  ExecutiveEventType.ProductionCompleted,
  ExecutiveEventType.ApprovalCompleted,
  ExecutiveEventType.PublishingCompleted,
]);

function after(events: ExecutiveEvent[], cutoff: string | null) {
  const cutoffTime = cutoff ? Date.parse(cutoff) : 0;
  const normalizedCutoff = Number.isNaN(cutoffTime) ? 0 : cutoffTime;
  return sortExecutiveEvents(events.filter((event) => Date.parse(event.timestamp) > normalizedCutoff));
}

function currentProductionCompletion(project: Project | undefined, event: ExecutiveEvent) {
  if (!project) return true;
  return Boolean(project.productionCompletedAt) && project.productionCompletedAt === event.timestamp;
}

function deduplicateCompleted(events: ExecutiveEvent[], projects: Project[]) {
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const seen = new Set<string>();
  return events.filter((event) => {
    if (event.eventType === ExecutiveEventType.ProductionCompleted) {
      if (!currentProductionCompletion(projectsById.get(event.projectId), event)) return false;
    }
    const key = `${event.projectId}:${event.eventType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const executiveTimelineService = {
  sort: sortExecutiveEvents,
  group: groupExecutiveEvents,
  since(events: ExecutiveEvent[], cutoff: string | null) {
    return after(events, cutoff);
  },
  completedSince(events: ExecutiveEvent[], cutoff: string, projects: Project[] = []) {
    const completed = after(events, cutoff).filter((event) => completedEventTypes.has(event.eventType));
    return deduplicateCompleted(completed, projects);
  },
};
