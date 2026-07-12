import type { DecisionStatus, Priority, Scope } from "../shared/enums";
import type { EntityId, ISODateString } from "../shared/types";

export interface Decision {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  summary: string;
  status: DecisionStatus;
  priority: Priority;
  scope: Scope;
  decidedBy: EntityId;
  decidedAt?: ISODateString;
  projectIds: EntityId[];
  sourceIds: EntityId[];
  rationale?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
