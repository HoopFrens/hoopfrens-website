import type { EntityId, Event } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export const eventService = {
  listByWorkspace(workspaceId: EntityId): ServiceResult<Event[]> {
    void workspaceId;
    return foundationOnly<Event[]>("eventService.listByWorkspace");
  },

  record(event: Event): ServiceResult<Event> {
    void event;
    return foundationOnly<Event>("eventService.record");
  },
};
