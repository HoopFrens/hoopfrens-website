import type { Conversation, EntityId } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export const conversationService = {
  listByWorkspace(workspaceId: EntityId): ServiceResult<Conversation[]> {
    void workspaceId;
    return foundationOnly<Conversation[]>("conversationService.listByWorkspace");
  },

  getById(conversationId: EntityId): ServiceResult<Conversation> {
    void conversationId;
    return foundationOnly<Conversation>("conversationService.getById");
  },
};
