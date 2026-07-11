import { IntentType, type IntentResult } from "@/domain/intent";

export type ExecutiveCommandHandlers<TResult> = {
  create(intent: IntentResult): Promise<TResult>;
  continue(intent: IntentResult): Promise<TResult>;
  review(intent: IntentResult): Promise<TResult>;
  approve(intent: IntentResult): Promise<TResult>;
  learn(intent: IntentResult): Promise<TResult>;
  think(intent: IntentResult): Promise<TResult>;
  search(intent: IntentResult): Promise<TResult>;
  navigate(intent: IntentResult): Promise<TResult>;
  unknown(intent: IntentResult): Promise<TResult>;
};

export const executiveCommandService = {
  execute<TResult>(intent: IntentResult, handlers: ExecutiveCommandHandlers<TResult>): Promise<TResult> {
    switch (intent.intentType) {
      case IntentType.Create:
        return handlers.create(intent);
      case IntentType.Continue:
        return handlers.continue(intent);
      case IntentType.Review:
        return handlers.review(intent);
      case IntentType.Approve:
        return handlers.approve(intent);
      case IntentType.Learn:
        return handlers.learn(intent);
      case IntentType.Think:
        return handlers.think(intent);
      case IntentType.Search:
        return handlers.search(intent);
      case IntentType.Navigate:
        return handlers.navigate(intent);
      case IntentType.Unknown:
        return handlers.unknown(intent);
    }
  },

  createRequestId(userId: string, submissionId: string) {
    return `${userId}:${submissionId}`;
  },

  projectIdForRequest(requestId: string) {
    const normalized = requestId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `project_${normalized}`;
  },
};
