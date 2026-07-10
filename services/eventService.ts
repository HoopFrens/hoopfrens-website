import { createProjectHistoryEvents, sortExecutiveEvents, type ExecutiveEvent, type ExecutiveEventRepository } from "@/domain/event";
import type { Project } from "@/domain/project";

export const eventService = {
  listByWorkspace(repository: ExecutiveEventRepository, workspaceId: string) {
    return repository.listByWorkspace(workspaceId);
  },

  listByProject(repository: ExecutiveEventRepository, projectId: string) {
    return repository.listByProject(projectId);
  },

  record(repository: ExecutiveEventRepository, event: ExecutiveEvent) {
    return repository.record(event);
  },

  async synchronizeProjectHistory(
    repository: ExecutiveEventRepository,
    projects: Project[],
    existingEvents: ExecutiveEvent[],
  ) {
    const existingEventIds = new Set(existingEvents.map((event) => event.id));
    const missingEvents = projects
      .flatMap((project) => createProjectHistoryEvents(project))
      .filter((event) => !existingEventIds.has(event.id));

    if (missingEvents.length) await repository.recordMany(missingEvents);
    return sortExecutiveEvents([...existingEvents, ...missingEvents]);
  },
};
