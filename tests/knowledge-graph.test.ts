import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeExplorer } from "@/components/executive/KnowledgeExplorer";
import { KnowledgeNodeDetail } from "@/components/executive/KnowledgeNodeDetail";
import {
  knowledgeCategoryForNodeType,
  KnowledgeNodeForm,
  parseOptionalNonNegativeNumber,
} from "@/components/executive/KnowledgeNodeForm";
import { KnowledgeRelationshipForm } from "@/components/executive/KnowledgeRelationshipForm";
import { KnowledgeSourceDetail } from "@/components/executive/KnowledgeSourceDetail";
import { KnowledgeSourceForm } from "@/components/executive/KnowledgeSourceForm";
import {
  connectedContentIds,
  connectedProjectIds,
  filterKnowledgeNodes,
  relationshipEndpointOptions,
} from "@/components/executive/knowledgeExplorerUtils";
import {
  buildManualKnowledgeSource,
  canonicalKnowledgeAuditEventId,
  createInMemoryKnowledgeGraphRepository,
  createVolatileKnowledgeGraphStore,
  evaluateKnowledgeIntegrity,
  formatKnowledgeSourceDateTimeLocal,
  isStrictKnowledgeTimestamp,
  knowledgeRelationshipPolicy,
  knowledgeSourceDateValidationMessage,
  KnowledgeCategory,
  KnowledgeConfidence,
  type KnowledgeGraph,
  type KnowledgeGraphRepository,
  type KnowledgeMutationContext,
  type KnowledgeNode,
  type KnowledgeNodeCreateInput,
  KnowledgeNodeType,
  type KnowledgeRelationshipCreateInput,
  KnowledgeRelationshipType,
  type KnowledgeSourceCreateInput,
  KnowledgeSourceReliability,
  KnowledgeStatus,
  migrateLegacyKnowledgeRelationshipRead,
  migrateLegacyKnowledgeAuditEventRead,
  migrateLegacyKnowledgeNodeRead,
  normalizeKnowledgeDateTimeInput,
  normalizeKnowledgeTimestamp,
  parseKnowledgeAuditEvent,
  parseKnowledgeNode,
  parseKnowledgeRelationship,
  parseKnowledgeSource,
  serializeKnowledgeNode,
  serializeKnowledgeRelationship,
  validateRelationshipEndpoints,
} from "@/domain/knowledge";
import {
  formatHoopFrensRegion,
  hoopFrensRegionForState,
  KnowledgeRegion,
  Region,
  sanitizeFirestoreDocument,
} from "@/domain/shared";
import { adminAuthorizationService, founderKnowledgeErrorMessage, knowledgeService } from "@/services";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const workspaceId = "executive-workspace";
const actorId = "founder-admin";
const editorId = "founder-editor";
const context: KnowledgeMutationContext = { actorId, reason: "Founder validation." };
const officialSourceId = "source-ashland-athletics";
const catalogSourceId = "source-ashland-catalog";

type SchoolCreateInput = Extract<KnowledgeNodeCreateInput, { type: KnowledgeNodeType.School }>;
type ProjectCreateInput = Extract<KnowledgeNodeCreateInput, { type: KnowledgeNodeType.Project }>;
type ContentCreateInput = Extract<KnowledgeNodeCreateInput, { type: KnowledgeNodeType.Content }>;

function deterministicClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 6, 12, 12, 0, tick++)).toISOString();
}

function sourceInput(id = officialSourceId, workspace = workspaceId): KnowledgeSourceCreateInput {
  const catalog = id === catalogSourceId;
  return {
    id,
    workspaceId: workspace,
    title: catalog ? "Ashland University Catalog" : "Ashland University Athletics",
    sourceType: catalog ? "institutional" : "official",
    url: catalog ? "https://catalog.ashland.edu" : "https://goashlandeagles.com",
    publisher: "Ashland University",
    accessedAt: "2026-07-12T12:00:00.000Z",
    reliability: catalog ? KnowledgeSourceReliability.High : KnowledgeSourceReliability.Official,
    notes: "Founder-verified evidence.",
    projectIds: [],
  };
}

function categoryFor(type: KnowledgeNodeType): KnowledgeCategory {
  if (type === KnowledgeNodeType.School) return KnowledgeCategory.Institution;
  if (type === KnowledgeNodeType.Project) return KnowledgeCategory.Work;
  if (type === KnowledgeNodeType.Content) return KnowledgeCategory.Content;
  if (type === KnowledgeNodeType.Coach || type === KnowledgeNodeType.Player) return KnowledgeCategory.Person;
  if (type === KnowledgeNodeType.State || type === KnowledgeNodeType.Region) return KnowledgeCategory.Geography;
  return KnowledgeCategory.Organization;
}

function generalNodeInput(
  id: string,
  type: Exclude<KnowledgeNodeType, KnowledgeNodeType.School | KnowledgeNodeType.Project | KnowledgeNodeType.Content>,
  name: string,
  workspace = workspaceId,
): KnowledgeNodeCreateInput {
  return {
    id,
    workspaceId: workspace,
    type,
    category: categoryFor(type),
    name,
    description: `${name} canonical record.`,
    confidence: KnowledgeConfidence.Verified,
    sourceIds: [officialSourceId],
    aliases: [],
    tags: ["release-3-1"],
  };
}

function schoolInput(overrides: Partial<SchoolCreateInput> = {}): SchoolCreateInput {
  return {
    id: "school-ashland",
    workspaceId,
    type: KnowledgeNodeType.School,
    category: KnowledgeCategory.Institution,
    name: "Ashland University",
    description: "NCAA Division II university in Ashland, Ohio.",
    confidence: KnowledgeConfidence.Verified,
    sourceIds: [officialSourceId],
    aliases: ["Ashland Eagles"],
    tags: ["ohio", "division-ii"],
    officialName: "Ashland University",
    nickname: "Eagles",
    city: "Ashland",
    state: "Ohio",
    stateNodeId: "state-ohio",
    region: KnowledgeRegion.GreaterLakes,
    regionNodeId: "region-greater-lakes",
    conference: null,
    division: "NCAA Division II",
    governingBody: "NCAA",
    schoolWebsite: "https://www.ashland.edu",
    athleticsWebsite: "https://goashlandeagles.com",
    enrollment: 6692,
    tuition: { inState: 28740, outOfState: 28740, currency: "USD", academicYear: "2026-27" },
    publicOrPrivate: "private",
    facilities: [],
    coaches: [],
    recruitingNotes: ["Review the official roster before outreach."],
    connectedProjectIds: [],
    connectedContentIds: [],
    lastVerifiedAt: "2026-07-12T12:00:00.000Z",
    ...overrides,
  };
}

function projectInput(): ProjectCreateInput {
  return {
    id: "knowledge-project-ashland",
    workspaceId,
    type: KnowledgeNodeType.Project,
    category: KnowledgeCategory.Work,
    name: "Ashland University School Spotlight",
    description: "Headquarters project connected to Ashland University.",
    confidence: KnowledgeConfidence.Verified,
    sourceIds: [officialSourceId],
    aliases: [],
    tags: [],
    projectId: "project-ashland-spotlight",
  };
}

