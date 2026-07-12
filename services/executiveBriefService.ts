import type { EntityId, Source } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export interface ExecutiveBrief {
  workspaceId: EntityId;
  title: string;
  summary: string;
  sourceIds: Source["id"][];
}

export const executiveBriefService = {
  createWorkspaceBrief(workspaceId: EntityId): ServiceResult<ExecutiveBrief> {
    void workspaceId;
    return foundationOnly<ExecutiveBrief>("executiveBriefService.createWorkspaceBrief");
  },
};
