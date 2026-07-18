import {
  hoopFrensRegionForState,
  hoopFrensRegionFromName,
  KnowledgeRegion,
  normalizeUSStateCode,
} from "../shared";
import {
  canonicalKnowledgeAliasClaimKey,
  canonicalKnowledgeNodeClaimKey,
  exclusiveKnowledgeRelationshipClaimKey,
  knowledgeRelationshipPolicy,
  relationshipIdentity,
  validateRelationshipEndpoints,
} from "./relationshipPolicy";
import { isStrictKnowledgeTimestamp, normalizeKnowledgeTimestamp } from "./dateTime";
import {
  isSchoolKnowledgeNode,
  KnowledgeAuditEventType,
  KnowledgeCategory,
  KnowledgeConfidence,
  type KnowledgeAuditEvent,
  type KnowledgeNode,
  KnowledgeNodeType,
  type KnowledgeRelationship,
  KnowledgeRelationshipType,
  KnowledgeSourceReliability,
  KnowledgeStatus,
  type SchoolKnowledgeNode,
  type KnowledgeSource,
  type KnowledgeSourceReference,
} from "./types";

export class KnowledgeValidationError extends Error {
  constructor(message: string) { super(message); this.name = "KnowledgeValidationError"; }
}

export const exclusiveKnowledgeRelationshipTypes = new Set(
  Object.entries(knowledgeRelationshipPolicy)
    .filter(([, policy]) => policy.exclusive)
    .map(([type]) => type as KnowledgeRelationshipType),
);

function unique(values: readonly string[]) { return Array.from(new Set(values)); }
function required(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new KnowledgeValidationError(`${label} is required.`);
}
function identifier(value: unknown, label: string): asserts value is string {
  required(value, label);
  if (value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new KnowledgeValidationError(`${label} must use only letters, numbers, periods, underscores, or hyphens.`);
  }
}
function date(value: unknown, label: string) {
  required(value, label);
  if (!isStrictKnowledgeTimestamp(value)) {
    throw new KnowledgeValidationError(`${label} must be a valid ISO timestamp.`);
  }
}
function array(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new KnowledgeValidationError(`${label} must be a list.`);
}
function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): asserts value is T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new KnowledgeValidationError(`${label} is invalid.`);
}
function record(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new KnowledgeValidationError(`${label} is malformed.`);
}

function exactKeys(value: Record<string, unknown>, allowedKeys: readonly string[], label: string) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new KnowledgeValidationError(`${label} contains unsupported field${unexpected.length === 1 ? "" : "s"}: ${unexpected.join(", ")}.`);
  }
}

const statusChangeKeys = ["from", "to", "changedAt", "changedBy", "reason", "version"] as const;
const confidenceChangeKeys = [...statusChangeKeys, "sourceIds"] as const;
const sourceReferenceKeys = ["sourceId", "title", "publisher", "reliability", "status"] as const;
const nodeReferenceKeys = ["nodeId", "name", "type"] as const;
const schoolDataKeys = [
  "officialName", "nickname", "city", "state", "stateNodeId", "region", "regionNodeId", "conference",
  "division", "governingBody", "schoolWebsite", "athleticsWebsite", "enrollment", "tuition", "publicOrPrivate",
  "facilities", "coaches", "recruitingNotes", "connectedProjectIds", "connectedContentIds", "lastVerifiedAt",
] as const;
const nodeVersionKeys = [
  "version", "changedAt", "changedBy", "reason", "name", "description", "confidence", "status", "sourceIds",
  "aliases", "tags", "schoolData",
] as const;
const relationshipVersionKeys = [
  "version", "changedAt", "changedBy", "reason", "description", "confidence", "status", "sourceIds", "projectIds",
] as const;
const sourceVersionKeys = [
  "version", "changedAt", "changedBy", "reason", "title", "url", "publisher", "sourceType", "accessedAt",
  "publishedAt", "reliability", "notes", "projectIds", "status",
] as const;
const nodeBaseKeys = [
  "id", "workspaceId", "type", "category", "name", "description", "confidence", "sourceIds", "sources", "aliases",
  "tags", "createdAt", "updatedAt", "createdBy", "updatedBy", "status", "version", "versionHistory",
  "confidenceHistory", "statusHistory", "canonicalNameKeys", "lastAuditEventId",
] as const;
const relationshipKeys = [
  "id", "workspaceId", "fromNodeId", "toNodeId", "relationshipType", "description", "confidence",
  "confidenceHistory", "versionHistory", "statusHistory", "sourceIds", "sources", "projectIds", "createdAt", "updatedAt",
  "createdBy", "updatedBy", "status", "version", "identityKey", "exclusiveClaimKey", "lastAuditEventId",
] as const;
const sourceKeys = [
  "id", "workspaceId", "title", "url", "publisher", "sourceType", "accessedAt", "publishedAt", "reliability",
  "notes", "projectIds", "createdAt", "updatedAt", "createdBy", "updatedBy", "status", "version", "versionHistory",
  "statusHistory", "lastAuditEventId",
] as const;
const auditEventKeys = [
  "id", "workspaceId", "subjectType", "subjectId", "eventType", "actorId", "occurredAt", "summary", "version", "metadata",
] as const;

function positiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new KnowledgeValidationError(`${label} must be a positive integer.`);
  }
}

function finiteNonNegative(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new KnowledgeValidationError(`${label} must be a non-negative number.`);
  }
}

function stringArray(value: unknown, label: string) {
  array(value, label);
  value.forEach((item) => required(item, `${label} item`));
  if (unique(value as string[]).length !== value.length) {
    throw new KnowledgeValidationError(`${label} must not contain duplicates.`);
  }
}

function httpUrl(value: unknown, label: string) {
  required(value, label);
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
  } catch {
    throw new KnowledgeValidationError(`${label} must use HTTP or HTTPS.`);
  }
}

function validateNodeReference(value: unknown, expectedType: KnowledgeNodeType, label: string) {
  record(value, label);
  exactKeys(value, nodeReferenceKeys, label);
  identifier(value.nodeId, `${label} ID`);
  required(value.name, `${label} name`);
  enumValue(value.type, Object.values(KnowledgeNodeType), `${label} type`);
  if (value.type !== expectedType) throw new KnowledgeValidationError(`${label} must reference a ${expectedType} record.`);
}

