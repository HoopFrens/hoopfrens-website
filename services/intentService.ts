import type { EntityId } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export interface IntentClassificationInput {
  workspaceId: EntityId;
  text: string;
}

export interface IntentClassification {
  label: string;
  confidence: number;
}

export const intentService = {
  classify(input: IntentClassificationInput): ServiceResult<IntentClassification> {
    void input;
    return foundationOnly<IntentClassification>("intentService.classify");
  },
};
