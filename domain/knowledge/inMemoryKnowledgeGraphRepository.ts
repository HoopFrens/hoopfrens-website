import { sanitizeFirestoreDocument } from "../shared/firestoreConverters";
import { createKnowledgeAuditEvent } from "./audit";
import { normalizeKnowledgeTimestamp } from "./dateTime";
import {
  exclusiveKnowledgeRelationshipClaimKey,
  relationshipIdentity,
  validateRelationshipEndpoints,
} from "./relationshipPolicy";
import type {
  KnowledgeGraphRepository,
  KnowledgeMutationContext,
} from "./repository";
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
  type KnowledgeRelationshipVersion,
  KnowledgeRelationshipType,
  type KnowledgeRelationshipUpdate,
  type KnowledgeSource,
  type KnowledgeSourceCreateInput,
  type KnowledgeSourceVersion,
  type KnowledgeSourceUpdate,
  type KnowledgeStatusChange,
  isContentKnowledgeNode,
  isProjectKnowledgeNode,
  isSchoolKnowledgeNode,
  KnowledgeStatus,
  type SchoolKnowledgeVersionData,
} from "./types";

export interface KnowledgeGraphStore {
  readNodes(): KnowledgeNode[];
  writeNodes(nodes: KnowledgeNode[]): void;
  readRelationships(): KnowledgeRelationship[];
  writeRelationships(relationships: KnowledgeRelationship[]): void;
  readSources(): KnowledgeSource[];
  writeSources(sources: KnowledgeSource[]): void;
  readAuditEvents(): KnowledgeAuditEvent[];
  writeAuditEvents(events: KnowledgeAuditEvent[]): void;
  replaceState(state: KnowledgeGraphStoreState): void;
}

export interface KnowledgeGraphStoreState {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  sources: KnowledgeSource[];
  auditEvents: KnowledgeAuditEvent[];
}

export interface InMemoryKnowledgeGraphRepositoryOptions {
  /** Repository-owned clock. Supplying one keeps deterministic tests deterministic. */
  now?: () => string;
  /** Test-only fault hook used to prove a subject and its audit commit atomically. */
  beforeAuditWrite?: (event: KnowledgeAuditEvent) => Promise<void> | void;
}

function clone<T>(value: T): T {
  return globalThis.structuredClone(value);
}

export function createVolatileKnowledgeGraphStore(
  initialNodes: KnowledgeNode[] = [],
  initialRelationships: KnowledgeRelationship[] = [],
  initialSources: KnowledgeSource[] = [],
  initialAuditEvents: KnowledgeAuditEvent[] = [],
): KnowledgeGraphStore {
  let nodes = clone(initialNodes);
  let relationships = clone(initialRelationships);
  let sources = clone(initialSources);
  let auditEvents = clone(initialAuditEvents);

  return {
    readNodes: () => clone(nodes),
    writeNodes: (nextNodes) => { nodes = clone(nextNodes); },
    readRelationships: () => clone(relationships),
    writeRelationships: (nextRelationships) => { relationships = clone(nextRelationships); },
    readSources: () => clone(sources),
    writeSources: (nextSources) => { sources = clone(nextSources); },
    readAuditEvents: () => clone(auditEvents),
    writeAuditEvents: (nextEvents) => { auditEvents = clone(nextEvents); },
    replaceState: (state) => {
      const nextNodes = clone(state.nodes);
      const nextRelationships = clone(state.relationships);
      const nextSources = clone(state.sources);
      const nextAuditEvents = clone(state.auditEvents);
      nodes = nextNodes;
      relationships = nextRelationships;
      sources = nextSources;
      auditEvents = nextAuditEvents;
    },
  };
}

function replaceById<T extends { id: string }>(items: readonly T[], item: T) {
  return [item, ...items.filter((candidate) => candidate.id !== item.id)];
}

function requireMutationContext(context: KnowledgeMutationContext) {
  const actorId = context?.actorId?.trim();
  if (!actorId) {
    throw new KnowledgeValidationError("An authenticated Headquarters editor is required.");
  }
  return {
    actorId,
    reason: context.reason?.trim() || undefined,
  };
}

function nodeReference(node: KnowledgeNode): KnowledgeNodeReference {
  return { nodeId: node.id, name: node.name, type: node.type };
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
  return clone({
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
  });
}

function nodeVersion(
  node: KnowledgeNode,
  changedAt: string,
  changedBy: string,
  reason: string,
): KnowledgeNodeVersion {
  const schoolData = schoolVersionData(node);
  return clone({
    version: node.version,
    changedAt,
    changedBy,
    reason,
    name: node.name,
    description: node.description,
    confidence: node.confidence,
    status: node.status,
    sourceIds: node.sourceIds,
    aliases: node.aliases,
    tags: node.tags,
    ...(schoolData ? { schoolData } : {}),
  });
}

function relationshipVersion(
  relationship: KnowledgeRelationship,
  changedAt: string,
  changedBy: string,
  reason: string,
): KnowledgeRelationshipVersion {
  return clone({
    version: relationship.version,
    changedAt,
    changedBy,
    reason,
    ...(relationship.description === undefined ? {} : { description: relationship.description }),
    confidence: relationship.confidence,
    status: relationship.status,
    sourceIds: relationship.sourceIds,
    projectIds: relationship.projectIds,
  });
}

