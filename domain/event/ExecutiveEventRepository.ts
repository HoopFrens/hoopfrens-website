import type { EntityId } from "../shared";
import type { ExecutiveEvent } from "./ExecutiveEvent";

export interface ExecutiveEventRepository {
  listByWorkspace(workspaceId: EntityId): Promise<ExecutiveEvent[]>;
  listByProject(projectId: EntityId): Promise<ExecutiveEvent[]>;
  record(event: ExecutiveEvent): Promise<ExecutiveEvent>;
  recordMany(events: ExecutiveEvent[]): Promise<ExecutiveEvent[]>;
}
