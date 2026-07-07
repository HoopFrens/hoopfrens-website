import type { Scope, WorkspaceType } from "../shared/enums";
import type { BusinessObjectType, EntityId, ISODateString } from "../shared/types";

export interface Workspace {
  id: EntityId;
  name: string;
  description?: string;
  type: WorkspaceType;
  scope: Scope;
  ownerId: EntityId;
  memberIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Event {
  id: EntityId;
  type: string;
  actorId: EntityId;
  workspaceId: EntityId;
  objectType: BusinessObjectType;
  objectId: EntityId;
  occurredAt: ISODateString;
  metadata?: Record<string, unknown>;
}
