import type { KnowledgeRegion } from "../shared/regions";
import type { EntityId, ISODateString } from "../shared/types";

export enum KnowledgeNodeType {
  School = "school", Coach = "coach", Conference = "conference", Player = "player",
  Facility = "facility", Region = "region", State = "state", Organization = "organization",
  Project = "project", Content = "content",
}

export enum KnowledgeConfidence {
  Verified = "verified", Supported = "supported", Inferred = "inferred",
  Unverified = "unverified", Conflicting = "conflicting",
}

export enum KnowledgeCategory {
  Institution = "institution", Person = "person", Geography = "geography",
  Organization = "organization", Work = "work", Content = "content",
}

export enum KnowledgeStatus { Active = "active", Archived = "archived" }
export enum KnowledgeSourceReliability {
  Official = "official", High = "high", Medium = "medium", Low = "low", Unverified = "unverified",
}

export interface KnowledgeSourceReference {
  sourceId: EntityId;
  title: string;
  publisher?: string;
  reliability: KnowledgeSourceReliability;
  status: KnowledgeStatus;
}

export interface KnowledgeStatusChange {
  readonly from: KnowledgeStatus;
  readonly to: KnowledgeStatus;
  readonly changedAt: ISODateString;
  readonly changedBy: EntityId;
  readonly reason?: string;
  readonly version: number;
}

export interface KnowledgeConfidenceChange {
  readonly from: KnowledgeConfidence;
  readonly to: KnowledgeConfidence;
  readonly changedAt: ISODateString;
  readonly changedBy: EntityId;
  readonly reason?: string;
  readonly sourceIds: readonly EntityId[];
  readonly version: number;
}

export interface KnowledgeSourceVersion {
  readonly version: number;
  readonly changedAt: ISODateString;
  readonly changedBy: EntityId;
  readonly reason: string;
  readonly title: string;
  readonly url?: string;
  readonly publisher?: string;
  readonly sourceType: KnowledgeSource["sourceType"];
  readonly accessedAt: ISODateString;
  readonly publishedAt?: ISODateString;
  readonly reliability: KnowledgeSourceReliability;
  readonly notes?: string;
  readonly projectIds: readonly EntityId[];
  readonly status: KnowledgeStatus;
}

export interface KnowledgeSource {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  url?: string;
  publisher?: string;
  sourceType: "official" | "institutional" | "publication" | "document" | "founder" | "other";
  accessedAt: ISODateString;
  publishedAt?: ISODateString;
  reliability: KnowledgeSourceReliability;
  notes?: string;
  projectIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: EntityId;
  updatedBy: EntityId;
  status: KnowledgeStatus;
  version: number;
  versionHistory: readonly KnowledgeSourceVersion[];
  statusHistory: readonly KnowledgeStatusChange[];
  lastAuditEventId: EntityId;
}

export interface KnowledgeNodeReference {
  nodeId: EntityId;
  name: string;
  type: KnowledgeNodeType;
}

export interface SchoolTuition {
  inState?: number;
  outOfState?: number;
  currency: "USD";
  academicYear?: string;
}

export interface SchoolKnowledgeVersionData {
  officialName: string;
  nickname?: string;
  city: string;
  state: string;
  stateNodeId: EntityId;
  region: KnowledgeRegion;
  regionNodeId: EntityId;
  conference: KnowledgeNodeReference | null;
  division: string;
  governingBody: string;
  schoolWebsite: string;
  athleticsWebsite: string;
  enrollment?: number;
  tuition?: SchoolTuition;
  publicOrPrivate?: "public" | "private";
  facilities: KnowledgeNodeReference[];
  coaches: KnowledgeNodeReference[];
  recruitingNotes: string[];
  connectedProjectIds: EntityId[];
  connectedContentIds: EntityId[];
  lastVerifiedAt?: ISODateString;
}

export interface KnowledgeNodeVersion {
  readonly version: number;
  readonly changedAt: ISODateString;
  readonly changedBy: EntityId;
  readonly reason: string;
  readonly name: string;
  readonly description: string;
  readonly confidence: KnowledgeConfidence;
  readonly status: KnowledgeStatus;
  readonly sourceIds: readonly EntityId[];
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly schoolData?: Readonly<SchoolKnowledgeVersionData>;
}

