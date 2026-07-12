import type { ExecutionPlan } from "../execution";
import type { EntityId, ISODateString } from "../shared";

export interface OrchestrationRequest {
  id: string;
  executionPlan: ExecutionPlan;
  requestedBy: EntityId;
  createdAt: ISODateString;
}
