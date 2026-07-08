import type { EntityId, ISODateString } from "../shared";
import type { IntentResult } from "./IntentResult";

export interface Intent {
  id?: EntityId;
  workspaceId?: EntityId;
  result: IntentResult;
  createdBy?: EntityId;
  createdAt: ISODateString;
}
