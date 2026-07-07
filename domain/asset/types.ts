import type { AssetStatus, Scope } from "../shared/enums";
import type { EntityId, ISODateString, ProductionPackage } from "../shared/types";

export interface Asset {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  description?: string;
  status: AssetStatus;
  scope: Scope;
  storagePath: string;
  mimeType: string;
  sizeBytes?: number;
  projectIds: EntityId[];
  sourceIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: EntityId;
}

export type { ProductionPackage };
