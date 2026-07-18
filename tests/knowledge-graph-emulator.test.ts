import assert from "node:assert/strict";
import test from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, type Firestore, getDoc, serverTimestamp, setDoc, setLogLevel } from "firebase/firestore";
import { readFile } from "node:fs/promises";
import {
  canonicalKnowledgeAuditEventId,
  createFirestoreKnowledgeGraphRepository,
  KnowledgeConfidence,
  KnowledgeNodeType,
  KnowledgeRelationshipType,
  KnowledgeStatus,
} from "@/domain/knowledge";
import {
  emulatorActorId,
  emulatorContentInput,
  emulatorContext,
  emulatorNodeInput,
  emulatorProjectInput,
  emulatorRelationshipInput,
  emulatorSchoolInput,
  emulatorSourceInput,
  emulatorWorkspaceId,
  firstTwoTransactionBarrier,
} from "./knowledge-graph-emulator-fixtures";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

setLogLevel("silent");

test("Firestore repository closes canonical, alias, relationship, and exclusive-claim races", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const testEnvironment = await initializeTestEnvironment({
    projectId: "hoopfrens-web-integrity-test",
    firestore: {
      host,
      port: Number(portValue),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });

  let stage = "administrator setup";
  try {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", emulatorActorId), { role: "admin" });
    });
    const adminDb = testEnvironment.authenticatedContext(emulatorActorId).firestore() as unknown as Firestore;
    const repository = createFirestoreKnowledgeGraphRepository(adminDb);
    stage = "source setup";
    await repository.createSource(emulatorSourceInput("source-official"), emulatorContext);
    await repository.createSource(emulatorSourceInput("source-catalog"), emulatorContext);

    stage = "canonical node race";
    const nodeBarrier = firstTwoTransactionBarrier();
    const nodeRepositoryA = createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: nodeBarrier });
    const nodeRepositoryB = createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: nodeBarrier });
    const [canonicalNodeA, canonicalNodeB] = await Promise.all([
      nodeRepositoryA.createNode(emulatorNodeInput("state-race-a", KnowledgeNodeType.State, "Race State"), emulatorContext),
      nodeRepositoryB.createNode(emulatorNodeInput("state-race-b", KnowledgeNodeType.State, "Race State"), emulatorContext),
    ]);
    assert.equal(canonicalNodeA.id, canonicalNodeB.id);
    assert.equal((await repository.listNodes(emulatorWorkspaceId)).filter((node) => node.name === "Race State").length, 1);

    stage = "canonical alias race";
    const aliasBarrier = firstTwoTransactionBarrier();
    const aliasResults = await Promise.allSettled([
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: aliasBarrier }).createNode({
        ...emulatorNodeInput("state-alias-a", KnowledgeNodeType.State, "Alias State A"),
        aliases: ["Shared Alias"],
      }, emulatorContext),
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: aliasBarrier }).createNode({
        ...emulatorNodeInput("state-alias-b", KnowledgeNodeType.State, "Alias State B"),
        aliases: ["Shared Alias"],
      }, emulatorContext),
    ]);
    assert.equal(aliasResults.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(aliasResults.filter((result) => result.status === "rejected").length, 1);
    assert.equal((await repository.listNodes(emulatorWorkspaceId)).filter((node) => node.aliases.includes("Shared Alias")).length, 1);

    stage = "relationship fixture nodes";
    await repository.createNode(emulatorNodeInput("state-ohio", KnowledgeNodeType.State, "Ohio"), emulatorContext);
    await repository.createNode(emulatorNodeInput("state-pennsylvania", KnowledgeNodeType.State, "Pennsylvania"), emulatorContext);
    await repository.createNode(emulatorNodeInput("region-greater-lakes", KnowledgeNodeType.Region, "Greater Lakes"), emulatorContext);
    await repository.createNode(emulatorNodeInput("coach-rules", KnowledgeNodeType.Coach, "Coach Rules"), emulatorContext);
    await repository.createNode(emulatorNodeInput("player-rules", KnowledgeNodeType.Player, "Player Rules"), emulatorContext);
    await repository.createNode(emulatorNodeInput(
      "organization-audit-archive",
      KnowledgeNodeType.Organization,
      "Audit Archive Organization",
    ), emulatorContext);
    await repository.createNode(emulatorSchoolInput("school-race-one", "Race University One"), emulatorContext);
    await repository.createNode(emulatorSchoolInput("school-race-two", "Race University Two"), emulatorContext);
    await repository.createNode(emulatorSchoolInput("school-archive-race", "Archive Race University"), emulatorContext);

    stage = "canonical relationship race";
    const relationshipBarrier = firstTwoTransactionBarrier();
    const [canonicalRelationshipA, canonicalRelationshipB] = await Promise.all([
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: relationshipBarrier }).createRelationship(
        emulatorRelationshipInput("relationship-race-a", "school-race-one", "state-ohio"), emulatorContext,
      ),
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: relationshipBarrier }).createRelationship(
        emulatorRelationshipInput("relationship-race-b", "school-race-one", "state-ohio"), emulatorContext,
      ),
    ]);
    assert.equal(canonicalRelationshipA.id, canonicalRelationshipB.id);
    const exactRelationships = (await repository.listRelationships(emulatorWorkspaceId)).filter((relationship) => (
      relationship.fromNodeId === "school-race-one"
      && relationship.toNodeId === "state-ohio"
      && relationship.relationshipType === KnowledgeRelationshipType.SchoolLocatedInState
    ));
    assert.equal(exactRelationships.length, 1);

    stage = "relationship create audit atomicity";
    const relationshipAuditFailure = createFirestoreKnowledgeGraphRepository(adminDb, {
      beforeAuditWrite: async (event) => {
        if (event.subjectId === "relationship-audit-repair") throw new Error("Injected relationship audit write failure.");
      },
    });
    await assert.rejects(
      () => relationshipAuditFailure.createRelationship(
        emulatorRelationshipInput(
          "relationship-audit-repair",
          "school-race-one",
          "region-greater-lakes",
          KnowledgeRelationshipType.SchoolLocatedInRegion,
        ),
        emulatorContext,
      ),
      /Injected relationship audit write failure/i,
    );
    assert.equal(await repository.getRelationshipById("relationship-audit-repair"), null);
    const retriedRelationship = await repository.createRelationship(
      emulatorRelationshipInput(
        "relationship-audit-repair",
        "school-race-one",
        "region-greater-lakes",
        KnowledgeRelationshipType.SchoolLocatedInRegion,
      ),
      emulatorContext,
    );
    assert.equal((await repository.listAuditEvents(emulatorWorkspaceId))
      .some((event) => event.id === retriedRelationship.lastAuditEventId), true);

    stage = "relationship update audit atomicity";
    const relationshipBeforeFailedUpdate = await repository.createRelationship(
      emulatorRelationshipInput(
        "relationship-audit-update-repair",
        "player-rules",
        "school-race-one",
        KnowledgeRelationshipType.PlayerConnectedToSchool,
      ),
      emulatorContext,
    );
    const relationshipUpdateAuditFailure = createFirestoreKnowledgeGraphRepository(adminDb, {
      beforeAuditWrite: async (event) => {
        if (event.subjectId === "relationship-audit-update-repair" && event.version === 2) {
          throw new Error("Injected relationship update audit failure.");
        }
      },
    });
    await assert.rejects(
      () => relationshipUpdateAuditFailure.updateRelationship(
        relationshipBeforeFailedUpdate.id,
        { description: "Update that must not persist without its audit." },
        { actorId: emulatorActorId, reason: "Inject an atomic relationship update failure." },
      ),
      /Injected relationship update audit failure/i,
    );
    const relationshipAfterFailedUpdate = await repository.getRelationshipById(relationshipBeforeFailedUpdate.id);
    assert.ok(relationshipAfterFailedUpdate);
    assert.equal(relationshipAfterFailedUpdate.version, 1);
    assert.equal(relationshipAfterFailedUpdate.description, relationshipBeforeFailedUpdate.description);
    const relationshipAfterRetry = await repository.updateRelationship(
      relationshipBeforeFailedUpdate.id,
      { description: "Update after the atomic failure." },
      { actorId: emulatorActorId, reason: "Validate atomic retry behavior." },
    );
    const relationshipRepairAuditIds = new Set((await repository.listAuditEvents(emulatorWorkspaceId)).map((event) => event.id));
    assert.equal(relationshipAfterRetry.version, 2);
    assert.ok(relationshipRepairAuditIds.has(relationshipBeforeFailedUpdate.lastAuditEventId));
    assert.ok(relationshipRepairAuditIds.has(relationshipAfterRetry.lastAuditEventId));

    stage = "node update audit atomicity";
    const nodeBeforeFailedUpdate = await repository.getNodeById("state-pennsylvania");
    assert.ok(nodeBeforeFailedUpdate);
    const nodeAuditFailure = createFirestoreKnowledgeGraphRepository(adminDb, {
      beforeAuditWrite: async (event) => {
        if (event.subjectId === "state-pennsylvania" && event.version === 2) throw new Error("Injected node audit write failure.");
      },
    });
    await assert.rejects(
      () => nodeAuditFailure.updateNode("state-pennsylvania", {
        description: "Canonical update that must not persist without its audit.",
      }, { actorId: emulatorActorId, reason: "Inject an atomic node update failure." }),
      /Injected node audit write failure/i,
    );
    const nodeAfterFailedUpdate = await repository.getNodeById("state-pennsylvania");
    assert.ok(nodeAfterFailedUpdate);
    assert.equal(nodeAfterFailedUpdate.version, 1);
    assert.equal(nodeAfterFailedUpdate.description, nodeBeforeFailedUpdate.description);
    assert.equal((await repository.listAuditEvents(emulatorWorkspaceId))
      .some((event) => event.id === nodeAfterFailedUpdate.lastAuditEventId), true);
    const nodeAfterRetry = await repository.updateNode("state-pennsylvania", {
      description: "Canonical update after the atomic failure.",
    }, { actorId: emulatorActorId, reason: "Validate atomic node retry behavior." });
    const nodeAuditIds = new Set((await repository.listAuditEvents(emulatorWorkspaceId)).map((event) => event.id));
    assert.equal(nodeAfterRetry.version, 2);
    assert.ok(nodeAuditIds.has(nodeBeforeFailedUpdate.lastAuditEventId));
    assert.ok(nodeAuditIds.has(nodeAfterRetry.lastAuditEventId));

    stage = "node archive audit atomicity";
    const nodeBeforeFailedArchiveUpdate = await repository.getNodeById("organization-audit-archive");
    assert.ok(nodeBeforeFailedArchiveUpdate);
    const nodeArchiveAuditFailure = createFirestoreKnowledgeGraphRepository(adminDb, {
      beforeAuditWrite: async (event) => {
        if (event.subjectId === "organization-audit-archive" && event.version === 2) {
          throw new Error("Injected node audit failure before archive.");
        }
      },
    });
    await assert.rejects(
      () => nodeArchiveAuditFailure.updateNode("organization-audit-archive", {
        description: "Canonical update awaiting repair before archival.",
      }, { actorId: emulatorActorId, reason: "Injected node audit failure before archive." }),
      /Injected node audit failure before archive/i,
    );
    const nodeAfterFailedArchiveUpdate = await repository.getNodeById("organization-audit-archive");
    assert.ok(nodeAfterFailedArchiveUpdate);
    assert.equal(nodeAfterFailedArchiveUpdate.version, 1);
    assert.equal(nodeAfterFailedArchiveUpdate.description, nodeBeforeFailedArchiveUpdate.description);
    const archivedNode = await repository.archiveNode("organization-audit-archive", {
      actorId: emulatorActorId,
      reason: "Archive after the atomic update failure.",
    });
    const nodeArchiveAuditIds = new Set((await repository.listAuditEvents(emulatorWorkspaceId))
      .map((event) => event.id));
    assert.equal(archivedNode.version, 2);
    assert.equal(archivedNode.status, KnowledgeStatus.Archived);
    assert.ok(nodeArchiveAuditIds.has(nodeBeforeFailedArchiveUpdate.lastAuditEventId));
    assert.ok(nodeArchiveAuditIds.has(archivedNode.lastAuditEventId));

    stage = "authenticated archive operations";
    const coachRelationship = await repository.createRelationship(
      emulatorRelationshipInput(
        "relationship-school-coach",
        "school-race-one",
        "coach-rules",
        KnowledgeRelationshipType.SchoolHasCoach,
      ),
      emulatorContext,
    );
    const inverseRetry = await repository.createRelationship(
      emulatorRelationshipInput(
        "relationship-coach-school",
        "coach-rules",
        "school-race-one",
        KnowledgeRelationshipType.CoachWorksAtSchool,
      ),
      emulatorContext,
    );
    assert.equal(inverseRetry.id, coachRelationship.id);
    const updatedCoachRelationship = await repository.updateRelationship(coachRelationship.id, {
      description: "Canonical relationship update before archival.",
    }, { actorId: emulatorActorId, reason: "Exercise authenticated relationship update." });
    assert.equal(updatedCoachRelationship.version, 2);
    const archivedCoachRelationship = await repository.archiveRelationship(coachRelationship.id, {
      actorId: emulatorActorId,
      reason: "Exercise authenticated relationship archival.",
    });
    assert.equal(archivedCoachRelationship.status, KnowledgeStatus.Archived);
    const archivedCoach = await repository.archiveNode("coach-rules", {
      actorId: emulatorActorId,
      reason: "Exercise authenticated node archival.",
    });
    assert.equal(archivedCoach.status, KnowledgeStatus.Archived);
    const unusedSource = await repository.createSource(emulatorSourceInput("source-unused"), emulatorContext);
    const archivedUnusedSource = await repository.archiveSource(unusedSource.id, {
      actorId: emulatorActorId,
      reason: "Exercise authenticated source archival.",
    });
    assert.equal(archivedUnusedSource.status, KnowledgeStatus.Archived);
    await assert.rejects(
      () => repository.createNode(
        emulatorNodeInput("state-missing-source", KnowledgeNodeType.State, "Missing Source State", ["source-missing"]),
        emulatorContext,
      ),
      /missing/i,
    );
    await assert.rejects(
      () => repository.createNode(
        emulatorNodeInput("state-archived-source", KnowledgeNodeType.State, "Archived Source State", [unusedSource.id]),
        emulatorContext,
      ),
      /archived|unavailable/i,
    );
    const foreignSource = await repository.createSource({
      ...emulatorSourceInput("source-foreign"),
      workspaceId: "foreign-workspace",
    }, emulatorContext);
    await assert.rejects(
      () => repository.createNode(
        emulatorNodeInput("state-foreign-source", KnowledgeNodeType.State, "Foreign Source State", [foreignSource.id]),
        emulatorContext,
      ),
      /unavailable/i,
    );
    const auditIds = new Set((await repository.listAuditEvents(emulatorWorkspaceId)).map((event) => event.id));
    for (const record of [archivedCoachRelationship, archivedCoach, archivedUnusedSource]) {
      assert.ok(auditIds.has(record.lastAuditEventId));
    }

    stage = "exclusive relationship conflict race";
    const exclusiveBarrier = firstTwoTransactionBarrier();
    await Promise.all([
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: exclusiveBarrier }).createRelationship(
        emulatorRelationshipInput("relationship-exclusive-ohio", "school-race-two", "state-ohio", KnowledgeRelationshipType.SchoolLocatedInState, ["source-official", "source-catalog"]),
        emulatorContext,
      ),
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: exclusiveBarrier }).createRelationship(
        emulatorRelationshipInput("relationship-exclusive-pa", "school-race-two", "state-pennsylvania", KnowledgeRelationshipType.SchoolLocatedInState, ["source-catalog"]),
        emulatorContext,
      ),
    ]);
    const exclusiveRelationships = (await repository.listRelationships(emulatorWorkspaceId)).filter((relationship) => (
      relationship.fromNodeId === "school-race-two"
      && relationship.relationshipType === KnowledgeRelationshipType.SchoolLocatedInState
    ));
    assert.equal(exclusiveRelationships.length, 2);
    assert.ok(exclusiveRelationships.every((relationship) => relationship.confidence === KnowledgeConfidence.Conflicting));
    assert.deepEqual(
      exclusiveRelationships.map((relationship) => relationship.sourceIds).sort((a, b) => a[0].localeCompare(b[0])),
      [["source-catalog"], ["source-official", "source-catalog"]],
    );

    stage = "node archive versus relationship-create race";
    const archiveRelationshipBarrier = firstTwoTransactionBarrier();
    const archiveRelationshipRace = await Promise.allSettled([
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: archiveRelationshipBarrier }).archiveNode(
        "school-archive-race",
        { actorId: emulatorActorId, reason: "Race node archival against relationship creation." },
      ),
      createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: archiveRelationshipBarrier }).createRelationship(
        emulatorRelationshipInput(
          "relationship-archive-race",
          "school-archive-race",
          "state-ohio",
          KnowledgeRelationshipType.SchoolLocatedInState,
        ),
        emulatorContext,
      ),
    ]);
    assert.equal(archiveRelationshipRace.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(archiveRelationshipRace.filter((result) => result.status === "rejected").length, 1);
    const archiveRaceNode = await repository.getNodeById("school-archive-race");
    const archiveRaceRelationship = await repository.getRelationshipById("relationship-archive-race");
    assert.ok(archiveRaceNode);
    assert.equal(
      archiveRaceNode.status === KnowledgeStatus.Archived,
      !archiveRaceRelationship || archiveRaceRelationship.status !== KnowledgeStatus.Active,
    );

    await assert.rejects(
      () => repository.archiveNode("school-race-two", emulatorContext),
      /Archive the active relationships first/i,
    );
    await assert.rejects(
      () => repository.archiveSource("source-official", emulatorContext),
      /active knowledge claims/i,
    );
  } catch (error) {
    throw new Error(`Integrity emulator stage failed: ${stage}.`, { cause: error });
  } finally {
    await testEnvironment.cleanup();
  }
});

