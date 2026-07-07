import type { Decision, EntityId } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export const decisionService = {
  listByWorkspace(workspaceId: EntityId): ServiceResult<Decision[]> {
    void workspaceId;
    return foundationOnly<Decision[]>("decisionService.listByWorkspace");
  },

  getById(decisionId: EntityId): ServiceResult<Decision> {
    void decisionId;
    return foundationOnly<Decision>("decisionService.getById");
  },
};