function contentInput(): ContentCreateInput {
  return {
    id: "content-ashland-preview",
    workspaceId,
    type: KnowledgeNodeType.Content,
    category: KnowledgeCategory.Content,
    name: "Ashland Spotlight Preview",
    description: "Internal content connected to Ashland University.",
    confidence: KnowledgeConfidence.Verified,
    sourceIds: [officialSourceId],
    aliases: [],
    tags: [],
    contentId: "article-ashland-preview",
    contentUrl: "https://hoopfrens.com/stories/ashland-preview",
  };
}

function relationshipInput(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  relationshipType: KnowledgeRelationshipType,
  overrides: Partial<KnowledgeRelationshipCreateInput> = {},
): KnowledgeRelationshipCreateInput {
  return {
    id,
    workspaceId,
    fromNodeId,
    toNodeId,
    relationshipType,
    description: "Founder-verified canonical relationship.",
    confidence: KnowledgeConfidence.Verified,
    sourceIds: [officialSourceId],
    projectIds: [],
    ...overrides,
  };
}

async function repositoryWithSources() {
  const store = createVolatileKnowledgeGraphStore();
  const repository = createInMemoryKnowledgeGraphRepository(store, { now: deterministicClock() });
  await repository.createSource(sourceInput(), context);
  await repository.createSource(sourceInput(catalogSourceId), context);
  return { repository, store };
}

async function createCanonicalNodes(repository: KnowledgeGraphRepository) {
  const inputs: KnowledgeNodeCreateInput[] = [
    generalNodeInput("state-ohio", KnowledgeNodeType.State, "Ohio"),
    generalNodeInput("region-greater-lakes", KnowledgeNodeType.Region, "Greater Lakes"),
    generalNodeInput("conference-gmac", KnowledgeNodeType.Conference, "Great Midwest Athletic Conference"),
    generalNodeInput("coach-owens", KnowledgeNodeType.Coach, "Coach Owens"),
    generalNodeInput("facility-kates", KnowledgeNodeType.Facility, "Kates Gymnasium"),
    generalNodeInput("player-example", KnowledgeNodeType.Player, "Verified Player"),
    generalNodeInput("organization-ncaa", KnowledgeNodeType.Organization, "NCAA"),
    projectInput(),
    contentInput(),
    schoolInput(),
  ];
  const nodes: KnowledgeNode[] = [];
  for (const input of inputs) nodes.push(await repository.createNode(input, context));
  return nodes;
}

function nodeByType(nodes: KnowledgeNode[], type: KnowledgeNodeType) {
  const node = nodes.find((candidate) => candidate.type === type);
  assert.ok(node, `Missing ${type} fixture`);
  return node;
}

test("manual source dates preserve the selected instant and omit blank optional dates", () => {
  const input = {
    ...sourceInput("source-manual"),
    url: sourceInput().url || "",
    publisher: sourceInput().publisher || "",
    accessedAt: "2026-07-12T09:30",
    publishedAt: "",
    notes: "Founder verified.",
  };
  const source = buildManualKnowledgeSource(input);
  assert.equal(source.accessedAt, new Date("2026-07-12T09:30").toISOString());
  assert.equal(formatKnowledgeSourceDateTimeLocal(source.accessedAt), "2026-07-12T09:30");
  assert.equal(Object.hasOwn(source, "publishedAt"), false);
  assert.throws(() => buildManualKnowledgeSource({ ...input, accessedAt: "" }), new RegExp(knowledgeSourceDateValidationMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const leapDaySource = buildManualKnowledgeSource({
    ...input,
    accessedAt: "2024-02-29T09:30",
    publishedAt: "2024-02-29T12:00:00+02:00",
  });
  assert.equal(leapDaySource.accessedAt, new Date("2024-02-29T09:30").toISOString());
  assert.equal(leapDaySource.publishedAt, "2024-02-29T10:00:00.000Z");

  for (const accessedAt of ["2026-02-30T09:30", "2023-02-29T09:30", "2026-13-01T09:30", "2026-04-31T09:30"]) {
    assert.throws(
      () => buildManualKnowledgeSource({ ...input, accessedAt }),
      (error) => error instanceof Error
        && error.message === knowledgeSourceDateValidationMessage
        && !/firestore|transaction|unsupported field/i.test(error.message),
    );
  }
});

test("strict Knowledge timestamps validate calendar dates, leap years, UTC, and offsets", () => {
  assert.equal(isStrictKnowledgeTimestamp("2024-02-29T23:59:59.999Z"), true);
  assert.equal(isStrictKnowledgeTimestamp("2000-02-29T00:00:00Z"), true);
  assert.equal(normalizeKnowledgeTimestamp("2024-02-29T18:59:59.999-05:00"), "2024-02-29T23:59:59.999Z");
  assert.equal(normalizeKnowledgeTimestamp("2026-07-12T17:30:00+05:30"), "2026-07-12T12:00:00.000Z");
  assert.equal(normalizeKnowledgeTimestamp(sourceInput().accessedAt), "2026-07-12T12:00:00.000Z");
  assert.equal(normalizeKnowledgeDateTimeInput("2024-02-29T09:30"), new Date("2024-02-29T09:30").toISOString());

  for (const value of [
    "2026-02-30T12:00:00.000Z",
    "2023-02-29T12:00:00.000Z",
    "2100-02-29T12:00:00.000Z",
    "2026-00-12T12:00:00.000Z",
    "2026-13-12T12:00:00.000Z",
    "2026-07-00T12:00:00.000Z",
    "2026-04-31T12:00:00.000Z",
    "2026-07-12T24:00:00.000Z",
    "2026-07-12T12:00:00+24:00",
  ]) {
    assert.equal(isStrictKnowledgeTimestamp(value), false, value);
    assert.equal(normalizeKnowledgeTimestamp(value), null, value);
  }
});

test("persisted Knowledge Source timestamps reject impossible calendar dates", async () => {
  const { repository } = await repositoryWithSources();
  const source = await repository.getSourceById(officialSourceId);
  assert.ok(source);
  assert.throws(
    () => parseKnowledgeSource({ ...source, accessedAt: "2026-02-30T12:00:00.000Z" }),
    /Source accessed date must be a valid ISO timestamp/i,
  );
  assert.throws(
    () => parseKnowledgeSource({
      ...source,
      versionHistory: source.versionHistory.map((entry, index) => index === 0
        ? { ...entry, changedAt: "2026-04-31T12:00:00.000Z" }
        : entry),
    }),
    /Source version 1 timestamp must be a valid ISO timestamp/i,
  );
});

test("the in-memory repository rejects an impossible calendar date from its clock", async () => {
  const repository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), {
    now: () => "2026-02-30T12:00:00.000Z",
  });
  await assert.rejects(
    repository.createSource(sourceInput("source-invalid-clock"), context),
    /repository clock must return a valid timestamp/i,
  );
});

test("optional Firestore values are omitted recursively while required undefined fails parsing", async () => {
  assert.deepEqual(sanitizeFirestoreDocument({ keep: true, omit: undefined, nested: { keep: "yes", omit: undefined } }), {
    keep: true,
    nested: { keep: "yes" },
  });
  const { repository } = await repositoryWithSources();
  const node = await repository.createNode(generalNodeInput("state-ohio", KnowledgeNodeType.State, "Ohio"), context);
  assert.throws(() => parseKnowledgeNode({ ...node, description: undefined }), /description is required/i);
  assert.throws(() => parseKnowledgeNode({ ...node, status: "invented" }), /status is invalid/i);
  assert.throws(() => parseKnowledgeNode({ ...node, versionHistory: [{ ...node.versionHistory[0], changedAt: "bad" }] }), /valid (?:ISO timestamp|date)/i);
});

