import type { Scope, VerificationStatus } from "../shared/enums";
import type { EntityId, ISODateString } from "../shared/types";

export interface KnowledgeEntity {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  summary?: string;
  category: string;
  tags: string[];
  sourceIds: EntityId[];
  relatedEntityIds: EntityId[];
  verificationStatus: VerificationStatus;
  scope: Scope;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
