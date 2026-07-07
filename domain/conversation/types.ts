import type { Scope } from "../shared/enums";
import type { EntityId, ISODateString } from "../shared/types";

export interface Conversation {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  scope: Scope;
  participantIds: EntityId[];
  projectIds: EntityId[];
  decisionIds: EntityId[];
  sourceIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