function validateSourceReference(value: unknown, label: string) {
  record(value, label);
  exactKeys(value, sourceReferenceKeys, label);
  identifier(value.sourceId, `${label} ID`);
  required(value.title, `${label} title`);
  if (value.publisher !== undefined) required(value.publisher, `${label} publisher`);
  enumValue(value.reliability, Object.values(KnowledgeSourceReliability), `${label} reliability`);
  enumValue(value.status, Object.values(KnowledgeStatus), `${label} status`);
}

function validateStatusChange(value: unknown, label: string) {
  record(value, label);
  exactKeys(value, statusChangeKeys, label);
  enumValue(value.from, Object.values(KnowledgeStatus), `${label} previous status`);
  enumValue(value.to, Object.values(KnowledgeStatus), `${label} status`);
  date(value.changedAt, `${label} timestamp`);
  required(value.changedBy, `${label} actor`);
  if (value.reason !== undefined) required(value.reason, `${label} reason`);
  positiveInteger(value.version, `${label} version`);
}

function validateConfidenceChange(value: unknown, label: string, relationship = false) {
  record(value, label);
  exactKeys(value, confidenceChangeKeys, label);
  enumValue(value.from, Object.values(KnowledgeConfidence), `${label} previous confidence`);
  enumValue(value.to, Object.values(KnowledgeConfidence), `${label} confidence`);
  date(value.changedAt, `${label} timestamp`);
  required(value.changedBy, `${label} actor`);
  if (value.reason !== undefined) required(value.reason, `${label} reason`);
  if (relationship) validateRelationshipSourceIds(value.sourceIds, value.to);
  else validateSourceIds(value.sourceIds, value.to);
  positiveInteger(value.version, `${label} version`);
}

function validateRelationshipConfidenceChange(value: unknown, label: string) {
  validateConfidenceChange(value, label, true);
}

function validateSchoolData(value: Record<string, unknown>, label: string) {
  ["officialName", "city", "state", "division", "governingBody"]
    .forEach((key) => required(value[key], `${label} ${key}`));
  identifier(value.stateNodeId, `${label} stateNodeId`);
  identifier(value.regionNodeId, `${label} regionNodeId`);
  if (value.nickname !== undefined) required(value.nickname, `${label} nickname`);
  enumValue(value.region, Object.values(KnowledgeRegion), `${label} region`);
  httpUrl(value.schoolWebsite, `${label} school website`);
  httpUrl(value.athleticsWebsite, `${label} athletics website`);
  if (value.enrollment !== undefined) finiteNonNegative(value.enrollment, `${label} enrollment`);
  if (value.publicOrPrivate !== undefined && !["public", "private"].includes(String(value.publicOrPrivate))) {
    throw new KnowledgeValidationError(`${label} ownership is invalid.`);
  }
  if (value.lastVerifiedAt !== undefined) date(value.lastVerifiedAt, `${label} last verified date`);
  if (value.tuition !== undefined) {
    record(value.tuition, `${label} tuition`);
    exactKeys(value.tuition, ["inState", "outOfState", "currency", "academicYear"], `${label} tuition`);
    if (value.tuition.currency !== "USD") throw new KnowledgeValidationError(`${label} tuition currency must be USD.`);
    if (value.tuition.inState !== undefined) finiteNonNegative(value.tuition.inState, `${label} in-state tuition`);
    if (value.tuition.outOfState !== undefined) finiteNonNegative(value.tuition.outOfState, `${label} out-of-state tuition`);
    if (value.tuition.academicYear !== undefined) required(value.tuition.academicYear, `${label} tuition academic year`);
  }
  if (value.conference !== null) validateNodeReference(value.conference, KnowledgeNodeType.Conference, `${label} conference`);
  array(value.coaches, `${label} coaches`);
  value.coaches.forEach((item, index) => validateNodeReference(item, KnowledgeNodeType.Coach, `${label} coach ${index + 1}`));
  array(value.facilities, `${label} facilities`);
  value.facilities.forEach((item, index) => validateNodeReference(item, KnowledgeNodeType.Facility, `${label} facility ${index + 1}`));
  stringArray(value.recruitingNotes, `${label} recruiting notes`);
  stringArray(value.connectedProjectIds, `${label} connected projects`);
  stringArray(value.connectedContentIds, `${label} connected content`);
}

function validateNodeVersion(value: unknown, nodeType: KnowledgeNodeType, label: string) {
  record(value, label);
  exactKeys(value, nodeVersionKeys, label);
  positiveInteger(value.version, `${label} version`);
  date(value.changedAt, `${label} timestamp`);
  required(value.changedBy, `${label} actor`);
  required(value.reason, `${label} reason`);
  required(value.name, `${label} name`);
  if (typeof value.description !== "string") throw new KnowledgeValidationError(`${label} description is required.`);
  enumValue(value.confidence, Object.values(KnowledgeConfidence), `${label} confidence`);
  enumValue(value.status, Object.values(KnowledgeStatus), `${label} status`);
  validateSourceIds(value.sourceIds, value.confidence);
  stringArray(value.aliases, `${label} aliases`);
  stringArray(value.tags, `${label} tags`);
  if (nodeType === KnowledgeNodeType.School) {
    record(value.schoolData, `${label} school data`);
    exactKeys(value.schoolData, schoolDataKeys, `${label} school data`);
    validateSchoolData(value.schoolData, `${label} school data`);
  } else if (value.schoolData !== undefined) {
    throw new KnowledgeValidationError(`${label} school data is only valid for School records.`);
  }
}

function validateRelationshipVersion(value: unknown, label: string) {
  record(value, label);
  exactKeys(value, relationshipVersionKeys, label);
  positiveInteger(value.version, `${label} version`);
  date(value.changedAt, `${label} timestamp`);
  required(value.changedBy, `${label} actor`);
  required(value.reason, `${label} reason`);
  if (value.description !== undefined && typeof value.description !== "string") {
    throw new KnowledgeValidationError(`${label} description must be text.`);
  }
  enumValue(value.confidence, Object.values(KnowledgeConfidence), `${label} confidence`);
  enumValue(value.status, Object.values(KnowledgeStatus), `${label} status`);
  validateRelationshipSourceIds(value.sourceIds, value.confidence);
  stringArray(value.projectIds, `${label} projects`);
}