interface KnowledgeNodeBase {
  id: EntityId;
  workspaceId: EntityId;
  type: KnowledgeNodeType;
  category: KnowledgeCategory;
  name: string;
  description: string;
  confidence: KnowledgeConfidence;
  /** Canonical persisted provenance. */
  sourceIds: EntityId[];
  /** Runtime-only display references, derived from canonical sources and never persisted. */
  sources: KnowledgeSourceReference[];
  aliases: string[];
  tags: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: EntityId;
  updatedBy: EntityId;
  status: KnowledgeStatus;
  version: number;
  versionHistory: readonly KnowledgeNodeVersion[];
  confidenceHistory: readonly KnowledgeConfidenceChange[];
  statusHistory: readonly KnowledgeStatusChange[];
  canonicalNameKeys: string[];
  lastAuditEventId: EntityId;
}

export interface SchoolKnowledgeNode extends KnowledgeNodeBase, SchoolKnowledgeVersionData {
  type: KnowledgeNodeType.School;
  category: KnowledgeCategory.Institution;
}
export interface ProjectKnowledgeNode extends KnowledgeNodeBase {
  type: KnowledgeNodeType.Project; category: KnowledgeCategory.Work; projectId: EntityId;
}
export interface ContentKnowledgeNode extends KnowledgeNodeBase {
  type: KnowledgeNodeType.Content; category: KnowledgeCategory.Content; contentId: EntityId; contentUrl?: string;
}
type GeneralKnowledgeNodeType = Exclude<KnowledgeNodeType, KnowledgeNodeType.School | KnowledgeNodeType.Project | KnowledgeNodeType.Content>;
export interface GeneralKnowledgeNode extends KnowledgeNodeBase { type: GeneralKnowledgeNodeType; }
export type KnowledgeNode = SchoolKnowledgeNode | ProjectKnowledgeNode | ContentKnowledgeNode | GeneralKnowledgeNode;

export enum KnowledgeRelationshipType {
  SchoolBelongsToConference = "SCHOOL_BELONGS_TO_CONFERENCE",
  SchoolLocatedInState = "SCHOOL_LOCATED_IN_STATE",
  SchoolLocatedInRegion = "SCHOOL_LOCATED_IN_REGION",
  SchoolHasCoach = "SCHOOL_HAS_COACH",
  SchoolHasFacility = "SCHOOL_HAS_FACILITY",
  ProjectAboutSchool = "PROJECT_ABOUT_SCHOOL",
  ContentAboutSchool = "CONTENT_ABOUT_SCHOOL",
  CoachWorksAtSchool = "COACH_WORKS_AT_SCHOOL",
  ConferenceGovernsSchool = "CONFERENCE_GOVERNS_SCHOOL",
  PlayerConnectedToSchool = "PLAYER_CONNECTED_TO_SCHOOL",
  FacilityBelongsToSchool = "FACILITY_BELONGS_TO_SCHOOL",
}

export interface KnowledgeRelationship {
  id: EntityId;
  workspaceId: EntityId;
  fromNodeId: EntityId;
  toNodeId: EntityId;
  relationshipType: KnowledgeRelationshipType;
  description?: string;
  confidence: KnowledgeConfidence;
  confidenceHistory: readonly KnowledgeConfidenceChange[];
  versionHistory: readonly KnowledgeRelationshipVersion[];
  statusHistory: readonly KnowledgeStatusChange[];
  sourceIds: EntityId[];
  /** Runtime-only display references, derived from canonical sources and never persisted. */
  sources: KnowledgeSourceReference[];
  projectIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: EntityId;
  updatedBy: EntityId;
  status: KnowledgeStatus;
  version: number;
  identityKey: string;
  exclusiveClaimKey?: string;
  lastAuditEventId: EntityId;
}

export interface KnowledgeRelationshipVersion {
  readonly version: number;
  readonly changedAt: ISODateString;
  readonly changedBy: EntityId;
  readonly reason: string;
  readonly description?: string;
  readonly confidence: KnowledgeConfidence;
  readonly status: KnowledgeStatus;
  readonly sourceIds: readonly EntityId[];
  readonly projectIds: readonly EntityId[];
}

