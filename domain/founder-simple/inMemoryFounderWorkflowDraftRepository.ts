import type { FounderWorkflowDraftRepository } from "./repository";
import type { FounderWorkflowDraft } from "./types";
import { normalizeFounderWorkflowDraft } from "./requestCompatibility";
import { FounderWorkflowValidationError, validateFounderWorkflowDraft } from "./validation";

export interface FounderWorkflowDraftStore {
  read(): FounderWorkflowDraft[];
  write(drafts: FounderWorkflowDraft[]): void;
}

function clone<T>(value: T): T {
  return globalThis.structuredClone(value);
}

export function createVolatileFounderWorkflowDraftStore(
  initialDrafts: FounderWorkflowDraft[] = [],
): FounderWorkflowDraftStore {
  let drafts = clone(initialDrafts);
  return {
    read: () => clone(drafts),
    write: (nextDrafts) => { drafts = clone(nextDrafts); },
  };
}

export function createInMemoryFounderWorkflowDraftRepository(
  store: FounderWorkflowDraftStore = createVolatileFounderWorkflowDraftStore(),
  now: () => string = () => new Date().toISOString(),
): FounderWorkflowDraftRepository {
  return {
    async listByOwner(workspaceId, ownerId) {
      return store.read()
        .filter((draft) => draft.workspaceId === workspaceId && draft.ownerId === ownerId)
        .map((draft) => validateFounderWorkflowDraft(normalizeFounderWorkflowDraft(draft)))
        .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
    },
    async getById(draftId, context) {
      if (!context.actorId) {
        throw new FounderWorkflowValidationError("An approved Headquarters editor is required.");
      }
      const draft = store.read().find((candidate) => candidate.id === draftId);
      if (draft && draft.ownerId !== context.actorId) {
        throw new FounderWorkflowValidationError("This saved workflow belongs to another Headquarters editor.");
      }
      return draft ? validateFounderWorkflowDraft(normalizeFounderWorkflowDraft(draft)) : null;
    },
    async create(input, context) {
      if (!context.actorId || context.actorId !== input.ownerId) {
        throw new FounderWorkflowValidationError("An approved Headquarters editor is required.");
      }
      const existing = store.read().find((draft) => draft.id === input.id);
      if (existing) {
        if (existing.ownerId !== context.actorId) {
          throw new FounderWorkflowValidationError("This saved workflow belongs to another Headquarters editor.");
        }
        return validateFounderWorkflowDraft(normalizeFounderWorkflowDraft(existing));
      }
      const timestamp = now();
      const draft = validateFounderWorkflowDraft(normalizeFounderWorkflowDraft({
        ...input,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: context.actorId,
        updatedBy: context.actorId,
        revision: 1,
      }));
      store.write([draft, ...store.read()]);
      return clone(draft);
    },
    async update(draftId, update, context, options) {
      const drafts = store.read();
      const stored = drafts.find((draft) => draft.id === draftId);
      if (!stored) throw new FounderWorkflowValidationError("This saved workflow could not be found.");
      const current = validateFounderWorkflowDraft(normalizeFounderWorkflowDraft(stored));
      if (context.actorId !== current.ownerId) {
        throw new FounderWorkflowValidationError("This saved workflow belongs to another Headquarters editor.");
      }
      if (options?.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
        throw new FounderWorkflowValidationError("A newer saved version is available. Reload before continuing.");
      }
      const next = validateFounderWorkflowDraft(normalizeFounderWorkflowDraft({
        ...current,
        ...update,
        id: current.id,
        workspaceId: current.workspaceId,
        ownerId: current.ownerId,
        kind: current.kind,
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        updatedAt: now(),
        updatedBy: context.actorId,
        revision: current.revision + 1,
      }));
      store.write([next, ...drafts.filter((draft) => draft.id !== draftId)]);
      return clone(next);
    },
  };
}