test("Release 2 Region values remain compatible while Knowledge Regions use the approved nine-region model", () => {
  assert.deepEqual(Object.values(Region), ["national", "northeast", "southeast", "midwest", "southwest", "west", "international"]);
  assert.deepEqual(Object.values(KnowledgeRegion), [
    "northeast", "mid_atlantic", "southeast", "gulf_states", "greater_lakes", "midwest", "texas", "southwest", "northwest",
  ]);
  assert.equal(hoopFrensRegionForState("OH"), KnowledgeRegion.GreaterLakes);
  assert.equal(formatHoopFrensRegion(KnowledgeRegion.MidAtlantic), "Mid-Atlantic");
  assert.equal(formatHoopFrensRegion(KnowledgeRegion.GulfStates), "Gulf States");
  assert.equal(formatHoopFrensRegion(KnowledgeRegion.Texas), "Texas");
});

test("the canonical policy validates every relationship direction and powers the form options", async () => {
  const expected: Record<KnowledgeRelationshipType, [KnowledgeNodeType, KnowledgeNodeType]> = {
    [KnowledgeRelationshipType.SchoolBelongsToConference]: [KnowledgeNodeType.School, KnowledgeNodeType.Conference],
    [KnowledgeRelationshipType.SchoolLocatedInState]: [KnowledgeNodeType.School, KnowledgeNodeType.State],
    [KnowledgeRelationshipType.SchoolLocatedInRegion]: [KnowledgeNodeType.School, KnowledgeNodeType.Region],
    [KnowledgeRelationshipType.SchoolHasCoach]: [KnowledgeNodeType.School, KnowledgeNodeType.Coach],
    [KnowledgeRelationshipType.SchoolHasFacility]: [KnowledgeNodeType.School, KnowledgeNodeType.Facility],
    [KnowledgeRelationshipType.ProjectAboutSchool]: [KnowledgeNodeType.Project, KnowledgeNodeType.School],
    [KnowledgeRelationshipType.ContentAboutSchool]: [KnowledgeNodeType.Content, KnowledgeNodeType.School],
    [KnowledgeRelationshipType.CoachWorksAtSchool]: [KnowledgeNodeType.Coach, KnowledgeNodeType.School],
    [KnowledgeRelationshipType.ConferenceGovernsSchool]: [KnowledgeNodeType.Conference, KnowledgeNodeType.School],
    [KnowledgeRelationshipType.PlayerConnectedToSchool]: [KnowledgeNodeType.Player, KnowledgeNodeType.School],
    [KnowledgeRelationshipType.FacilityBelongsToSchool]: [KnowledgeNodeType.Facility, KnowledgeNodeType.School],
  };
  const expectedPolicy: Record<KnowledgeRelationshipType, {
    allowMultipleActiveFrom: boolean;
    allowMultipleActiveTo: boolean;
    exclusiveEndpoint: "from" | "to" | null;
    semanticFamily: string;
    canonicalDirection: "as-authored" | "reverse";
  }> = {
    [KnowledgeRelationshipType.SchoolBelongsToConference]: { allowMultipleActiveFrom: false, allowMultipleActiveTo: true, exclusiveEndpoint: "from", semanticFamily: "school-conference", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.SchoolLocatedInState]: { allowMultipleActiveFrom: false, allowMultipleActiveTo: true, exclusiveEndpoint: "from", semanticFamily: "school-state", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.SchoolLocatedInRegion]: { allowMultipleActiveFrom: false, allowMultipleActiveTo: true, exclusiveEndpoint: "from", semanticFamily: "school-region", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.SchoolHasCoach]: { allowMultipleActiveFrom: true, allowMultipleActiveTo: false, exclusiveEndpoint: "to", semanticFamily: "school-coach", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.SchoolHasFacility]: { allowMultipleActiveFrom: true, allowMultipleActiveTo: false, exclusiveEndpoint: "to", semanticFamily: "school-facility", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.ProjectAboutSchool]: { allowMultipleActiveFrom: true, allowMultipleActiveTo: true, exclusiveEndpoint: null, semanticFamily: "project-school", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.ContentAboutSchool]: { allowMultipleActiveFrom: true, allowMultipleActiveTo: true, exclusiveEndpoint: null, semanticFamily: "content-school", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.CoachWorksAtSchool]: { allowMultipleActiveFrom: false, allowMultipleActiveTo: true, exclusiveEndpoint: "from", semanticFamily: "school-coach", canonicalDirection: "reverse" },
    [KnowledgeRelationshipType.ConferenceGovernsSchool]: { allowMultipleActiveFrom: true, allowMultipleActiveTo: false, exclusiveEndpoint: "to", semanticFamily: "school-conference", canonicalDirection: "reverse" },
    [KnowledgeRelationshipType.PlayerConnectedToSchool]: { allowMultipleActiveFrom: true, allowMultipleActiveTo: true, exclusiveEndpoint: null, semanticFamily: "player-school", canonicalDirection: "as-authored" },
    [KnowledgeRelationshipType.FacilityBelongsToSchool]: { allowMultipleActiveFrom: false, allowMultipleActiveTo: true, exclusiveEndpoint: "from", semanticFamily: "school-facility", canonicalDirection: "reverse" },
  };
  assert.equal(Object.keys(knowledgeRelationshipPolicy).length, 11);
  const { repository } = await repositoryWithSources();
  const nodes = await createCanonicalNodes(repository);
  const wrong = nodeByType(nodes, KnowledgeNodeType.Organization);
  for (const relationshipType of Object.values(KnowledgeRelationshipType)) {
    const [fromType, toType] = expected[relationshipType];
    const fromNode = nodeByType(nodes, fromType);
    const toNode = nodeByType(nodes, toType);
    assert.equal(knowledgeRelationshipPolicy[relationshipType].fromNodeType, fromType);
    assert.equal(knowledgeRelationshipPolicy[relationshipType].toNodeType, toType);
    assert.deepEqual({
      allowMultipleActiveFrom: knowledgeRelationshipPolicy[relationshipType].allowMultipleActiveFrom,
      allowMultipleActiveTo: knowledgeRelationshipPolicy[relationshipType].allowMultipleActiveTo,
      exclusiveEndpoint: knowledgeRelationshipPolicy[relationshipType].exclusiveEndpoint,
      semanticFamily: knowledgeRelationshipPolicy[relationshipType].semanticFamily,
      canonicalDirection: knowledgeRelationshipPolicy[relationshipType].canonicalDirection,
    }, expectedPolicy[relationshipType]);
    assert.equal(knowledgeRelationshipPolicy[relationshipType].exclusive, !(
      expectedPolicy[relationshipType].allowMultipleActiveFrom
      && expectedPolicy[relationshipType].allowMultipleActiveTo
    ));
    validateRelationshipEndpoints(fromNode, toNode, relationshipType, workspaceId);
    assert.throws(() => validateRelationshipEndpoints(toNode, fromNode, relationshipType, workspaceId), /requires/i);
    assert.throws(() => validateRelationshipEndpoints(wrong, toNode, relationshipType, workspaceId), /requires/i);
    assert.throws(() => validateRelationshipEndpoints(fromNode, fromNode, relationshipType, workspaceId), /different/i);
    const options = relationshipEndpointOptions(nodes, relationshipType);
    assert.ok(options.fromNodes.every((node) => node.type === fromType));
    assert.ok(options.toNodes.every((node) => node.type === toType));
    const foreignFrom = { ...fromNode, id: `foreign-${fromNode.id}`, workspaceId: "foreign-workspace" } as KnowledgeNode;
    const scopedOptions = relationshipEndpointOptions([...nodes, foreignFrom], relationshipType, "", workspaceId);
    assert.equal(scopedOptions.fromNodes.some((node) => node.id === foreignFrom.id), false);
  }
});

