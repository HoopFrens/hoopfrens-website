import type { ExecutiveEvent } from "./ExecutiveEvent";
import type { ExecutiveEventRepository } from "./ExecutiveEventRepository";
import { sortExecutiveEvents } from "./timelineEngine";

export class InMemoryExecutiveEventRepository implements ExecutiveEventRepository {
  private readonly events = new Map<string, ExecutiveEvent>();

  constructor(initialEvents: ExecutiveEvent[] = []) {
    for (const event of initialEvents) this.events.set(event.id, event);
  }

  async listByWorkspace(workspaceId: string) {
    return sortExecutiveEvents([...this.events.values()].filter((event) => event.workspaceId === workspaceId));
  }

  async listByProject(projectId: string) {
    return sortExecutiveEvents([...this.events.values()].filter((event) => event.projectId === projectId));
  }

  async record(event: ExecutiveEvent) {
    this.events.set(event.id, event);
    return event;
  }

  async recordMany(events: ExecutiveEvent[]) {
    for (const event of events) this.events.set(event.id, event);
    return sortExecutiveEvents(events);
  }
}
