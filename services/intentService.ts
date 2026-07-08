import { IntentConfidence, type IntentResult, IntentType } from "@/domain/intent";
import type { EntityId } from "@/types/workspace";
import type { ServiceResult } from "./serviceResult";

export interface IntentClassificationInput {
  workspaceId: EntityId;
  text: string;
}

type StaticIntentRule = {
  intentType: IntentType;
  pattern: RegExp;
  targetRoom: IntentResult["targetRoom"];
  recommendedNextAction: string;
  suggestedProjectType?: string;
  entityFromMatch?: (match: RegExpMatchArray) => string | undefined;
};

const staticIntentRules: StaticIntentRule[] = [
  {
    intentType: IntentType.Create,
    pattern: /^spotlight\s+(.+)$/i,
    targetRoom: "production-studio",
    suggestedProjectType: "spotlight",
    recommendedNextAction: "Create a new spotlight project draft.",
    entityFromMatch: (match) => match[1],
  },
  {
    intentType: IntentType.Continue,
    pattern: /^continue\s+yesterday(?:'|’)?s\s+project$/i,
    targetRoom: "executive-office",
    recommendedNextAction: "Continue the most recent in-session project.",
  },
  {
    intentType: IntentType.Continue,
    pattern: /^pick\s+up\s+where\s+we\s+left\s+off$/i,
    targetRoom: "executive-office",
    recommendedNextAction: "Continue the most recent in-session project.",
  },
  {
    intentType: IntentType.Continue,
    pattern: /^continue\s+(.+)$/i,
    targetRoom: "executive-office",
    recommendedNextAction: "Continue the existing work thread or project context.",
    entityFromMatch: (match) => match[1],
  },
  {
    intentType: IntentType.Review,
    pattern: /^review\s+(.+)$/i,
    targetRoom: "strategy-room",
    recommendedNextAction: "Open the item for executive review.",
    entityFromMatch: (match) => match[1],
  },
  {
    intentType: IntentType.Approve,
    pattern: /^approve\s+(.+)$/i,
    targetRoom: "strategy-room",
    recommendedNextAction: "Prepare the item for approval review.",
    entityFromMatch: (match) => match[1]?.replace(/^the\s+/i, ""),
  },
  {
    intentType: IntentType.Learn,
    pattern: /^what\s+do\s+we\s+know\s+about\s+(.+)\??$/i,
    targetRoom: "intelligence-center",
    recommendedNextAction: "Open an intelligence brief placeholder.",
    entityFromMatch: (match) => match[1]?.replace(/\?$/, ""),
  },
  {
    intentType: IntentType.Think,
    pattern: /^where\s+should\s+hoop\s+frens\s+go\s+next\??$/i,
    targetRoom: "strategy-room",
    recommendedNextAction: "Open a strategic thinking placeholder.",
  },
  {
    intentType: IntentType.Search,
    pattern: /^find\s+(.+)$/i,
    targetRoom: "intelligence-center",
    recommendedNextAction: "Prepare a search request for future intelligence services.",
    entityFromMatch: (match) => match[1],
  },
  {
    intentType: IntentType.Navigate,
    pattern: /^open\s+the\s+library$/i,
    targetRoom: "library",
    recommendedNextAction: "Navigate to the Library room.",
  },
];

function normalizeInput(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function createUnknownIntent(rawInput: string, normalizedInput: string): IntentResult {
  return {
    rawInput,
    normalizedInput,
    intentType: IntentType.Unknown,
    confidence: IntentConfidence.Unknown,
    targetWorkspace: "executive-workspace",
    targetRoom: "unknown",
    clarificationRequired: true,
    clarificationQuestion: "What would you like Hoop Frens to do with this request?",
    recommendedNextAction: "Ask for clarification before routing the request.",
    createdAt: new Date().toISOString(),
  };
}

function parseStaticIntent(rawInput: string): IntentResult {
  const normalizedInput = normalizeInput(rawInput);

  for (const rule of staticIntentRules) {
    const match = normalizedInput.match(rule.pattern);
    if (!match) continue;

    return {
      rawInput,
      normalizedInput,
      intentType: rule.intentType,
      confidence: IntentConfidence.High,
      targetWorkspace: "executive-workspace",
      targetRoom: rule.targetRoom,
      suggestedProjectType: rule.suggestedProjectType,
      relatedEntityName: rule.entityFromMatch?.(match)?.trim(),
      clarificationRequired: false,
      recommendedNextAction: rule.recommendedNextAction,
      createdAt: new Date().toISOString(),
    };
  }

  return createUnknownIntent(rawInput, normalizedInput);
}

export const intentService = {
  classify(input: IntentClassificationInput): ServiceResult<IntentResult> {
    return {
      ok: true,
      data: parseStaticIntent(input.text),
    };
  },
};
