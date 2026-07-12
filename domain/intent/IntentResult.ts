import type { ISODateString } from "../shared";
import type { IntentConfidence } from "./IntentConfidence";
import type { IntentType } from "./IntentType";
import type { IntentRoute } from "./IntentRoute";

export interface IntentResult extends IntentRoute {
  rawInput: string;
  normalizedInput: string;
  intentType: IntentType;
  confidence: IntentConfidence;
  suggestedProjectType?: string;
  relatedEntityName?: string;
  clarificationRequired: boolean;
  clarificationQuestion?: string;
  recommendedNextAction: string;
  createdAt: ISODateString;
}