function validateSourceVersion(value: unknown, label: string) {
  record(value, label);
  exactKeys(value, sourceVersionKeys, label);
  positiveInteger(value.version, `${label} version`);
  date(value.changedAt, `${label} timestamp`);
  required(value.changedBy, `${label} actor`);
  required(value.reason, `${label} reason`);
  required(value.title, `${label} title`);
  if (value.url !== undefined) httpUrl(value.url, `${label} URL`);
  if (value.publisher !== undefined) required(value.publisher, `${label} publisher`);
  if (value.notes !== undefined && typeof value.notes !== "string") {
    throw new KnowledgeValidationError(`${label} notes must be text.`);
  }
  enumValue(value.sourceType, ["official", "institutional", "publication", "document", "founder", "other"], `${label} type`);
  date(value.accessedAt, `${label} accessed date`);
  if (value.publishedAt !== undefined) date(value.publishedAt, `${label} published date`);
  enumValue(value.reliability, Object.values(KnowledgeSourceReliability), `${label} reliability`);
  stringArray(value.projectIds, `${label} projects`);
  if ((value.projectIds as unknown[]).length > 64) throw new KnowledgeValidationError(`${label} can reference at most 64 projects.`);
  enumValue(value.status, Object.values(KnowledgeStatus), `${label} status`);
}

function assertOrderedVersions(
  entries: readonly { version: number; changedAt: string }[],
  currentVersion: number,
  label: string,
  requireConsecutive = false,
) {
  entries.forEach((entry, index) => {
    if (entry.version > currentVersion || (index > 0 && entry.version <= entries[index - 1].version)) {
      throw new KnowledgeValidationError(`${label} versions must be unique and increasing.`);
    }
    if (requireConsecutive && entry.version !== index + 1) {
      throw new KnowledgeValidationError(`${label} must contain every canonical version from 1 through ${currentVersion}.`);
    }
    if (index > 0 && (normalizeKnowledgeTimestamp(entry.changedAt) || "") < (normalizeKnowledgeTimestamp(entries[index - 1].changedAt) || "")) {
      throw new KnowledgeValidationError(`${label} timestamps must be chronological.`);
    }
  });
}

function assertChangeContinuity<T extends string>(
  entries: readonly { from: T; to: T; version: number; changedAt: string }[],
  currentValue: T,
  currentVersion: number,
  label: string,
) {
  assertOrderedVersions(entries, currentVersion, label);
  entries.forEach((entry, index) => {
    if (index > 0 && entry.from !== entries[index - 1].to) {
      throw new KnowledgeValidationError(`${label} must preserve an unbroken change history.`);
    }
  });
  if (entries.at(-1)?.to !== currentValue) throw new KnowledgeValidationError(`${label} must end at the current value.`);
}

export function normalizeCanonicalKnowledgeName(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function nodeCanonicalNames(node: Pick<KnowledgeNode, "name" | "aliases">) {
  return unique([node.name, ...node.aliases].map(normalizeCanonicalKnowledgeName).filter(Boolean));
}

export function nodeCanonicalClaimKeys(node: Pick<KnowledgeNode, "workspaceId" | "type" | "name" | "aliases">) {
  return nodeCanonicalNames(node).map((name) => canonicalKnowledgeNodeClaimKey(node.workspaceId, node.type, name));
}

export function canonicalSourceReference(source: KnowledgeSource): KnowledgeSourceReference {
  return {
    sourceId: source.id,
    title: source.title,
    ...(source.publisher ? { publisher: source.publisher } : {}),
    reliability: source.reliability,
    status: source.status,
  };
}

export function deriveCanonicalSourceReferences(sourceIds: readonly string[], sources: readonly KnowledgeSource[]) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return sourceIds.flatMap((sourceId) => {
    const source = byId.get(sourceId);
    return source ? [canonicalSourceReference(source)] : [];
  });
}

export function findDuplicateKnowledgeNode(nodes: KnowledgeNode[], candidate: KnowledgeNode) {
  if (candidate.status !== KnowledgeStatus.Active) return null;
  const names = new Set(nodeCanonicalNames(candidate));
  return nodes.find((node) => node.id !== candidate.id && node.workspaceId === candidate.workspaceId
    && node.type === candidate.type && node.status === KnowledgeStatus.Active
    && nodeCanonicalNames(node).some((name) => names.has(name))) || null;
}

function validateSourceIds(sourceIds: unknown, confidence?: KnowledgeConfidence) {
  array(sourceIds, "Source IDs");
  sourceIds.forEach((id) => identifier(id, "Source ID"));
  if (unique(sourceIds as string[]).length !== sourceIds.length) throw new KnowledgeValidationError("Source IDs must be unique.");
  if (sourceIds.length > 4) throw new KnowledgeValidationError("A knowledge claim can reference at most four canonical sources.");
  if (confidence === KnowledgeConfidence.Verified && sourceIds.length === 0) throw new KnowledgeValidationError("Verified knowledge requires at least one active source.");
  if (confidence === KnowledgeConfidence.Conflicting && sourceIds.length < 2) throw new KnowledgeValidationError("Conflicting knowledge requires at least two sources.");
}

function validateRelationshipSourceIds(sourceIds: unknown, confidence?: KnowledgeConfidence) {
  validateSourceIds(sourceIds, confidence === KnowledgeConfidence.Conflicting ? undefined : confidence);
  if ((sourceIds as unknown[]).length === 0) {
    throw new KnowledgeValidationError("Knowledge relationships require at least one active source.");
  }
  if ((sourceIds as unknown[]).length > 2) {
    throw new KnowledgeValidationError("A knowledge relationship can reference at most two canonical sources.");
  }
}

