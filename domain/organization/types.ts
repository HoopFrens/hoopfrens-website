import type { Region, Scope, VerificationStatus } from "../shared/enums";
import type { EntityId, ISODateString } from "../shared/types";

export interface Organization {
  id: EntityId;
  workspaceId: EntityId;
  name: string;
  type: "school" | "team" | "league" | "company" | "media" | "other";
  website?: string;
  location?: string;
  region?: Region;
  scope: Scope;
  verificationStatus: VerificationStatus;
  personIds: EntityId[];
  sourceIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
