import type { EntityId, KnowledgeEntity } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export const knowledgeService = {
  listByWorkspace(workspaceId: EntityId): ServiceResult<KnowledgeEntity[]> {
    void workspaceId;
    return foundationOnly<KnowledgeEntity[]>("knowledgeService.listByWorkspace");
  },

  getById(entityId: EntityId): ServiceResult<KnowledgeEntity> {
    void entityId;
    return foundationOnly<KnowledgeEntity>("knowledgeService.getById");
  },
};