export function validateKnowledgeSource(source: KnowledgeSource) {
  exactKeys(source as unknown as Record<string, unknown>, sourceKeys, "Knowledge source");
  identifier(source.id, "Source ID"); identifier(source.workspaceId, "Source workspace"); required(source.title, "Source title");
  required(source.createdBy, "Source creator"); required(source.updatedBy, "Source editor");
  required(source.lastAuditEventId, "Source audit event"); date(source.accessedAt, "Source accessed date");
  if (source.publishedAt !== undefined) date(source.publishedAt, "Source published date");
  date(source.createdAt, "Source created date"); date(source.updatedAt, "Source updated date");
  enumValue(source.reliability, Object.values(KnowledgeSourceReliability), "Source reliability");
  enumValue(source.status, Object.values(KnowledgeStatus), "Source status");
  if (source.publisher !== undefined) required(source.publisher, "Source publisher");
  if (source.notes !== undefined && typeof source.notes !== "string") throw new KnowledgeValidationError("Source notes must be text.");
  enumValue(source.sourceType, ["official", "institutional", "publication", "document", "founder", "other"], "Source type");
  stringArray(source.projectIds, "Source projects");
  if (source.projectIds.length > 64) throw new KnowledgeValidationError("A knowledge source can reference at most 64 projects.");
  positiveInteger(source.version, "Source version");
  array(source.versionHistory, "Source version history");
  array(source.statusHistory, "Source status history");
  if (source.versionHistory.length === 0 || source.statusHistory.length === 0) throw new KnowledgeValidationError("Source history cannot be empty.");
  source.versionHistory.forEach((entry, index) => validateSourceVersion(entry, `Source version ${index + 1}`));
  source.statusHistory.forEach((entry, index) => validateStatusChange(entry, `Source status history entry ${index + 1}`));
  const sourceVersions = source.versionHistory.map((entry) => entry.version);
  if (unique(sourceVersions.map(String)).length !== sourceVersions.length || sourceVersions.some((version) => version > source.version)
    || source.versionHistory.at(-1)?.version !== source.version) {
    throw new KnowledgeValidationError("Source version history must contain one ordered snapshot for the current version.");
  }
  assertOrderedVersions(source.versionHistory, source.version, "Source version history", true);
  assertChangeContinuity(source.statusHistory, source.status, source.version, "Source status history");
  const latestSourceVersion = source.versionHistory.at(-1);
  if (!latestSourceVersion || latestSourceVersion.title !== source.title || latestSourceVersion.reliability !== source.reliability
    || latestSourceVersion.status !== source.status || latestSourceVersion.accessedAt !== source.accessedAt
    || latestSourceVersion.publisher !== source.publisher || latestSourceVersion.url !== source.url
    || latestSourceVersion.publishedAt !== source.publishedAt || latestSourceVersion.sourceType !== source.sourceType
    || latestSourceVersion.notes !== source.notes
    || latestSourceVersion.projectIds.join("\u0000") !== source.projectIds.join("\u0000")) {
    throw new KnowledgeValidationError("The latest source version must reconstruct the current source record.");
  }
  if (source.statusHistory.at(-1)?.to !== source.status) throw new KnowledgeValidationError("Source status history must end at the current status.");
  if (source.url) httpUrl(source.url, "Knowledge source URL");
  return source;
}

