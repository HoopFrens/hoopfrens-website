import type { Region, Scope, VerificationStatus } from "../shared/enums";
import type { EntityId, ISODateString } from "../shared/types";

export interface Person {
  id: EntityId;
  workspaceId: EntityId;
  displayName: string;
  role?: string;
  organizationIds: EntityId[];
  email?: string;
  phone?: string;
  region?: Region;
  scope: Scope;
  verificationStatus: VerificationStatus;
  tags: string[];
  sourceIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
