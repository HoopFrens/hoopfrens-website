import {
  collection,
  doc,
  type DocumentData,
  type Firestore,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { sanitizeFirestoreDocument } from "../shared";
import type { FounderWorkflowDraftRepository } from "./repository";
import type { FounderWorkflowDraft } from "./types";
import { normalizeFounderWorkflowDraft } from "./requestCompatibility";
import { FounderWorkflowValidationError, validateFounderWorkflowDraft } from "./validation";

export const founderWorkflowDraftCollection = "internalFounderWorkflowDrafts";

function draftDocument(db: Firestore, draftId: string) {
  return doc(db, founderWorkflowDraftCollection, draftId);
}

function readTimestamp(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function decodeDraft(data: DocumentData) {
  return validateFounderWorkflowDraft(normalizeFounderWorkflowDraft({
    ...data,
    createdAt: readTimestamp(data.createdAt),
    updatedAt: readTimestamp(data.updatedAt),
  } as FounderWorkflowDraft));
}

export function createFirestoreFounderWorkflowDraftRepository(db: Firestore): FounderWorkflowDraftRepository {
  return {
    async listByOwner(workspaceId, ownerId) {
      const snapshot = await getDocs(query(
        collection(db, founderWorkflowDraftCollection),
        where("workspaceId", "==", workspaceId),
        where("ownerId", "==", ownerId),
      ));
      return snapshot.docs.map((item) => decodeDraft(item.data()))
        .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
    },
    async getById(draftId, context) {
      if (!context.actorId) {
        throw new FounderWorkflowValidationError("An approved Headquarters editor is required.");
      }
      const snapshot = await getDoc(draftDocument(db, draftId));
      if (!snapshot.exists()) return null;
      const draft = decodeDraft(snapshot.data());
      if (draft.ownerId !== context.actorId) {
        throw new FounderWorkflowValidationError("This saved workflow belongs to another Headquarters editor.");
      }
      return draft;
    },
    async create(input, context) {
      if (!context.actorId || context.actorId !== input.ownerId) {
        throw new FounderWorkflowValidationError("An approved Headquarters editor is required.");
      }
      const reference = draftDocument(db, input.id);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists()) {
          const existing = decodeDraft(snapshot.data());
          if (existing.ownerId !== context.actorId) {
            throw new FounderWorkflowValidationError("This saved workflow belongs to another Headquarters editor.");
          }
          return;
        }
        const timestamp = new Date().toISOString();
        const candidate = validateFounderWorkflowDraft(normalizeFounderWorkflowDraft({
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: context.actorId,
          updatedBy: context.actorId,
          revision: 1,
        }));
        transaction.set(reference, sanitizeFirestoreDocument({
          ...candidate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
      });
      const saved = await getDoc(reference);
      if (!saved.exists()) throw new FounderWorkflowValidationError("Headquarters could not save this workflow yet.");
      return decodeDraft(saved.data());
    },
    async update(draftId, update, context, options) {
      const reference = draftDocument(db, draftId);
      const applyUpdate = async (patch: typeof update, expectedRevision?: number) => {
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(reference);
          if (!snapshot.exists()) throw new FounderWorkflowValidationError("This saved workflow could not be found.");
          const current = decodeDraft(snapshot.data());
          if (current.ownerId !== context.actorId) {
            throw new FounderWorkflowValidationError("This saved workflow belongs to another Headquarters editor.");
          }
          if (expectedRevision !== undefined && current.revision !== expectedRevision) {
            throw new FounderWorkflowValidationError("A newer saved version is available. Reload before continuing.");
          }
          const candidate = validateFounderWorkflowDraft(normalizeFounderWorkflowDraft({
            ...current,
            ...patch,
            id: current.id,
            workspaceId: current.workspaceId,
            ownerId: current.ownerId,
            kind: current.kind,
            createdAt: current.createdAt,
            createdBy: current.createdBy,
            updatedAt: new Date().toISOString(),
            updatedBy: context.actorId,
            revision: current.revision + 1,
          }));
          transaction.set(reference, sanitizeFirestoreDocument({
            ...candidate,
            createdAt: snapshot.data().createdAt,
            updatedAt: serverTimestamp(),
          }));
        });
        const saved = await getDoc(reference);
        if (!saved.exists()) throw new FounderWorkflowValidationError("Headquarters could not reload this workflow.");
        return decodeDraft(saved.data());
      };

      const changesRequest = Object.prototype.hasOwnProperty.call(update, "request");
      const changesCustomization = Object.prototype.hasOwnProperty.call(update, "customization");
      if (changesRequest && changesCustomization) {
        const afterRequest = await applyUpdate({ request: update.request }, options?.expectedRevision);
        const remainingUpdate = { ...update };
        delete remainingUpdate.request;
        return applyUpdate(remainingUpdate, afterRequest.revision);
      }
      return applyUpdate(update, options?.expectedRevision);
    },
  };
}
