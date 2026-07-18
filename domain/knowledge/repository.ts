import type { EntityId } from "../shared/types";
import type {
  KnowledgeAuditEvent,
  KnowledgeNode,
  KnowledgeNodeCreateInput,
  KnowledgeNodeUpdate,
  KnowledgeRelationship,
  KnowledgeRelationshipCreateInput,
  KnowledgeRelationshipUpdate,
  KnowledgeSource,
  KnowledgeSourceCreateInput,
  KnowledgeSourceUpdate,
} from "./types";

/** Actor identity is supplied by authenticated application context; clocks remain repository-owned. */
export interface KnowledgeMutationContext {
  actorId: EntityId;
  reason?: string;
}

export interface KnowledgeGraphRepository {
  listNodes(workspaceId: EntityId): Promise<KnowledgeNode[]>;
  getNodeById(nodeId: EntityId): Promise<KnowledgeNode | null>;
  createNode(node: KnowledgeNodeCreateInput, context: KnowledgeMutationContext): Promise<KnowledgeNode>;
  updateNode(nodeId: EntityId, node: KnowledgeNodeUpdate, context: KnowledgeMutationContext): Promise<KnowledgeNode>;
  archiveNode(nodeId: EntityId, context: KnowledgeMutationContext): Promise<KnowledgeNode>;

  listRelationships(workspaceId: EntityId): Promise<KnowledgeRelationship[]>;
  getRelationshipById(relationshipId: EntityId): Promise<KnowledgeRelationship | null>;
  createRelationship(
    relationship: KnowledgeRelationshipCreateInput,
    context: KnowledgeMutationContext,
  ): Promise<KnowledgeRelationship>;
  updateRelationship(
    relationshipId: EntityId,
    relationship: KnowledgeRelationshipUpdate,
    context: KnowledgeMutationContext,
  ): Promise<KnowledgeRelationship>;
  archiveRelationship(relationshipId: EntityId, context: KnowledgeMutationContext): Promise<KnowledgeRelationship>;

  listSources(workspaceId: EntityId): Promise<KnowledgeSource[]>;
  getSourceById(sourceId: EntityId): Promise<KnowledgeSource | null>;
  createSource(source: KnowledgeSourceCreateInput, context: KnowledgeMutationContext): Promise<KnowledgeSource>;
  updateSource(sourceId: EntityId, source: KnowledgeSourceUpdate, context: KnowledgeMutationContext): Promise<KnowledgeSource>;
  archiveSource(sourceId: EntityId, context: KnowledgeMutationContext): Promise<KnowledgeSource>;

  listAuditEvents(workspaceId: EntityId): Promise<KnowledgeAuditEvent[]>;
}

export type KnowledgeRepository = KnowledgeGraphRepository;
