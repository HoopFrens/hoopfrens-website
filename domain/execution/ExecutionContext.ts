import type { Region, Scope } from "../shared";
import type { IntentResult } from "../intent";

export interface ExecutionContext {
  sourceIntent: IntentResult;
  targetWorkspace: IntentResult["targetWorkspace"];
  targetRoom: IntentResult["targetRoom"];
  projectType?: string;
  scope?: Scope;
  region?: Region;
}