function sourceVersion(
  source: KnowledgeSource,
  changedAt: string,
  changedBy: string,
  reason: string,
): KnowledgeSourceVersion {
  return clone({
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
    projectIds: source.projectIds,
    status: source.status,
  });
}

function initialConfidenceHistory(
  confidence: KnowledgeConfidence,
  changedAt: string,
  changedBy: string,
  sourceIds: readonly string[],
  reason: string,
): readonly KnowledgeConfidenceChange[] {
  return [{
    from: confidence,
    to: confidence,
    changedAt,
    changedBy,
    reason,
    sourceIds: [...sourceIds],
    version: 1,
  }];
}

function initialStatusHistory(
  status: KnowledgeStatus,
  changedAt: string,
  changedBy: string,
  reason: string,
): readonly KnowledgeStatusChange[] {
  return [{
    from: status,
    to: status,
    changedAt,
    changedBy,
    reason,
    version: 1,
  }];
}

function persistedNode(node: KnowledgeNode) {
  return parseKnowledgeNode(sanitizeFirestoreDocument({
    ...neutralizeSchoolDerivedReferences(node),
    sources: [],
  }));
}

function persistedRelationship(relationship: KnowledgeRelationship) {
  return parseKnowledgeRelationship(sanitizeFirestoreDocument({
    ...relationship,
    sources: [],
  }));
}

function persistedSource(source: KnowledgeSource) {
  return parseKnowledgeSource(sanitizeFirestoreDocument(source));
}

