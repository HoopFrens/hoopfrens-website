import type { ISODateString } from "../shared";
import type { OrchestrationStatus } from "./OrchestrationStatus";
import type { OrchestrationStep } from "./OrchestrationStep";

export interface OrchestrationResult {
  id: string;
  requestId: string;
  status: OrchestrationStatus;
  completedSteps: OrchestrationStep[];
  blockedReason?: string;
  recommendedNextAction?: string;
  createdAt: ISODateString;
  completedAt?: ISODateString;
}
