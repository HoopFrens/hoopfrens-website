import type {
  KnowledgeGraph,
  KnowledgeGraphRepository,
  KnowledgeMutationContext,
  KnowledgeNodeCreateInput,
  KnowledgeNodeUpdate,
  KnowledgeRelationshipCreateInput,
  KnowledgeRelationshipUpdate,
  KnowledgeSource,
  KnowledgeSourceCreateInput,
  KnowledgeSourceReference,
} from "@/domain/knowledge";
import type { EntityId } from "@/domain/shared";

const founderSafeKnowledgeErrorNames = new Set([
  "KnowledgeValidationError",
  "KnowledgeIntegrityError",
  "KnowledgeConflictError",
  "KnowledgeNotFoundError",
]);

export function founderKnowledgeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !founderSafeKnowledgeErrorNames.has(error.name)) return fallback;
  if (!error.message.trim() || /firestore|transaction|internalKnowledge|permission-denied/i.test(error.message)) {
    return fallback;
  }
  return error.message;
}

function resolveCanonicalSourceReferences(
  sourceIds: EntityId[],
  sourceById: Map<EntityId, KnowledgeSource>,
): KnowledgeSourceReference[] {
  return sourceIds.flatMap((sourceId) => {
    const source = sourceById.get(sourceId);
    return source ? [{
      sourceId: source.id,
      title: source.title,
      publisher: source.publisher,
      reliability: source.reliability,
      status: source.status,
    }] : [];
  });
}

export const knowledgeService = {
  async loadGraph(repository: KnowledgeGraphRepository, workspaceId: EntityId): Promise<KnowledgeGraph> {
    const [storedNodes, storedRelationships, sources, auditEvents] = await Promise.all([
      repository.listNodes(workspaceId),
      repository.listRelationships(workspaceId),
      repository.listSources(workspaceId),
      repository.listAuditEvents(workspaceId),
    ]);
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const nodes = storedNodes.map((node) => ({
      ...node,
      sources: resolveCanonicalSourceReferences(node.sourceIds, sourceById),
    }));
    const relationships = storedRelationships.map((relationship) => ({
      ...relationship,
      sources: resolveCanonicalSourceReferences(relationship.sourceIds, sourceById),
    }));
    return { nodes, relationships, sources, auditEvents };
  },

  getNode(repository: KnowledgeGraphRepository, nodeId: EntityId) {
    return repository.getNodeById(nodeId);
  },

  createNode(repository: KnowledgeGraphRepository, node: KnowledgeNodeCreateInput, context: KnowledgeMutationContext) {
    return repository.createNode(node, context);
  },

  updateNode(
    repository: KnowledgeGraphRepository,
    nodeId: EntityId,
    node: KnowledgeNodeUpdate,
    context: KnowledgeMutationContext,
  ) {
    return repository.updateNode(nodeId, node, context);
  },

  archiveNode(repository: KnowledgeGraphRepository, nodeId: EntityId, context: KnowledgeMutationContext) {
    return repository.archiveNode(nodeId, context);
  },

  connectNodes(
    repository: KnowledgeGraphRepository,
    relationship: KnowledgeRelationshipCreateInput,
    context: KnowledgeMutationContext,
  ) {
    return repository.createRelationship(relationship, context);
  },

  updateRelationship(
    repository: KnowledgeGraphRepository,
    relationshipId: EntityId,
    relationship: KnowledgeRelationshipUpdate,
    context: KnowledgeMutationContext,
  ) {
    return repository.updateRelationship(relationshipId, relationship, context);
  },

  archiveRelationship(
    repository: KnowledgeGraphRepository,
    relationshipId: EntityId,
    context: KnowledgeMutationContext,
  ) {
    return repository.archiveRelationship(relationshipId, context);
  },

  createSource(repository: KnowledgeGraphRepository, source: KnowledgeSourceCreateInput, context: KnowledgeMutationContext) {
    return repository.createSource(source, context);
  },

  archiveSource(repository: KnowledgeGraphRepository, sourceId: EntityId, context: KnowledgeMutationContext) {
    return repository.archiveSource(sourceId, context);
  },
};