test("repository context owns actors and timestamps and actorless mutations fail", async () => {
  const store = createVolatileKnowledgeGraphStore();
  const repository = createInMemoryKnowledgeGraphRepository(store, { now: deterministicClock() });
  const spoofed = {
    ...sourceInput(),
    createdBy: "spoofed",
    updatedBy: "spoofed",
    createdAt: "1999-01-01T00:00:00.000Z",
    updatedAt: "1999-01-01T00:00:00.000Z",
  } as unknown as KnowledgeSourceCreateInput;
  const source = await repository.createSource(spoofed, context);
  assert.equal(source.createdBy, actorId);
  assert.equal(source.updatedBy, actorId);
  assert.notEqual(source.createdAt, "1999-01-01T00:00:00.000Z");
  const updated = await repository.updateSource(source.id, {
    title: "Updated canonical source",
    updatedBy: "spoofed-editor",
    updatedAt: "1999-01-01T00:00:00.000Z",
  } as unknown as Parameters<KnowledgeGraphRepository["updateSource"]>[1], {
    actorId: editorId,
    reason: "Founder corrected the source title.",
  });
  assert.equal(updated.createdBy, actorId);
  assert.equal(updated.updatedBy, editorId);
  assert.notEqual(updated.updatedAt, "1999-01-01T00:00:00.000Z");
  await assert.rejects(() => repository.createSource(sourceInput("actorless"), { actorId: "" }), /authenticated Headquarters editor/i);
  const audits = await repository.listAuditEvents(workspaceId);
  const createAudit = audits.find((audit) => audit.id === source.lastAuditEventId);
  const updateAudit = audits.find((audit) => audit.id === updated.lastAuditEventId);
  assert.ok(createAudit && updateAudit);
  assert.equal(createAudit.actorId, actorId);
  assert.equal(createAudit.version, 1);
  assert.equal(updateAudit.actorId, editorId);
  assert.equal(updateAudit.version, 2);
  assert.equal(createAudit.id, canonicalKnowledgeAuditEventId("source", source.id, 1));
  assert.equal(updateAudit.id, canonicalKnowledgeAuditEventId("source", source.id, 2));
  assert.throws(() => parseKnowledgeAuditEvent({ ...createAudit, actorId: "" }), /Audit actor is required/i);
});

test("in-memory subject and audit writes commit atomically when audit persistence fails", async () => {
  const store = createVolatileKnowledgeGraphStore();
  const repository = createInMemoryKnowledgeGraphRepository(store, { now: deterministicClock() });
  await repository.createSource(sourceInput(), context);
  const nodesBefore = store.readNodes();
  const auditsBefore = store.readAuditEvents();
  const failingRepository = createInMemoryKnowledgeGraphRepository(store, {
    now: deterministicClock(),
    beforeAuditWrite(event) {
      if (event.subjectId === "state-audit-failure") {
        throw new Error("Injected in-memory audit persistence failure.");
      }
    },
  });

  await assert.rejects(
    () => failingRepository.createNode(
      generalNodeInput("state-audit-failure", KnowledgeNodeType.State, "Audit Failure State"),
      context,
    ),
    /Injected in-memory audit persistence failure/i,
  );
  assert.deepEqual(store.readNodes(), nodesBefore);
  assert.deepEqual(store.readAuditEvents(), auditsBefore);
  assert.equal(await failingRepository.getNodeById("state-audit-failure"), null);
});

test("canonical node and alias identities are retry-safe and historical identities stay reserved", async () => {
  const { repository } = await repositoryWithSources();
  const ohio = await repository.createNode(generalNodeInput("state-ohio", KnowledgeNodeType.State, "Ohio"), context);
  const retry = await repository.createNode(generalNodeInput("state-ohio-retry", KnowledgeNodeType.State, "Ohio"), context);
  assert.equal(retry.id, ohio.id);
  await assert.rejects(
    () => repository.createNode({ ...generalNodeInput("state-buckeye", KnowledgeNodeType.State, "Buckeye State"), aliases: ["Ohio"] }, context),
    /identity is already reserved/i,
  );
  await repository.archiveNode(ohio.id, { actorId, reason: "Archive validation node." });
  await assert.rejects(
    () => repository.createNode(generalNodeInput("state-ohio-new", KnowledgeNodeType.State, "Ohio"), context),
    /Historical knowledge identity remains reserved/i,
  );
});

test("source provenance rejects missing, archived, foreign-workspace, and caller-supplied summaries", async () => {
  const { repository } = await repositoryWithSources();
  await assert.rejects(
    () => repository.createNode({ ...generalNodeInput("state-missing", KnowledgeNodeType.State, "Missing"), sourceIds: ["missing-source"] }, context),
    /source is unavailable/i,
  );
  await repository.createSource(sourceInput("source-foreign", "other-workspace"), context);
  await assert.rejects(
    () => repository.createNode({ ...generalNodeInput("state-foreign", KnowledgeNodeType.State, "Foreign"), sourceIds: ["source-foreign"] }, context),
    /source is unavailable/i,
  );
  await repository.archiveSource(catalogSourceId, { actorId, reason: "Archive unused validation source." });
  await assert.rejects(
    () => repository.createNode({ ...generalNodeInput("state-archived", KnowledgeNodeType.State, "Archived Source"), sourceIds: [catalogSourceId] }, context),
    /source is unavailable/i,
  );
  const driftAttempt = {
    ...generalNodeInput("state-ohio", KnowledgeNodeType.State, "Ohio"),
    sources: [{ sourceId: officialSourceId, title: "Spoofed", reliability: KnowledgeSourceReliability.Low, status: KnowledgeStatus.Active }],
  } as unknown as KnowledgeNodeCreateInput;
  const node = await repository.createNode(driftAttempt, context);
  assert.equal(node.sources[0].title, "Ashland University Athletics");
  assert.equal(node.sources[0].reliability, KnowledgeSourceReliability.Official);
  assert.equal(Object.hasOwn(serializeKnowledgeNode(node), "sources"), false);
});