export function validateKnowledgeNode(node: KnowledgeNode) {
  identifier(node.id, "Knowledge node ID"); identifier(node.workspaceId, "Knowledge workspace"); required(node.name, "Knowledge name");
  if (typeof node.description !== "string") throw new KnowledgeValidationError("Knowledge description is required.");
  required(node.createdBy, "Knowledge creator"); required(node.updatedBy, "Knowledge editor"); required(node.lastAuditEventId, "Knowledge audit event");
  date(node.createdAt, "Knowledge created date"); date(node.updatedAt, "Knowledge updated date");
  enumValue(node.type, Object.values(KnowledgeNodeType), "Knowledge node type"); enumValue(node.category, Object.values(KnowledgeCategory), "Knowledge category");
  enumValue(node.confidence, Object.values(KnowledgeConfidence), "Knowledge confidence"); enumValue(node.status, Object.values(KnowledgeStatus), "Knowledge status");
  const typeSpecificKeys = node.type === KnowledgeNodeType.School
    ? schoolDataKeys
    : node.type === KnowledgeNodeType.Project
      ? ["projectId"] as const
      : node.type === KnowledgeNodeType.Content
        ? ["contentId", "contentUrl"] as const
        : [] as const;
  exactKeys(node as unknown as Record<string, unknown>, [...nodeBaseKeys, ...typeSpecificKeys], "Knowledge node");
  stringArray(node.aliases, "Knowledge aliases"); stringArray(node.tags, "Knowledge tags");
  if (!normalizeCanonicalKnowledgeName(node.name)) {
    throw new KnowledgeValidationError("Knowledge name must contain at least one letter or number.");
  }
  if (node.aliases.some((alias) => !normalizeCanonicalKnowledgeName(alias))) {
    throw new KnowledgeValidationError("Knowledge aliases must contain at least one letter or number.");
  }
  array(node.sources, "Derived knowledge sources");
  node.sources.forEach((source, index) => validateSourceReference(source, `Derived source ${index + 1}`));
  if (node.sources.length > 0) {
    const referenceIds = node.sources.map((source) => source.sourceId);
    if (unique(referenceIds).length !== referenceIds.length || referenceIds.length !== node.sourceIds.length
      || node.sourceIds.some((sourceId) => !referenceIds.includes(sourceId))) {
      throw new KnowledgeValidationError("Derived source references must match the canonical source IDs.");
    }
  }
  array(node.versionHistory, "Knowledge version history");
  array(node.confidenceHistory, "Knowledge confidence history"); array(node.statusHistory, "Knowledge status history");
  positiveInteger(node.version, "Knowledge version");
  if (node.versionHistory.length === 0 || node.confidenceHistory.length === 0 || node.statusHistory.length === 0) {
    throw new KnowledgeValidationError("Knowledge history cannot be empty.");
  }
  node.versionHistory.forEach((entry, index) => validateNodeVersion(entry, node.type, `Knowledge version ${index + 1}`));
  node.confidenceHistory.forEach((entry, index) => validateConfidenceChange(entry, `Knowledge confidence history entry ${index + 1}`));
  node.statusHistory.forEach((entry, index) => validateStatusChange(entry, `Knowledge status history entry ${index + 1}`));
  const versionNumbers = node.versionHistory.map((entry) => entry.version);
  if (unique(versionNumbers.map(String)).length !== versionNumbers.length || versionNumbers.some((version) => version > node.version)
    || node.versionHistory.at(-1)?.version !== node.version) {
    throw new KnowledgeValidationError("Knowledge version history must contain one ordered snapshot for the current version.");
  }
  assertOrderedVersions(node.versionHistory, node.version, "Knowledge version history", true);
  assertChangeContinuity(node.confidenceHistory, node.confidence, node.version, "Knowledge confidence history");
  assertChangeContinuity(node.statusHistory, node.status, node.version, "Knowledge status history");
  const latestNodeVersion = node.versionHistory.at(-1);
  if (!latestNodeVersion || latestNodeVersion.name !== node.name || latestNodeVersion.description !== node.description
    || latestNodeVersion.confidence !== node.confidence || latestNodeVersion.status !== node.status
    || latestNodeVersion.sourceIds.join("\u0000") !== node.sourceIds.join("\u0000")
    || latestNodeVersion.aliases.join("\u0000") !== node.aliases.join("\u0000")
    || latestNodeVersion.tags.join("\u0000") !== node.tags.join("\u0000")) {
    throw new KnowledgeValidationError("The latest knowledge version must reconstruct the current record.");
  }
  if (unique(node.aliases.map(normalizeCanonicalKnowledgeName)).length !== node.aliases.length) throw new KnowledgeValidationError("Knowledge aliases must be unique.");
  validateSourceIds(node.sourceIds, node.confidence);
  stringArray(node.canonicalNameKeys, "Knowledge canonical identity keys");
  const expectedKeys = nodeCanonicalClaimKeys(node);
  if (expectedKeys.length > 4) throw new KnowledgeValidationError("A knowledge node can have at most three distinct aliases.");
  if (expectedKeys.length !== node.canonicalNameKeys.length || expectedKeys.some((key) => !node.canonicalNameKeys.includes(key))) throw new KnowledgeValidationError("Knowledge canonical identity keys are invalid.");
  if (node.type === KnowledgeNodeType.Region && !hoopFrensRegionFromName(node.name)) throw new KnowledgeValidationError("Region nodes must use an approved Hoop Frens region.");
  const expectedCategory: Record<KnowledgeNodeType, KnowledgeCategory> = {
    [KnowledgeNodeType.School]: KnowledgeCategory.Institution,
    [KnowledgeNodeType.Coach]: KnowledgeCategory.Person,
    [KnowledgeNodeType.Conference]: KnowledgeCategory.Organization,
    [KnowledgeNodeType.Player]: KnowledgeCategory.Person,
    [KnowledgeNodeType.Facility]: KnowledgeCategory.Organization,
    [KnowledgeNodeType.Region]: KnowledgeCategory.Geography,
    [KnowledgeNodeType.State]: KnowledgeCategory.Geography,
    [KnowledgeNodeType.Organization]: KnowledgeCategory.Organization,
    [KnowledgeNodeType.Project]: KnowledgeCategory.Work,
    [KnowledgeNodeType.Content]: KnowledgeCategory.Content,
  };
  if (node.category !== expectedCategory[node.type]) throw new KnowledgeValidationError(`${node.type} records must use the ${expectedCategory[node.type]} category.`);
  if (isSchoolKnowledgeNode(node)) {
    validateSchoolData(node as unknown as Record<string, unknown>, "School knowledge");
    if (JSON.stringify(latestNodeVersion.schoolData) !== JSON.stringify(schoolVersionData(node as unknown as Record<string, unknown>))) {
      throw new KnowledgeValidationError("The latest School version must reconstruct the current School intelligence fields.");
    }
    if (hoopFrensRegionForState(node.state) !== node.region) throw new KnowledgeValidationError("The selected Region and State must match.");
    if (normalizeCanonicalKnowledgeName(node.name) !== normalizeCanonicalKnowledgeName(node.officialName)) throw new KnowledgeValidationError("School canonical name must match its official name.");
  } else if (node.type === KnowledgeNodeType.Project) {
    identifier(node.projectId, "Knowledge project ID");
  } else if (node.type === KnowledgeNodeType.Content) {
    identifier(node.contentId, "Knowledge content ID");
    if (node.contentUrl !== undefined) httpUrl(node.contentUrl, "Knowledge content URL");
  }
  return node;
}

export function validateSchoolRegionalReferences(school: SchoolKnowledgeNode, stateNode: KnowledgeNode | null, regionNode: KnowledgeNode | null) {
  if (!stateNode || stateNode.type !== KnowledgeNodeType.State || stateNode.workspaceId !== school.workspaceId || stateNode.status !== KnowledgeStatus.Active || normalizeUSStateCode(stateNode.name) !== normalizeUSStateCode(school.state)) throw new KnowledgeValidationError("The selected State and State Node must match.");
  if (!regionNode || regionNode.type !== KnowledgeNodeType.Region || regionNode.workspaceId !== school.workspaceId || regionNode.status !== KnowledgeStatus.Active || hoopFrensRegionFromName(regionNode.name) !== school.region) throw new KnowledgeValidationError("The selected Region and Region Node must match.");
  return school;
}

