import {
  canonicalKnowledgeAuditEventId,
} from "./audit";
import {
  collection,
  doc,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { sanitizeFirestoreDocument } from "../shared/firestoreConverters";
import {
  exclusiveKnowledgeRelationshipClaimKey,
  relationshipIdentity,
  validateRelationshipEndpoints,
} from "./relationshipPolicy";
import type { KnowledgeGraphRepository, KnowledgeMutationContext } from "./repository";
import {
  serializeKnowledgeAuditEvent,
  serializeKnowledgeNode,
  serializeKnowledgeRelationship,
  serializeKnowledgeSource,
} from "./firestoreConverters";
import {
  deriveCanonicalSourceReferences,
  migrateLegacyKnowledgeAuditEventRead,
  migrateLegacyKnowledgeNodeRead,
  migrateLegacyKnowledgeRelationshipRead,
  migrateLegacyKnowledgeSourceRead,
  nodeCanonicalClaimKeys,
  normalizeCanonicalKnowledgeName,
  parseKnowledgeAuditEvent,
  parseKnowledgeNode,
  parseKnowledgeRelationship,
  parseKnowledgeSource,
  validateKnowledgeRelationship,
  validateSchoolRegionalReferences,
  KnowledgeValidationError,
} from "./validation";
import {
  type KnowledgeAuditEvent,
  KnowledgeAuditEventType,
  KnowledgeConfidence,
  type KnowledgeConfidenceChange,
  type KnowledgeNode,
  type KnowledgeNodeCreateInput,
  type KnowledgeNodeReference,
  type KnowledgeNodeUpdate,
  type KnowledgeNodeVersion,
  KnowledgeNodeType,
  type KnowledgeRelationship,
  type KnowledgeRelationshipCreateInput,
  type KnowledgeRelationshipUpdate,
  type KnowledgeRelationshipVersion,
  KnowledgeRelationshipType,
  type KnowledgeSource,
  type KnowledgeSourceCreateInput,
  type KnowledgeSourceUpdate,
  type KnowledgeSourceVersion,
  type KnowledgeStatusChange,
  isContentKnowledgeNode,
  isProjectKnowledgeNode,
  isSchoolKnowledgeNode,
  KnowledgeStatus,
  type SchoolKnowledgeVersionData,
} from "./types";

export const knowledgeGraphCollections = {
  nodes: "internalKnowledgeNodes",
  relationships: "internalKnowledgeRelationships",
  sources: "internalKnowledgeSources",
  auditEvents: "internalKnowledgeAuditEvents",
  uniqueness: "internalKnowledgeUniqueness",
} as const;

export interface FirestoreKnowledgeGraphRepositoryOptions {
  /** Test-only coordination hook used to prove transactions retry after a shared claim read. */
  afterClaimRead?: (kind: "node" | "relationship") => Promise<void>;
  /** Test-only fault hook used to prove a mutation and its audit fail atomically. */
  beforeAuditWrite?: (event: KnowledgeAuditEvent) => Promise<void>;
}

type RawSnapshot = DocumentSnapshot<DocumentData>;

interface NodeRegistry {
  id: string;
  kind: "node-registry";
  workspaceId: string;
  nodeType: string;
  owners: Record<string, string>;
  claimedKeysByNode: Record<string, string[]>;
  legacyBootstrapComplete: boolean;
}

interface RelationshipRegistry {
  id: string;
  kind: "relationship-registry";
  workspaceId: string;
  exactOwners: Record<string, string>;
  activeRelationshipIds: string[];
  exclusiveActive: Record<string, string[]>;
  endpointActive: Record<string, string[]>;
  legacyBootstrapComplete: boolean;
}

interface SourceRegistry {
  id: string;
  kind: "source-registry";
  workspaceId: string;
  activeSourceIds: string[];
  subjectKeysBySource: Record<string, string[]>;
}

function rawDocument(db: Firestore, collectionName: string, id: string) {
  return doc(db, collectionName, id);
}

function nodeDocument(db: Firestore, id: string) {
  return rawDocument(db, knowledgeGraphCollections.nodes, id);
}

function relationshipDocument(db: Firestore, id: string) {
  return rawDocument(db, knowledgeGraphCollections.relationships, id);
}

function sourceDocument(db: Firestore, id: string) {
  return rawDocument(db, knowledgeGraphCollections.sources, id);
}

function auditDocument(db: Firestore, id: string) {
  return rawDocument(db, knowledgeGraphCollections.auditEvents, id);
}

function claimDocument(db: Firestore, id: string) {
  return rawDocument(db, knowledgeGraphCollections.uniqueness, id);
}

function nodeRegistryId(workspaceId: string, nodeType: string) {
  return `node-registry:${workspaceId}:${nodeType}`;
}

function relationshipRegistryId(workspaceId: string) {
  return `relationship-registry:${workspaceId}`;
}

function sourceRegistryId(workspaceId: string) {
  return `source-registry:${workspaceId}`;
}

function sortedUnique(values: readonly string[]) {
  return [...new Set(values)].sort();
}

function requireMutationContext(context: KnowledgeMutationContext) {
  const actorId = context?.actorId?.trim();
  if (!actorId) throw new KnowledgeValidationError("An authenticated Headquarters editor is required.");
  return { actorId, reason: context.reason?.trim() || undefined };
}

function isRetryableClaimRace(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String((error as { code?: unknown }).code || "");
  return code === "permission-denied" || code === "aborted" || code === "failed-precondition";
}

function placeholderTime() {
  return new Date().toISOString();
}

function historyArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    .sort((first, second) => Number(first.version || 0) - Number(second.version || 0));
}

function decodedPersistenceData(data: DocumentData) {
  const {
    latestVersionKey: _latestVersionKey,
    latestConfidenceKey: _latestConfidenceKey,
    latestStatusKey: _latestStatusKey,
    legacyHistorySnapshot: _legacyHistorySnapshot,
    ...canonical
  } = data;
  void _latestVersionKey;
  void _latestConfidenceKey;
  void _latestStatusKey;
  void _legacyHistorySnapshot;
  return {
    ...canonical,
    ...(data.versionHistory === undefined ? {} : { versionHistory: historyArray(data.versionHistory) }),
    ...(data.confidenceHistory === undefined ? {} : { confidenceHistory: historyArray(data.confidenceHistory) }),
    ...(data.statusHistory === undefined ? {} : { statusHistory: historyArray(data.statusHistory) }),
  };
}

function preservedLegacyHistorySnapshots(existing: DocumentData | undefined) {
  if (!existing) return {};
  if (existing.legacyHistorySnapshot && typeof existing.legacyHistorySnapshot === "object") {
    return { legacyHistorySnapshot: existing.legacyHistorySnapshot };
  }
  const snapshot = {
    ...(Array.isArray(existing.versionHistory) ? { versionHistory: existing.versionHistory } : {}),
    ...(Array.isArray(existing.confidenceHistory) ? { confidenceHistory: existing.confidenceHistory } : {}),
    ...(Array.isArray(existing.statusHistory) ? { statusHistory: existing.statusHistory } : {}),
  };
  return Object.keys(snapshot).length > 0 ? { legacyHistorySnapshot: snapshot } : {};
}

function decodeNode(snapshot: RawSnapshot) {
  return migrateLegacyKnowledgeNodeRead(decodedPersistenceData(snapshot.data() || {}));
}

function decodeRelationship(snapshot: RawSnapshot) {
  return migrateLegacyKnowledgeRelationshipRead(decodedPersistenceData(snapshot.data() || {}));
}

function decodeSource(snapshot: RawSnapshot) {
  return migrateLegacyKnowledgeSourceRead(decodedPersistenceData(snapshot.data() || {}));
}

function decodeAudit(snapshot: RawSnapshot) {
  return migrateLegacyKnowledgeAuditEventRead(snapshot.data() || {});
}

function historyMap(
  existingValue: unknown,
  entries: readonly { version: number; changedAt: string }[],
) {
  const persisted: Record<string, unknown> = {};
  if (Array.isArray(existingValue)) {
    for (const entry of existingValue) {
      if (entry && typeof entry === "object" && Number.isInteger((entry as { version?: unknown }).version)) {
        persisted[`v${String((entry as { version: number }).version)}`] = entry;
      }
    }
  } else if (existingValue && typeof existingValue === "object") {
    Object.assign(persisted, existingValue);
  }
  for (const entry of entries) {
    const key = `v${entry.version}`;
    if (!(key in persisted)) {
      persisted[key] = {
        ...sanitizeFirestoreDocument(entry),
        changedAt: serverTimestamp(),
      };
    }
  }
  return persisted;
}

function persistedHistories(
  data: DocumentData,
  existing: DocumentData | undefined,
  versionHistory: readonly { version: number; changedAt: string }[],
  confidenceHistory: readonly { version: number; changedAt: string }[] | undefined,
  statusHistory: readonly { version: number; changedAt: string }[],
) {
  const versionMap = historyMap(existing?.versionHistory, versionHistory);
  const confidenceMap = confidenceHistory ? historyMap(existing?.confidenceHistory, confidenceHistory) : undefined;
  const statusMap = historyMap(existing?.statusHistory, statusHistory);
  return {
    ...data,
    versionHistory: versionMap,
    ...(confidenceMap ? { confidenceHistory: confidenceMap } : {}),
    statusHistory: statusMap,
    latestVersionKey: `v${versionHistory.at(-1)?.version || 1}`,
    ...(confidenceHistory ? { latestConfidenceKey: `v${confidenceHistory.at(-1)?.version || 1}` } : {}),
    latestStatusKey: `v${statusHistory.at(-1)?.version || 1}`,
  };
}