export function createInMemoryKnowledgeGraphRepository(
  store: KnowledgeGraphStore = createVolatileKnowledgeGraphStore(),
  options: InMemoryKnowledgeGraphRepositoryOptions = {},
): KnowledgeGraphRepository {
  const clock = options.now || (() => new Date().toISOString());

  function now() {
    const value = clock();
    const normalized = normalizeKnowledgeTimestamp(value);
    if (!normalized) {
      throw new KnowledgeValidationError("The repository clock must return a valid timestamp.");
    }
    return normalized;
  }

  function rawSources() {
    return store.readSources().map(migrateLegacyKnowledgeSourceRead);
  }

  function rawNodes() {
    return store.readNodes().map(migrateLegacyKnowledgeNodeRead);
  }

  function rawRelationships() {
    return store.readRelationships().map(migrateLegacyKnowledgeRelationshipRead);
  }

  function rawAuditEvents() {
    return store.readAuditEvents().map(migrateLegacyKnowledgeAuditEventRead);
  }

  function stageAudits(newEvents: readonly KnowledgeAuditEvent[]) {
    const parsedEvents = newEvents.map(parseKnowledgeAuditEvent);
    const existingEvents = rawAuditEvents();
    const newEventIds = new Set<string>();
    for (const event of parsedEvents) {
      if (newEventIds.has(event.id) || existingEvents.some((candidate) => candidate.id === event.id)) {
        throw new Error(`Knowledge audit event already exists: ${event.id}`);
      }
      newEventIds.add(event.id);
    }
    return {
      newEvents: parsedEvents,
      auditEvents: [...parsedEvents, ...existingEvents],
    };
  }

  async function commitMutation(input: {
    nodes?: readonly KnowledgeNode[];
    relationships?: readonly KnowledgeRelationship[];
    sources?: readonly KnowledgeSource[];
    audits: readonly KnowledgeAuditEvent[];
  }) {
    const nextState: KnowledgeGraphStoreState = {
      nodes: input.nodes ? input.nodes.map(persistedNode) : store.readNodes(),
      relationships: input.relationships
        ? input.relationships.map(persistedRelationship)
        : store.readRelationships(),
      sources: input.sources ? input.sources.map(persistedSource) : store.readSources(),
      auditEvents: [],
    };
    const stagedAudits = stageAudits(input.audits);
    nextState.auditEvents = stagedAudits.auditEvents;
    if (options.beforeAuditWrite) {
      for (const event of stagedAudits.newEvents) await options.beforeAuditWrite(event);
    }
    store.replaceState(nextState);
  }

  function sourceById() {
    return new Map(rawSources().map((source) => [source.id, source]));
  }

  function assertSourcesExist(workspaceId: string, sourceIds: readonly string[]) {
    const sources = sourceById();
    for (const sourceId of sourceIds) {
      const source = sources.get(sourceId);
      if (!source || source.workspaceId !== workspaceId || source.status !== KnowledgeStatus.Active) {
        throw new KnowledgeValidationError(`Knowledge source is unavailable: ${sourceId}`);
      }
    }
  }

  function hydrateRelationship(relationship: KnowledgeRelationship) {
    return parseKnowledgeRelationship({
      ...relationship,
      sources: deriveCanonicalSourceReferences(relationship.sourceIds, rawSources()),
    });
  }

  function hydrateSchoolReferences(
    node: KnowledgeNode,
    nodes: readonly KnowledgeNode[],
    relationships: readonly KnowledgeRelationship[],
  ): KnowledgeNode {
    if (!isSchoolKnowledgeNode(node)) return node;
    const nodeById = new Map(nodes.map((candidate) => [candidate.id, candidate]));
    const activeRelationships = relationships.filter((relationship) => (
      relationship.workspaceId === node.workspaceId
      && relationship.status === KnowledgeStatus.Active
      && (relationship.fromNodeId === node.id || relationship.toNodeId === node.id)
    ));
    const conferences = new Map<string, KnowledgeNodeReference>();
    const coaches = new Map<string, KnowledgeNodeReference>();
    const facilities = new Map<string, KnowledgeNodeReference>();
    const projectIds = new Set<string>();
    const contentIds = new Set<string>();

    for (const relationship of activeRelationships) {
      const fromNode = nodeById.get(relationship.fromNodeId);
      const toNode = nodeById.get(relationship.toNodeId);
      if (!fromNode || !toNode) continue;
      try {
        validateRelationshipEndpoints(fromNode, toNode, relationship.relationshipType, relationship.workspaceId);
      } catch {
        continue;
      }
      const connectedNode = fromNode.id === node.id ? toNode : fromNode;
      if (
        relationship.relationshipType === KnowledgeRelationshipType.SchoolBelongsToConference
        || relationship.relationshipType === KnowledgeRelationshipType.ConferenceGovernsSchool
      ) conferences.set(connectedNode.id, nodeReference(connectedNode));
      if (
        relationship.relationshipType === KnowledgeRelationshipType.SchoolHasCoach
        || relationship.relationshipType === KnowledgeRelationshipType.CoachWorksAtSchool
      ) coaches.set(connectedNode.id, nodeReference(connectedNode));
      if (
        relationship.relationshipType === KnowledgeRelationshipType.SchoolHasFacility
        || relationship.relationshipType === KnowledgeRelationshipType.FacilityBelongsToSchool
      ) facilities.set(connectedNode.id, nodeReference(connectedNode));
      if (relationship.relationshipType === KnowledgeRelationshipType.ProjectAboutSchool && isProjectKnowledgeNode(connectedNode)) {
        projectIds.add(connectedNode.projectId);
      }
      if (relationship.relationshipType === KnowledgeRelationshipType.ContentAboutSchool && isContentKnowledgeNode(connectedNode)) {
        contentIds.add(connectedNode.contentId);
      }
    }

    return {
      ...node,
      conference: [...conferences.values()].sort((first, second) => first.name.localeCompare(second.name))[0] || null,
      coaches: [...coaches.values()].sort((first, second) => first.name.localeCompare(second.name)),
      facilities: [...facilities.values()].sort((first, second) => first.name.localeCompare(second.name)),
      connectedProjectIds: [...projectIds].sort(),
      connectedContentIds: [...contentIds].sort(),
    };
  }

  function hydratedNodes() {
    const nodes = rawNodes();
    const relationships = rawRelationships();
    const sources = rawSources();
    return nodes.map((node) => parseKnowledgeNode({
      ...hydrateSchoolReferences(node, nodes, relationships),
      sources: deriveCanonicalSourceReferences(node.sourceIds, sources),
    }));
  }

  function assertSchoolRegionalNodes(node: KnowledgeNode) {
    if (!isSchoolKnowledgeNode(node)) return;
    const nodes = rawNodes();
    validateSchoolRegionalReferences(
      node,
      nodes.find((candidate) => candidate.id === node.stateNodeId) || null,
      nodes.find((candidate) => candidate.id === node.regionNodeId) || null,
    );
  }

  function historicalNodeClaimKeys(node: KnowledgeNode) {
    const keys = new Set(node.canonicalNameKeys);
    for (const version of node.versionHistory) {
      for (const key of nodeCanonicalClaimKeys({
        workspaceId: node.workspaceId,
        type: node.type,
        name: version.name,
        aliases: [...version.aliases],
      } as KnowledgeNode)) keys.add(key);
    }
    return keys;
  }

  function assertNodeIdentityAvailable(candidate: KnowledgeNode, currentNodeId?: string) {
    const candidateKeys = new Set(candidate.canonicalNameKeys);
    const candidateName = normalizeCanonicalKnowledgeName(candidate.name);
    for (const existing of rawNodes()) {
      if (existing.id === currentNodeId) continue;
      const collides = [...historicalNodeClaimKeys(existing)].some((key) => candidateKeys.has(key));
      if (!collides && existing.id !== candidate.id) continue;
      const sameCanonicalName = normalizeCanonicalKnowledgeName(existing.name) === candidateName;
      if (
        sameCanonicalName
        && existing.workspaceId === candidate.workspaceId
        && existing.type === candidate.type
        && existing.status === KnowledgeStatus.Active
      ) return existing;
      throw new KnowledgeValidationError(
        existing.status === KnowledgeStatus.Archived
          ? `Historical knowledge identity remains reserved by archived node ${existing.id}.`
          : `Canonical knowledge identity is already reserved by node ${existing.id}.`,
      );
    }
    return null;
  }

  function activeRelationshipBlockers(nodeId: string) {
    return rawRelationships().filter((relationship) => (
      relationship.status === KnowledgeStatus.Active
      && (relationship.fromNodeId === nodeId || relationship.toNodeId === nodeId)
    ));
  }

  function activeSourceClaimBlockers(sourceId: string) {
    const nodeIds = rawNodes().filter((node) => node.status === KnowledgeStatus.Active && node.sourceIds.includes(sourceId)).map((node) => node.id);
    const relationshipIds = rawRelationships()
      .filter((relationship) => relationship.status === KnowledgeStatus.Active && relationship.sourceIds.includes(sourceId))
      .map((relationship) => relationship.id);
    return { nodeIds, relationshipIds };
  }

  function createAudit(input: {
    workspaceId: string;
    subjectType: KnowledgeAuditEvent["subjectType"];
    subjectId: string;
    eventType: KnowledgeAuditEventType;
    actorId: string;
    occurredAt: string;
    summary: string;
    version: number;
    metadata?: KnowledgeAuditEvent["metadata"];
  }) {
    return createKnowledgeAuditEvent({
      workspaceId: input.workspaceId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      eventType: input.eventType,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: input.summary,
      version: input.version,
      metadata: input.metadata,
    });
  }

  return {
    async listNodes(workspaceId) {
      return hydratedNodes().filter((node) => node.workspaceId === workspaceId)
        .sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
    },

    async getNodeById(nodeId) {
      return hydratedNodes().find((node) => node.id === nodeId) || null;
    },

    async createNode(input: KnowledgeNodeCreateInput, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = now();
      const reason = mutation.reason || `Created knowledge node ${input.name}.`;
      const auditVersion = 1;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: input.workspaceId,
        subjectType: "node",
        subjectId: input.id,
        eventType: KnowledgeAuditEventType.Created,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version: auditVersion,
      });
      let candidate = neutralizeSchoolDerivedReferences({
        ...input,
        sources: [],
        createdAt: changedAt,
        updatedAt: changedAt,
        createdBy: mutation.actorId,
        updatedBy: mutation.actorId,
        status: KnowledgeStatus.Active,
        version: 1,
        versionHistory: [],
        confidenceHistory: initialConfidenceHistory(input.confidence, changedAt, mutation.actorId, input.sourceIds, reason),
        statusHistory: initialStatusHistory(KnowledgeStatus.Active, changedAt, mutation.actorId, reason),
        canonicalNameKeys: nodeCanonicalClaimKeys(input as KnowledgeNode),
        lastAuditEventId: auditSeed.id,
      } as KnowledgeNode);
      candidate = { ...candidate, versionHistory: [nodeVersion(candidate, changedAt, mutation.actorId, reason)] } as KnowledgeNode;
      candidate = persistedNode(candidate);
      assertSourcesExist(candidate.workspaceId, candidate.sourceIds);
      assertSchoolRegionalNodes(candidate);
      const existing = assertNodeIdentityAvailable(candidate);
      if (existing) return (await this.getNodeById(existing.id)) as KnowledgeNode;

      const audit = createAudit({
        workspaceId: candidate.workspaceId,
        subjectType: "node",
        subjectId: candidate.id,
        eventType: KnowledgeAuditEventType.Created,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version: auditVersion,
      });
      await commitMutation({ nodes: [candidate, ...rawNodes()], audits: [audit] });
      return (await this.getNodeById(candidate.id)) as KnowledgeNode;
    },

    async updateNode(nodeId: string, update: KnowledgeNodeUpdate, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const current = rawNodes().find((node) => node.id === nodeId);
      if (!current) throw new KnowledgeValidationError(`Knowledge node not found: ${nodeId}`);
      if (current.status !== KnowledgeStatus.Active) throw new KnowledgeValidationError("Archived knowledge nodes cannot be edited.");
      const changedAt = now();
      const version = current.version + 1;
      const reason = mutation.reason || `Updated knowledge node ${current.name}.`;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: current.workspaceId,
        subjectType: "node",
        subjectId: current.id,
        eventType: update.confidence && update.confidence !== current.confidence
          ? KnowledgeAuditEventType.ConfidenceChanged
          : KnowledgeAuditEventType.Updated,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      let candidate = neutralizeSchoolDerivedReferences({
        ...current,
        ...update,
        id: current.id,
        workspaceId: current.workspaceId,
        type: current.type,
        category: current.category,
        sources: [],
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        updatedAt: changedAt,
        updatedBy: mutation.actorId,
        status: current.status,
        version,
        canonicalNameKeys: nodeCanonicalClaimKeys({ ...current, ...update } as KnowledgeNode),
        lastAuditEventId: auditSeed.id,
      } as KnowledgeNode);
      const confidenceHistory: readonly KnowledgeConfidenceChange[] = candidate.confidence === current.confidence
        ? current.confidenceHistory
        : [...current.confidenceHistory, {
            from: current.confidence,
            to: candidate.confidence,
            changedAt,
            changedBy: mutation.actorId,
            reason,
            sourceIds: [...candidate.sourceIds],
            version,
          }];
      candidate = {
        ...candidate,
        confidenceHistory,
        statusHistory: current.statusHistory,
        versionHistory: [
          ...current.versionHistory,
          nodeVersion(candidate, changedAt, mutation.actorId, reason),
        ],
      } as KnowledgeNode;
      candidate = persistedNode(candidate);
      assertSourcesExist(candidate.workspaceId, candidate.sourceIds);
      assertSchoolRegionalNodes(candidate);
      const identityOwner = assertNodeIdentityAvailable(candidate, current.id);
      if (identityOwner) {
        throw new KnowledgeValidationError(
          `Canonical knowledge identity is already reserved by node ${identityOwner.id}.`,
        );
      }

      const eventType = candidate.confidence === current.confidence
        ? KnowledgeAuditEventType.Updated
        : KnowledgeAuditEventType.ConfidenceChanged;
      const audit = createAudit({
        workspaceId: candidate.workspaceId,
        subjectType: "node",
        subjectId: candidate.id,
        eventType,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      await commitMutation({ nodes: replaceById(rawNodes(), candidate), audits: [audit] });
      return (await this.getNodeById(candidate.id)) as KnowledgeNode;
    },

    async archiveNode(nodeId: string, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const current = rawNodes().find((node) => node.id === nodeId);
      if (!current) throw new KnowledgeValidationError(`Knowledge node not found: ${nodeId}`);
      if (current.status === KnowledgeStatus.Archived) return (await this.getNodeById(nodeId)) as KnowledgeNode;
      const blockers = activeRelationshipBlockers(nodeId);
      if (blockers.length > 0) {
        throw new KnowledgeValidationError(
          `Archive the active relationships first: ${blockers.map((relationship) => relationship.id).sort().join(", ")}.`,
        );
      }
      const changedAt = now();
      const version = current.version + 1;
      const reason = mutation.reason || `Archived knowledge node ${current.name}.`;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: current.workspaceId,
        subjectType: "node",
        subjectId: current.id,
        eventType: KnowledgeAuditEventType.Archived,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      let archived = {
        ...current,
        sources: [],
        status: KnowledgeStatus.Archived,
        updatedAt: changedAt,
        updatedBy: mutation.actorId,
        version,
        statusHistory: [...current.statusHistory, {
          from: KnowledgeStatus.Active,
          to: KnowledgeStatus.Archived,
          changedAt,
          changedBy: mutation.actorId,
          reason,
          version,
        } satisfies KnowledgeStatusChange],
        lastAuditEventId: auditSeed.id,
      } as KnowledgeNode;
      archived = {
        ...archived,
        versionHistory: [...current.versionHistory, nodeVersion(archived, changedAt, mutation.actorId, reason)],
      } as KnowledgeNode;
      archived = persistedNode(archived);
      const audit = createAudit({
        workspaceId: archived.workspaceId,
        subjectType: "node",
        subjectId: archived.id,
        eventType: KnowledgeAuditEventType.Archived,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      await commitMutation({ nodes: replaceById(rawNodes(), archived), audits: [audit] });
      return (await this.getNodeById(archived.id)) as KnowledgeNode;
    },

    async listRelationships(workspaceId) {
      return rawRelationships().filter((relationship) => relationship.workspaceId === workspaceId)
        .map(hydrateRelationship)
        .sort((first, second) => first.relationshipType.localeCompare(second.relationshipType) || first.id.localeCompare(second.id));
    },

    async getRelationshipById(relationshipId) {
      const relationship = rawRelationships().find((candidate) => candidate.id === relationshipId);
      return relationship ? hydrateRelationship(relationship) : null;
    },

    async createRelationship(input: KnowledgeRelationshipCreateInput, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const changedAt = now();
      const identityKey = relationshipIdentity(input as KnowledgeRelationship);
      const exclusiveClaimKey = exclusiveKnowledgeRelationshipClaimKey(input as KnowledgeRelationship) || undefined;
      const reason = mutation.reason || `Created knowledge relationship ${input.relationshipType}.`;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: input.workspaceId,
        subjectType: "relationship",
        subjectId: input.id,
        eventType: KnowledgeAuditEventType.Created,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version: 1,
      });
      let candidate = {
        ...input,
        sources: [],
        confidenceHistory: initialConfidenceHistory(input.confidence, changedAt, mutation.actorId, input.sourceIds, reason),
        versionHistory: [],
        statusHistory: initialStatusHistory(KnowledgeStatus.Active, changedAt, mutation.actorId, reason),
        createdAt: changedAt,
        updatedAt: changedAt,
        createdBy: mutation.actorId,
        updatedBy: mutation.actorId,
        status: KnowledgeStatus.Active,
        version: 1,
        identityKey,
        ...(exclusiveClaimKey ? { exclusiveClaimKey } : {}),
        lastAuditEventId: auditSeed.id,
      } as KnowledgeRelationship;
      candidate = {
        ...candidate,
        versionHistory: [relationshipVersion(candidate, changedAt, mutation.actorId, reason)],
      };
      candidate = persistedRelationship(candidate);
      assertSourcesExist(candidate.workspaceId, candidate.sourceIds);
      const nodes = rawNodes();
      const fromNode = nodes.find((node) => node.id === candidate.fromNodeId);
      const toNode = nodes.find((node) => node.id === candidate.toNodeId);
      if (!fromNode || !toNode) throw new KnowledgeValidationError("Knowledge relationships require two existing nodes.");
      validateKnowledgeRelationship(candidate, fromNode, toNode);

      const existingRelationships = rawRelationships();
      for (const existing of existingRelationships) {
        if (existing.identityKey !== identityKey && existing.id !== candidate.id) continue;
        if (existing.identityKey === identityKey && existing.status === KnowledgeStatus.Active) {
          return hydrateRelationship(existing);
        }
        throw new KnowledgeValidationError(
          existing.status === KnowledgeStatus.Archived
            ? `Historical relationship identity remains reserved by ${existing.id}.`
            : `Knowledge relationship identity is already reserved by ${existing.id}.`,
        );
      }
      const conflicts = exclusiveClaimKey
        ? existingRelationships.filter((relationship) => (
          relationship.status === KnowledgeStatus.Active
          && relationship.exclusiveClaimKey === exclusiveClaimKey
          && relationship.identityKey !== identityKey
        ))
        : [];
      if (conflicts.length > 0) {
        const peersRequiringConflict = conflicts.filter(
          (relationship) => relationship.confidence !== KnowledgeConfidence.Conflicting,
        );
        if (peersRequiringConflict.length > 1) {
          throw new KnowledgeValidationError(
            "Multiple unresolved exclusive relationships already exist. Reconcile the legacy relationship records before adding another claim.",
          );
        }
        const conflictReason = mutation.reason
          || `Conflicting active claims detected for ${candidate.relationshipType}.`;
        const candidateAuditSeed = createKnowledgeAuditEvent({
          workspaceId: candidate.workspaceId,
          subjectType: "relationship",
          subjectId: candidate.id,
          eventType: KnowledgeAuditEventType.ConflictDetected,
          actorId: mutation.actorId,
          occurredAt: changedAt,
          summary: conflictReason,
          version: 1,
        });
        candidate = {
          ...candidate,
          confidence: KnowledgeConfidence.Conflicting,
          confidenceHistory: initialConfidenceHistory(
            KnowledgeConfidence.Conflicting,
            changedAt,
            mutation.actorId,
            candidate.sourceIds,
            conflictReason,
          ),
          versionHistory: [],
          lastAuditEventId: candidateAuditSeed.id,
        };
        candidate = {
          ...candidate,
          versionHistory: [relationshipVersion(candidate, changedAt, mutation.actorId, conflictReason)],
        };
        candidate = persistedRelationship(candidate);
        validateKnowledgeRelationship(candidate, fromNode, toNode);

        const updatedConflicts = peersRequiringConflict.map((current) => {
          const version = current.version + 1;
          const existingReason = mutation.reason
            || `Conflict detected with relationship ${candidate.id}.`;
          const conflictAuditSeed = createKnowledgeAuditEvent({
            workspaceId: current.workspaceId,
            subjectType: "relationship",
            subjectId: current.id,
            eventType: KnowledgeAuditEventType.ConflictDetected,
            actorId: mutation.actorId,
            occurredAt: changedAt,
            summary: existingReason,
            version,
          });
          const confidenceHistory: readonly KnowledgeConfidenceChange[] = current.confidence === KnowledgeConfidence.Conflicting
            ? current.confidenceHistory
            : [...current.confidenceHistory, {
                from: current.confidence,
                to: KnowledgeConfidence.Conflicting,
                changedAt,
                changedBy: mutation.actorId,
                reason: existingReason,
                sourceIds: current.sourceIds,
                version,
              }];
          let conflictingRelationship = {
            ...current,
            sources: [],
            confidence: KnowledgeConfidence.Conflicting,
            confidenceHistory,
            updatedAt: changedAt,
            updatedBy: mutation.actorId,
            version,
            versionHistory: current.versionHistory,
            lastAuditEventId: conflictAuditSeed.id,
          } as KnowledgeRelationship;
          conflictingRelationship = {
            ...conflictingRelationship,
            versionHistory: [
              ...current.versionHistory,
              relationshipVersion(conflictingRelationship, changedAt, mutation.actorId, existingReason),
            ],
          };
          conflictingRelationship = persistedRelationship(conflictingRelationship);
          const conflictFromNode = nodes.find((node) => node.id === conflictingRelationship.fromNodeId);
          const conflictToNode = nodes.find((node) => node.id === conflictingRelationship.toNodeId);
          if (!conflictFromNode || !conflictToNode) {
            throw new KnowledgeValidationError("Knowledge relationships require two existing nodes.");
          }
          validateKnowledgeRelationship(conflictingRelationship, conflictFromNode, conflictToNode);
          return conflictingRelationship;
        });
        const updatedConflictIds = new Set(updatedConflicts.map((relationship) => relationship.id));
        const audits = [
          createAudit({
            workspaceId: candidate.workspaceId,
            subjectType: "relationship",
            subjectId: candidate.id,
            eventType: KnowledgeAuditEventType.ConflictDetected,
            actorId: mutation.actorId,
            occurredAt: changedAt,
            summary: conflictReason,
            version: 1,
          }),
          ...updatedConflicts.map((relationship) => createAudit({
            workspaceId: relationship.workspaceId,
            subjectType: "relationship",
            subjectId: relationship.id,
            eventType: KnowledgeAuditEventType.ConflictDetected,
            actorId: mutation.actorId,
            occurredAt: changedAt,
            summary: mutation.reason || `Conflict detected with relationship ${candidate.id}.`,
            version: relationship.version,
          })),
        ];
        await commitMutation({
          relationships: [
            candidate,
            ...updatedConflicts,
            ...existingRelationships.filter((relationship) => !updatedConflictIds.has(relationship.id)),
          ],
          audits,
        });
        return hydrateRelationship(candidate);
      }

      const audit = createAudit({
        workspaceId: candidate.workspaceId,
        subjectType: "relationship",
        subjectId: candidate.id,
        eventType: KnowledgeAuditEventType.Created,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version: 1,
      });
      await commitMutation({ relationships: [candidate, ...existingRelationships], audits: [audit] });
      return hydrateRelationship(candidate);
    },

    async updateRelationship(
      relationshipId: string,
      update: KnowledgeRelationshipUpdate,
      context: KnowledgeMutationContext,
    ) {
      const mutation = requireMutationContext(context);
      const current = rawRelationships().find((relationship) => relationship.id === relationshipId);
      if (!current) throw new KnowledgeValidationError(`Knowledge relationship not found: ${relationshipId}`);
      if (current.status !== KnowledgeStatus.Active) throw new KnowledgeValidationError("Archived knowledge relationships cannot be edited.");
      const changedAt = now();
      const version = current.version + 1;
      const reason = mutation.reason || `Updated knowledge relationship ${current.relationshipType}.`;
      const nextConfidence = update.confidence || current.confidence;
      if (current.exclusiveClaimKey) {
        const conflict = rawRelationships().find((relationship) => (
          relationship.id !== current.id
          && relationship.status === KnowledgeStatus.Active
          && relationship.exclusiveClaimKey === current.exclusiveClaimKey
          && relationship.identityKey !== current.identityKey
        ));
        if (conflict && nextConfidence !== KnowledgeConfidence.Conflicting) {
          throw new KnowledgeValidationError(
            nextConfidence === KnowledgeConfidence.Verified
              ? `Resolve the conflicting relationship ${conflict.id} before marking this relationship Verified.`
              : `Resolve the conflicting relationship ${conflict.id} before changing this relationship from Conflicting.`,
          );
        }
      }
      const eventType = nextConfidence === current.confidence
        ? KnowledgeAuditEventType.Updated
        : KnowledgeAuditEventType.ConfidenceChanged;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: current.workspaceId,
        subjectType: "relationship",
        subjectId: current.id,
        eventType,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      const confidenceHistory: readonly KnowledgeConfidenceChange[] = nextConfidence === current.confidence
        ? current.confidenceHistory
        : [...current.confidenceHistory, {
            from: current.confidence,
            to: nextConfidence,
            changedAt,
            changedBy: mutation.actorId,
            reason,
            sourceIds: [...(update.sourceIds || current.sourceIds)],
            version,
          }];
      let candidate = {
        ...current,
        ...update,
        id: current.id,
        workspaceId: current.workspaceId,
        fromNodeId: current.fromNodeId,
        toNodeId: current.toNodeId,
        relationshipType: current.relationshipType,
        sources: [],
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        updatedAt: changedAt,
        updatedBy: mutation.actorId,
        status: current.status,
        version,
        confidence: nextConfidence,
        confidenceHistory,
        versionHistory: current.versionHistory,
        statusHistory: current.statusHistory,
        identityKey: current.identityKey,
        exclusiveClaimKey: current.exclusiveClaimKey,
        lastAuditEventId: auditSeed.id,
      } as KnowledgeRelationship;
      candidate = {
        ...candidate,
        versionHistory: [
          ...current.versionHistory,
          relationshipVersion(candidate, changedAt, mutation.actorId, reason),
        ],
      };
      candidate = persistedRelationship(candidate);
      assertSourcesExist(candidate.workspaceId, candidate.sourceIds);
      const nodes = rawNodes();
      const fromNode = nodes.find((node) => node.id === candidate.fromNodeId);
      const toNode = nodes.find((node) => node.id === candidate.toNodeId);
      if (!fromNode || !toNode) throw new KnowledgeValidationError("Knowledge relationships require two existing nodes.");
      validateKnowledgeRelationship(candidate, fromNode, toNode);
      const audit = createAudit({
        workspaceId: candidate.workspaceId,
        subjectType: "relationship",
        subjectId: candidate.id,
        eventType,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      await commitMutation({ relationships: replaceById(rawRelationships(), candidate), audits: [audit] });
      return hydrateRelationship(candidate);
    },

    async archiveRelationship(relationshipId: string, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const current = rawRelationships().find((relationship) => relationship.id === relationshipId);
      if (!current) throw new KnowledgeValidationError(`Knowledge relationship not found: ${relationshipId}`);
      if (current.status === KnowledgeStatus.Archived) return hydrateRelationship(current);
      const changedAt = now();
      const version = current.version + 1;
      const reason = mutation.reason || `Archived knowledge relationship ${current.relationshipType}.`;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: current.workspaceId,
        subjectType: "relationship",
        subjectId: current.id,
        eventType: KnowledgeAuditEventType.Archived,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      let archived = {
        ...current,
        sources: [],
        status: KnowledgeStatus.Archived,
        updatedAt: changedAt,
        updatedBy: mutation.actorId,
        version,
        statusHistory: [...current.statusHistory, {
          from: KnowledgeStatus.Active,
          to: KnowledgeStatus.Archived,
          changedAt,
          changedBy: mutation.actorId,
          reason,
          version,
        } satisfies KnowledgeStatusChange],
        lastAuditEventId: auditSeed.id,
      } as KnowledgeRelationship;
      archived = {
        ...archived,
        versionHistory: [
          ...current.versionHistory,
          relationshipVersion(archived, changedAt, mutation.actorId, reason),
        ],
      };
      archived = persistedRelationship(archived);
      const audit = createAudit({
        workspaceId: archived.workspaceId,
        subjectType: "relationship",
        subjectId: archived.id,
        eventType: KnowledgeAuditEventType.Archived,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      await commitMutation({ relationships: replaceById(rawRelationships(), archived), audits: [audit] });
      return hydrateRelationship(archived);
    },

    async listSources(workspaceId) {
      return rawSources().filter((source) => source.workspaceId === workspaceId)
        .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id))
        .map(clone);
    },

    async getSourceById(sourceId) {
      const source = rawSources().find((candidate) => candidate.id === sourceId);
      return source ? clone(source) : null;
    },

    async createSource(input: KnowledgeSourceCreateInput, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const existing = rawSources().find((source) => source.id === input.id);
      if (existing) {
        if (existing.status === KnowledgeStatus.Active && existing.workspaceId === input.workspaceId) return clone(existing);
        throw new KnowledgeValidationError(`Historical knowledge source identity remains reserved by ${existing.id}.`);
      }
      const changedAt = now();
      const version = 1;
      const reason = mutation.reason || `Created knowledge source ${input.title}.`;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: input.workspaceId,
        subjectType: "source",
        subjectId: input.id,
        eventType: KnowledgeAuditEventType.Created,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      let candidate = {
        ...input,
        createdAt: changedAt,
        updatedAt: changedAt,
        createdBy: mutation.actorId,
        updatedBy: mutation.actorId,
        status: KnowledgeStatus.Active,
        version: 1,
        versionHistory: [],
        statusHistory: initialStatusHistory(KnowledgeStatus.Active, changedAt, mutation.actorId, reason),
        lastAuditEventId: auditSeed.id,
      } as KnowledgeSource;
      candidate = {
        ...candidate,
        versionHistory: [sourceVersion(candidate, changedAt, mutation.actorId, reason)],
      };
      candidate = persistedSource(candidate);
      const audit = createAudit({
        workspaceId: candidate.workspaceId,
        subjectType: "source",
        subjectId: candidate.id,
        eventType: KnowledgeAuditEventType.Created,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      await commitMutation({ sources: [candidate, ...rawSources()], audits: [audit] });
      return clone(candidate);
    },

    async updateSource(sourceId: string, update: KnowledgeSourceUpdate, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const current = rawSources().find((source) => source.id === sourceId);
      if (!current) throw new KnowledgeValidationError(`Knowledge source not found: ${sourceId}`);
      if (current.status === KnowledgeStatus.Archived) throw new KnowledgeValidationError("Archived knowledge sources cannot be edited.");
      const changedAt = now();
      const version = current.version + 1;
      const reason = mutation.reason || `Updated knowledge source ${current.title}.`;
      const eventType = KnowledgeAuditEventType.Updated;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: current.workspaceId,
        subjectType: "source",
        subjectId: current.id,
        eventType,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      let candidate = {
        ...current,
        ...update,
        id: current.id,
        workspaceId: current.workspaceId,
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        updatedAt: changedAt,
        updatedBy: mutation.actorId,
        status: current.status,
        version,
        versionHistory: current.versionHistory,
        statusHistory: current.statusHistory,
        lastAuditEventId: auditSeed.id,
      } as KnowledgeSource;
      candidate = {
        ...candidate,
        versionHistory: [
          ...current.versionHistory,
          sourceVersion(candidate, changedAt, mutation.actorId, reason),
        ],
      };
      candidate = persistedSource(candidate);
      const audit = createAudit({
        workspaceId: candidate.workspaceId,
        subjectType: "source",
        subjectId: candidate.id,
        eventType,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      await commitMutation({ sources: replaceById(rawSources(), candidate), audits: [audit] });
      return clone(candidate);
    },

    async archiveSource(sourceId: string, context: KnowledgeMutationContext) {
      const mutation = requireMutationContext(context);
      const current = rawSources().find((source) => source.id === sourceId);
      if (!current) throw new KnowledgeValidationError(`Knowledge source not found: ${sourceId}`);
      if (current.status === KnowledgeStatus.Archived) return clone(current);
      const blockers = activeSourceClaimBlockers(sourceId);
      if (blockers.nodeIds.length > 0 || blockers.relationshipIds.length > 0) {
        throw new KnowledgeValidationError([
          "Archive the active knowledge claims that use this source first.",
          blockers.nodeIds.length > 0 ? ` Nodes: ${blockers.nodeIds.sort().join(", ")}.` : "",
          blockers.relationshipIds.length > 0 ? ` Relationships: ${blockers.relationshipIds.sort().join(", ")}.` : "",
        ].join(""));
      }
      const changedAt = now();
      const version = current.version + 1;
      const reason = mutation.reason || `Archived knowledge source ${current.title}.`;
      const auditSeed = createKnowledgeAuditEvent({
        workspaceId: current.workspaceId,
        subjectType: "source",
        subjectId: current.id,
        eventType: KnowledgeAuditEventType.Archived,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      let archived = {
        ...current,
        status: KnowledgeStatus.Archived,
        updatedAt: changedAt,
        updatedBy: mutation.actorId,
        version,
        versionHistory: current.versionHistory,
        statusHistory: [...current.statusHistory, {
          from: KnowledgeStatus.Active,
          to: KnowledgeStatus.Archived,
          changedAt,
          changedBy: mutation.actorId,
          reason,
          version,
        } satisfies KnowledgeStatusChange],
        lastAuditEventId: auditSeed.id,
      } as KnowledgeSource;
      archived = {
        ...archived,
        versionHistory: [
          ...current.versionHistory,
          sourceVersion(archived, changedAt, mutation.actorId, reason),
        ],
      };
      archived = persistedSource(archived);
      const audit = createAudit({
        workspaceId: archived.workspaceId,
        subjectType: "source",
        subjectId: archived.id,
        eventType: KnowledgeAuditEventType.Archived,
        actorId: mutation.actorId,
        occurredAt: changedAt,
        summary: reason,
        version,
      });
      await commitMutation({ sources: replaceById(rawSources(), archived), audits: [audit] });
      return clone(archived);
    },

    async listAuditEvents(workspaceId) {
      return rawAuditEvents().filter((event) => event.workspaceId === workspaceId)
        .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt) || first.id.localeCompare(second.id))
        .map(clone);
    },
  };
}
