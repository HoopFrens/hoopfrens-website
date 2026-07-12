import type { IntentResult } from "../intent";
import type { ISODateString, Priority, Region, Scope } from "../shared";
import type { ExecutionStatus } from "./ExecutionStatus";
import type { ExecutionStep } from "./ExecutionStep";

export interface ExecutionPlan {
  id: string;
  intentResultId?: string;
  sourceIntent: IntentResult;
  planType: string;
  targetWorkspace: IntentResult["targetWorkspace"];
  targetRoom: IntentResult["targetRoom"];
  projectType?: string;
  priority: Priority;
  scope?: Scope;
  region?: Region;
  requiredSystems: string[];
  requiredSteps: ExecutionStep[];
  requiredDeliverables: string[];
  founderReviewRequired: boolean;
  founderApprovalRequired: boolean;
  clarificationRequired: boolean;
  clarificationQuestion?: string;
  status: ExecutionStatus;
  createdAt: ISODateString;
}
