import type { EntityId } from "../shared/types";
import type { Asset } from "./types";

export interface AssetRepository {
  listByWorkspace(workspaceId: EntityId): Promise<Asset[]>;
  getById(assetId: EntityId): Promise<Asset | null>;
  create(asset: Asset): Promise<Asset>;
  update(assetId: EntityId, asset: Partial<Asset>): Promise<Asset>;
}