test("Firestore rules accept the canonical endpoint policy for all eleven relationship types", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const testEnvironment = await initializeTestEnvironment({
    projectId: "hoopfrens-web-relationship-policy-test",
    firestore: {
      host,
      port: Number(portValue),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });

  try {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", emulatorActorId), { role: "admin" });
    });
    const adminDb = testEnvironment.authenticatedContext(emulatorActorId).firestore() as unknown as Firestore;
    const repository = createFirestoreKnowledgeGraphRepository(adminDb);
    await repository.createSource(emulatorSourceInput("source-official"), emulatorContext);
    await repository.createNode(emulatorNodeInput("state-policy", KnowledgeNodeType.State, "Ohio"), emulatorContext);
    await repository.createNode(emulatorNodeInput("region-policy", KnowledgeNodeType.Region, "Greater Lakes"), emulatorContext);
    await repository.createNode(emulatorNodeInput("conference-policy-a", KnowledgeNodeType.Conference, "Policy Conference A"), emulatorContext);
    await repository.createNode(emulatorNodeInput("conference-policy-b", KnowledgeNodeType.Conference, "Policy Conference B"), emulatorContext);
    await repository.createNode(emulatorNodeInput("coach-policy-a", KnowledgeNodeType.Coach, "Policy Coach A"), emulatorContext);
    await repository.createNode(emulatorNodeInput("coach-policy-b", KnowledgeNodeType.Coach, "Policy Coach B"), emulatorContext);
    await repository.createNode(emulatorNodeInput("facility-policy-a", KnowledgeNodeType.Facility, "Policy Facility A"), emulatorContext);
    await repository.createNode(emulatorNodeInput("facility-policy-b", KnowledgeNodeType.Facility, "Policy Facility B"), emulatorContext);
    await repository.createNode(emulatorNodeInput("player-policy", KnowledgeNodeType.Player, "Policy Player"), emulatorContext);
    await repository.createNode({
      ...emulatorSchoolInput("school-policy-a", "Policy University A"),
      stateNodeId: "state-policy",
      regionNodeId: "region-policy",
    }, emulatorContext);
    await repository.createNode({
      ...emulatorSchoolInput("school-policy-b", "Policy University B"),
      stateNodeId: "state-policy",
      regionNodeId: "region-policy",
    }, emulatorContext);
    await repository.createNode(emulatorProjectInput("project-policy", "Policy Project"), emulatorContext);
    await repository.createNode(emulatorContentInput("content-policy", "Policy Content"), emulatorContext);

    const cases = [
      ["relationship-policy-school-conference", "school-policy-a", "conference-policy-a", KnowledgeRelationshipType.SchoolBelongsToConference],
      ["relationship-policy-school-state", "school-policy-a", "state-policy", KnowledgeRelationshipType.SchoolLocatedInState],
      ["relationship-policy-school-region", "school-policy-a", "region-policy", KnowledgeRelationshipType.SchoolLocatedInRegion],
      ["relationship-policy-school-coach", "school-policy-a", "coach-policy-a", KnowledgeRelationshipType.SchoolHasCoach],
      ["relationship-policy-school-facility", "school-policy-a", "facility-policy-a", KnowledgeRelationshipType.SchoolHasFacility],
      ["relationship-policy-project-school", "project-policy", "school-policy-a", KnowledgeRelationshipType.ProjectAboutSchool],
      ["relationship-policy-content-school", "content-policy", "school-policy-a", KnowledgeRelationshipType.ContentAboutSchool],
      ["relationship-policy-coach-school", "coach-policy-b", "school-policy-b", KnowledgeRelationshipType.CoachWorksAtSchool],
      ["relationship-policy-conference-school", "conference-policy-b", "school-policy-b", KnowledgeRelationshipType.ConferenceGovernsSchool],
      ["relationship-policy-player-school", "player-policy", "school-policy-a", KnowledgeRelationshipType.PlayerConnectedToSchool],
      ["relationship-policy-facility-school", "facility-policy-b", "school-policy-b", KnowledgeRelationshipType.FacilityBelongsToSchool],
    ] as const;

    const createdTypes = [];
    for (const [id, fromNodeId, toNodeId, relationshipType] of cases) {
      const relationship = await repository.createRelationship(
        emulatorRelationshipInput(id, fromNodeId, toNodeId, relationshipType),
        emulatorContext,
      ).catch((error: unknown) => {
        throw new Error(`Relationship policy failed for ${relationshipType}.`, { cause: error });
      });
      createdTypes.push(relationship.relationshipType);
    }
    assert.deepEqual(new Set(createdTypes), new Set(Object.values(KnowledgeRelationshipType)));
  } finally {
    await testEnvironment.cleanup();
  }
});

