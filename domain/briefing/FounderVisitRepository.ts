import type { EntityId, ISODateString } from "../shared";
import type { FounderVisitRegistration } from "./FounderVisit";

export interface FounderVisitRepository {
  recordVisit(userId: EntityId, workspaceId: EntityId, visitedAt: ISODateString): Promise<FounderVisitRegistration>;
}
