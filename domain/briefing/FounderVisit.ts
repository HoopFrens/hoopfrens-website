import type { EntityId, ISODateString } from "../shared";

export interface FounderVisit {
  id: EntityId;
  userId: EntityId;
  workspaceId: EntityId;
  lastVisitAt: ISODateString | null;
  currentVisitStartedAt: ISODateString;
  lastSeenAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface FounderVisitRegistration {
  previousVisitAt: ISODateString | null;
  visit: FounderVisit;
  isNewSession: boolean;
}
