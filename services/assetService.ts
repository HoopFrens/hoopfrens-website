import type { Asset, EntityId } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export const assetService = {
  listByWorkspace(workspaceId: EntityId): ServiceResult<Asset[]> {
    void workspaceId;
    return foundationOnly<Asset[]>("assetService.listByWorkspace");
  },

  getById(assetId: EntityId): ServiceResult<Asset> {
    void assetId;
    return foundationOnly<Asset>("assetService.getById");
  },
};
