import { canonicalRelationshipEndpoints, relationshipPolicyFor } from "./relationshipPolicy";
import { findConflictingRelationships, findDuplicateKnowledgeNode, relationshipIdentity } from "./validation";
import {
  isSchoolKnowledgeNode,
  type KnowledgeGraph,
  type KnowledgeIntegrityWarning,
  type KnowledgeNode,
  type KnowledgeSourceReference,
  KnowledgeNodeType,
  KnowledgeRelationshipType,
  KnowledgeStatus,
} from "./types";

function sourceReferenceMatchesCanonical(reference: KnowledgeSourceReference, source: KnowledgeGraph["sources"][number]) {
  return reference.sourceId === source.id
    && reference.title === source.title
    && reference.publisher === source.publisher
    && reference.reliability === source.reliability
    && reference.status === source.status;
}

export function evaluateKnowledgeIntegrity(graph: KnowledgeGraph): KnowledgeIntegrityWarning[] {
  const warnings: KnowledgeIntegrityWarning[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const sourceById = new Map(graph.sources.map((source) => [source.id, source]));
  const auditById = new Map(graph.auditEvents.map((event) => [event.id, event]));

  function evaluateAuditLink(
    owner: { id: string; workspaceId: string; version: number; lastAuditEventId: string },
    subjectType: "node" | "relationship" | "source",
    subject: { nodeId?: string; relationshipId?: string; sourceId?: string },
    label: string,
  ) {
    if (owner.lastAuditEventId.startsWith("legacy:")) return;
    const audit = auditById.get(owner.lastAuditEventId);
    if (!audit) {
      warnings.push({
        id: `missing-audit:${subjectType}:${owner.id}:${owner.lastAuditEventId}`,
        type: "missing-audit",
        ...subject,
        message: `${label} references an audit event that is not available. Retry through the canonical repository to repair the audit link before relying on this version.`,
      });
      return;
    }
    if (audit.workspaceId !== owner.workspaceId || audit.subjectType !== subjectType
      || audit.subjectId !== owner.id || audit.version !== owner.version) {
      warnings.push({
        id: `audit-mismatch:${subjectType}:${owner.id}:${owner.lastAuditEventId}`,
        type: "audit-mismatch",
        ...subject,
        message: `${label} has an audit event that does not match its current canonical version.`,
      });
    }
  }

  function evaluateProvenance(
    owner: { id: string; workspaceId: string; sourceIds: string[]; sources: KnowledgeSourceReference[]; status: KnowledgeStatus },
    subject: { nodeId?: string; relationshipId?: string },
    label: string,
  ) {
    for (const sourceId of owner.sourceIds) {
      const source = sourceById.get(sourceId);
      if (!source) {
        warnings.push({
          id: `missing-source:${owner.id}:${sourceId}`,
          type: "missing-source",
          ...subject,
          sourceId,
          message: `${label} references missing source ${sourceId}.`,
        });
        continue;
      }
      if (source.workspaceId !== owner.workspaceId) {
        warnings.push({
          id: `foreign-source:${owner.id}:${sourceId}`,
          type: "provenance-mismatch",
          ...subject,
          sourceId,
          message: `${label} references a source from another workspace.`,
        });
      }
      if (source.status === KnowledgeStatus.Archived && owner.status === KnowledgeStatus.Active) {
        warnings.push({
          id: `archived-source:${owner.id}:${sourceId}`,
          type: "archived-source",
          ...subject,
          sourceId,
          message: `${label} is active but relies on archived source ${source.title}.`,
        });
      }
      const embedded = owner.sources.find((reference) => reference.sourceId === sourceId);
      if (embedded && !sourceReferenceMatchesCanonical(embedded, source)) {
        warnings.push({
          id: `source-drift:${owner.id}:${sourceId}`,
          type: "provenance-mismatch",
          ...subject,
          sourceId,
          message: `${label} has a derived source summary that no longer matches ${source.title}.`,
        });
      }
    }
    for (const reference of owner.sources) {
      if (!owner.sourceIds.includes(reference.sourceId)) {
        warnings.push({
          id: `unbound-source-summary:${owner.id}:${reference.sourceId}`,
          type: "provenance-mismatch",
          ...subject,
          sourceId: reference.sourceId,
          message: `${label} contains a source summary that is not backed by a canonical source ID.`,
        });
      }
    }
  }

  for (const node of graph.nodes) {
    const duplicate = findDuplicateKnowledgeNode(graph.nodes, node);
    if (duplicate && node.id.localeCompare(duplicate.id) < 0) {
      warnings.push({
        id: `duplicate-node:${node.id}:${duplicate.id}`,
        type: "duplicate-node",
        nodeId: node.id,
        message: `${node.name} may duplicate canonical node ${duplicate.name}.`,
      });
    }
    evaluateAuditLink(node, "node", { nodeId: node.id }, node.name);
    evaluateProvenance(node, { nodeId: node.id }, node.name);
  }

  for (const source of graph.sources) {
    evaluateAuditLink(source, "source", { sourceId: source.id }, source.title);
  }

  const activeRelationshipsByIdentity = new Map<string, KnowledgeGraph["relationships"]>();
  for (const relationship of graph.relationships) {
    if (relationship.status !== KnowledgeStatus.Active) continue;
    const identity = relationshipIdentity(relationship);
    activeRelationshipsByIdentity.set(identity, [
      ...(activeRelationshipsByIdentity.get(identity) || []),
      relationship,
    ]);
  }
  for (const duplicateGroup of activeRelationshipsByIdentity.values()) {
    if (duplicateGroup.length < 2) continue;
    const sortedIds = duplicateGroup.map((relationship) => relationship.id).sort();
    warnings.push({
      id: `duplicate-relationship:${sortedIds.join(":")}`,
      type: "duplicate-relationship",
      relationshipId: sortedIds[0],
      message: `Relationships ${sortedIds.join(", ")} represent the same canonical fact.`,
    });
  }

  for (const relationship of graph.relationships) {
    const fromNode = nodeById.get(relationship.fromNodeId);
    const toNode = nodeById.get(relationship.toNodeId);
    if (!fromNode || !toNode) {
      warnings.push({
        id: `orphaned-relationship:${relationship.id}`,
        type: "orphaned-relationship",
        relationshipId: relationship.id,
        message: `Relationship ${relationship.id} references a missing node.`,
      });
    } else {
      const policy = relationshipPolicyFor(relationship.relationshipType);
      if (fromNode.type !== policy.fromNodeType || toNode.type !== policy.toNodeType
        || fromNode.workspaceId !== relationship.workspaceId || toNode.workspaceId !== relationship.workspaceId) {
        warnings.push({
          id: `invalid-relationship-semantics:${relationship.id}`,
          type: "invalid-relationship-semantics",
          relationshipId: relationship.id,
          message: `${relationship.relationshipType} must connect ${policy.fromNodeType} to ${policy.toNodeType} in the same workspace.`,
        });
      }
      if (relationship.status === KnowledgeStatus.Active
        && (fromNode.status === KnowledgeStatus.Archived || toNode.status === KnowledgeStatus.Archived)) {
        warnings.push({
          id: `archived-endpoint:${relationship.id}`,
          type: "archived-endpoint",
          relationshipId: relationship.id,
          message: `Active relationship ${relationship.id} has an archived endpoint and must be archived or repaired.`,
        });
      }
    }
    evaluateAuditLink(
      relationship,
      "relationship",
      { relationshipId: relationship.id },
      `Relationship ${relationship.id}`,
    );
    evaluateProvenance(relationship, { relationshipId: relationship.id }, `Relationship ${relationship.id}`);
    const conflicts = findConflictingRelationships(graph.relationships, relationship);
    if (conflicts.length > 0 && relationship.id.localeCompare(conflicts[0].id) < 0) {
      warnings.push({
        id: `conflicting-relationship:${relationship.id}`,
        type: "conflicting-relationship",
        relationshipId: relationship.id,
        message: `Relationship ${relationship.id} conflicts with ${conflicts.map((conflict) => conflict.id).join(", ")}.`,
      });
    }
  }

  function warnInvalidReference(school: KnowledgeNode, referencedId: string, expectedType: KnowledgeNodeType, label: string) {
    const referenced = nodeById.get(referencedId);
    if (!referenced || referenced.workspaceId !== school.workspaceId
      || referenced.status !== KnowledgeStatus.Active || referenced.type !== expectedType) {
      warnings.push({
        id: `invalid-school-reference:${school.id}:${label}:${referencedId}`,
        type: "provenance-mismatch",
        nodeId: school.id,
        message: `${school.name} has an unresolved or inactive ${label} reference ${referencedId}.`,
      });
    }
  }

  for (const node of graph.nodes) {
    if (!isSchoolKnowledgeNode(node) || node.status !== KnowledgeStatus.Active) continue;
    const activeCanonicalFamilies = new Set(
      graph.relationships
        .filter((relationship) => (
          relationship.status === KnowledgeStatus.Active
          && (() => {
            const fromNode = nodeById.get(relationship.fromNodeId);
            const toNode = nodeById.get(relationship.toNodeId);
            if (!fromNode || !toNode) return false;
            const policy = relationshipPolicyFor(relationship.relationshipType);
            return fromNode.workspaceId === relationship.workspaceId
              && toNode.workspaceId === relationship.workspaceId
              && fromNode.status === KnowledgeStatus.Active
              && toNode.status === KnowledgeStatus.Active
              && fromNode.type === policy.fromNodeType
              && toNode.type === policy.toNodeType
              && canonicalRelationshipEndpoints(relationship).fromNodeId === node.id;
          })()
        ))
        .map((relationship) => relationshipPolicyFor(relationship.relationshipType).semanticFamily),
    );
    const requiredRelationships: Array<[KnowledgeRelationshipType, string]> = [
      [KnowledgeRelationshipType.SchoolLocatedInState, "school-state"],
      [KnowledgeRelationshipType.SchoolLocatedInRegion, "school-region"],
      ...(node.conference ? [[KnowledgeRelationshipType.SchoolBelongsToConference, "school-conference"] as [KnowledgeRelationshipType, string]] : []),
    ];
    for (const [relationshipType, semanticFamily] of requiredRelationships) {
      if (!activeCanonicalFamilies.has(semanticFamily)) {
        warnings.push({
          id: `school-relationship-missing:${node.id}:${relationshipType}`,
          type: "school-relationship-missing",
          nodeId: node.id,
          message: `${node.name} is missing required relationship ${relationshipType}.`,
        });
      }
    }
    if (node.conference) warnInvalidReference(node, node.conference.nodeId, KnowledgeNodeType.Conference, "conference");
    node.coaches.forEach((reference) => warnInvalidReference(node, reference.nodeId, KnowledgeNodeType.Coach, "coach"));
    node.facilities.forEach((reference) => warnInvalidReference(node, reference.nodeId, KnowledgeNodeType.Facility, "facility"));
  }

  return warnings;
}
