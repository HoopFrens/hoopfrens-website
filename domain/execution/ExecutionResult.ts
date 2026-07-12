import type { ISODateString } from "../shared";
import type { ExecutionStatus } from "./ExecutionStatus";

export interface ExecutionResult {
  planId: string;
  status: ExecutionStatus;
  summary: string;
  completedStepIds: string[];
  failedStepIds: string[];
  createdAt: ISODateString;
  completedAt?: ISODateString;
}