export { relationshipIdentity };
export function findDuplicateActiveRelationship(relationships: KnowledgeRelationship[], candidate: KnowledgeRelationship) {
  if (candidate.status !== KnowledgeStatus.Active) return null;
  const identity = relationshipIdentity(candidate);
  return relationships.find((item) => item.id !== candidate.id && item.status === KnowledgeStatus.Active && relationshipIdentity(item) === identity) || null;
}
export function findConflictingRelationships(relationships: KnowledgeRelationship[], candidate: KnowledgeRelationship) {
  if (candidate.status !== KnowledgeStatus.Active) return [];
  const claim = exclusiveKnowledgeRelationshipClaimKey(candidate);
  if (!claim) return [];
  return relationships.filter((item) => item.id !== candidate.id && item.status === KnowledgeStatus.Active
    && exclusiveKnowledgeRelationshipClaimKey(item) === claim
    && relationshipIdentity(item) !== relationshipIdentity(candidate));
}
export function validateKnowledgeRelationship(relationship: KnowledgeRelationship, fromNode?: KnowledgeNode, toNode?: KnowledgeNode) {
  exactKeys(relationship as unknown as Record<string, unknown>, relationshipKeys, "Knowledge relationship");
  identifier(relationship.id, "Relationship ID"); identifier(relationship.workspaceId, "Relationship workspace");
  identifier(relationship.fromNodeId, "Relationship From record"); identifier(relationship.toNodeId, "Relationship To record");
  required(relationship.createdBy, "Relationship creator"); required(relationship.updatedBy, "Relationship editor"); required(relationship.lastAuditEventId, "Relationship audit event");
  date(relationship.createdAt, "Relationship created date"); date(relationship.updatedAt, "Relationship updated date");
  enumValue(relationship.relationshipType, Object.values(KnowledgeRelationshipType), "Relationship type"); enumValue(relationship.confidence, Object.values(KnowledgeConfidence), "Relationship confidence"); enumValue(relationship.status, Object.values(KnowledgeStatus), "Relationship status");
  if (relationship.description !== undefined && typeof relationship.description !== "string") throw new KnowledgeValidationError("Relationship description must be text.");
  if (relationship.fromNodeId === relationship.toNodeId) throw new KnowledgeValidationError("Choose two different knowledge records to connect.");
  positiveInteger(relationship.version, "Relationship version");
  validateRelationshipSourceIds(relationship.sourceIds, relationship.confidence);
  if (relationship.sourceIds.length === 0) throw new KnowledgeValidationError("Knowledge relationships require at least one active source.");
  array(relationship.sources, "Derived relationship sources");
  relationship.sources.forEach((source, index) => validateSourceReference(source, `Derived relationship source ${index + 1}`));
  if (relationship.sources.length > 0) {
    const referenceIds = relationship.sources.map((source) => source.sourceId);
    if (unique(referenceIds).length !== referenceIds.length || referenceIds.length !== relationship.sourceIds.length
      || relationship.sourceIds.some((sourceId) => !referenceIds.includes(sourceId))) {
      throw new KnowledgeValidationError("Derived relationship sources must match the canonical source IDs.");
    }
  }
  stringArray(relationship.projectIds, "Relationship projects");
  array(relationship.confidenceHistory, "Relationship confidence history");
  array(relationship.versionHistory, "Relationship version history");
  array(relationship.statusHistory, "Relationship status history");
  if (relationship.confidenceHistory.length === 0 || relationship.versionHistory.length === 0 || relationship.statusHistory.length === 0) {
    throw new KnowledgeValidationError("Relationship history cannot be empty.");
  }
  relationship.confidenceHistory.forEach((entry, index) => validateRelationshipConfidenceChange(entry, `Relationship confidence history entry ${index + 1}`));
  relationship.versionHistory.forEach((entry, index) => validateRelationshipVersion(entry, `Relationship version ${index + 1}`));
  relationship.statusHistory.forEach((entry, index) => validateStatusChange(entry, `Relationship status history entry ${index + 1}`));
  const relationshipVersions = relationship.versionHistory.map((entry) => entry.version);
  if (unique(relationshipVersions.map(String)).length !== relationshipVersions.length
    || relationshipVersions.some((version) => version > relationship.version)
    || relationship.versionHistory.at(-1)?.version !== relationship.version) {
    throw new KnowledgeValidationError("Relationship version history must contain one ordered snapshot for the current version.");
  }
  assertOrderedVersions(relationship.versionHistory, relationship.version, "Relationship version history", true);
  assertChangeContinuity(relationship.confidenceHistory, relationship.confidence, relationship.version, "Relationship confidence history");
  assertChangeContinuity(relationship.statusHistory, relationship.status, relationship.version, "Relationship status history");
  const latestRelationshipVersion = relationship.versionHistory.at(-1);
  if (!latestRelationshipVersion || latestRelationshipVersion.description !== relationship.description
    || latestRelationshipVersion.confidence !== relationship.confidence || latestRelationshipVersion.status !== relationship.status
    || latestRelationshipVersion.sourceIds.join("\u0000") !== relationship.sourceIds.join("\u0000")
    || latestRelationshipVersion.projectIds.join("\u0000") !== relationship.projectIds.join("\u0000")) {
    throw new KnowledgeValidationError("The latest relationship version must reconstruct the current relationship record.");
  }
  if (relationship.identityKey !== relationshipIdentity(relationship)) throw new KnowledgeValidationError("Relationship canonical identity is invalid.");
  const exclusiveKey = exclusiveKnowledgeRelationshipClaimKey(relationship) || undefined;
  if (relationship.exclusiveClaimKey !== exclusiveKey) throw new KnowledgeValidationError("Relationship exclusive identity is invalid.");
  if (fromNode && toNode) { try { validateRelationshipEndpoints(fromNode, toNode, relationship.relationshipType, relationship.workspaceId); } catch (error) { throw new KnowledgeValidationError(error instanceof Error ? error.message : "Relationship endpoints are invalid."); } }
  return relationship;
}

export function validateKnowledgeAuditEvent(event: KnowledgeAuditEvent) {
  exactKeys(event as unknown as Record<string, unknown>, auditEventKeys, "Knowledge audit event");
  required(event.id, "Audit event ID"); identifier(event.workspaceId, "Audit workspace"); identifier(event.subjectId, "Audit subject"); required(event.actorId, "Audit actor"); required(event.summary, "Audit summary");
  date(event.occurredAt, "Audit timestamp");
  enumValue(event.subjectType, ["node", "relationship", "source"], "Audit subject type");
  enumValue(event.eventType, Object.values(KnowledgeAuditEventType), "Audit event type");
  positiveInteger(event.version, "Audit version");
  record(event.metadata, "Audit metadata");
  Object.values(event.metadata).forEach((item) => {
    if (item !== null && !["string", "number", "boolean"].includes(typeof item)) {
      throw new KnowledgeValidationError("Audit metadata values must be strings, numbers, booleans, or null.");
    }
    if (typeof item === "number" && !Number.isFinite(item)) throw new KnowledgeValidationError("Audit metadata numbers must be finite.");
  });
  return event;
}

export function parseKnowledgeNode(value: unknown) { record(value, "Knowledge node"); return validateKnowledgeNode(value as unknown as KnowledgeNode); }
export function parseKnowledgeRelationship(value: unknown) { record(value, "Knowledge relationship"); return validateKnowledgeRelationship(value as unknown as KnowledgeRelationship); }
export function parseKnowledgeSource(value: unknown) { record(value, "Knowledge source"); return validateKnowledgeSource(value as unknown as KnowledgeSource); }
export function parseKnowledgeAuditEvent(value: unknown) { record(value, "Knowledge audit event"); return validateKnowledgeAuditEvent(value as unknown as KnowledgeAuditEvent); }

