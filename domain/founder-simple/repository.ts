import type { EntityId } from "../shared";
import type {
  FounderWorkflowDraft,
  FounderWorkflowDraftCreateInput,
  FounderWorkflowDraftUpdate,
  FounderWorkflowMutationContext,
  FounderWorkflowMutationOptions,
} from "./types";

export interface FounderWorkflowDraftRepository {
  listByOwner(workspaceId: EntityId, ownerId: EntityId): Promise<FounderWorkflowDraft[]>;
  getById(
    draftId: EntityId,
    context: FounderWorkflowMutationContext,
  ): Promise<FounderWorkflowDraft | null>;
  create(
    input: FounderWorkflowDraftCreateInput,
    context: FounderWorkflowMutationContext,
  ): Promise<FounderWorkflowDraft>;
  update(
    draftId: EntityId,
    update: FounderWorkflowDraftUpdate,
    context: FounderWorkflowMutationContext,
    options?: FounderWorkflowMutationOptions,
  ): Promise<FounderWorkflowDraft>;
}
