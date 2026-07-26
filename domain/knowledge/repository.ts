import type { EntityId } from "../shared/types";
import type {
  KnowledgeAuditEvent,
  KnowledgeNode,
  KnowledgeNodeCreateInput,
  KnowledgeNodeUpdate,
  KnowledgeNodeType,
  KnowledgeRelationship,
  KnowledgeRelationshipCreateInput,
  KnowledgeRelationshipUpdate,
  KnowledgeSource,
  KnowledgeSourceCreateInput,
  KnowledgeSourceUpdate,
  SchoolKnowledgeNode,
} from "./types";

type StateNodeCreateInput = Omit<KnowledgeNodeCreateInput, "type"> & { type: KnowledgeNodeType.State };
type RegionNodeCreateInput = Omit<KnowledgeNodeCreateInput, "type"> & { type: KnowledgeNodeType.Region };
type SchoolNodeCreateInput = Extract<KnowledgeNodeCreateInput, { type: KnowledgeNodeType.School }>;

export interface KnowledgeSchoolBundleReasons {
  source: string;
  stateNode: string;
  regionNode: string;
  schoolNode: string;
  stateRelationship: string;
  regionRelationship: string;
}

/**
 * One Founder-confirmed School mutation. Repository-managed references ensure
 * every new canonical subject uses the same verified source and the canonical
 * State/Region owners selected by the uniqueness registries.
 */
export interface KnowledgeSchoolBundleCreateInput {
  source: KnowledgeSourceCreateInput;
  stateNode: Omit<StateNodeCreateInput, "sourceIds">;
  regionNode: Omit<RegionNodeCreateInput, "sourceIds">;
  schoolNode: Omit<SchoolNodeCreateInput, "sourceIds" | "stateNodeId" | "regionNodeId">;
  stateRelationship: Omit<
    KnowledgeRelationshipCreateInput,
    "id" | "workspaceId" | "fromNodeId" | "toNodeId" | "relationshipType" | "sourceIds"
  >;
  regionRelationship: Omit<
    KnowledgeRelationshipCreateInput,
    "id" | "workspaceId" | "fromNodeId" | "toNodeId" | "relationshipType" | "sourceIds"
  >;
  reasons: KnowledgeSchoolBundleReasons;
}

/** Reports whether the request created a School or resolved its existing canonical owner. */
export interface KnowledgeSchoolBundleResult {
  school: SchoolKnowledgeNode;
  created: boolean;
}

/** Actor identity is supplied by authenticated application context; clocks remain repository-owned. */
export interface KnowledgeMutationContext {
  actorId: EntityId;
  reason?: string;
}

export interface KnowledgeGraphRepository {
  listNodes(workspaceId: EntityId): Promise<KnowledgeNode[]>;
  getNodeById(nodeId: EntityId): Promise<KnowledgeNode | null>;
  createNode(node: KnowledgeNodeCreateInput, context: KnowledgeMutationContext): Promise<KnowledgeNode>;
  createSchoolBundle(
    bundle: KnowledgeSchoolBundleCreateInput,
    context: KnowledgeMutationContext,
  ): Promise<KnowledgeSchoolBundleResult>;
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