function nodeWriteData(node: KnowledgeNode, existing?: DocumentData) {
  const serialized = serializeKnowledgeNode(node);
  const withHistories = persistedHistories(
    serialized,
    existing,
    node.versionHistory,
    node.confidenceHistory,
    node.statusHistory,
  );
  return {
    ...withHistories,
    ...preservedLegacyHistorySnapshots(existing),
    sources: [],
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function relationshipWriteData(relationship: KnowledgeRelationship, existing?: DocumentData) {
  const serialized = serializeKnowledgeRelationship(relationship);
  const withHistories = persistedHistories(
    serialized,
    existing,
    relationship.versionHistory,
    relationship.confidenceHistory,
    relationship.statusHistory,
  );
  return {
    ...withHistories,
    ...preservedLegacyHistorySnapshots(existing),
    sources: [],
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function sourceWriteData(source: KnowledgeSource, existing?: DocumentData) {
  const serialized = serializeKnowledgeSource(source);
  const withHistories = persistedHistories(serialized, existing, source.versionHistory, undefined, source.statusHistory);
  return {
    ...withHistories,
    ...preservedLegacyHistorySnapshots(existing),
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function auditWriteData(event: KnowledgeAuditEvent) {
  return { ...serializeKnowledgeAuditEvent(event), occurredAt: serverTimestamp() };
}

function claimWriteData<T extends { id: string; kind: string; workspaceId: string }>(
  claim: T,
  existing: DocumentData | undefined,
  actorId: string,
) {
  return sanitizeFirestoreDocument({
    ...claim,
    createdAt: existing?.createdAt || serverTimestamp(),
    createdBy: existing?.createdBy || actorId,
    updatedAt: serverTimestamp(),
    updatedBy: actorId,
  });
}

function neutralizeSchoolDerivedReferences<T extends KnowledgeNode | KnowledgeNodeCreateInput>(node: T): T {
  if (node.type !== KnowledgeNodeType.School) return node;
  return {
    ...node,
    conference: null,
    facilities: [],
    coaches: [],
    connectedProjectIds: [],
    connectedContentIds: [],
  } as T;
}

function schoolVersionData(node: KnowledgeNode): SchoolKnowledgeVersionData | undefined {
  if (!isSchoolKnowledgeNode(node)) return undefined;
  return {
    officialName: node.officialName,
    ...(node.nickname ? { nickname: node.nickname } : {}),
    city: node.city,
    state: node.state,
    stateNodeId: node.stateNodeId,
    region: node.region,
    regionNodeId: node.regionNodeId,
    conference: node.conference,
    division: node.division,
    governingBody: node.governingBody,
    schoolWebsite: node.schoolWebsite,
    athleticsWebsite: node.athleticsWebsite,
    ...(node.enrollment === undefined ? {} : { enrollment: node.enrollment }),
    ...(node.tuition ? { tuition: node.tuition } : {}),
    ...(node.publicOrPrivate ? { publicOrPrivate: node.publicOrPrivate } : {}),
    facilities: node.facilities,
    coaches: node.coaches,
    recruitingNotes: node.recruitingNotes,
    connectedProjectIds: node.connectedProjectIds,
    connectedContentIds: node.connectedContentIds,
    ...(node.lastVerifiedAt ? { lastVerifiedAt: node.lastVerifiedAt } : {}),
  };
}

function nodeVersion(node: KnowledgeNode, changedAt: string, changedBy: string, reason: string): KnowledgeNodeVersion {
  const schoolData = schoolVersionData(node);
  return {
    version: node.version,
    changedAt,
    changedBy,
    reason,
    name: node.name,
    description: node.description,
    confidence: node.confidence,
    status: node.status,
    sourceIds: [...node.sourceIds],
    aliases: [...node.aliases],
    tags: [...node.tags],
    ...(schoolData ? { schoolData } : {}),
  };
}

function relationshipVersion(
  relationship: KnowledgeRelationship,
  changedAt: string,
  changedBy: string,
  reason: string,
): KnowledgeRelationshipVersion {
  return {
    version: relationship.version,
    changedAt,
    changedBy,
    reason,
    ...(relationship.description === undefined ? {} : { description: relationship.description }),
    confidence: relationship.confidence,
    status: relationship.status,
    sourceIds: [...relationship.sourceIds],
    projectIds: [...relationship.projectIds],
  };
}

function sourceVersion(source: KnowledgeSource, changedAt: string, changedBy: string, reason: string): KnowledgeSourceVersion {
  return {
    version: source.version,
    changedAt,
    changedBy,
    reason,
    title: source.title,
    ...(source.url === undefined ? {} : { url: source.url }),
    ...(source.publisher === undefined ? {} : { publisher: source.publisher }),
    sourceType: source.sourceType,
    accessedAt: source.accessedAt,
    ...(source.publishedAt === undefined ? {} : { publishedAt: source.publishedAt }),
    reliability: source.reliability,
    ...(source.notes === undefined ? {} : { notes: source.notes }),
    projectIds: [...source.projectIds],
    status: source.status,
  };
}

function initialConfidenceHistory(
  confidence: KnowledgeConfidence,
  changedAt: string,
  changedBy: string,
  sourceIds: readonly string[],
  reason: string,
): readonly KnowledgeConfidenceChange[] {
  return [{ from: confidence, to: confidence, changedAt, changedBy, reason, sourceIds: [...sourceIds], version: 1 }];
}

function initialStatusHistory(
  status: KnowledgeStatus,
  changedAt: string,
  changedBy: string,
  reason: string,
): readonly KnowledgeStatusChange[] {
  return [{ from: status, to: status, changedAt, changedBy, reason, version: 1 }];
}

function newAudit(
  db: Firestore,
  input: Omit<KnowledgeAuditEvent, "id" | "occurredAt">,
  changedAt: string,
) {
  if (!input.version) throw new KnowledgeValidationError("Knowledge audit events require a canonical version.");
  const auditId = canonicalKnowledgeAuditEventId(input.subjectType, input.subjectId, input.version);
  const reference = auditDocument(db, auditId);
  const event = parseKnowledgeAuditEvent({ ...input, id: reference.id, occurredAt: changedAt });
  return { reference, event };
}

function assertActiveSources(workspaceId: string, sourceIds: readonly string[], snapshots: readonly RawSnapshot[]) {
  snapshots.forEach((snapshot, index) => {
    const source = snapshot.exists() ? decodeSource(snapshot) : null;
    if (!source || source.workspaceId !== workspaceId || source.status !== KnowledgeStatus.Active) {
      throw new KnowledgeValidationError(`Knowledge source is unavailable: ${sourceIds[index]}`);
    }
  });
}

function sourceUsage(
  existing: SourceRegistry,
  sourceIds: readonly string[],
  subjectKey: string,
  active: boolean,
) {
  const subjectKeysBySource = { ...existing.subjectKeysBySource };
  for (const sourceId of sourceIds) {
    const current = subjectKeysBySource[sourceId] || [];
    subjectKeysBySource[sourceId] = active
      ? sortedUnique([...current, subjectKey])
      : current.filter((item) => item !== subjectKey);
  }
  return { ...existing, subjectKeysBySource };
}

function replaceSourceUsage(
  existing: SourceRegistry,
  priorSourceIds: readonly string[],
  nextSourceIds: readonly string[],
  subjectKey: string,
  active: boolean,
) {
  return sourceUsage(sourceUsage(existing, priorSourceIds, subjectKey, false), nextSourceIds, subjectKey, active);
}

function nodeReference(node: KnowledgeNode): KnowledgeNodeReference {
  return { nodeId: node.id, name: node.name, type: node.type };
}

export function createFirestoreKnowledgeGraphRepository(
  db: Firestore,
  options: FirestoreKnowledgeGraphRepositoryOptions = {},
): KnowledgeGraphRepository {
  async function rawNodes(workspaceId?: string) {
    const snapshot = await getDocs(workspaceId
      ? query(collection(db, knowledgeGraphCollections.nodes), where("workspaceId", "==", workspaceId))
      : collection(db, knowledgeGraphCollections.nodes));
    return snapshot.docs.map((item) => decodeNode(item));
  }

  async function rawRelationships(workspaceId?: string) {
    const snapshot = await getDocs(workspaceId
      ? query(collection(db, knowledgeGraphCollections.relationships), where("workspaceId", "==", workspaceId))
      : collection(db, knowledgeGraphCollections.relationships));
    return snapshot.docs.map((item) => decodeRelationship(item));
  }

  async function rawSources(workspaceId?: string) {
    const snapshot = await getDocs(workspaceId
      ? query(collection(db, knowledgeGraphCollections.sources), where("workspaceId", "==", workspaceId))
      : collection(db, knowledgeGraphCollections.sources));
    return snapshot.docs.map((item) => decodeSource(item));
  }

  async function hydrateRelationship(relationship: KnowledgeRelationship) {
    const sources = await Promise.all(relationship.sourceIds.map(async (sourceId) => {
      const snapshot = await getDoc(sourceDocument(db, sourceId));
      return snapshot.exists() ? decodeSource(snapshot) : null;
    }));
    return parseKnowledgeRelationship({
      ...relationship,
      sources: deriveCanonicalSourceReferences(relationship.sourceIds, sources.filter((item): item is KnowledgeSource => Boolean(item))),
    });
  }

  function hydrateSchoolReferences(
    node: KnowledgeNode,
    nodes: readonly KnowledgeNode[],
    relationships: readonly KnowledgeRelationship[],
  ): KnowledgeNode {
    if (!isSchoolKnowledgeNode(node)) return node;
    const nodeById = new Map(nodes.map((candidate) => [candidate.id, candidate]));
    const active = relationships.filter((relationship) => relationship.status === KnowledgeStatus.Active
      && relationship.workspaceId === node.workspaceId
      && (relationship.fromNodeId === node.id || relationship.toNodeId === node.id));
    const conferences = new Map<string, KnowledgeNodeReference>();
    const coaches = new Map<string, KnowledgeNodeReference>();
    const facilities = new Map<string, KnowledgeNodeReference>();
    const projectIds = new Set<string>();
    const contentIds = new Set<string>();
    for (const relationship of active) {
      const from = nodeById.get(relationship.fromNodeId);
      const to = nodeById.get(relationship.toNodeId);
      if (!from || !to) continue;
      try {
        validateRelationshipEndpoints(from, to, relationship.relationshipType, relationship.workspaceId);
      } catch {
        continue;
      }
      const connected = from.id === node.id ? to : from;
      if ([KnowledgeRelationshipType.SchoolBelongsToConference, KnowledgeRelationshipType.ConferenceGovernsSchool].includes(relationship.relationshipType)) conferences.set(connected.id, nodeReference(connected));
      if ([KnowledgeRelationshipType.SchoolHasCoach, KnowledgeRelationshipType.CoachWorksAtSchool].includes(relationship.relationshipType)) coaches.set(connected.id, nodeReference(connected));
      if ([KnowledgeRelationshipType.SchoolHasFacility, KnowledgeRelationshipType.FacilityBelongsToSchool].includes(relationship.relationshipType)) facilities.set(connected.id, nodeReference(connected));
      if (relationship.relationshipType === KnowledgeRelationshipType.ProjectAboutSchool && isProjectKnowledgeNode(connected)) projectIds.add(connected.projectId);
      if (relationship.relationshipType === KnowledgeRelationshipType.ContentAboutSchool && isContentKnowledgeNode(connected)) contentIds.add(connected.contentId);
    }
    return {
      ...node,
      conference: [...conferences.values()].sort((a, b) => a.name.localeCompare(b.name))[0] || null,
      coaches: [...coaches.values()].sort((a, b) => a.name.localeCompare(b.name)),
      facilities: [...facilities.values()].sort((a, b) => a.name.localeCompare(b.name)),
      connectedProjectIds: [...projectIds].sort(),
      connectedContentIds: [...contentIds].sort(),
    };
  }

  async function hydratedNodes(workspaceId: string) {
    const [nodes, relationships, sources] = await Promise.all([
      rawNodes(workspaceId),
      rawRelationships(workspaceId),
      rawSources(workspaceId),
    ]);
    return nodes.map((node) => parseKnowledgeNode({
      ...hydrateSchoolReferences(node, nodes, relationships),
      sources: deriveCanonicalSourceReferences(node.sourceIds, sources),
    }));
  }

  function baseNodeRegistry(snapshot: RawSnapshot, workspaceId: string, nodeType: string): NodeRegistry {
    const existing = snapshot.exists() ? snapshot.data() as Partial<NodeRegistry> : {};
    return {
      id: nodeRegistryId(workspaceId, nodeType), kind: "node-registry", workspaceId, nodeType,
      owners: existing.owners || {},
      claimedKeysByNode: existing.claimedKeysByNode || {},
      legacyBootstrapComplete: existing.legacyBootstrapComplete === true,
    };
  }

  function baseRelationshipRegistry(snapshot: RawSnapshot, workspaceId: string): RelationshipRegistry {
    const existing = snapshot.exists() ? snapshot.data() as Partial<RelationshipRegistry> : {};
    return {
      id: relationshipRegistryId(workspaceId), kind: "relationship-registry", workspaceId,
      exactOwners: existing.exactOwners || {},
      activeRelationshipIds: existing.activeRelationshipIds || [],
      exclusiveActive: existing.exclusiveActive || {},
      endpointActive: existing.endpointActive || {},
      legacyBootstrapComplete: existing.legacyBootstrapComplete === true,
    };
  }

  function baseSourceRegistry(snapshot: RawSnapshot, workspaceId: string): SourceRegistry {
    const existing = snapshot.exists() ? snapshot.data() as Partial<SourceRegistry> : {};
    return {
      id: sourceRegistryId(workspaceId), kind: "source-registry", workspaceId,
      activeSourceIds: existing.activeSourceIds || [],
      subjectKeysBySource: existing.subjectKeysBySource || {},
    };
  }

  function historicalNodeClaimKeys(node: KnowledgeNode) {
    const keys = new Set(node.canonicalNameKeys);
    for (const version of node.versionHistory) {
      nodeCanonicalClaimKeys({
        workspaceId: node.workspaceId,
        type: node.type,
        name: version.name,
        aliases: [...version.aliases],
      }).forEach((key) => keys.add(key));
    }
    return [...keys].sort();
  }

  function enrollExistingNodeClaims(registry: NodeRegistry, snapshots: readonly RawSnapshot[]) {
    const enrolled: NodeRegistry = {
      ...registry,
      owners: { ...registry.owners },
      claimedKeysByNode: { ...registry.claimedKeysByNode },
      legacyBootstrapComplete: true,
    };
    for (const snapshot of snapshots) {
      if (!snapshot.exists()) continue;
      const node = decodeNode(snapshot);
      const claimKeys = sortedUnique([
        ...(enrolled.claimedKeysByNode[node.id] || []),
        ...historicalNodeClaimKeys(node),
      ]);
      for (const key of claimKeys) {
        const ownerId = enrolled.owners[key];
        if (ownerId && ownerId !== node.id) {
          throw new KnowledgeValidationError(
            `Existing knowledge records ${ownerId} and ${node.id} conflict for one canonical identity. Resolve the legacy collision before creating another record.`,
          );
        }
        enrolled.owners[key] = node.id;
      }
      enrolled.claimedKeysByNode[node.id] = claimKeys;
    }
    return enrolled;
  }

  function enrollExistingRelationshipClaims(
    registry: RelationshipRegistry,
    snapshots: readonly RawSnapshot[],
  ) {
    const enrolled: RelationshipRegistry = {
      ...registry,
      exactOwners: { ...registry.exactOwners },
      activeRelationshipIds: [...registry.activeRelationshipIds],
      exclusiveActive: { ...registry.exclusiveActive },
      endpointActive: { ...registry.endpointActive },
      legacyBootstrapComplete: true,
    };
    for (const snapshot of snapshots) {
      if (!snapshot.exists()) continue;
      const relationship = decodeRelationship(snapshot);
      const ownerId = enrolled.exactOwners[relationship.identityKey];
      if (ownerId && ownerId !== relationship.id) {
        throw new KnowledgeValidationError(
          `Existing relationships ${ownerId} and ${relationship.id} represent the same canonical fact. Resolve the legacy collision before creating another relationship.`,
        );
      }
      enrolled.exactOwners[relationship.identityKey] = relationship.id;
      if (relationship.status !== KnowledgeStatus.Active) continue;
      enrolled.activeRelationshipIds = sortedUnique([...enrolled.activeRelationshipIds, relationship.id]);
      if (relationship.exclusiveClaimKey) {
        enrolled.exclusiveActive = {
          ...enrolled.exclusiveActive,
          [relationship.exclusiveClaimKey]: sortedUnique([
            ...(enrolled.exclusiveActive[relationship.exclusiveClaimKey] || []),
            relationship.id,
          ]),
        };
      }
      enrolled.endpointActive = {
        ...enrolled.endpointActive,
        [relationship.fromNodeId]: sortedUnique([
          ...(enrolled.endpointActive[relationship.fromNodeId] || []),
          relationship.id,
        ]),
        [relationship.toNodeId]: sortedUnique([
          ...(enrolled.endpointActive[relationship.toNodeId] || []),
          relationship.id,
        ]),
      };
    }
    return enrolled;
  }

  async function ensureNodeRegistryBootstrapped(
    workspaceId: string,
    nodeType: KnowledgeNodeType,
    actorId: string,
  ) {
    const registryRef = claimDocument(db, nodeRegistryId(workspaceId, nodeType));
    const registrySnapshot = await getDoc(registryRef);
    if (registrySnapshot.data()?.legacyBootstrapComplete === true) return;
    const workspaceNodes = await getDocs(query(
      collection(db, knowledgeGraphCollections.nodes),
      where("workspaceId", "==", workspaceId),
    ));
    const nodeRefs = workspaceNodes.docs
      .filter((snapshot) => snapshot.data().type === nodeType)
      .map((snapshot) => snapshot.ref);
    await runTransaction(db, async (transaction) => {
      const [currentRegistrySnapshot, nodeSnapshots] = await Promise.all([
        transaction.get(registryRef),
        Promise.all(nodeRefs.map((reference) => transaction.get(reference))),
      ]);
      if (currentRegistrySnapshot.data()?.legacyBootstrapComplete === true) return;
      const registry = enrollExistingNodeClaims(
        baseNodeRegistry(currentRegistrySnapshot, workspaceId, nodeType),
        nodeSnapshots,
      );
      transaction.set(
        registryRef,
        claimWriteData(registry, currentRegistrySnapshot.data(), actorId),
      );
    });
  }

  async function ensureRelationshipRegistryBootstrapped(
    workspaceId: string,
    actorId: string,
  ) {
    const registryRef = claimDocument(db, relationshipRegistryId(workspaceId));
    const registrySnapshot = await getDoc(registryRef);
    if (registrySnapshot.data()?.legacyBootstrapComplete === true) return;
    const workspaceRelationships = await getDocs(query(
      collection(db, knowledgeGraphCollections.relationships),
      where("workspaceId", "==", workspaceId),
    ));
    const relationshipRefs = workspaceRelationships.docs.map((snapshot) => snapshot.ref);
    await runTransaction(db, async (transaction) => {
      const [currentRegistrySnapshot, relationshipSnapshots] = await Promise.all([
        transaction.get(registryRef),
        Promise.all(relationshipRefs.map((reference) => transaction.get(reference))),
      ]);
      if (currentRegistrySnapshot.data()?.legacyBootstrapComplete === true) return;
      const registry = enrollExistingRelationshipClaims(
        baseRelationshipRegistry(currentRegistrySnapshot, workspaceId),
        relationshipSnapshots,
      );
      transaction.set(
        registryRef,
        claimWriteData(registry, currentRegistrySnapshot.data(), actorId),
      );
    });
  }

  async function ensureSourceUsageIndexed(
    workspaceId: string,
    sourceIds: readonly string[],
    subjectKey: string,
    actorId: string,
  ) {
    const registryRef = claimDocument(db, sourceRegistryId(workspaceId));
    const snapshot = await getDoc(registryRef);
    const current = baseSourceRegistry(snapshot, workspaceId);
    const indexed = sourceIds.every((sourceId) => (
      current.subjectKeysBySource[sourceId] || []
    ).includes(subjectKey));
    if (indexed) return;
    await runTransaction(db, async (transaction) => {
      const [currentSnapshot, sourceSnapshots] = await Promise.all([
        transaction.get(registryRef),
        Promise.all(sourceIds.map((sourceId) => transaction.get(sourceDocument(db, sourceId)))),
      ]);
      assertActiveSources(workspaceId, sourceIds, sourceSnapshots);
      const registry = baseSourceRegistry(currentSnapshot, workspaceId);
      const nextRegistry = {
        ...sourceUsage(registry, sourceIds, subjectKey, true),
        activeSourceIds: sortedUnique([...registry.activeSourceIds, ...sourceIds]),
      };
      transaction.set(
        registryRef,
        claimWriteData(nextRegistry, currentSnapshot.data(), actorId),
      );
    });
  }

  async function ensureExclusiveRelationshipSourceUsageIndexed(
    workspaceId: string,
    exclusiveClaimKey: string,
    actorId: string,
  ) {
    const registrySnapshot = await getDoc(claimDocument(db, relationshipRegistryId(workspaceId)));
    const registry = baseRelationshipRegistry(registrySnapshot, workspaceId);
    const relationshipSnapshots = await Promise.all(
      (registry.exclusiveActive[exclusiveClaimKey] || [])
        .map((relationshipId) => getDoc(relationshipDocument(db, relationshipId))),
    );
    for (const snapshot of relationshipSnapshots) {
      if (!snapshot.exists()) continue;
      const relationship = decodeRelationship(snapshot);
      if (relationship.status !== KnowledgeStatus.Active
        || relationship.workspaceId !== workspaceId
        || relationship.exclusiveClaimKey !== exclusiveClaimKey) continue;
      await ensureSourceUsageIndexed(
        workspaceId,
        relationship.sourceIds,
        `relationship:${relationship.id}`,
        actorId,
      );
    }
  }

  async function legacyRelationshipBlockerIds(workspaceId: string, nodeId: string) {
    const relationships = collection(db, knowledgeGraphCollections.relationships);
    const [fromSnapshot, toSnapshot] = await Promise.all([
      getDocs(query(relationships, where("fromNodeId", "==", nodeId))),
      getDocs(query(relationships, where("toNodeId", "==", nodeId))),
    ]);
    return sortedUnique([...fromSnapshot.docs, ...toSnapshot.docs]
      .filter((snapshot) => {
        const data = snapshot.data();
        return data.workspaceId === workspaceId && data.status === KnowledgeStatus.Active;
      })
      .map((snapshot) => snapshot.id));
  }

  async function legacySourceBlockerKeys(workspaceId: string, sourceId: string) {
    const [nodeSnapshot, relationshipSnapshot] = await Promise.all([
      getDocs(query(collection(db, knowledgeGraphCollections.nodes), where("sourceIds", "array-contains", sourceId))),
      getDocs(query(collection(db, knowledgeGraphCollections.relationships), where("sourceIds", "array-contains", sourceId))),
    ]);
    return sortedUnique([
      ...nodeSnapshot.docs
        .filter((snapshot) => snapshot.data().workspaceId === workspaceId && snapshot.data().status === KnowledgeStatus.Active)
        .map((snapshot) => `node:${snapshot.id}`),
      ...relationshipSnapshot.docs
        .filter((snapshot) => snapshot.data().workspaceId === workspaceId && snapshot.data().status === KnowledgeStatus.Active)
        .map((snapshot) => `relationship:${snapshot.id}`),
    ]);
  }

  async function readAfterNode(id: string) {
    const snapshot = await getDoc(nodeDocument(db, id));
    if (!snapshot.exists()) throw new KnowledgeValidationError(`Knowledge node not found: ${id}`);
    const node = decodeNode(snapshot);
    return (await hydratedNodes(node.workspaceId)).find((item) => item.id === id) || node;
  }

  async function readAfterRelationship(id: string) {
    const snapshot = await getDoc(relationshipDocument(db, id));
    if (!snapshot.exists()) throw new KnowledgeValidationError(`Knowledge relationship not found: ${id}`);
    return hydrateRelationship(decodeRelationship(snapshot));
  }

  async function readAfterSource(id: string) {
    const snapshot = await getDoc(sourceDocument(db, id));
    if (!snapshot.exists()) throw new KnowledgeValidationError(`Knowledge source not found: ${id}`);
    return decodeSource(snapshot);
  }

  return {
    async listNodes(workspaceId) {
      return (await hydratedNodes(workspaceId))
        .sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
    },

    async getNodeById(nodeId) {
      const snapshot = await getDoc(nodeDocument(db, nodeId));
      if (!snapshot.exists()) return null;
      const node = decodeNode(snapshot);
      return (await hydratedNodes(node.workspaceId)).find((item) => item.id === nodeId) || node;
    },

    async createNode(input: KnowledgeNodeCreateInput, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = placeholderTime();
      const reason = mutation.reason || `Created knowledge node ${input.name}.`;
      const audit = newAudit(db, {
        workspaceId: input.workspaceId, subjectType: "node", subjectId: input.id,
        eventType: KnowledgeAuditEventType.Created, actorId: mutation.actorId,
        summary: reason, version: 1, metadata: {},
      }, changedAt);
      let candidate = neutralizeSchoolDerivedReferences({
        ...input,
        sources: [], createdAt: changedAt, updatedAt: changedAt,
        createdBy: mutation.actorId, updatedBy: mutation.actorId,
        status: KnowledgeStatus.Active, version: 1, versionHistory: [],
        confidenceHistory: initialConfidenceHistory(input.confidence, changedAt, mutation.actorId, input.sourceIds, reason),
        statusHistory: initialStatusHistory(KnowledgeStatus.Active, changedAt, mutation.actorId, reason),
        canonicalNameKeys: nodeCanonicalClaimKeys(input as KnowledgeNode),
        lastAuditEventId: audit.reference.id,
      } as KnowledgeNode);
      candidate = { ...candidate, versionHistory: [nodeVersion(candidate, changedAt, mutation.actorId, reason)] } as KnowledgeNode;
      candidate = parseKnowledgeNode(candidate);

      const registryRef = claimDocument(db, nodeRegistryId(candidate.workspaceId, candidate.type));
      const sourceRegistryRef = claimDocument(db, sourceRegistryId(candidate.workspaceId));
      const registryBeforeCreate = await getDoc(registryRef);
      const existingTypeNodeRefs = registryBeforeCreate.data()?.legacyBootstrapComplete === true
        ? []
        : (await getDocs(query(
          collection(db, knowledgeGraphCollections.nodes),
          where("workspaceId", "==", candidate.workspaceId),
        ))).docs
          .filter((snapshot) => snapshot.id !== candidate.id && snapshot.data().type === candidate.type)
          .map((snapshot) => snapshot.ref);
      const resultId = await runTransaction(db, async (transaction) => {
        const [existingSnapshot, registrySnapshot, sourceRegistrySnapshot, sourceSnapshots,
          stateSnapshot, regionSnapshot, existingTypeNodeSnapshots] = await Promise.all([
          transaction.get(nodeDocument(db, candidate.id)),
          transaction.get(registryRef),
          transaction.get(sourceRegistryRef),
          Promise.all(candidate.sourceIds.map((id) => transaction.get(sourceDocument(db, id)))),
          isSchoolKnowledgeNode(candidate) ? transaction.get(nodeDocument(db, candidate.stateNodeId)) : Promise.resolve(null),
          isSchoolKnowledgeNode(candidate) ? transaction.get(nodeDocument(db, candidate.regionNodeId)) : Promise.resolve(null),
          Promise.all(existingTypeNodeRefs.map((reference) => transaction.get(reference))),
        ]);
        await options.afterClaimRead?.("node");
        if (existingSnapshot.exists()) {
          const existing = decodeNode(existingSnapshot);
          if (existing.status === KnowledgeStatus.Active) return existing.id;
          throw new KnowledgeValidationError(`Historical knowledge identity remains reserved by archived node ${existing.id}.`);
        }
        assertActiveSources(candidate.workspaceId, candidate.sourceIds, sourceSnapshots);
        if (isSchoolKnowledgeNode(candidate)) {
          validateSchoolRegionalReferences(
            candidate,
            stateSnapshot?.exists() ? decodeNode(stateSnapshot) : null,
            regionSnapshot?.exists() ? decodeNode(regionSnapshot) : null,
          );
        }
        const registry = enrollExistingNodeClaims(
          baseNodeRegistry(registrySnapshot, candidate.workspaceId, candidate.type),
          existingTypeNodeSnapshots,
        );
        const owners = sortedUnique(candidate.canonicalNameKeys.map((key) => registry.owners[key]).filter(Boolean));
        if (owners.length > 0) {
          if (owners.length > 1) throw new KnowledgeValidationError("Canonical identity claims are owned by multiple records.");
          const ownerSnapshot = await transaction.get(nodeDocument(db, owners[0]));
          if (!ownerSnapshot.exists()) throw new KnowledgeValidationError(`Canonical identity claim owner is missing: ${owners[0]}.`);
          const owner = decodeNode(ownerSnapshot);
          if (owner.status === KnowledgeStatus.Active
            && normalizeCanonicalKnowledgeName(owner.name) === normalizeCanonicalKnowledgeName(candidate.name)) {
            if (registrySnapshot.data()?.legacyBootstrapComplete !== true) {
              transaction.set(registryRef, claimWriteData(registry, registrySnapshot.data(), mutation.actorId));
            }
            return owner.id;
          }
          throw new KnowledgeValidationError(owner.status === KnowledgeStatus.Archived
            ? `Historical knowledge identity remains reserved by archived node ${owner.id}.`
            : `Canonical knowledge identity is already reserved by node ${owner.id}.`);
        }
        const nextRegistry = {
          ...registry,
          owners: { ...registry.owners },
          claimedKeysByNode: { ...registry.claimedKeysByNode, [candidate.id]: [...candidate.canonicalNameKeys] },
        };
        candidate.canonicalNameKeys.forEach((key) => { nextRegistry.owners[key] = candidate.id; });
        let sourceRegistry = baseSourceRegistry(sourceRegistrySnapshot, candidate.workspaceId);
        sourceRegistry = {
          ...sourceUsage(sourceRegistry, candidate.sourceIds, `node:${candidate.id}`, true),
          activeSourceIds: sortedUnique([...sourceRegistry.activeSourceIds, ...candidate.sourceIds]),
        };
        await options.beforeAuditWrite?.(audit.event);
        transaction.set(nodeDocument(db, candidate.id), nodeWriteData(candidate));
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(sourceRegistryRef, claimWriteData(sourceRegistry, sourceRegistrySnapshot.data(), mutation.actorId));
        transaction.set(audit.reference, auditWriteData(audit.event));
        return candidate.id;
      });
      return readAfterNode(resultId);
    },

    async updateNode(nodeId: string, update: KnowledgeNodeUpdate, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const preflightSnapshot = await getDoc(nodeDocument(db, nodeId));
      if (!preflightSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge node not found: ${nodeId}`);
      const preflightNode = decodeNode(preflightSnapshot);
      await ensureNodeRegistryBootstrapped(preflightNode.workspaceId, preflightNode.type, mutation.actorId);
      await ensureSourceUsageIndexed(
        preflightNode.workspaceId,
        preflightNode.sourceIds,
        `node:${preflightNode.id}`,
        mutation.actorId,
      );
      const preflightSourceIds = update.sourceIds || preflightNode.sourceIds;
      const preflightSourceSnapshots = await Promise.all(
        preflightSourceIds.map((id) => getDoc(sourceDocument(db, id))),
      );
      assertActiveSources(preflightNode.workspaceId, preflightSourceIds, preflightSourceSnapshots);
      const changedAt = placeholderTime();
      const result = await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(nodeDocument(db, nodeId));
        if (!currentSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge node not found: ${nodeId}`);
        const current = decodeNode(currentSnapshot);
        if (current.status !== KnowledgeStatus.Active) throw new KnowledgeValidationError("Archived knowledge nodes cannot be edited.");
        const version = current.version + 1;
        const reason = mutation.reason || `Updated knowledge node ${current.name}.`;
        const eventType = update.confidence && update.confidence !== current.confidence
          ? KnowledgeAuditEventType.ConfidenceChanged : KnowledgeAuditEventType.Updated;
        const audit = newAudit(db, {
          workspaceId: current.workspaceId, subjectType: "node", subjectId: current.id,
          eventType, actorId: mutation.actorId, summary: reason, version,
          metadata: { confidence: update.confidence || current.confidence },
        }, changedAt);
        let candidate = neutralizeSchoolDerivedReferences({
          ...current, ...update,
          id: current.id, workspaceId: current.workspaceId, type: current.type, category: current.category,
          sources: [], createdAt: current.createdAt, createdBy: current.createdBy,
          updatedAt: changedAt, updatedBy: mutation.actorId, status: current.status, version,
          versionHistory: current.versionHistory, statusHistory: current.statusHistory,
          canonicalNameKeys: nodeCanonicalClaimKeys({ ...current, ...update } as KnowledgeNode),
          lastAuditEventId: audit.reference.id,
        } as KnowledgeNode);
        candidate = {
          ...candidate,
          confidenceHistory: candidate.confidence === current.confidence ? current.confidenceHistory : [
            ...current.confidenceHistory,
            { from: current.confidence, to: candidate.confidence, changedAt, changedBy: mutation.actorId,
              reason, sourceIds: [...candidate.sourceIds], version },
          ],
        } as KnowledgeNode;
        candidate = { ...candidate, versionHistory: [...current.versionHistory, nodeVersion(candidate, changedAt, mutation.actorId, reason)] } as KnowledgeNode;
        candidate = parseKnowledgeNode(candidate);

        const identityChanged = sortedUnique(current.canonicalNameKeys).join("\u0000")
          !== sortedUnique(candidate.canonicalNameKeys).join("\u0000");
        const sourcesChanged = sortedUnique(current.sourceIds).join("\u0000")
          !== sortedUnique(candidate.sourceIds).join("\u0000");

        const registryRef = claimDocument(db, nodeRegistryId(current.workspaceId, current.type));
        const sourceRegistryRef = claimDocument(db, sourceRegistryId(current.workspaceId));
        const [registrySnapshot, sourceRegistrySnapshot, stateSnapshot, regionSnapshot] = await Promise.all([
          identityChanged ? transaction.get(registryRef) : Promise.resolve(null),
          sourcesChanged ? transaction.get(sourceRegistryRef) : Promise.resolve(null),
          isSchoolKnowledgeNode(candidate) ? transaction.get(nodeDocument(db, candidate.stateNodeId)) : Promise.resolve(null),
          isSchoolKnowledgeNode(candidate) ? transaction.get(nodeDocument(db, candidate.regionNodeId)) : Promise.resolve(null),
        ]);
        if (isSchoolKnowledgeNode(candidate)) validateSchoolRegionalReferences(candidate,
          stateSnapshot?.exists() ? decodeNode(stateSnapshot) : null,
          regionSnapshot?.exists() ? decodeNode(regionSnapshot) : null);
        let nextRegistry: NodeRegistry | null = null;
        if (registrySnapshot) {
          const registry = baseNodeRegistry(registrySnapshot, candidate.workspaceId, candidate.type);
          for (const key of candidate.canonicalNameKeys) {
            if (registry.owners[key] && registry.owners[key] !== candidate.id) {
              throw new KnowledgeValidationError(`Canonical knowledge identity is already reserved by node ${registry.owners[key]}.`);
            }
          }
          nextRegistry = {
            ...registry,
            owners: { ...registry.owners },
            claimedKeysByNode: { ...registry.claimedKeysByNode, [candidate.id]: [...candidate.canonicalNameKeys] },
          };
          candidate.canonicalNameKeys.forEach((key) => { nextRegistry!.owners[key] = candidate.id; });
        }
        let sourceRegistry: SourceRegistry | null = null;
        if (sourceRegistrySnapshot) {
          const existingSourceRegistry = baseSourceRegistry(sourceRegistrySnapshot, candidate.workspaceId);
          sourceRegistry = {
            ...replaceSourceUsage(existingSourceRegistry, current.sourceIds, candidate.sourceIds, `node:${candidate.id}`, true),
            activeSourceIds: sortedUnique([...existingSourceRegistry.activeSourceIds, ...candidate.sourceIds]),
          };
        }
        transaction.set(nodeDocument(db, candidate.id), nodeWriteData(candidate, currentSnapshot.data()));
        await options.beforeAuditWrite?.(audit.event);
        if (nextRegistry && registrySnapshot) {
          transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        }
        if (sourceRegistry && sourceRegistrySnapshot) {
          transaction.set(sourceRegistryRef, claimWriteData(sourceRegistry, sourceRegistrySnapshot.data(), mutation.actorId));
        }
        transaction.set(audit.reference, auditWriteData(audit.event));
        return candidate.id;
      });
      return readAfterNode(result);
    },

    async archiveNode(nodeId: string, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = placeholderTime();
      const preflightSnapshot = await getDoc(nodeDocument(db, nodeId));
      if (!preflightSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge node not found: ${nodeId}`);
      const preflightNode = decodeNode(preflightSnapshot);
      await ensureNodeRegistryBootstrapped(preflightNode.workspaceId, preflightNode.type, mutation.actorId);
      await ensureSourceUsageIndexed(
        preflightNode.workspaceId,
        preflightNode.sourceIds,
        `node:${preflightNode.id}`,
        mutation.actorId,
      );
      const legacyBlockers = await legacyRelationshipBlockerIds(preflightNode.workspaceId, nodeId);
      await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(nodeDocument(db, nodeId));
        if (!currentSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge node not found: ${nodeId}`);
        const current = decodeNode(currentSnapshot);
        if (current.status === KnowledgeStatus.Archived) return;
        const registryRef = claimDocument(db, nodeRegistryId(current.workspaceId, current.type));
        const relationshipRegistryRef = claimDocument(db, relationshipRegistryId(current.workspaceId));
        const sourceRegistryRef = claimDocument(db, sourceRegistryId(current.workspaceId));
        const [relationshipRegistrySnapshot, registrySnapshot, sourceRegistrySnapshot] = await Promise.all([
          transaction.get(relationshipRegistryRef), transaction.get(registryRef), transaction.get(sourceRegistryRef),
        ]);
        await options.afterClaimRead?.("relationship");
        const relationshipRegistry = baseRelationshipRegistry(relationshipRegistrySnapshot, current.workspaceId);
        const blockers = sortedUnique([
          ...legacyBlockers,
          ...(relationshipRegistry.endpointActive[current.id] || []),
        ]);
        if (blockers.length > 0) {
          throw new KnowledgeValidationError(`Archive the active relationships first: ${blockers.join(", ")}.`);
        }
        const version = current.version + 1;
        const reason = mutation.reason || `Archived knowledge node ${current.name}.`;
        const audit = newAudit(db, {
          workspaceId: current.workspaceId, subjectType: "node", subjectId: current.id,
          eventType: KnowledgeAuditEventType.Archived, actorId: mutation.actorId,
          summary: reason, version, metadata: {},
        }, changedAt);
        let archived = {
          ...current, sources: [], status: KnowledgeStatus.Archived,
          updatedAt: changedAt, updatedBy: mutation.actorId, version,
          statusHistory: [...current.statusHistory, { from: KnowledgeStatus.Active, to: KnowledgeStatus.Archived,
            changedAt, changedBy: mutation.actorId, reason, version }],
          lastAuditEventId: audit.reference.id,
        } as KnowledgeNode;
        archived = { ...archived, versionHistory: [...current.versionHistory, nodeVersion(archived, changedAt, mutation.actorId, reason)] } as KnowledgeNode;
        archived = parseKnowledgeNode(archived);
        const registry = baseNodeRegistry(registrySnapshot, current.workspaceId, current.type);
        const nextRegistry = {
          ...registry,
          owners: { ...registry.owners },
          claimedKeysByNode: { ...registry.claimedKeysByNode, [current.id]: [...current.canonicalNameKeys] },
        };
        current.canonicalNameKeys.forEach((key) => { nextRegistry.owners[key] = current.id; });
        let sourceRegistry = baseSourceRegistry(sourceRegistrySnapshot, current.workspaceId);
        sourceRegistry = {
          ...sourceUsage(sourceRegistry, current.sourceIds, `node:${current.id}`, false),
          activeSourceIds: sortedUnique([...sourceRegistry.activeSourceIds, ...current.sourceIds]),
        };
        await options.beforeAuditWrite?.(audit.event);
        transaction.set(nodeDocument(db, current.id), nodeWriteData(archived, currentSnapshot.data()));
        transaction.set(relationshipRegistryRef,
          claimWriteData(relationshipRegistry, relationshipRegistrySnapshot.data(), mutation.actorId));
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(sourceRegistryRef, claimWriteData(sourceRegistry, sourceRegistrySnapshot.data(), mutation.actorId));
        transaction.set(audit.reference, auditWriteData(audit.event));
      });
      return readAfterNode(nodeId);
    },

    async listRelationships(workspaceId) {
      return Promise.all((await rawRelationships(workspaceId))
        .sort((a, b) => a.relationshipType.localeCompare(b.relationshipType) || a.id.localeCompare(b.id))
        .map(hydrateRelationship));
    },

    async getRelationshipById(relationshipId) {
      const snapshot = await getDoc(relationshipDocument(db, relationshipId));
      return snapshot.exists() ? hydrateRelationship(decodeRelationship(snapshot)) : null;
    },

    async createRelationship(input: KnowledgeRelationshipCreateInput, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = placeholderTime();
      const identityKey = relationshipIdentity(input as KnowledgeRelationship);
      const exclusiveKey = exclusiveKnowledgeRelationshipClaimKey(input as KnowledgeRelationship) || undefined;
      const reason = mutation.reason || `Created knowledge relationship ${input.relationshipType}.`;
      const baseAudit = newAudit(db, {
        workspaceId: input.workspaceId, subjectType: "relationship", subjectId: input.id,
        eventType: KnowledgeAuditEventType.Created, actorId: mutation.actorId,
        summary: reason, version: 1, metadata: {},
      }, changedAt);
      let candidate = {
        ...input, sources: [], createdAt: changedAt, updatedAt: changedAt,
        createdBy: mutation.actorId, updatedBy: mutation.actorId,
        status: KnowledgeStatus.Active, version: 1,
        confidenceHistory: initialConfidenceHistory(input.confidence, changedAt, mutation.actorId, input.sourceIds, reason),
        versionHistory: [], statusHistory: initialStatusHistory(KnowledgeStatus.Active, changedAt, mutation.actorId, reason),
        identityKey, ...(exclusiveKey ? { exclusiveClaimKey: exclusiveKey } : {}),
        lastAuditEventId: baseAudit.reference.id,
      } as KnowledgeRelationship;
      candidate = { ...candidate, versionHistory: [relationshipVersion(candidate, changedAt, mutation.actorId, reason)] };
      candidate = parseKnowledgeRelationship(candidate);

      await ensureRelationshipRegistryBootstrapped(candidate.workspaceId, mutation.actorId);
      if (exclusiveKey) {
        await ensureExclusiveRelationshipSourceUsageIndexed(
          candidate.workspaceId,
          exclusiveKey,
          mutation.actorId,
        );
      }
      const existingCandidateSnapshot = await getDoc(relationshipDocument(db, candidate.id));
      if (existingCandidateSnapshot.exists()) {
        const existing = decodeRelationship(existingCandidateSnapshot);
        if (existing.status === KnowledgeStatus.Active && existing.identityKey === candidate.identityKey) {
          return readAfterRelationship(existing.id);
        }
        throw new KnowledgeValidationError(`Historical relationship identity remains reserved by ${existing.id}.`);
      }
      const preflightSourceSnapshots = await Promise.all(
        candidate.sourceIds.map((id) => getDoc(sourceDocument(db, id))),
      );
      assertActiveSources(candidate.workspaceId, candidate.sourceIds, preflightSourceSnapshots);
      const registryRef = claimDocument(db, relationshipRegistryId(candidate.workspaceId));
      const sourceRegistryRef = claimDocument(db, sourceRegistryId(candidate.workspaceId));
      const createAttempt = () => runTransaction(db, async (transaction) => {
        const [registrySnapshot, fromSnapshot, toSnapshot, sourceRegistrySnapshot] = await Promise.all([
          transaction.get(registryRef),
          transaction.get(nodeDocument(db, candidate.fromNodeId)), transaction.get(nodeDocument(db, candidate.toNodeId)),
          transaction.get(sourceRegistryRef),
        ]);
        await options.afterClaimRead?.("relationship");
        const registry = baseRelationshipRegistry(registrySnapshot, candidate.workspaceId);
        const permanentOwnerId = registry.exactOwners[candidate.identityKey];
        if (!fromSnapshot.exists() || !toSnapshot.exists()) throw new KnowledgeValidationError("Knowledge relationships require two existing nodes.");
        validateKnowledgeRelationship(candidate, decodeNode(fromSnapshot), decodeNode(toSnapshot));
        const ownerId = typeof permanentOwnerId === "string" ? permanentOwnerId : undefined;
        if (ownerId) {
          const ownerSnapshot = await transaction.get(relationshipDocument(db, ownerId));
          if (!ownerSnapshot.exists()) throw new KnowledgeValidationError(`Relationship identity owner is missing: ${ownerId}.`);
          const owner = decodeRelationship(ownerSnapshot);
          if (owner.identityKey !== candidate.identityKey) {
            throw new KnowledgeValidationError(
              `Relationship registry identity ${candidate.identityKey} does not match its owner.`,
            );
          }
          if (owner.status === KnowledgeStatus.Active) {
            return owner.id;
          }
          throw new KnowledgeValidationError(`Historical relationship identity remains reserved by ${owner.id}.`);
        }
        const exclusiveRelationshipIds = exclusiveKey ? registry.exclusiveActive[exclusiveKey] || [] : [];
        const conflictSnapshots = await Promise.all(
          exclusiveRelationshipIds.map((id) => transaction.get(relationshipDocument(db, id))),
        );
        conflictSnapshots.forEach((snapshot, index) => {
          if (!snapshot.exists()) {
            throw new KnowledgeValidationError(
              `The exclusive relationship registry references a missing record: ${exclusiveRelationshipIds[index]}.`,
            );
          }
          const registered = decodeRelationship(snapshot);
          if (registered.workspaceId !== candidate.workspaceId
            || registered.status !== KnowledgeStatus.Active
            || registered.exclusiveClaimKey !== exclusiveKey) {
            throw new KnowledgeValidationError(
              `The exclusive relationship registry is inconsistent for record ${registered.id}.`,
            );
          }
          if (registered.identityKey === candidate.identityKey && registered.id !== candidate.id) {
            throw new KnowledgeValidationError(
              `Existing relationships ${registered.id} and ${candidate.id} represent the same canonical fact.`,
            );
          }
        });
        const conflictEntries = conflictSnapshots.flatMap((snapshot) => {
          if (!snapshot.exists()) return [];
          const relationship = decodeRelationship(snapshot);
          return relationship.status === KnowledgeStatus.Active && relationship.identityKey !== candidate.identityKey
            ? [{ relationship, snapshot }]
            : [];
        });
        const conflicts = conflictEntries.map((entry) => entry.relationship);
        const peersRequiringConflict = conflictEntries.filter(
          ({ relationship }) => relationship.confidence !== KnowledgeConfidence.Conflicting,
        );
        if (peersRequiringConflict.length > 1) {
          throw new KnowledgeValidationError(
            "Multiple unresolved exclusive relationships already exist. Reconcile the legacy relationship records before adding another claim.",
          );
        }

        let effectiveCandidate = candidate;
        let candidateAudit = baseAudit;
        const conflictReason = mutation.reason || `Conflicting active claims detected for ${candidate.relationshipType}.`;
        if (conflicts.length > 0) {
          candidateAudit = newAudit(db, {
            workspaceId: candidate.workspaceId, subjectType: "relationship", subjectId: candidate.id,
            eventType: KnowledgeAuditEventType.ConflictDetected, actorId: mutation.actorId,
            summary: conflictReason, version: 1, metadata: { conflictCount: conflicts.length },
          }, changedAt);
          effectiveCandidate = {
            ...candidate, confidence: KnowledgeConfidence.Conflicting,
            confidenceHistory: initialConfidenceHistory(
              KnowledgeConfidence.Conflicting,
              changedAt,
              mutation.actorId,
              candidate.sourceIds,
              conflictReason,
            ),
            versionHistory: [], lastAuditEventId: candidateAudit.reference.id,
          };
          effectiveCandidate = { ...effectiveCandidate,
            versionHistory: [relationshipVersion(effectiveCandidate, changedAt, mutation.actorId, conflictReason)] };
          effectiveCandidate = parseKnowledgeRelationship(effectiveCandidate);
        }

        const peerMutations = peersRequiringConflict.map(({ relationship: peer, snapshot }) => {
          const peerVersion = peer.version + 1;
          const peerChangedAt = new Date(Math.max(
            Date.now(),
            Date.parse(peer.versionHistory.at(-1)?.changedAt || peer.updatedAt) + 1,
          )).toISOString();
          const peerAudit = newAudit(db, {
            workspaceId: peer.workspaceId,
            subjectType: "relationship",
            subjectId: peer.id,
            eventType: KnowledgeAuditEventType.ConflictDetected,
            actorId: mutation.actorId,
            summary: conflictReason,
            version: peerVersion,
            metadata: { conflictingRelationshipId: candidate.id, conflictCount: conflicts.length },
          }, peerChangedAt);
          let conflictingPeer = {
            ...peer,
            sources: [],
            confidence: KnowledgeConfidence.Conflicting,
            updatedAt: peerChangedAt,
            updatedBy: mutation.actorId,
            version: peerVersion,
            confidenceHistory: [
              ...peer.confidenceHistory,
              {
                from: peer.confidence,
                to: KnowledgeConfidence.Conflicting,
                changedAt: peerChangedAt,
                changedBy: mutation.actorId,
                reason: conflictReason,
                sourceIds: [...peer.sourceIds],
                version: peerVersion,
              },
            ],
            lastAuditEventId: peerAudit.reference.id,
          } as KnowledgeRelationship;
          conflictingPeer = {
            ...conflictingPeer,
            versionHistory: [
              ...peer.versionHistory,
              relationshipVersion(conflictingPeer, peerChangedAt, mutation.actorId, conflictReason),
            ],
          };
          return {
            audit: peerAudit,
            relationship: parseKnowledgeRelationship(conflictingPeer),
            snapshot,
          };
        });

        const nextRegistry = {
          ...registry,
          exactOwners: { ...registry.exactOwners, [effectiveCandidate.identityKey]: effectiveCandidate.id },
          activeRelationshipIds: sortedUnique([...registry.activeRelationshipIds, effectiveCandidate.id]),
          exclusiveActive: exclusiveKey ? {
            ...registry.exclusiveActive,
            [exclusiveKey]: sortedUnique([...(registry.exclusiveActive[exclusiveKey] || []), effectiveCandidate.id]),
          } : registry.exclusiveActive,
          endpointActive: {
            ...registry.endpointActive,
            [effectiveCandidate.fromNodeId]: sortedUnique([
              ...(registry.endpointActive[effectiveCandidate.fromNodeId] || []), effectiveCandidate.id,
            ]),
            [effectiveCandidate.toNodeId]: sortedUnique([
              ...(registry.endpointActive[effectiveCandidate.toNodeId] || []), effectiveCandidate.id,
            ]),
          },
        };
        let sourceRegistry = baseSourceRegistry(sourceRegistrySnapshot, effectiveCandidate.workspaceId);
        sourceRegistry = { ...sourceUsage(sourceRegistry, effectiveCandidate.sourceIds, `relationship:${effectiveCandidate.id}`, true),
          activeSourceIds: sortedUnique([...sourceRegistry.activeSourceIds, ...effectiveCandidate.sourceIds]) };
        for (const { relationship } of peerMutations) {
          sourceRegistry = {
            ...sourceUsage(sourceRegistry, relationship.sourceIds, `relationship:${relationship.id}`, true),
            activeSourceIds: sortedUnique([...sourceRegistry.activeSourceIds, ...relationship.sourceIds]),
          };
        }
        for (const audit of [candidateAudit, ...peerMutations.map((item) => item.audit)]) {
          await options.beforeAuditWrite?.(audit.event);
        }
        transaction.set(relationshipDocument(db, effectiveCandidate.id), relationshipWriteData(effectiveCandidate));
        peerMutations.forEach(({ relationship, snapshot }) => {
          transaction.set(
            relationshipDocument(db, relationship.id),
            relationshipWriteData(relationship, snapshot.data()),
          );
        });
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(sourceRegistryRef, claimWriteData(sourceRegistry, sourceRegistrySnapshot.data(), mutation.actorId));
        transaction.set(candidateAudit.reference, auditWriteData(candidateAudit.event));
        peerMutations.forEach(({ audit }) => {
          transaction.set(audit.reference, auditWriteData(audit.event));
        });
        return effectiveCandidate.id;
      });
      let result: string;
      try {
        result = await createAttempt();
      } catch (error) {
        if (!isRetryableClaimRace(error)) throw error;
        // A stale concurrent registry write can be denied by immutable-claim rules
        // before the SDK surfaces a transaction retry. Re-read once so the winner
        // becomes the canonical result or the exclusive conflict is materialized.
        result = await createAttempt();
      }
      return readAfterRelationship(result);
    },

    async updateRelationship(relationshipId: string, update: KnowledgeRelationshipUpdate, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const preflightSnapshot = await getDoc(relationshipDocument(db, relationshipId));
      if (!preflightSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge relationship not found: ${relationshipId}`);
      const preflightRelationship = decodeRelationship(preflightSnapshot);
      await ensureRelationshipRegistryBootstrapped(preflightRelationship.workspaceId, mutation.actorId);
      await ensureSourceUsageIndexed(
        preflightRelationship.workspaceId,
        preflightRelationship.sourceIds,
        `relationship:${preflightRelationship.id}`,
        mutation.actorId,
      );
      const changedAt = placeholderTime();
      await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(relationshipDocument(db, relationshipId));
        if (!currentSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge relationship not found: ${relationshipId}`);
        const current = decodeRelationship(currentSnapshot);
        if (current.status !== KnowledgeStatus.Active) throw new KnowledgeValidationError("Archived knowledge relationships cannot be edited.");
        const registryRef = claimDocument(db, relationshipRegistryId(current.workspaceId));
        const sourceRegistryRef = claimDocument(db, sourceRegistryId(current.workspaceId));
        const [registrySnapshot, fromSnapshot, toSnapshot,
          sourceRegistrySnapshot, sourceSnapshots] = await Promise.all([
          transaction.get(registryRef),
          transaction.get(nodeDocument(db, current.fromNodeId)), transaction.get(nodeDocument(db, current.toNodeId)),
          transaction.get(sourceRegistryRef),
          Promise.all((update.sourceIds || current.sourceIds).map((id) => transaction.get(sourceDocument(db, id)))),
        ]);
        const nextConfidence = update.confidence || current.confidence;
        const registry = baseRelationshipRegistry(registrySnapshot, current.workspaceId);
        const nextRegistry = {
          ...registry,
          exactOwners: { ...registry.exactOwners, [current.identityKey]: current.id },
          activeRelationshipIds: sortedUnique([...registry.activeRelationshipIds, current.id]),
          exclusiveActive: current.exclusiveClaimKey ? {
            ...registry.exclusiveActive,
            [current.exclusiveClaimKey]: sortedUnique([
              ...(registry.exclusiveActive[current.exclusiveClaimKey] || []), current.id,
            ]),
          } : registry.exclusiveActive,
          endpointActive: {
            ...registry.endpointActive,
            [current.fromNodeId]: sortedUnique([...(registry.endpointActive[current.fromNodeId] || []), current.id]),
            [current.toNodeId]: sortedUnique([...(registry.endpointActive[current.toNodeId] || []), current.id]),
          },
        };
        const exclusiveActive = current.exclusiveClaimKey ? nextRegistry.exclusiveActive[current.exclusiveClaimKey] || [] : [];
        if (exclusiveActive.some((id) => id !== current.id)
          && nextConfidence !== KnowledgeConfidence.Conflicting) {
          throw new KnowledgeValidationError("Resolve the conflicting relationship before changing this relationship from Conflicting.");
        }
        const version = current.version + 1;
        const reason = mutation.reason || `Updated knowledge relationship ${current.relationshipType}.`;
        const eventType = nextConfidence === current.confidence ? KnowledgeAuditEventType.Updated : KnowledgeAuditEventType.ConfidenceChanged;
        const audit = newAudit(db, {
          workspaceId: current.workspaceId, subjectType: "relationship", subjectId: current.id,
          eventType, actorId: mutation.actorId, summary: reason, version,
          metadata: { confidence: nextConfidence },
        }, changedAt);
        let candidate = {
          ...current, ...update,
          id: current.id, workspaceId: current.workspaceId,
          fromNodeId: current.fromNodeId, toNodeId: current.toNodeId, relationshipType: current.relationshipType,
          sources: [], createdAt: current.createdAt, createdBy: current.createdBy,
          updatedAt: changedAt, updatedBy: mutation.actorId, status: current.status, version,
          confidence: nextConfidence,
          confidenceHistory: nextConfidence === current.confidence ? current.confidenceHistory : [
            ...current.confidenceHistory,
            { from: current.confidence, to: nextConfidence, changedAt, changedBy: mutation.actorId,
              reason, sourceIds: [...(update.sourceIds || current.sourceIds)], version },
          ],
          versionHistory: current.versionHistory, statusHistory: current.statusHistory,
          identityKey: current.identityKey, exclusiveClaimKey: current.exclusiveClaimKey,
          lastAuditEventId: audit.reference.id,
        } as KnowledgeRelationship;
        candidate = { ...candidate,
          versionHistory: [...current.versionHistory, relationshipVersion(candidate, changedAt, mutation.actorId, reason)] };
        candidate = parseKnowledgeRelationship(candidate);
        assertActiveSources(candidate.workspaceId, candidate.sourceIds, sourceSnapshots);
        if (!fromSnapshot.exists() || !toSnapshot.exists()) throw new KnowledgeValidationError("Knowledge relationships require two existing nodes.");
        validateKnowledgeRelationship(candidate, decodeNode(fromSnapshot), decodeNode(toSnapshot));
        let sourceRegistry = baseSourceRegistry(sourceRegistrySnapshot, current.workspaceId);
        sourceRegistry = { ...replaceSourceUsage(sourceRegistry, current.sourceIds, candidate.sourceIds,
          `relationship:${current.id}`, true), activeSourceIds: sortedUnique([...sourceRegistry.activeSourceIds, ...candidate.sourceIds]) };
        await options.beforeAuditWrite?.(audit.event);
        transaction.set(relationshipDocument(db, current.id), relationshipWriteData(candidate, currentSnapshot.data()));
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(sourceRegistryRef, claimWriteData(sourceRegistry, sourceRegistrySnapshot.data(), mutation.actorId));
        transaction.set(audit.reference, auditWriteData(audit.event));
      });
      return readAfterRelationship(relationshipId);
    },

    async archiveRelationship(relationshipId: string, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const preflightSnapshot = await getDoc(relationshipDocument(db, relationshipId));
      if (!preflightSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge relationship not found: ${relationshipId}`);
      const preflightRelationship = decodeRelationship(preflightSnapshot);
      await ensureRelationshipRegistryBootstrapped(preflightRelationship.workspaceId, mutation.actorId);
      await ensureSourceUsageIndexed(
        preflightRelationship.workspaceId,
        preflightRelationship.sourceIds,
        `relationship:${preflightRelationship.id}`,
        mutation.actorId,
      );
      const changedAt = placeholderTime();
      await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(relationshipDocument(db, relationshipId));
        if (!currentSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge relationship not found: ${relationshipId}`);
        const current = decodeRelationship(currentSnapshot);
        if (current.status === KnowledgeStatus.Archived) return;
        const registryRef = claimDocument(db, relationshipRegistryId(current.workspaceId));
        const sourceRegistryRef = claimDocument(db, sourceRegistryId(current.workspaceId));
        const [registrySnapshot, sourceRegistrySnapshot] = await Promise.all([
          transaction.get(registryRef), transaction.get(sourceRegistryRef),
        ]);
        const version = current.version + 1;
        const reason = mutation.reason || `Archived knowledge relationship ${current.relationshipType}.`;
        const audit = newAudit(db, {
          workspaceId: current.workspaceId, subjectType: "relationship", subjectId: current.id,
          eventType: KnowledgeAuditEventType.Archived, actorId: mutation.actorId,
          summary: reason, version, metadata: {},
        }, changedAt);
        let archived = {
          ...current, sources: [], status: KnowledgeStatus.Archived,
          updatedAt: changedAt, updatedBy: mutation.actorId, version,
          statusHistory: [...current.statusHistory, { from: KnowledgeStatus.Active, to: KnowledgeStatus.Archived,
            changedAt, changedBy: mutation.actorId, reason, version }],
          lastAuditEventId: audit.reference.id,
        } as KnowledgeRelationship;
        archived = { ...archived,
          versionHistory: [...current.versionHistory, relationshipVersion(archived, changedAt, mutation.actorId, reason)] };
        archived = parseKnowledgeRelationship(archived);
        const registry = baseRelationshipRegistry(registrySnapshot, current.workspaceId);
        const nextRegistry = { ...registry,
          exactOwners: { ...registry.exactOwners, [current.identityKey]: current.id },
          activeRelationshipIds: registry.activeRelationshipIds.filter((id) => id !== current.id),
          exclusiveActive: current.exclusiveClaimKey ? {
            ...registry.exclusiveActive,
            [current.exclusiveClaimKey]: (registry.exclusiveActive[current.exclusiveClaimKey] || [])
              .filter((id) => id !== current.id),
          } : registry.exclusiveActive,
          endpointActive: {
            ...registry.endpointActive,
            [current.fromNodeId]: (registry.endpointActive[current.fromNodeId] || []).filter((id) => id !== current.id),
            [current.toNodeId]: (registry.endpointActive[current.toNodeId] || []).filter((id) => id !== current.id),
          },
        };
        let sourceRegistry = baseSourceRegistry(sourceRegistrySnapshot, current.workspaceId);
        sourceRegistry = {
          ...sourceUsage(sourceRegistry, current.sourceIds, `relationship:${current.id}`, false),
          activeSourceIds: sortedUnique([...sourceRegistry.activeSourceIds, ...current.sourceIds]),
        };
        await options.beforeAuditWrite?.(audit.event);
        transaction.set(relationshipDocument(db, current.id), relationshipWriteData(archived, currentSnapshot.data()));
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(sourceRegistryRef, claimWriteData(sourceRegistry, sourceRegistrySnapshot.data(), mutation.actorId));
        transaction.set(audit.reference, auditWriteData(audit.event));
      });
      return readAfterRelationship(relationshipId);
    },

    async listSources(workspaceId) {
      return (await rawSources(workspaceId))
        .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id));
    },

    async getSourceById(sourceId) {
      const snapshot = await getDoc(sourceDocument(db, sourceId));
      return snapshot.exists() ? decodeSource(snapshot) : null;
    },

    async createSource(input: KnowledgeSourceCreateInput, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = placeholderTime();
      const reason = mutation.reason || `Created knowledge source ${input.title}.`;
      const audit = newAudit(db, {
        workspaceId: input.workspaceId, subjectType: "source", subjectId: input.id,
        eventType: KnowledgeAuditEventType.Created, actorId: mutation.actorId,
        summary: reason, version: 1, metadata: {},
      }, changedAt);
      let candidate = {
        ...input, createdAt: changedAt, updatedAt: changedAt,
        createdBy: mutation.actorId, updatedBy: mutation.actorId,
        status: KnowledgeStatus.Active, version: 1, versionHistory: [],
        statusHistory: initialStatusHistory(KnowledgeStatus.Active, changedAt, mutation.actorId, reason),
        lastAuditEventId: audit.reference.id,
      } as KnowledgeSource;
      candidate = { ...candidate, versionHistory: [sourceVersion(candidate, changedAt, mutation.actorId, reason)] };
      candidate = parseKnowledgeSource(candidate);
      const registryRef = claimDocument(db, sourceRegistryId(candidate.workspaceId));
      const resultId = await runTransaction(db, async (transaction) => {
        const [currentSnapshot, registrySnapshot] = await Promise.all([
          transaction.get(sourceDocument(db, candidate.id)), transaction.get(registryRef),
        ]);
        if (currentSnapshot.exists()) {
          const current = decodeSource(currentSnapshot);
          if (current.status === KnowledgeStatus.Active && current.workspaceId === candidate.workspaceId) return current.id;
          throw new KnowledgeValidationError(`Historical knowledge source identity remains reserved by ${current.id}.`);
        }
        const registry = baseSourceRegistry(registrySnapshot, candidate.workspaceId);
        const nextRegistry = { ...registry,
          activeSourceIds: sortedUnique([...registry.activeSourceIds, candidate.id]),
          subjectKeysBySource: { ...registry.subjectKeysBySource, [candidate.id]: registry.subjectKeysBySource[candidate.id] || [] },
        };
        transaction.set(sourceDocument(db, candidate.id), sourceWriteData(candidate));
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(audit.reference, auditWriteData(audit.event));
        return candidate.id;
      });
      return readAfterSource(resultId);
    },

    async updateSource(sourceId: string, update: KnowledgeSourceUpdate, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = placeholderTime();
      await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(sourceDocument(db, sourceId));
        if (!currentSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge source not found: ${sourceId}`);
        const current = decodeSource(currentSnapshot);
        if (current.status !== KnowledgeStatus.Active) throw new KnowledgeValidationError("Archived knowledge sources cannot be edited.");
        const registryRef = claimDocument(db, sourceRegistryId(current.workspaceId));
        const registrySnapshot = await transaction.get(registryRef);
        const version = current.version + 1;
        const reason = mutation.reason || `Updated knowledge source ${current.title}.`;
        const audit = newAudit(db, {
          workspaceId: current.workspaceId, subjectType: "source", subjectId: current.id,
          eventType: KnowledgeAuditEventType.Updated, actorId: mutation.actorId,
          summary: reason, version, metadata: {},
        }, changedAt);
        let candidate = {
          ...current, ...update, id: current.id, workspaceId: current.workspaceId,
          createdAt: current.createdAt, createdBy: current.createdBy,
          updatedAt: changedAt, updatedBy: mutation.actorId, status: current.status,
          version, versionHistory: current.versionHistory, statusHistory: current.statusHistory,
          lastAuditEventId: audit.reference.id,
        } as KnowledgeSource;
        candidate = { ...candidate,
          versionHistory: [...current.versionHistory, sourceVersion(candidate, changedAt, mutation.actorId, reason)] };
        candidate = parseKnowledgeSource(candidate);
        const registry = baseSourceRegistry(registrySnapshot, current.workspaceId);
        const nextRegistry = {
          ...registry,
          activeSourceIds: sortedUnique([...registry.activeSourceIds, current.id]),
          subjectKeysBySource: {
            ...registry.subjectKeysBySource,
            [current.id]: registry.subjectKeysBySource[current.id] || [],
          },
        };
        transaction.set(sourceDocument(db, current.id), sourceWriteData(candidate, currentSnapshot.data()));
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(audit.reference, auditWriteData(audit.event));
      });
      return readAfterSource(sourceId);
    },

    async archiveSource(sourceId: string, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = placeholderTime();
      const preflightSnapshot = await getDoc(sourceDocument(db, sourceId));
      if (!preflightSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge source not found: ${sourceId}`);
      const preflightSource = decodeSource(preflightSnapshot);
      const legacyBlockers = await legacySourceBlockerKeys(preflightSource.workspaceId, sourceId);
      await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(sourceDocument(db, sourceId));
        if (!currentSnapshot.exists()) throw new KnowledgeValidationError(`Knowledge source not found: ${sourceId}`);
        const current = decodeSource(currentSnapshot);
        if (current.status === KnowledgeStatus.Archived) return;
        const registryRef = claimDocument(db, sourceRegistryId(current.workspaceId));
        const registrySnapshot = await transaction.get(registryRef);
        const registry = baseSourceRegistry(registrySnapshot, current.workspaceId);
        const blockers = sortedUnique([
          ...legacyBlockers,
          ...(registry.subjectKeysBySource[current.id] || []),
        ]);
        if (blockers.length > 0) {
          throw new KnowledgeValidationError(`Archive the active knowledge claims that use this source first: ${blockers.join(", ")}.`);
        }
        const version = current.version + 1;
        const reason = mutation.reason || `Archived knowledge source ${current.title}.`;
        const audit = newAudit(db, {
          workspaceId: current.workspaceId, subjectType: "source", subjectId: current.id,
          eventType: KnowledgeAuditEventType.Archived, actorId: mutation.actorId,
          summary: reason, version, metadata: {},
        }, changedAt);
        let archived = {
          ...current, status: KnowledgeStatus.Archived,
          updatedAt: changedAt, updatedBy: mutation.actorId, version,
          statusHistory: [...current.statusHistory, { from: KnowledgeStatus.Active, to: KnowledgeStatus.Archived,
            changedAt, changedBy: mutation.actorId, reason, version }],
          lastAuditEventId: audit.reference.id,
        } as KnowledgeSource;
        archived = { ...archived,
          versionHistory: [...current.versionHistory, sourceVersion(archived, changedAt, mutation.actorId, reason)] };
        archived = parseKnowledgeSource(archived);
        const nextRegistry = { ...registry,
          activeSourceIds: registry.activeSourceIds.filter((id) => id !== current.id) };
        transaction.set(sourceDocument(db, current.id), sourceWriteData(archived, currentSnapshot.data()));
        transaction.set(registryRef, claimWriteData(nextRegistry, registrySnapshot.data(), mutation.actorId));
        transaction.set(audit.reference, auditWriteData(audit.event));
      });
      return readAfterSource(sourceId);
    },

    async listAuditEvents(workspaceId) {
      const snapshot = await getDocs(query(
        collection(db, knowledgeGraphCollections.auditEvents),
        where("workspaceId", "==", workspaceId),
      ));
      return snapshot.docs.map((item) => decodeAudit(item))
        .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt) || first.id.localeCompare(second.id));
    },
  };
}
