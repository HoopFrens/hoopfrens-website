import type { ISODateString } from "../shared";

export enum ProductionReadinessStatus {
  ReadyForReview = "ready-for-review",
  NeedsProduction = "needs-production",
  Blocked = "blocked",
}

export interface ProductionReadinessResult {
  status: ProductionReadinessStatus;
  reasons: string[];
  missingRequirements: string[];
  checkedAt: ISODateString;
}