// Explicit read migration only supplies fields introduced by the integrity remediation.
function readDate(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const converted = value.toDate();
    if (converted instanceof Date) return converted.toISOString();
  }
  return value;
}

function schoolVersionData(item: Record<string, unknown>) {
  if (item.type !== KnowledgeNodeType.School) return undefined;
  return {
    officialName: item.officialName,
    nickname: item.nickname,
    city: item.city,
    state: item.state,
    stateNodeId: item.stateNodeId,
    region: item.region,
    regionNodeId: item.regionNodeId,
    conference: null,
    division: item.division,
    governingBody: item.governingBody,
    schoolWebsite: item.schoolWebsite,
    athleticsWebsite: item.athleticsWebsite,
    enrollment: item.enrollment,
    tuition: item.tuition,
    publicOrPrivate: item.publicOrPrivate,
    facilities: [],
    coaches: [],
    recruitingNotes: item.recruitingNotes,
    connectedProjectIds: [],
    connectedContentIds: [],
    lastVerifiedAt: readDate(item.lastVerifiedAt),
  };
}

function migrateStatusHistory(
  value: unknown,
  status: unknown,
  changedAt: unknown,
  changedBy: string,
) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ from: status, to: status, changedAt, changedBy, reason: "Legacy record baseline.", version: 1 }];
  }
  return value.map((entry, index) => {
    record(entry, `Legacy status history entry ${index + 1}`);
    return {
      ...entry,
      changedAt: readDate(entry.changedAt),
      version: "version" in entry ? entry.version : index + 1,
    };
  });
}

function migrateConfidenceHistory(
  value: unknown,
  confidence: unknown,
  sourceIds: unknown,
  changedAt: unknown,
  changedBy: string,
) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ from: confidence, to: confidence, changedAt, changedBy, reason: "Legacy record baseline.", sourceIds, version: 1 }];
  }
  const isCanonical = value.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    return Array.isArray((entry as Record<string, unknown>).sourceIds)
      && Number.isInteger((entry as Record<string, unknown>).version);
  });
  const migrated: Record<string, unknown>[] = value.map((entry, index) => {
    record(entry, `Legacy confidence history entry ${index + 1}`);
    const { sources: _legacySources, ...canonicalEntry } = entry;
    void _legacySources;
    return {
      ...canonicalEntry,
      changedAt: readDate(entry.changedAt),
      sourceIds: entry.sourceIds || sourceIds,
      version: "version" in entry ? entry.version : index + 2,
    };
  });
  if (isCanonical) return migrated;
  const first = migrated[0];
  return [{
    from: first.from,
    to: first.from,
    changedAt,
    changedBy,
    reason: "Legacy record baseline.",
    sourceIds,
    version: 1,
  }, ...migrated];
}

function historyEntryAtVersion(entries: readonly Record<string, unknown>[], version: number) {
  return entries.findLast((entry) => typeof entry.version === "number" && entry.version <= version);
}

function inferredLegacyVersion(
  explicitVersion: unknown,
  ...histories: readonly (readonly Record<string, unknown>[])[]
) {
  const historyVersion = Math.max(1, ...histories.flatMap((history) => history.map((entry) => (
    typeof entry.version === "number" && Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1
  ))));
  return typeof explicitVersion === "number" && Number.isInteger(explicitVersion) && explicitVersion > 0
    ? Math.max(explicitVersion, historyVersion)
    : historyVersion;
}

function legacyChangeMetadata(
  version: number,
  changedAt: unknown,
  changedBy: string,
  ...histories: readonly (readonly Record<string, unknown>[])[]
) {
  const flattened = histories.flatMap((history) => [...history]);
  const exact = flattened.find((entry) => entry.version === version);
  const latest: Record<string, unknown> | undefined = exact
    || histories.flatMap((history) => {
      const entry = historyEntryAtVersion(history, version);
      return entry ? [entry] : [];
    }).at(-1);
  return {
    changedAt: readDate(latest?.changedAt ?? changedAt),
    changedBy: typeof latest?.changedBy === "string" ? latest.changedBy : changedBy,
    reason: typeof latest?.reason === "string" && latest.reason.trim() ? latest.reason : "Legacy record baseline.",
  };
}

