import type { EntityId } from "../shared";
import {
  type KnowledgeAuditEvent,
  KnowledgeAuditEventType,
} from "./types";

export function canonicalKnowledgeAuditEventId(
  subjectType: KnowledgeAuditEvent["subjectType"],
  subjectId: EntityId,
  version: number,
) {
  return `knowledge-audit_${subjectType}_${subjectId}_v${version}`;
}

export function createKnowledgeAuditEvent(input: {
  workspaceId: EntityId;
  subjectType: KnowledgeAuditEvent["subjectType"];
  subjectId: EntityId;
  eventType: KnowledgeAuditEventType;
  actorId: EntityId;
  occurredAt: string;
  summary: string;
  version: number;
  eventKey?: string;
  metadata?: KnowledgeAuditEvent["metadata"];
}): KnowledgeAuditEvent {
  void input.eventKey;

  return {
    id: canonicalKnowledgeAuditEventId(input.subjectType, input.subjectId, input.version),
    workspaceId: input.workspaceId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    eventType: input.eventType,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    summary: input.summary,
    version: input.version,
    metadata: input.metadata || {},
  };
}