test("relationship creation enforces endpoints, exact retries, canonical sources, and immutable identity", async () => {
  const { repository } = await repositoryWithSources();
  const nodes = await createCanonicalNodes(repository);
  const relationship = await repository.createRelationship(
    relationshipInput("relationship-school-state", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  const retry = await repository.createRelationship(
    relationshipInput("relationship-school-state-retry", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  assert.equal(retry.id, relationship.id);
  assert.equal(relationship.sources[0].title, "Ashland University Athletics");
  assert.equal(Object.hasOwn(serializeKnowledgeRelationship(relationship), "sources"), false);
  const migratedLegacyKeys = migrateLegacyKnowledgeRelationshipRead({
    ...relationship,
    identityKey: "legacy-per-type-key",
    exclusiveClaimKey: "legacy-exclusive-key",
  });
  assert.equal(migratedLegacyKeys.identityKey, relationship.identityKey);
  assert.equal(migratedLegacyKeys.exclusiveClaimKey, relationship.exclusiveClaimKey);
  await assert.rejects(
    () => repository.createRelationship(relationshipInput("relationship-reversed", "state-ohio", "school-ashland", KnowledgeRelationshipType.SchoolLocatedInState), context),
    /requires school as the From record and state as the To record/i,
  );
  await assert.rejects(
    () => repository.createRelationship(relationshipInput("relationship-missing", "school-ashland", "missing", KnowledgeRelationshipType.SchoolLocatedInState), context),
    /two existing nodes/i,
  );
  await assert.rejects(
    () => repository.createRelationship({
      ...relationshipInput("relationship-too-many-sources", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
      sourceIds: [officialSourceId, catalogSourceId, "source-third"],
    }, context),
    /at most two/i,
  );
  const player = nodeByType(nodes, KnowledgeNodeType.Player);
  await repository.archiveNode(player.id, { actorId, reason: "Archive player fixture." });
  await assert.rejects(
    () => repository.createRelationship(relationshipInput("relationship-archived", player.id, "school-ashland", KnowledgeRelationshipType.PlayerConnectedToSchool), context),
    /Archived knowledge records/i,
  );
});

test("inverse relationship labels share one semantic identity and one exclusive claim family", async () => {
  const { repository } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  const authored = await repository.createRelationship(
    relationshipInput("relationship-school-coach", "school-ashland", "coach-owens", KnowledgeRelationshipType.SchoolHasCoach),
    context,
  );
  const inverseRetry = await repository.createRelationship(
    relationshipInput("relationship-coach-school", "coach-owens", "school-ashland", KnowledgeRelationshipType.CoachWorksAtSchool),
    context,
  );
  assert.equal(inverseRetry.id, authored.id);

  await repository.createNode(schoolInput({
    id: "school-second-owner",
    name: "Second School",
    officialName: "Second School",
    aliases: [],
  }), context);
  const competing = await repository.createRelationship(
    relationshipInput("relationship-coach-second-school", "coach-owens", "school-second-owner", KnowledgeRelationshipType.CoachWorksAtSchool, {
      sourceIds: [catalogSourceId],
    }),
    context,
  );
  assert.equal(competing.confidence, KnowledgeConfidence.Conflicting);
  const conflictingAuthored = await repository.getRelationshipById(authored.id);
  assert.equal(conflictingAuthored?.confidence, KnowledgeConfidence.Conflicting);
  assert.deepEqual(conflictingAuthored?.sourceIds, [officialSourceId]);
  assert.deepEqual(competing.sourceIds, [catalogSourceId]);

  const authoredFacility = await repository.createRelationship(
    relationshipInput("relationship-school-facility", "school-ashland", "facility-kates", KnowledgeRelationshipType.SchoolHasFacility),
    context,
  );
  const inverseFacilityRetry = await repository.createRelationship(
    relationshipInput("relationship-facility-school", "facility-kates", "school-ashland", KnowledgeRelationshipType.FacilityBelongsToSchool),
    context,
  );
  assert.equal(inverseFacilityRetry.id, authoredFacility.id);
  const competingFacility = await repository.createRelationship(
    relationshipInput("relationship-facility-second-school", "facility-kates", "school-second-owner", KnowledgeRelationshipType.FacilityBelongsToSchool, {
      sourceIds: [catalogSourceId],
    }),
    context,
  );
  assert.equal(competingFacility.confidence, KnowledgeConfidence.Conflicting);

  const authoredConference = await repository.createRelationship(
    relationshipInput("relationship-school-conference", "school-ashland", "conference-gmac", KnowledgeRelationshipType.SchoolBelongsToConference),
    context,
  );
  const inverseConferenceRetry = await repository.createRelationship(
    relationshipInput("relationship-conference-school", "conference-gmac", "school-ashland", KnowledgeRelationshipType.ConferenceGovernsSchool),
    context,
  );
  assert.equal(inverseConferenceRetry.id, authoredConference.id);
  await repository.createNode(generalNodeInput("conference-second", KnowledgeNodeType.Conference, "Second Conference"), context);
  const competingConference = await repository.createRelationship(
    relationshipInput("relationship-second-conference-school", "conference-second", "school-ashland", KnowledgeRelationshipType.ConferenceGovernsSchool, {
      sourceIds: [catalogSourceId],
    }),
    context,
  );
  assert.equal(competingConference.confidence, KnowledgeConfidence.Conflicting);
});

test("exclusive competing claims are preserved only as explicit conflicts", async () => {
  const { repository } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  await repository.createNode(generalNodeInput("state-pennsylvania", KnowledgeNodeType.State, "Pennsylvania"), context);
  const first = await repository.createRelationship(
    relationshipInput("relationship-school-ohio", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  const second = await repository.createRelationship(
    relationshipInput("relationship-school-pa", "school-ashland", "state-pennsylvania", KnowledgeRelationshipType.SchoolLocatedInState, {
      sourceIds: [catalogSourceId],
    }),
    context,
  );
  assert.equal(second.confidence, KnowledgeConfidence.Conflicting);
  const conflictingFirst = await repository.getRelationshipById(first.id);
  assert.equal(conflictingFirst?.confidence, KnowledgeConfidence.Conflicting);
  assert.deepEqual(conflictingFirst?.sourceIds, [officialSourceId]);
  assert.deepEqual(second.sourceIds, [catalogSourceId]);
  await assert.rejects(
    () => repository.updateRelationship(second.id, { confidence: KnowledgeConfidence.Verified }, { actorId, reason: "Invalid promotion." }),
    /Resolve the conflicting relationship/i,
  );
});

test("node and source archive guards identify active claims before preserving history", async () => {
  const { repository } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  const relationship = await repository.createRelationship(
    relationshipInput("relationship-school-state", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  await assert.rejects(() => repository.archiveNode("school-ashland", context), /relationship-school-state/);
  await assert.rejects(() => repository.archiveSource(officialSourceId, context), /active knowledge claims/i);
  const archivedRelationship = await repository.archiveRelationship(relationship.id, { actorId, reason: "Archive edge first." });
  assert.equal(archivedRelationship.status, KnowledgeStatus.Archived);
  const archivedSchool = await repository.archiveNode("school-ashland", { actorId, reason: "Archive node after edges." });
  assert.equal(archivedSchool.status, KnowledgeStatus.Archived);
  assert.equal(archivedSchool.statusHistory.at(-1)?.changedBy, actorId);
});

test("node, relationship, and source versions preserve prior evidence and canonical state", async () => {
  const { repository } = await repositoryWithSources();
  const ohio = await repository.createNode(generalNodeInput("state-ohio", KnowledgeNodeType.State, "Ohio"), context);
  const updatedNode = await repository.updateNode(ohio.id, {
    description: "Updated evidence-backed Ohio description.",
    confidence: KnowledgeConfidence.Supported,
    sourceIds: [officialSourceId, catalogSourceId],
  }, { actorId: editorId, reason: "New evidence requires lower confidence." });
  assert.equal(updatedNode.createdBy, actorId);
  assert.equal(updatedNode.updatedBy, editorId);
  assert.equal(updatedNode.version, 2);
  assert.equal(updatedNode.versionHistory[0].description, "Ohio canonical record.");
  assert.equal(updatedNode.versionHistory[1].description, "Updated evidence-backed Ohio description.");
  assert.deepEqual(updatedNode.versionHistory[0].sourceIds, [officialSourceId]);
  assert.deepEqual(updatedNode.versionHistory[1].sourceIds, [officialSourceId, catalogSourceId]);
  assert.equal(updatedNode.confidenceHistory.at(-1)?.from, KnowledgeConfidence.Verified);

  await repository.createNode(generalNodeInput("region-greater-lakes", KnowledgeNodeType.Region, "Greater Lakes"), context);
  await repository.createNode(schoolInput(), context);
  const originalRelationship = await repository.createRelationship(
    relationshipInput("relationship-school-state", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  const updatedRelationship = await repository.updateRelationship(originalRelationship.id, {
    description: "Updated relationship evidence.",
    confidence: KnowledgeConfidence.Supported,
    sourceIds: [officialSourceId, catalogSourceId],
  }, { actorId: editorId, reason: "Relationship evidence was revised." });
  assert.equal(updatedRelationship.version, 2);
  assert.equal(updatedRelationship.versionHistory[0].description, "Founder-verified canonical relationship.");
  assert.equal(updatedRelationship.versionHistory[1].description, "Updated relationship evidence.");
  assert.deepEqual(updatedRelationship.versionHistory[0].sourceIds, [officialSourceId]);
  assert.deepEqual(updatedRelationship.versionHistory[1].sourceIds, [officialSourceId, catalogSourceId]);

  const source = await repository.updateSource(catalogSourceId, { reliability: KnowledgeSourceReliability.Official }, {
    actorId: editorId,
    reason: "Founder reverified catalog reliability.",
  });
  assert.equal(source.version, 2);
  assert.equal(source.versionHistory[0].reliability, KnowledgeSourceReliability.High);
  assert.equal(source.versionHistory[1].reliability, KnowledgeSourceReliability.Official);
});

test("School compact references are derived exclusively from active canonical relationships", async () => {
  const { repository, store } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  const relationships = [
    relationshipInput("relationship-school-conference", "school-ashland", "conference-gmac", KnowledgeRelationshipType.SchoolBelongsToConference),
    relationshipInput("relationship-school-coach", "school-ashland", "coach-owens", KnowledgeRelationshipType.SchoolHasCoach),
    relationshipInput("relationship-school-facility", "school-ashland", "facility-kates", KnowledgeRelationshipType.SchoolHasFacility),
    relationshipInput("relationship-project-school", "knowledge-project-ashland", "school-ashland", KnowledgeRelationshipType.ProjectAboutSchool),
    relationshipInput("relationship-content-school", "content-ashland-preview", "school-ashland", KnowledgeRelationshipType.ContentAboutSchool),
  ];
  for (const input of relationships) await repository.createRelationship(input, context);
  const school = await repository.getNodeById("school-ashland");
  assert.ok(school && school.type === KnowledgeNodeType.School);
  assert.equal(school.conference?.nodeId, "conference-gmac");
  assert.deepEqual(school.coaches.map((item) => item.nodeId), ["coach-owens"]);
  assert.deepEqual(school.facilities.map((item) => item.nodeId), ["facility-kates"]);
  assert.deepEqual(school.connectedProjectIds, ["project-ashland-spotlight"]);
  assert.deepEqual(school.connectedContentIds, ["article-ashland-preview"]);
  const storedSchool = store.readNodes().find((node) => node.id === "school-ashland");
  assert.ok(storedSchool && storedSchool.type === KnowledgeNodeType.School);
  assert.equal(storedSchool.conference, null);
  assert.deepEqual(storedSchool.coaches, []);
  assert.deepEqual(storedSchool.connectedProjectIds, []);
  const relationshipTemplate = store.readRelationships().find((item) => item.id === "relationship-school-coach");
  assert.ok(relationshipTemplate);
  store.writeRelationships([{
    ...relationshipTemplate,
    id: "legacy-invalid-school-coach-edge",
    toNodeId: "facility-kates",
  }, ...store.readRelationships()]);
  const schoolWithInvalidLegacyEdge = await repository.getNodeById("school-ashland");
  assert.ok(schoolWithInvalidLegacyEdge && schoolWithInvalidLegacyEdge.type === KnowledgeNodeType.School);
  assert.deepEqual(schoolWithInvalidLegacyEdge.coaches.map((item) => item.nodeId), ["coach-owens"]);
  assert.deepEqual(connectedProjectIds(school, await repository.listNodes(workspaceId), await repository.listRelationships(workspaceId)), ["project-ashland-spotlight"]);
  assert.deepEqual(connectedContentIds(school, await repository.listNodes(workspaceId), await repository.listRelationships(workspaceId)), ["article-ashland-preview"]);
  await repository.archiveRelationship("relationship-project-school", context);
  const refreshedSchool = await repository.getNodeById("school-ashland");
  assert.ok(refreshedSchool && refreshedSchool.type === KnowledgeNodeType.School);
  assert.deepEqual(refreshedSchool.connectedProjectIds, []);
});

test("integrity evaluation reports legacy stale endpoints, invalid semantics, and unresolved provenance", async () => {
  const { repository } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  await repository.createNode(generalNodeInput("state-pennsylvania", KnowledgeNodeType.State, "Pennsylvania"), context);
  const relationship = await repository.createRelationship(
    relationshipInput("relationship-school-state", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  const inverseConference = await repository.createRelationship(
    relationshipInput("relationship-conference-school", "conference-gmac", "school-ashland", KnowledgeRelationshipType.ConferenceGovernsSchool),
    context,
  );
  const nodes = await repository.listNodes(workspaceId);
  const sources = await repository.listSources(workspaceId);
  const staleNodes = nodes.map((node) => node.id === "state-ohio" ? { ...node, status: KnowledgeStatus.Archived } as KnowledgeNode : node);
  const duplicateInverseConference = {
    ...inverseConference,
    id: "relationship-school-conference-legacy-duplicate",
    fromNodeId: "school-ashland",
    toNodeId: "conference-gmac",
    relationshipType: KnowledgeRelationshipType.SchoolBelongsToConference,
  };
  const archivedCompetingState = {
    ...relationship,
    id: "relationship-school-pa-archived",
    toNodeId: "state-pennsylvania",
    status: KnowledgeStatus.Archived,
  };
  const graph: KnowledgeGraph = {
    nodes: staleNodes,
    sources: sources.map((source) => source.id === officialSourceId ? { ...source, status: KnowledgeStatus.Archived } : source),
    auditEvents: [],
    relationships: [
      relationship,
      inverseConference,
      duplicateInverseConference,
      archivedCompetingState,
      { ...relationship, id: "relationship-invalid", fromNodeId: "state-ohio", toNodeId: "school-ashland" },
      { ...relationship, id: "relationship-missing-source", sourceIds: ["source-missing"], sources: [] },
    ],
  };
  const warnings = evaluateKnowledgeIntegrity(graph);
  const warningTypes = new Set(warnings.map((warning) => warning.type));
  assert.ok(warningTypes.has("archived-endpoint"));
  assert.ok(warningTypes.has("invalid-relationship-semantics"));
  assert.ok(warningTypes.has("archived-source"));
  assert.ok(warningTypes.has("missing-source"));
  assert.ok(warningTypes.has("duplicate-relationship"));
  assert.ok(warningTypes.has("missing-audit"));
  assert.equal(warnings.some((warning) => warning.id === `school-relationship-missing:school-ashland:${KnowledgeRelationshipType.SchoolBelongsToConference}`), false);
  assert.equal(warnings.some((warning) => warning.id === "conflicting-relationship:relationship-school-pa-archived"), false);

  const invalidLocation = {
    ...relationship,
    id: "relationship-invalid-location-type",
    toNodeId: "coach-owens",
  };
  const missingLocationWarnings = evaluateKnowledgeIntegrity({
    nodes,
    sources,
    auditEvents: [],
    relationships: [invalidLocation],
  });
  assert.ok(missingLocationWarnings.some((warning) => warning.id === "invalid-relationship-semantics:relationship-invalid-location-type"));
  assert.ok(missingLocationWarnings.some((warning) => (
    warning.id === `school-relationship-missing:school-ashland:${KnowledgeRelationshipType.SchoolLocatedInState}`
  )));
});

test("legacy Ashland validation data receives explicit compatibility baselines and remains readable", () => {
  const legacy = {
    ...schoolInput(),
    sources: [{ sourceId: officialSourceId, title: "Legacy summary", reliability: KnowledgeSourceReliability.Low }],
    createdAt: "2024-02-29T12:00:00.000Z",
    updatedAt: "2024-02-29T13:00:00.000Z",
    createdBy: actorId,
    status: KnowledgeStatus.Active,
    confidenceHistory: [{
      from: KnowledgeConfidence.Unverified,
      to: KnowledgeConfidence.Verified,
      changedAt: "2024-02-29T12:30:00.000Z",
      changedBy: actorId,
      reason: "Founder verified the legacy record.",
      sources: [{ sourceId: officialSourceId, title: "Legacy summary" }],
    }],
  };
  const migrated = migrateLegacyKnowledgeNodeRead(legacy);
  assert.equal(migrated.id, "school-ashland");
  assert.equal(migrated.createdAt, "2024-02-29T12:00:00.000Z");
  assert.equal(migrated.updatedBy, actorId);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.versionHistory.length, 2);
  assert.equal(migrated.versionHistory[0].confidence, KnowledgeConfidence.Unverified);
  assert.equal(migrated.versionHistory[1].confidence, KnowledgeConfidence.Verified);
  assert.equal(migrated.versionHistory[0].schoolData?.region, KnowledgeRegion.GreaterLakes);
  assert.deepEqual(migrated.sources, []);
  assert.throws(
    () => migrateLegacyKnowledgeNodeRead({ ...legacy, createdAt: "2026-02-30T12:00:00.000Z" }),
    /Knowledge created date must be a valid ISO timestamp/i,
  );

  const migratedRelationship = migrateLegacyKnowledgeRelationshipRead({
    id: "legacy-relationship-with-confidence-history",
    workspaceId,
    fromNodeId: "school-ashland",
    toNodeId: "state-ohio",
    relationshipType: KnowledgeRelationshipType.SchoolLocatedInState,
    description: "Legacy source-backed relationship.",
    confidence: KnowledgeConfidence.Verified,
    sourceIds: [officialSourceId],
    projectIds: [],
    createdAt: "2024-02-29T12:00:00.000Z",
    updatedAt: "2024-02-29T13:00:00.000Z",
    createdBy: actorId,
    status: KnowledgeStatus.Active,
    confidenceHistory: legacy.confidenceHistory,
  });
  assert.equal(migratedRelationship.version, 2);
  assert.equal(migratedRelationship.versionHistory.length, 2);
  assert.equal(migratedRelationship.versionHistory[0].confidence, KnowledgeConfidence.Unverified);
  assert.equal(migratedRelationship.versionHistory[1].confidence, KnowledgeConfidence.Verified);
});

test("canonical source hydration drives search and service graph reads", async () => {
  const { repository } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  const graph = await knowledgeService.loadGraph(repository, workspaceId);
  const results = filterKnowledgeNodes(graph.nodes, {
    query: "Ashland University Athletics",
    type: "all",
    confidence: "all",
    status: "all",
    region: "all",
    state: "all",
    sort: "name",
  }, graph.sources);
  assert.ok(results.length > 0);
  assert.ok(results.every((node) => node.sources.every((source) => source.title !== "Spoofed")));
});

test("Founder-facing errors pass through typed validation only and hide technical internals", () => {
  const typed = Object.assign(new Error("Choose valid endpoints."), { name: "KnowledgeValidationError" });
  assert.equal(founderKnowledgeErrorMessage(typed, "Fallback"), "Choose valid endpoints.");
  assert.equal(founderKnowledgeErrorMessage(new Error("FirebaseError: internalKnowledgeNodes transaction"), "Fallback"), "Fallback");
  assert.equal(founderKnowledgeErrorMessage(Object.assign(new Error("Firestore transaction failed"), { name: "KnowledgeValidationError" }), "Fallback"), "Fallback");
});

test("Knowledge Center UI renders canonical controls, approved regions, history, and archive guidance", async () => {
  const { repository } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  const relationship = await repository.createRelationship(
    relationshipInput("relationship-school-state", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  const graph = await knowledgeService.loadGraph(repository, workspaceId);
  const school = graph.nodes.find((node) => node.id === "school-ashland");
  const source = graph.sources.find((item) => item.id === officialSourceId);
  assert.ok(school && school.type === KnowledgeNodeType.School);
  assert.ok(source);
  const explorerMarkup = renderToStaticMarkup(createElement(KnowledgeExplorer, {
    currentUserId: actorId,
    initialNodes: graph.nodes,
    initialRelationships: graph.relationships,
    initialSources: graph.sources,
    loadFromFirestore: false,
  }));
  assert.match(explorerMarkup, /Knowledge Center/);
  assert.match(explorerMarkup, /Deterministic · No AI/);
  assert.match(explorerMarkup, /Create Relationship/);

  const detailMarkup = renderToStaticMarkup(createElement(KnowledgeNodeDetail, {
    node: school,
    nodes: graph.nodes,
    relationships: [relationship],
    sources: graph.sources,
    integrityWarnings: [],
    actionPending: false,
    onOpenNode: () => undefined,
    onEdit: () => undefined,
    onArchive: () => undefined,
    onArchiveRelationship: () => undefined,
  }));
  assert.match(detailMarkup, /Canonical History/);
  assert.match(detailMarkup, /Archive the active relationships first/);
  assert.match(detailMarkup, /Archive relationship/);

  const sourceDetailMarkup = renderToStaticMarkup(createElement(KnowledgeSourceDetail, {
    source,
    actionPending: false,
    onArchive: () => undefined,
  }));
  assert.match(sourceDetailMarkup, /Source Provenance/);
  assert.match(sourceDetailMarkup, /Canonical History/);
  assert.match(sourceDetailMarkup, /Archive source/);

  const nodeFormMarkup = renderToStaticMarkup(createElement(KnowledgeNodeForm, {
    nodes: graph.nodes,
    sources: graph.sources,
    pending: false,
    onSubmit: () => undefined,
  }));
  assert.match(nodeFormMarkup, /Greater Lakes/);
  assert.match(nodeFormMarkup, /Mid-Atlantic/);
  assert.match(nodeFormMarkup, /Conference, Coach, Facility, Project, and Content facts/);
  assert.doesNotMatch(nodeFormMarkup, /value="national"|value="west"|value="international"/);

  const editNodeFormMarkup = renderToStaticMarkup(createElement(KnowledgeNodeForm, {
    node: {
      ...school,
      enrollment: 0,
      tuition: { inState: 0, outOfState: 0, currency: "USD" },
    },
    nodes: graph.nodes,
    sources: graph.sources,
    pending: false,
    onSubmit: () => undefined,
  }));
  assert.match(editNodeFormMarkup, /name="enrollment"[^>]*value="0"/);
  assert.match(editNodeFormMarkup, /name="tuitionInState"[^>]*value="0"/);
  assert.match(editNodeFormMarkup, /name="tuitionOutOfState"[^>]*value="0"/);
  assert.match(editNodeFormMarkup, new RegExp(`name="lastVerifiedAt"[^>]*value="${formatKnowledgeSourceDateTimeLocal(school.lastVerifiedAt)}"`));

  const relationshipFormMarkup = renderToStaticMarkup(createElement(KnowledgeRelationshipForm, {
    nodes: graph.nodes,
    sources: graph.sources,
    pending: false,
    onSubmit: () => undefined,
  }));
  assert.match(relationshipFormMarkup, /School → State/);
  assert.match(relationshipFormMarkup, /Select School/);
  assert.match(relationshipFormMarkup, /Select State/);

  const sourceFormMarkup = renderToStaticMarkup(createElement(KnowledgeSourceForm, {
    pending: false,
    onSubmit: () => undefined,
  }));
  assert.match(sourceFormMarkup, /Accessed At/);
  assert.match(sourceFormMarkup, /does not search, infer, or populate facts automatically/);
});

test("blank optional School numbers remain absent instead of becoming unsupported zero facts", () => {
  assert.equal(parseOptionalNonNegativeNumber(null), undefined);
  assert.equal(parseOptionalNonNegativeNumber(""), undefined);
  assert.equal(parseOptionalNonNegativeNumber("   "), undefined);
  assert.equal(parseOptionalNonNegativeNumber("0"), 0);
  assert.equal(parseOptionalNonNegativeNumber("6692"), 6692);
});

test("the Founder node form maps every node type to its canonical category", () => {
  const expected: Record<KnowledgeNodeType, KnowledgeCategory> = {
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
  for (const type of Object.values(KnowledgeNodeType)) {
    assert.equal(knowledgeCategoryForNodeType(type), expected[type]);
  }
});

test("Knowledge Graph authorization inherits the fail-closed Headquarters admin policy", async () => {
  assert.deepEqual(await adminAuthorizationService.authorize({ uid: actorId }, async () => ({ exists: true, role: "admin" })), { allowed: true, reason: "admin" });
  assert.deepEqual(await adminAuthorizationService.authorize({ uid: "member" }, async () => ({ exists: true, role: "member" })), { allowed: false, reason: "not-admin" });
  assert.deepEqual(await adminAuthorizationService.authorize(null, async () => ({ exists: true, role: "admin" })), { allowed: false, reason: "unauthenticated" });
});

test("runtime parsers reject malformed relationship, source, and audit histories", async () => {
  const { repository } = await repositoryWithSources();
  await createCanonicalNodes(repository);
  const relationship = await repository.createRelationship(
    relationshipInput("relationship-school-state", "school-ashland", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState),
    context,
  );
  const source = await repository.getSourceById(officialSourceId);
  const node = await repository.getNodeById("school-ashland");
  const audit = (await repository.listAuditEvents(workspaceId))[0];
  assert.ok(source && node && audit);
  assert.throws(() => parseKnowledgeRelationship({ ...relationship, confidenceHistory: [] }), /history cannot be empty/i);
  assert.throws(() => parseKnowledgeRelationship({ ...relationship, relationshipType: "INVENTED" }), /type is invalid/i);
  assert.throws(() => parseKnowledgeSource({ ...source, versionHistory: [{ ...source.versionHistory[0], reliability: "invented" }] }), /reliability is invalid/i);
  assert.throws(() => parseKnowledgeAuditEvent({ ...audit, metadata: { invalid: [] } }), /metadata values/i);
  const { version: _version, ...auditWithoutVersion } = audit;
  void _version;
  assert.throws(() => parseKnowledgeAuditEvent(auditWithoutVersion), /Audit version must be a positive integer/i);
  assert.equal(migrateLegacyKnowledgeAuditEventRead(auditWithoutVersion).version, 1);
  assert.throws(() => migrateLegacyKnowledgeAuditEventRead({ ...audit, version: 0 }), /Audit version must be a positive integer/i);
  assert.throws(() => parseKnowledgeNode({ ...node, unsupportedPersistedField: true }), /unsupported field/i);
  assert.throws(() => parseKnowledgeRelationship({ ...relationship, unsupportedPersistedField: true }), /unsupported field/i);
  assert.throws(() => parseKnowledgeSource({ ...source, unsupportedPersistedField: true }), /unsupported field/i);
  assert.throws(() => parseKnowledgeAuditEvent({ ...audit, unsupportedPersistedField: true }), /unsupported field/i);
  assert.throws(() => parseKnowledgeNode({
    ...node,
    versionHistory: [{ ...node.versionHistory[0], unsupportedPersistedField: true }],
  }), /unsupported field/i);
  assert.throws(() => parseKnowledgeRelationship({
    ...relationship,
    confidenceHistory: [{ ...relationship.confidenceHistory[0], unsupportedPersistedField: true }],
  }), /unsupported field/i);
  assert.throws(() => parseKnowledgeSource({
    ...source,
    statusHistory: [{ ...source.statusHistory[0], unsupportedPersistedField: true }],
  }), /unsupported field/i);
  assert.throws(() => parseKnowledgeRelationship({
    ...relationship,
    version: 3,
    versionHistory: [
      relationship.versionHistory[0],
      { ...relationship.versionHistory[0], version: 3 },
    ],
  }), /every canonical version from 1 through 3/i);
});

test("runtime validation enforces Firestore identity and collection bounds before persistence", async () => {
  const store = createVolatileKnowledgeGraphStore();
  const repository = createInMemoryKnowledgeGraphRepository(store, { now: deterministicClock() });
  await repository.createSource(sourceInput(), context);
  await assert.rejects(
    () => repository.createNode({
      ...generalNodeInput("state-conflicting-one-source", KnowledgeNodeType.State, "Conflicting State"),
      confidence: KnowledgeConfidence.Conflicting,
    }, context),
    /Conflicting knowledge requires at least two sources/i,
  );
  await assert.rejects(
    () => repository.createNode(generalNodeInput("state-punctuation", KnowledgeNodeType.State, "!!!"), context),
    /name must contain at least one letter or number/i,
  );
  await assert.rejects(
    () => repository.createNode(generalNodeInput("state id with spaces", KnowledgeNodeType.State, "Invalid ID State"), context),
    /Knowledge node ID must use only/i,
  );
  await assert.rejects(
    () => repository.createNode({
      ...generalNodeInput("state-alias-bound", KnowledgeNodeType.State, "Alias Bound State"),
      aliases: Array.from({ length: 4 }, (_, index) => `Alias ${index + 1}`),
    }, context),
    /at most three distinct aliases/i,
  );
  await assert.rejects(
    () => repository.createNode({
      ...generalNodeInput("state-empty-alias", KnowledgeNodeType.State, "Empty Alias State"),
      aliases: ["---"],
    }, context),
    /aliases must contain at least one letter or number/i,
  );
  await assert.rejects(
    () => repository.createSource({
      ...sourceInput("source-project-bound"),
      projectIds: Array.from({ length: 65 }, (_, index) => `project-${index + 1}`),
    }, context),
    /at most 64 projects/i,
  );
});