export function migrateLegacyKnowledgeNodeRead(value: unknown): KnowledgeNode {
  record(value, "Knowledge node");
  const item = value as Record<string, unknown>;
  const actor = typeof item.createdBy === "string" ? item.createdBy : "";
  const updatedBy = String(item.updatedBy || actor);
  const createdAt = readDate(item.createdAt);
  const updatedAt = readDate(item.updatedAt);
  const sourceIds = item.sourceIds;
  const confidenceHistory = migrateConfidenceHistory(item.confidenceHistory, item.confidence, sourceIds, createdAt, actor);
  const statusHistory = migrateStatusHistory(item.statusHistory, item.status, createdAt, actor);
  const rawVersionHistory = Array.isArray(item.versionHistory) ? item.versionHistory : [];
  const hasVersionHistory = rawVersionHistory.length > 0;
  const targetVersion = inferredLegacyVersion(item.version, confidenceHistory, statusHistory);
  const versionHistory = hasVersionHistory
    ? rawVersionHistory.map((entry, index) => {
        record(entry, `Legacy node version ${index + 1}`);
        const data = entry.schoolData;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          const schoolData = data as Record<string, unknown>;
          return { ...entry, changedAt: readDate(entry.changedAt), version: "version" in entry ? entry.version : index + 1,
            schoolData: { ...schoolData, lastVerifiedAt: readDate(schoolData.lastVerifiedAt) } };
        }
        return { ...entry, changedAt: readDate(entry.changedAt), version: "version" in entry ? entry.version : index + 1 };
      })
    : Array.from({ length: targetVersion }, (_, index) => {
        const version = index + 1;
        const confidenceEntry = historyEntryAtVersion(confidenceHistory, version);
        const statusEntry = historyEntryAtVersion(statusHistory, version);
        return {
        version,
        ...legacyChangeMetadata(version, updatedAt, updatedBy, confidenceHistory, statusHistory),
        name: item.name,
        description: item.description,
        confidence: confidenceEntry?.to ?? item.confidence,
        status: statusEntry?.to ?? item.status,
        sourceIds: confidenceEntry?.sourceIds ?? sourceIds,
        aliases: item.aliases,
        tags: item.tags,
        schoolData: schoolVersionData(item),
      };
    });
  const version = item.version === undefined ? versionHistory.length : item.version;
  const canonicalNameKeys = item.canonicalNameKeys || (
    typeof item.workspaceId === "string"
      && typeof item.type === "string"
      && typeof item.name === "string"
      && Array.isArray(item.aliases)
      && item.aliases.every((alias) => typeof alias === "string")
      ? nodeCanonicalClaimKeys(item as unknown as KnowledgeNode)
      : []
  );
  const node = {
    ...item,
    createdAt,
    updatedAt,
    ...(item.type === KnowledgeNodeType.School && item.lastVerifiedAt !== undefined
      ? { lastVerifiedAt: readDate(item.lastVerifiedAt) }
      : {}),
    sources: [],
    updatedBy,
    version,
    canonicalNameKeys,
    lastAuditEventId: item.lastAuditEventId || `legacy:${String(item.id)}`,
    confidenceHistory,
    statusHistory,
    versionHistory,
  };
  return parseKnowledgeNode(node);
}
export function migrateLegacyKnowledgeRelationshipRead(value: unknown): KnowledgeRelationship {
  record(value, "Knowledge relationship");
  const item = value as Record<string, unknown>;
  const actor = typeof item.createdBy === "string" ? item.createdBy : "";
  const createdAt = readDate(item.createdAt);
  const confidenceHistory = migrateConfidenceHistory(item.confidenceHistory, item.confidence, item.sourceIds, createdAt, actor);
  const statusHistory = migrateStatusHistory(item.statusHistory, item.status, createdAt, actor);
  const rawVersionHistory = Array.isArray(item.versionHistory) ? item.versionHistory : [];
  const hasVersionHistory = rawVersionHistory.length > 0;
  const targetVersion = inferredLegacyVersion(item.version, confidenceHistory, statusHistory);
  const versionHistory = hasVersionHistory
    ? rawVersionHistory.map((entry, index) => {
        record(entry, `Legacy relationship version ${index + 1}`);
        return { ...entry, changedAt: readDate(entry.changedAt), version: "version" in entry ? entry.version : index + 1 };
      })
    : Array.from({ length: targetVersion }, (_, index) => {
        const version = index + 1;
        const confidenceEntry = historyEntryAtVersion(confidenceHistory, version);
        const statusEntry = historyEntryAtVersion(statusHistory, version);
        return {
        version,
        ...legacyChangeMetadata(version, item.updatedAt, String(item.updatedBy || actor), confidenceHistory, statusHistory),
        description: item.description,
        confidence: confidenceEntry?.to ?? item.confidence,
        status: statusEntry?.to ?? item.status,
        sourceIds: confidenceEntry?.sourceIds ?? item.sourceIds,
        projectIds: item.projectIds,
      };
    });
  const version = item.version === undefined ? versionHistory.length : item.version;
  const relationshipWithoutDerivedKeys = {
    ...item,
    createdAt,
    updatedAt: readDate(item.updatedAt),
    sources: [],
    updatedBy: item.updatedBy || actor,
    version,
    confidenceHistory,
    versionHistory,
    statusHistory,
    lastAuditEventId: item.lastAuditEventId || `legacy:${String(item.id)}`,
  };
  const migratedRelationship = relationshipWithoutDerivedKeys as unknown as KnowledgeRelationship;
  const relationship = {
    ...relationshipWithoutDerivedKeys,
    identityKey: relationshipIdentity(migratedRelationship),
    exclusiveClaimKey: exclusiveKnowledgeRelationshipClaimKey(migratedRelationship) || undefined,
  };
  return parseKnowledgeRelationship(relationship);
}
export function migrateLegacyKnowledgeSourceRead(value: unknown): KnowledgeSource {
  record(value, "Knowledge source");
  const item = value as Record<string, unknown>;
  const actor = typeof item.createdBy === "string" ? item.createdBy : "";
  const createdAt = readDate(item.createdAt);
  const statusHistory = migrateStatusHistory(item.statusHistory, item.status, createdAt, actor);
  const rawVersionHistory = Array.isArray(item.versionHistory) ? item.versionHistory : [];
  const hasVersionHistory = rawVersionHistory.length > 0;
  const targetVersion = inferredLegacyVersion(item.version, statusHistory);
  const versionHistory = hasVersionHistory
    ? rawVersionHistory.map((entry, index) => {
        record(entry, `Legacy source version ${index + 1}`);
        return {
          ...entry,
          changedAt: readDate(entry.changedAt),
          accessedAt: readDate(entry.accessedAt),
          publishedAt: readDate(entry.publishedAt),
          version: "version" in entry ? entry.version : index + 1,
        };
      })
    : Array.from({ length: targetVersion }, (_, index) => {
        const version = index + 1;
        const statusEntry = historyEntryAtVersion(statusHistory, version);
        return {
        version,
        ...legacyChangeMetadata(version, item.updatedAt, String(item.updatedBy || actor), statusHistory),
        title: item.title,
        url: item.url,
        publisher: item.publisher,
        sourceType: item.sourceType,
        accessedAt: readDate(item.accessedAt),
        publishedAt: readDate(item.publishedAt),
        reliability: item.reliability,
        notes: item.notes,
        projectIds: item.projectIds,
        status: statusEntry?.to ?? item.status,
      };
    });
  const version = item.version === undefined ? versionHistory.length : item.version;
  return parseKnowledgeSource({
    ...item,
    accessedAt: readDate(item.accessedAt),
    publishedAt: readDate(item.publishedAt),
    createdAt,
    updatedAt: readDate(item.updatedAt),
    updatedBy: item.updatedBy || actor,
    version,
    versionHistory,
    statusHistory,
    lastAuditEventId: item.lastAuditEventId || `legacy:${String(item.id)}`,
  });
}
export function migrateLegacyKnowledgeAuditEventRead(value: unknown) {
  record(value, "Knowledge audit event");
  return parseKnowledgeAuditEvent({
    ...value,
    occurredAt: readDate(value.occurredAt),
    version: "version" in value ? value.version : 1,
  });
}

// Ensure alias helper remains visibly tied to the same namespace contract.
void canonicalKnowledgeAliasClaimKey;