export enum KnowledgeAuditEventType {
  Created = "created", Updated = "updated", Archived = "archived",
  ConfidenceChanged = "confidence-changed", ConflictDetected = "conflict-detected",
}
export interface KnowledgeAuditEvent {
  id: EntityId;
  workspaceId: EntityId;
  subjectType: "node" | "relationship" | "source";
  subjectId: EntityId;
  eventType: KnowledgeAuditEventType;
  actorId: EntityId;
  occurredAt: ISODateString;
  summary: string;
  version: number;
  metadata: Record<string, string | number | boolean | null>;
}

export type KnowledgeIntegrityWarningType =
  | "duplicate-node" | "duplicate-relationship" | "orphaned-relationship" | "invalid-relationship-semantics"
  | "archived-endpoint" | "missing-source" | "archived-source" | "provenance-mismatch"
  | "conflicting-relationship" | "school-relationship-missing" | "missing-audit" | "audit-mismatch";
export interface KnowledgeIntegrityWarning {
  id: string; type: KnowledgeIntegrityWarningType; nodeId?: EntityId;
  relationshipId?: EntityId; sourceId?: EntityId; message: string;
}
export interface KnowledgeGraph {
  nodes: KnowledgeNode[]; relationships: KnowledgeRelationship[];
  sources: KnowledgeSource[]; auditEvents: KnowledgeAuditEvent[];
}

export const knowledgeRelationshipTypeAliases: Record<string, KnowledgeRelationshipType> = {
  "member-of-conference": KnowledgeRelationshipType.SchoolBelongsToConference,
  "located-in": KnowledgeRelationshipType.SchoolLocatedInState,
  "located-in-region": KnowledgeRelationshipType.SchoolLocatedInRegion,
  "coached-by": KnowledgeRelationshipType.SchoolHasCoach,
  "has-facility": KnowledgeRelationshipType.SchoolHasFacility,
  "related-to-project": KnowledgeRelationshipType.ProjectAboutSchool,
  "referenced-by-content": KnowledgeRelationshipType.ContentAboutSchool,
};
export function normalizeKnowledgeRelationshipType(value: string): KnowledgeRelationshipType | null {
  return (Object.values(KnowledgeRelationshipType) as string[]).includes(value)
    ? value as KnowledgeRelationshipType : knowledgeRelationshipTypeAliases[value] || null;
}
export function isSchoolKnowledgeNode(node: KnowledgeNode): node is SchoolKnowledgeNode { return node.type === KnowledgeNodeType.School; }
export function isProjectKnowledgeNode(node: KnowledgeNode): node is ProjectKnowledgeNode { return node.type === KnowledgeNodeType.Project; }
export function isContentKnowledgeNode(node: KnowledgeNode): node is ContentKnowledgeNode { return node.type === KnowledgeNodeType.Content; }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, Extract<keyof T, K>> : never;
type NodeManaged = "sources" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "status" | "version"
  | "versionHistory" | "confidenceHistory" | "statusHistory" | "canonicalNameKeys" | "lastAuditEventId";
export type KnowledgeNodeCreateInput = DistributiveOmit<KnowledgeNode, NodeManaged>;
export type KnowledgeNodeUpdate = Partial<DistributiveOmit<KnowledgeNode, NodeManaged | "id" | "workspaceId" | "type" | "category">>;
type RelationshipManaged = "sources" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "status" | "version"
  | "confidenceHistory" | "statusHistory" | "versionHistory" | "identityKey" | "exclusiveClaimKey" | "lastAuditEventId";
export type KnowledgeRelationshipCreateInput = Omit<KnowledgeRelationship, RelationshipManaged>;
export type KnowledgeRelationshipUpdate = Partial<Omit<KnowledgeRelationship, RelationshipManaged | "id" | "workspaceId" | "fromNodeId" | "toNodeId" | "relationshipType">>;
type SourceManaged = "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "status" | "version" | "versionHistory"
  | "statusHistory" | "lastAuditEventId";
export type KnowledgeSourceCreateInput = Omit<KnowledgeSource, SourceManaged>;
export type KnowledgeSourceUpdate = Partial<Omit<KnowledgeSource, SourceManaged | "id" | "workspaceId">>;
