import type {
  DocumentData,
  FirestoreDataConverter,
  PartialWithFieldValue,
  QueryDocumentSnapshot,
  SetOptions,
  SnapshotOptions,
  WithFieldValue,
} from "firebase/firestore";
import { sanitizeFirestoreDocument } from "../shared/firestoreConverters";
import {
  migrateLegacyKnowledgeAuditEventRead,
  migrateLegacyKnowledgeNodeRead,
  migrateLegacyKnowledgeRelationshipRead,
  migrateLegacyKnowledgeSourceRead,
  parseKnowledgeAuditEvent,
  parseKnowledgeNode,
  parseKnowledgeRelationship,
  parseKnowledgeSource,
} from "./validation";
import type { KnowledgeAuditEvent, KnowledgeNode, KnowledgeRelationship, KnowledgeSource } from "./types";

function withoutDerivedSources(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutDerivedSources);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => (
      key === "sources" ? [] : [[key, withoutDerivedSources(item)]]
    )),
  );
}

function converter<T>(
  parseWrite: (value: unknown) => T,
  parseRead: (value: unknown) => T,
  serialize: (value: T) => DocumentData,
): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions) {
      void options;
      return serialize(parseWrite(modelObject));
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions) {
      return parseRead(snapshot.data(options));
    },
  };
}

export function serializeKnowledgeNode(node: KnowledgeNode) { return sanitizeFirestoreDocument(withoutDerivedSources(parseKnowledgeNode(node))) as DocumentData; }
export function serializeKnowledgeRelationship(relationship: KnowledgeRelationship) { return sanitizeFirestoreDocument(withoutDerivedSources(parseKnowledgeRelationship(relationship))) as DocumentData; }
export function serializeKnowledgeSource(source: KnowledgeSource) { return sanitizeFirestoreDocument(parseKnowledgeSource(source)); }
export function serializeKnowledgeAuditEvent(event: KnowledgeAuditEvent) { return sanitizeFirestoreDocument(parseKnowledgeAuditEvent(event)); }

export const knowledgeNodeConverter = converter(parseKnowledgeNode, migrateLegacyKnowledgeNodeRead, serializeKnowledgeNode);
export const knowledgeRelationshipConverter = converter(parseKnowledgeRelationship, migrateLegacyKnowledgeRelationshipRead, serializeKnowledgeRelationship);
export const knowledgeSourceConverter = converter(parseKnowledgeSource, migrateLegacyKnowledgeSourceRead, serializeKnowledgeSource);
export const knowledgeAuditEventConverter = converter(parseKnowledgeAuditEvent, migrateLegacyKnowledgeAuditEventRead, serializeKnowledgeAuditEvent);