test("legacy records upgrade safely and legacy dependencies still block archival", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const testEnvironment = await initializeTestEnvironment({
    projectId: "hoopfrens-web-legacy-test",
    firestore: {
      host,
      port: Number(portValue),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
  const legacyTime = "2026-07-17T12:00:00.000Z";

  try {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "users", emulatorActorId), { role: "admin" });
      await setDoc(doc(firestore, "internalKnowledgeSources", "legacy-source"), {
        id: "legacy-source",
        workspaceId: emulatorWorkspaceId,
        title: "Legacy Official Source",
        sourceType: "official",
        accessedAt: legacyTime,
        reliability: "official",
        projectIds: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "active",
      });
      await setDoc(doc(firestore, "internalKnowledgeSources", "legacy-source-two"), {
        id: "legacy-source-two",
        workspaceId: emulatorWorkspaceId,
        title: "Second Legacy Official Source",
        sourceType: "official",
        accessedAt: legacyTime,
        reliability: "official",
        projectIds: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "active",
      });
      await setDoc(doc(firestore, "internalKnowledgeNodes", "legacy-state"), {
        id: "legacy-state",
        workspaceId: emulatorWorkspaceId,
        type: "state",
        category: "geography",
        name: "Ohio",
        description: "Legacy state record.",
        confidence: "verified",
        sourceIds: ["legacy-source", "legacy-source-two"],
        aliases: [],
        tags: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "active",
        confidenceHistory: [{
          from: "unverified",
          to: "verified",
          changedAt: legacyTime,
          changedBy: emulatorActorId,
          reason: "Founder verified the legacy State.",
          sources: [{ sourceId: "legacy-source", title: "Legacy Official Source" }],
        }],
      });
      await setDoc(doc(firestore, "internalKnowledgeNodes", "legacy-school"), {
        id: "legacy-school",
        workspaceId: emulatorWorkspaceId,
        type: "school",
        category: "institution",
        name: "Legacy University",
        description: "Legacy School record.",
        confidence: "verified",
        sourceIds: ["legacy-source", "legacy-source-two"],
        aliases: [],
        tags: [],
        officialName: "Legacy University",
        city: "Ashland",
        state: "Ohio",
        stateNodeId: "legacy-state",
        region: "greater_lakes",
        regionNodeId: "legacy-region",
        conference: null,
        division: "NCAA Division II",
        governingBody: "NCAA",
        schoolWebsite: "https://example.edu",
        athleticsWebsite: "https://example.edu/athletics",
        facilities: [],
        coaches: [],
        recruitingNotes: [],
        connectedProjectIds: [],
        connectedContentIds: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "active",
      });
      await setDoc(doc(firestore, "internalKnowledgeNodes", "legacy-region"), {
        id: "legacy-region",
        workspaceId: emulatorWorkspaceId,
        type: "region",
        category: "geography",
        name: "Greater Lakes",
        description: "Legacy region record.",
        confidence: "verified",
        sourceIds: ["legacy-source", "legacy-source-two"],
        aliases: [],
        tags: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "active",
      });
      await setDoc(doc(firestore, "internalKnowledgeRelationships", "legacy-school-state"), {
        id: "legacy-school-state",
        workspaceId: emulatorWorkspaceId,
        fromNodeId: "legacy-school",
        toNodeId: "legacy-state",
        relationshipType: "SCHOOL_LOCATED_IN_STATE",
        description: "Legacy relationship.",
        confidence: "verified",
        sourceIds: ["legacy-source", "legacy-source-two"],
        projectIds: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "active",
        lastAuditEventId: canonicalKnowledgeAuditEventId("relationship", "legacy-school-state", 1),
      });
      await setDoc(doc(
        firestore,
        "internalKnowledgeAuditEvents",
        canonicalKnowledgeAuditEventId("relationship", "legacy-school-state", 1),
      ), {
        id: canonicalKnowledgeAuditEventId("relationship", "legacy-school-state", 1),
        workspaceId: emulatorWorkspaceId,
        subjectType: "relationship",
        subjectId: "legacy-school-state",
        eventType: "created",
        actorId: emulatorActorId,
        occurredAt: legacyTime,
        summary: "Legacy relationship audit.",
        version: 1,
        metadata: {},
      });
      await setDoc(doc(firestore, "internalKnowledgeNodes", "legacy-archived-organization"), {
        id: "legacy-archived-organization",
        workspaceId: emulatorWorkspaceId,
        type: "organization",
        category: "organization",
        name: "Legacy Archived Organization",
        description: "Reserved legacy Organization identity.",
        confidence: "verified",
        sourceIds: ["legacy-source"],
        aliases: [],
        tags: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "archived",
      });
      await setDoc(doc(firestore, "internalKnowledgeRelationships", "legacy-archived-school-region"), {
        id: "legacy-archived-school-region",
        workspaceId: emulatorWorkspaceId,
        fromNodeId: "legacy-school",
        toNodeId: "legacy-region",
        relationshipType: "SCHOOL_LOCATED_IN_REGION",
        description: "Archived legacy relationship identity.",
        confidence: "verified",
        sourceIds: ["legacy-source"],
        projectIds: [],
        createdAt: legacyTime,
        updatedAt: legacyTime,
        createdBy: emulatorActorId,
        status: "archived",
      });
    });

    const adminDb = testEnvironment.authenticatedContext(emulatorActorId).firestore() as unknown as Firestore;
    const repository = createFirestoreKnowledgeGraphRepository(adminDb);
    const duplicateLegacySchool = await repository.createNode({
      ...emulatorSchoolInput("legacy-school-duplicate-attempt", "Legacy University"),
      stateNodeId: "legacy-state",
      regionNodeId: "legacy-region",
      sourceIds: ["legacy-source"],
    }, emulatorContext);
    assert.equal(duplicateLegacySchool.id, "legacy-school");
    const duplicateLegacyRelationship = await repository.createRelationship(
      emulatorRelationshipInput(
        "legacy-school-state-duplicate-attempt",
        "legacy-school",
        "legacy-state",
        KnowledgeRelationshipType.SchoolLocatedInState,
        ["legacy-source", "legacy-source-two"],
      ),
      emulatorContext,
    );
    assert.equal(duplicateLegacyRelationship.id, "legacy-school-state");
    const legacyRelationshipRegistry = await getDoc(doc(
      adminDb,
      "internalKnowledgeUniqueness",
      `relationship-registry:${emulatorWorkspaceId}`,
    ));
    assert.equal(
      legacyRelationshipRegistry.data()?.exactOwners?.[duplicateLegacyRelationship.identityKey],
      "legacy-school-state",
    );
    const legacyRelationshipAuditId = canonicalKnowledgeAuditEventId(
      "relationship",
      "legacy-school-state",
      1,
    );
    await assert.rejects(() => setDoc(doc(
      adminDb,
      "internalKnowledgeRelationships",
      "legacy-school-state",
    ), {
      id: "legacy-school-state",
      workspaceId: emulatorWorkspaceId,
      fromNodeId: "legacy-school",
      toNodeId: "legacy-state",
      relationshipType: KnowledgeRelationshipType.SchoolLocatedInState,
      description: "Attempt to canonicalize legacy history with a reused audit.",
      confidence: KnowledgeConfidence.Verified,
      sourceIds: ["legacy-source", "legacy-source-two"],
      sources: [],
      projectIds: [],
      createdAt: legacyTime,
      updatedAt: serverTimestamp(),
      createdBy: emulatorActorId,
      updatedBy: emulatorActorId,
      status: KnowledgeStatus.Active,
      version: 2,
      versionHistory: {
        legacyV1: {
          version: 1,
          changedAt: legacyTime,
          changedBy: emulatorActorId,
          reason: "Legacy relationship baseline.",
          description: "Legacy relationship.",
          confidence: KnowledgeConfidence.Verified,
          status: KnowledgeStatus.Active,
          sourceIds: ["legacy-source", "legacy-source-two"],
          projectIds: [],
        },
        v1: {
          version: 2,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
          reason: "Attempt to reuse the legacy audit.",
          description: "Attempt to canonicalize legacy history with a reused audit.",
          confidence: KnowledgeConfidence.Verified,
          status: KnowledgeStatus.Active,
          sourceIds: ["legacy-source", "legacy-source-two"],
          projectIds: [],
        },
      },
      confidenceHistory: {
        v1: {
          version: 1,
          from: KnowledgeConfidence.Verified,
          to: KnowledgeConfidence.Verified,
          changedAt: legacyTime,
          changedBy: emulatorActorId,
          reason: "Legacy relationship baseline.",
          sourceIds: ["legacy-source", "legacy-source-two"],
        },
      },
      statusHistory: {
        v1: {
          version: 1,
          from: KnowledgeStatus.Active,
          to: KnowledgeStatus.Active,
          changedAt: legacyTime,
          changedBy: emulatorActorId,
          reason: "Legacy relationship baseline.",
        },
      },
      latestVersionKey: "v1",
      latestConfidenceKey: "v1",
      latestStatusKey: "v1",
      identityKey: duplicateLegacyRelationship.identityKey,
      exclusiveClaimKey: duplicateLegacyRelationship.exclusiveClaimKey,
      legacyHistorySnapshot: {},
      lastAuditEventId: legacyRelationshipAuditId,
    }));
    const updatedLegacyRelationship = await repository.updateRelationship("legacy-school-state", {
      description: "Legacy relationship upgraded through the canonical repository.",
    }, { actorId: emulatorActorId, reason: "First canonical legacy relationship update." }).catch((error: unknown) => {
      throw new Error("Legacy relationship canonical upgrade failed.", { cause: error });
    });
    assert.equal(updatedLegacyRelationship.version, 2);
    assert.deepEqual(updatedLegacyRelationship.sourceIds, ["legacy-source", "legacy-source-two"]);
    await assert.rejects(
      () => repository.createNode(
        emulatorNodeInput(
          "legacy-archived-organization-duplicate-attempt",
          KnowledgeNodeType.Organization,
          "Legacy Archived Organization",
          ["legacy-source"],
        ),
        emulatorContext,
      ),
      /Historical knowledge identity remains reserved/i,
    );
    await assert.rejects(
      () => repository.createRelationship(
        emulatorRelationshipInput(
          "legacy-archived-school-region-duplicate-attempt",
          "legacy-school",
          "legacy-region",
          KnowledgeRelationshipType.SchoolLocatedInRegion,
          ["legacy-source"],
        ),
        emulatorContext,
      ),
      /Historical relationship identity remains reserved/i,
    );
    const updatedLegacyNode = await repository.updateNode("legacy-state", {
      description: "Legacy state upgraded through the canonical repository.",
    }, { actorId: emulatorActorId, reason: "First canonical legacy update." }).catch((error: unknown) => {
      throw new Error("Legacy node canonical upgrade failed.", { cause: error });
    });
    assert.equal(updatedLegacyNode.version, 3);
    assert.equal(updatedLegacyNode.versionHistory.length, 3);
    assert.equal(updatedLegacyNode.updatedBy, emulatorActorId);
    const persistedLegacyNode = await getDoc(doc(adminDb, "internalKnowledgeNodes", "legacy-state"));
    assert.deepEqual(persistedLegacyNode.data()?.legacyHistorySnapshot?.confidenceHistory, [{
      from: "unverified",
      to: "verified",
      changedAt: legacyTime,
      changedBy: emulatorActorId,
      reason: "Founder verified the legacy State.",
      sources: [{ sourceId: "legacy-source", title: "Legacy Official Source" }],
    }]);

    await assert.rejects(
      () => repository.archiveNode("legacy-state", emulatorContext),
      /legacy-school-state/i,
    );
    await assert.rejects(
      () => repository.archiveSource("legacy-source", emulatorContext),
      /legacy-(?:state|school)|legacy-school-state/i,
    );

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "internalKnowledgeNodes", "malformed-node"), {
        id: "malformed-node",
        workspaceId: emulatorWorkspaceId,
        type: "state",
        status: "invented",
      });
    });
    await assert.rejects(() => repository.getNodeById("malformed-node"), /required|invalid|malformed/i);

    assert.equal(updatedLegacyNode.status, KnowledgeStatus.Active);
  } finally {
    await testEnvironment.cleanup();
  }
});
