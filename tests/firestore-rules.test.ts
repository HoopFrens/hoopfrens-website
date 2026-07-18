import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  type DocumentData,
  type Firestore,
  getDoc,
  serverTimestamp,
  setLogLevel,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import {
  canonicalKnowledgeAuditEventId,
  createFirestoreKnowledgeGraphRepository,
  KnowledgeConfidence,
  KnowledgeNodeType,
} from "@/domain/knowledge";
import {
  emulatorActorId,
  emulatorContext,
  emulatorNodeInput,
  emulatorRelationshipInput,
  emulatorSchoolInput,
  emulatorSourceInput,
  emulatorWorkspaceId,
} from "./knowledge-graph-emulator-fixtures";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

setLogLevel("silent");

test("Knowledge Graph rules bind admin mutations to canonical records, actors, time, and immutable audits", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const testEnvironment = await initializeTestEnvironment({
    projectId: "hoopfrens-web-rules-test",
    firestore: {
      host,
      port: Number(portValue),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });

  try {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "users", emulatorActorId), { role: "admin" });
      await setDoc(doc(firestore, "users", "authenticated-member"), { role: "member" });
    });

    const adminDb = testEnvironment.authenticatedContext(emulatorActorId).firestore() as unknown as Firestore;
    const memberDb = testEnvironment.authenticatedContext("authenticated-member").firestore();
    const signedOutDb = testEnvironment.unauthenticatedContext().firestore();
    const repository = createFirestoreKnowledgeGraphRepository(adminDb);

    const source = await repository.createSource(emulatorSourceInput("source-official"), emulatorContext);
    assert.equal(source.createdBy, emulatorActorId);
    assert.equal(source.updatedBy, emulatorActorId);
    assert.equal(source.version, 1);
    assert.equal(source.versionHistory.length, 1);

    const state = await repository.createNode(
      emulatorNodeInput("state-ohio", KnowledgeNodeType.State, "Ohio"),
      emulatorContext,
    );
    const region = await repository.createNode(
      emulatorNodeInput("region-greater-lakes", KnowledgeNodeType.Region, "Greater Lakes"),
      emulatorContext,
    );
    const school = await repository.createNode(
      emulatorSchoolInput("school-rules", "Rules University"),
      emulatorContext,
    );
    const relationship = await repository.createRelationship(
      emulatorRelationshipInput("relationship-rules-state", "school-rules", "state-ohio"),
      emulatorContext,
    );
    for (const node of [state, region, school]) {
      assert.equal(node.versionHistory.length, 1);
      assert.equal(node.confidenceHistory.length, 1);
      assert.equal(node.statusHistory.length, 1);
      assert.equal(node.versionHistory[0].changedBy, emulatorActorId);
      assert.equal(node.confidenceHistory[0].changedBy, emulatorActorId);
      assert.equal(node.statusHistory[0].changedBy, emulatorActorId);
    }
    assert.equal(relationship.versionHistory.length, 1);
    assert.equal(relationship.confidenceHistory.length, 1);
    assert.equal(relationship.statusHistory.length, 1);
    assert.equal(relationship.versionHistory[0].changedBy, emulatorActorId);
    assert.equal(relationship.confidenceHistory[0].changedBy, emulatorActorId);
    assert.equal(relationship.statusHistory[0].changedBy, emulatorActorId);

    const setSubjectIndexed = async (subjectKey: string, indexed: boolean) => {
      await testEnvironment.withSecurityRulesDisabled(async (context) => {
        const registryReference = doc(
          context.firestore(),
          "internalKnowledgeUniqueness",
          `source-registry:${emulatorWorkspaceId}`,
        );
        const registrySnapshot = await getDoc(registryReference);
        const registry = registrySnapshot.data();
        assert.ok(registry);
        const currentKeys = Array.isArray(registry.subjectKeysBySource?.[source.id])
          ? registry.subjectKeysBySource[source.id] as string[]
          : [];
        const nextKeys = indexed
          ? [...new Set([...currentKeys, subjectKey])].sort()
          : currentKeys.filter((key) => key !== subjectKey);
        await setDoc(registryReference, {
          ...registry,
          subjectKeysBySource: {
            ...registry.subjectKeysBySource,
            [source.id]: nextKeys,
          },
        });
      });
    };

    const schoolReference = doc(adminDb, "internalKnowledgeNodes", "school-rules");
    const schoolSnapshot = await getDoc(schoolReference);
    const schoolRecord = schoolSnapshot.data();
    assert.ok(schoolRecord);
    await setSubjectIndexed("node:school-rules", false);
    const nodeAuditId = canonicalKnowledgeAuditEventId("node", "school-rules", 2);
    const nodeBatch = writeBatch(adminDb);
    nodeBatch.set(schoolReference, {
      ...schoolRecord,
      description: "Direct write without source usage indexing.",
      version: 2,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
      latestVersionKey: "v2",
      lastAuditEventId: nodeAuditId,
      versionHistory: {
        ...schoolRecord.versionHistory,
        v2: {
          ...schoolRecord.versionHistory.v1,
          version: 2,
          description: "Direct write without source usage indexing.",
          changedBy: emulatorActorId,
          changedAt: serverTimestamp(),
          reason: "Attempt an unindexed direct node write.",
        },
      },
    });
    nodeBatch.set(doc(adminDb, "internalKnowledgeAuditEvents", nodeAuditId), {
      id: nodeAuditId,
      workspaceId: emulatorWorkspaceId,
      subjectType: "node",
      subjectId: "school-rules",
      eventType: "updated",
      actorId: emulatorActorId,
      occurredAt: serverTimestamp(),
      summary: "Attempt an unindexed direct node write.",
      version: 2,
      metadata: {},
    });
    await assertFails(nodeBatch.commit());
    await setSubjectIndexed("node:school-rules", true);
    const embeddedNodeBatch = writeBatch(adminDb);
    embeddedNodeBatch.set(schoolReference, {
      ...schoolRecord,
      description: "Direct write with an embedded source summary.",
      sources: [{ sourceId: source.id, title: "Caller supplied title" }],
      version: 2,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
      latestVersionKey: "v2",
      lastAuditEventId: nodeAuditId,
      versionHistory: {
        ...schoolRecord.versionHistory,
        v2: {
          ...schoolRecord.versionHistory.v1,
          version: 2,
          description: "Direct write with an embedded source summary.",
          changedBy: emulatorActorId,
          changedAt: serverTimestamp(),
          reason: "Attempt to persist caller-supplied source metadata.",
        },
      },
    });
    embeddedNodeBatch.set(doc(adminDb, "internalKnowledgeAuditEvents", nodeAuditId), {
      id: nodeAuditId,
      workspaceId: emulatorWorkspaceId,
      subjectType: "node",
      subjectId: "school-rules",
      eventType: "updated",
      actorId: emulatorActorId,
      occurredAt: serverTimestamp(),
      summary: "Attempt to persist caller-supplied source metadata.",
      version: 2,
      metadata: {},
    });
    await assertFails(embeddedNodeBatch.commit());

    const relationshipReference = doc(adminDb, "internalKnowledgeRelationships", relationship.id);
    const relationshipSnapshot = await getDoc(relationshipReference);
    const relationshipRecord = relationshipSnapshot.data();
    assert.ok(relationshipRecord);

    const auditRecord = (
      subjectType: "node" | "relationship",
      subjectId: string,
      version: number,
      overrides: Record<string, unknown> = {},
    ) => {
      const id = canonicalKnowledgeAuditEventId(subjectType, subjectId, version);
      return {
        id,
        workspaceId: emulatorWorkspaceId,
        subjectType,
        subjectId,
        eventType: "updated",
        actorId: emulatorActorId,
        occurredAt: serverTimestamp(),
        summary: "Direct history-boundary validation.",
        version,
        metadata: {},
        ...overrides,
      };
    };

    const attemptNodeUpdate = async (
      overrides: Record<string, unknown> = {},
      auditOverrides: Record<string, unknown> = {},
    ) => {
      const target: DocumentData = {
        ...schoolRecord,
        description: "Direct node history-boundary validation.",
        ...overrides,
      };
      const auditId = canonicalKnowledgeAuditEventId("node", "school-rules", 2);
      const batch = writeBatch(adminDb);
      batch.set(schoolReference, {
        ...target,
        version: 2,
        updatedBy: emulatorActorId,
        updatedAt: serverTimestamp(),
        latestVersionKey: "v2",
        lastAuditEventId: auditId,
        versionHistory: {
          ...schoolRecord.versionHistory,
          v2: {
            ...schoolRecord.versionHistory.v1,
            version: 2,
            description: target.description,
            confidence: target.confidence,
            status: target.status,
            sourceIds: target.sourceIds,
            aliases: target.aliases,
            tags: target.tags,
            changedBy: emulatorActorId,
            changedAt: serverTimestamp(),
            reason: "Direct node history-boundary validation.",
          },
        },
      });
      batch.set(
        doc(adminDb, "internalKnowledgeAuditEvents", auditId),
        auditRecord("node", "school-rules", 2, auditOverrides),
      );
      return batch.commit();
    };

    const attemptRelationshipUpdate = async (
      overrides: Record<string, unknown> = {},
      auditOverrides: Record<string, unknown> = {},
    ) => {
      const target: DocumentData = {
        ...relationshipRecord,
        description: "Direct relationship history-boundary validation.",
        ...overrides,
      };
      const auditId = canonicalKnowledgeAuditEventId("relationship", relationship.id, 2);
      const batch = writeBatch(adminDb);
      batch.set(relationshipReference, {
        ...target,
        version: 2,
        updatedBy: emulatorActorId,
        updatedAt: serverTimestamp(),
        latestVersionKey: "v2",
        lastAuditEventId: auditId,
        versionHistory: {
          ...relationshipRecord.versionHistory,
          v2: {
            ...relationshipRecord.versionHistory.v1,
            version: 2,
            description: target.description,
            confidence: target.confidence,
            status: target.status,
            sourceIds: target.sourceIds,
            projectIds: target.projectIds,
            changedBy: emulatorActorId,
            changedAt: serverTimestamp(),
            reason: "Direct relationship history-boundary validation.",
          },
        },
      });
      batch.set(
        doc(adminDb, "internalKnowledgeAuditEvents", auditId),
        auditRecord("relationship", relationship.id, 2, auditOverrides),
      );
      return batch.commit();
    };

    await assertFails(attemptNodeUpdate({
      confidenceHistory: {
        ...schoolRecord.confidenceHistory,
        v1: { ...schoolRecord.confidenceHistory.v1, changedBy: "spoofed-history-actor" },
      },
    }));
    await assertFails(attemptNodeUpdate({ confidenceHistory: {} }));
    await assertFails(attemptNodeUpdate({
      statusHistory: {
        ...schoolRecord.statusHistory,
        v1: { ...schoolRecord.statusHistory.v1, changedAt: new Date("1999-01-01T00:00:00.000Z") },
      },
    }));
    await assertFails(attemptNodeUpdate({ confidence: KnowledgeConfidence.Supported }));
    await assertFails(attemptNodeUpdate({
      confidence: KnowledgeConfidence.Supported,
      latestConfidenceKey: "v2",
      confidenceHistory: {
        ...schoolRecord.confidenceHistory,
        v2: {
          version: 2,
          from: schoolRecord.confidence,
          to: KnowledgeConfidence.Supported,
          changedAt: serverTimestamp(),
          changedBy: "spoofed-history-actor",
          reason: "Attempt to spoof confidence attribution.",
          sourceIds: schoolRecord.sourceIds,
        },
      },
    }));
    await assertFails(attemptNodeUpdate({
      confidence: KnowledgeConfidence.Supported,
      latestConfidenceKey: "v2",
      confidenceHistory: {
        ...schoolRecord.confidenceHistory,
        v2: {
          version: 2,
          from: schoolRecord.confidence,
          to: KnowledgeConfidence.Supported,
          changedAt: new Date("2001-01-01T00:00:00.000Z"),
          changedBy: emulatorActorId,
          reason: "Attempt to spoof confidence time.",
          sourceIds: schoolRecord.sourceIds,
        },
      },
    }));

    await assertFails(attemptRelationshipUpdate({
      confidenceHistory: {
        ...relationshipRecord.confidenceHistory,
        v1: { ...relationshipRecord.confidenceHistory.v1, changedBy: "spoofed-history-actor" },
      },
    }));
    await assertFails(attemptRelationshipUpdate({ confidenceHistory: {} }));
    await assertFails(attemptRelationshipUpdate({
      statusHistory: {
        ...relationshipRecord.statusHistory,
        v1: { ...relationshipRecord.statusHistory.v1, reason: "Rewritten prior status history." },
      },
    }));
    await assertFails(attemptRelationshipUpdate({ confidence: KnowledgeConfidence.Supported }));
    await assertFails(attemptRelationshipUpdate({
      confidence: KnowledgeConfidence.Supported,
      latestConfidenceKey: "v2",
      confidenceHistory: {
        ...relationshipRecord.confidenceHistory,
        v2: {
          version: 2,
          from: relationshipRecord.confidence,
          to: KnowledgeConfidence.Supported,
          changedAt: serverTimestamp(),
          changedBy: "spoofed-history-actor",
          reason: "Attempt to spoof relationship confidence attribution.",
          sourceIds: relationshipRecord.sourceIds,
        },
      },
    }));
    await assertFails(attemptRelationshipUpdate({ confidence: "invented-confidence" }));
    await assertFails(attemptRelationshipUpdate({
      confidence: KnowledgeConfidence.Supported,
      latestConfidenceKey: "v2",
      confidenceHistory: {
        ...relationshipRecord.confidenceHistory,
        v2: {
          version: 2,
          from: relationshipRecord.confidence,
          to: KnowledgeConfidence.Supported,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
          reason: "Attempt to add an unsupported confidence history field.",
          sourceIds: relationshipRecord.sourceIds,
          unexpectedHistoryField: true,
        },
      },
    }));

    const relationshipRegistryReference = doc(
      adminDb,
      "internalKnowledgeUniqueness",
      `relationship-registry:${emulatorWorkspaceId}`,
    );
    const sourceRegistryReference = doc(
      adminDb,
      "internalKnowledgeUniqueness",
      `source-registry:${emulatorWorkspaceId}`,
    );
    const relationshipRegistryRecord = (await getDoc(relationshipRegistryReference)).data();
    const sourceRegistryRecord = (await getDoc(sourceRegistryReference)).data();
    assert.ok(relationshipRegistryRecord && sourceRegistryRecord);
    const archivedEndpointActive = {
      ...relationshipRegistryRecord.endpointActive,
      [relationshipRecord.fromNodeId]: relationshipRegistryRecord.endpointActive[relationshipRecord.fromNodeId]
        .filter((id: string) => id !== relationship.id),
      [relationshipRecord.toNodeId]: relationshipRegistryRecord.endpointActive[relationshipRecord.toNodeId]
        .filter((id: string) => id !== relationship.id),
    };
    const archivedExclusiveActive = {
      ...relationshipRegistryRecord.exclusiveActive,
      [relationshipRecord.exclusiveClaimKey]: relationshipRegistryRecord.exclusiveActive[relationshipRecord.exclusiveClaimKey]
        .filter((id: string) => id !== relationship.id),
    };
    const archivedSourceUsage = { ...sourceRegistryRecord.subjectKeysBySource };
    for (const sourceId of relationshipRecord.sourceIds as string[]) {
      archivedSourceUsage[sourceId] = archivedSourceUsage[sourceId]
        .filter((key: string) => key !== `relationship:${relationship.id}`);
    }
    const archivedAuditId = canonicalKnowledgeAuditEventId("relationship", relationship.id, 2);
    const archiveWithoutHistory = writeBatch(adminDb);
    archiveWithoutHistory.set(relationshipReference, {
      ...relationshipRecord,
      status: "archived",
      version: 2,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
      latestVersionKey: "v2",
      lastAuditEventId: archivedAuditId,
      versionHistory: {
        ...relationshipRecord.versionHistory,
        v2: {
          ...relationshipRecord.versionHistory.v1,
          version: 2,
          status: "archived",
          changedBy: emulatorActorId,
          changedAt: serverTimestamp(),
          reason: "Attempt archive without status history.",
        },
      },
    });
    archiveWithoutHistory.set(relationshipRegistryReference, {
      ...relationshipRegistryRecord,
      activeRelationshipIds: relationshipRegistryRecord.activeRelationshipIds
        .filter((id: string) => id !== relationship.id),
      endpointActive: archivedEndpointActive,
      exclusiveActive: archivedExclusiveActive,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
    });
    archiveWithoutHistory.set(sourceRegistryReference, {
      ...sourceRegistryRecord,
      subjectKeysBySource: archivedSourceUsage,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
    });
    archiveWithoutHistory.set(
      doc(adminDb, "internalKnowledgeAuditEvents", archivedAuditId),
      auditRecord("relationship", relationship.id, 2, {
        eventType: "archived",
        summary: "Attempt archive without status history.",
      }),
    );
    await assertFails(archiveWithoutHistory.commit());

    await assertFails(attemptNodeUpdate({}, { unexpectedAuditField: true }));
    await assertFails(attemptNodeUpdate({}, { eventType: "invented-event" }));
    await assertFails(attemptNodeUpdate({}, { metadata: { nested: { unsupported: true } } }));
    await assertFails(attemptNodeUpdate({}, { metadata: { confidence: 42 } }));
    await assertFails(attemptNodeUpdate({}, { summary: "" }));
    await assertFails(setDoc(schoolReference, {
      ...schoolRecord,
      description: "Attempt to update without a new matching audit.",
      version: 2,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
      latestVersionKey: "v2",
      lastAuditEventId: schoolRecord.lastAuditEventId,
      versionHistory: {
        ...schoolRecord.versionHistory,
        v2: {
          ...schoolRecord.versionHistory.v1,
          version: 2,
          description: "Attempt to update without a new matching audit.",
          changedBy: emulatorActorId,
          changedAt: serverTimestamp(),
          reason: "An existing audit cannot authorize a new subject version.",
        },
      },
    }));

    await setSubjectIndexed(`relationship:${relationship.id}`, false);
    const relationshipAuditId = canonicalKnowledgeAuditEventId("relationship", relationship.id, 2);
    const relationshipBatch = writeBatch(adminDb);
    relationshipBatch.set(relationshipReference, {
      ...relationshipRecord,
      description: "Direct relationship write without source usage indexing.",
      version: 2,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
      latestVersionKey: "v2",
      lastAuditEventId: relationshipAuditId,
      versionHistory: {
        ...relationshipRecord.versionHistory,
        v2: {
          ...relationshipRecord.versionHistory.v1,
          version: 2,
          description: "Direct relationship write without source usage indexing.",
          changedBy: emulatorActorId,
          changedAt: serverTimestamp(),
          reason: "Attempt an unindexed direct relationship write.",
        },
      },
    });
    relationshipBatch.set(doc(adminDb, "internalKnowledgeAuditEvents", relationshipAuditId), {
      id: relationshipAuditId,
      workspaceId: emulatorWorkspaceId,
      subjectType: "relationship",
      subjectId: relationship.id,
      eventType: "updated",
      actorId: emulatorActorId,
      occurredAt: serverTimestamp(),
      summary: "Attempt an unindexed direct relationship write.",
      version: 2,
      metadata: {},
    });
    await assertFails(relationshipBatch.commit());
    await setSubjectIndexed(`relationship:${relationship.id}`, true);
    const embeddedRelationshipBatch = writeBatch(adminDb);
    embeddedRelationshipBatch.set(relationshipReference, {
      ...relationshipRecord,
      description: "Direct relationship write with an embedded source summary.",
      sources: [{ sourceId: source.id, title: "Caller supplied title" }],
      version: 2,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
      latestVersionKey: "v2",
      lastAuditEventId: relationshipAuditId,
      versionHistory: {
        ...relationshipRecord.versionHistory,
        v2: {
          ...relationshipRecord.versionHistory.v1,
          version: 2,
          description: "Direct relationship write with an embedded source summary.",
          changedBy: emulatorActorId,
          changedAt: serverTimestamp(),
          reason: "Attempt to persist caller-supplied source metadata.",
        },
      },
    });
    embeddedRelationshipBatch.set(doc(adminDb, "internalKnowledgeAuditEvents", relationshipAuditId), {
      id: relationshipAuditId,
      workspaceId: emulatorWorkspaceId,
      subjectType: "relationship",
      subjectId: relationship.id,
      eventType: "updated",
      actorId: emulatorActorId,
      occurredAt: serverTimestamp(),
      summary: "Attempt to persist caller-supplied source metadata.",
      version: 2,
      metadata: {},
    });
    await assertFails(embeddedRelationshipBatch.commit());

    const updatedSchool = await repository.updateNode("school-rules", {
      description: "Rules University history validation completed.",
    }, {
      actorId: emulatorActorId,
      reason: "Validate canonical node history under hardened rules.",
    });
    assert.equal(updatedSchool.version, 2);
    assert.equal(updatedSchool.versionHistory.length, 2);
    assert.equal(updatedSchool.versionHistory[1].changedBy, emulatorActorId);
    assert.equal(updatedSchool.confidenceHistory.length, 1);
    assert.equal(updatedSchool.statusHistory.length, 1);

    const updatedRelationship = await repository.updateRelationship(relationship.id, {
      description: "Relationship history validation completed.",
    }, {
      actorId: emulatorActorId,
      reason: "Validate canonical relationship history under hardened rules.",
    });
    assert.equal(updatedRelationship.version, 2);
    assert.equal(updatedRelationship.versionHistory.length, 2);
    assert.equal(updatedRelationship.versionHistory[1].changedBy, emulatorActorId);
    assert.equal(updatedRelationship.confidenceHistory.length, 1);
    assert.equal(updatedRelationship.statusHistory.length, 1);

    await assertSucceeds(getDoc(doc(adminDb, "internalKnowledgeNodes", "school-rules")));
    await assertFails(getDoc(doc(memberDb, "internalKnowledgeNodes", "school-rules")));
    await assertFails(getDoc(doc(signedOutDb, "internalKnowledgeNodes", "school-rules")));
    await assertFails(setDoc(doc(memberDb, "internalKnowledgeSources", "member-source"), { status: "active" }));
    await assertFails(setDoc(doc(signedOutDb, "internalKnowledgeNodes", "anonymous-node"), { status: "active" }));

    const sourceReference = doc(adminDb, "internalKnowledgeSources", source.id);
    await assertFails(updateDoc(sourceReference, {
      updatedBy: "spoofed-editor",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(sourceReference, {
      createdBy: "spoofed-creator",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(sourceReference, {
      updatedAt: new Date("1999-01-01T00:00:00.000Z"),
    }));

    const updatedSource = await repository.updateSource(source.id, { title: "Updated Official Source" }, {
      actorId: emulatorActorId,
      reason: "Rules validation update.",
    });
    assert.equal(updatedSource.version, 2);
    assert.equal(updatedSource.versionHistory[0].title, "Official Athletics Source");
    assert.equal(updatedSource.versionHistory[1].title, "Updated Official Source");

    await assertFails(updateDoc(relationshipReference, {
      fromNodeId: "state-ohio",
      toNodeId: "school-rules",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(relationshipReference, {
      toNodeId: "region-greater-lakes",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(relationshipReference, {
      identityKey: `${emulatorWorkspaceId}:invented:school-rules:state-ohio`,
      updatedAt: serverTimestamp(),
    }));

    const forgedAuditReference = doc(adminDb, "internalKnowledgeAuditEvents", "forged-audit");
    await assertFails(setDoc(forgedAuditReference, {
      id: "forged-audit",
      workspaceId: emulatorWorkspaceId,
      subjectType: "source",
      subjectId: source.id,
      eventType: "updated",
      actorId: emulatorActorId,
      occurredAt: serverTimestamp(),
      summary: "Standalone audit injection.",
      version: updatedSource.version,
      metadata: {},
    }));
    await assertFails(setDoc(doc(adminDb, "internalKnowledgeAuditEvents", "actorless-audit"), {
      id: "actorless-audit",
      workspaceId: emulatorWorkspaceId,
      subjectType: "source",
      subjectId: source.id,
      eventType: "updated",
      occurredAt: serverTimestamp(),
      summary: "Actorless audit injection.",
      version: updatedSource.version,
      metadata: {},
    }));

    const auditReference = doc(adminDb, "internalKnowledgeAuditEvents", updatedSource.lastAuditEventId);
    await assertFails(updateDoc(auditReference, { summary: "Mutated history" }));
    await assertFails(deleteDoc(auditReference));
    await assertFails(deleteDoc(relationshipReference));
    await assertFails(deleteDoc(sourceReference));
    await assertFails(updateDoc(doc(
      adminDb,
      "internalKnowledgeUniqueness",
      `node-registry:${emulatorWorkspaceId}:${KnowledgeNodeType.State}`,
    ), {
      owners: {},
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(
      adminDb,
      "internalKnowledgeUniqueness",
      `relationship-registry:${emulatorWorkspaceId}`,
    ), {
      exactOwners: {},
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
    }));
    const legacyRelationshipIdentityClaimReference = doc(
      adminDb, "internalKnowledgeUniqueness", `relationship-identity-claim:${relationship.identityKey}`,
    );
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(
        context.firestore(),
        "internalKnowledgeUniqueness",
        `relationship-identity-claim:${relationship.identityKey}`,
      ), {
        id: `relationship-identity-claim:${relationship.identityKey}`,
        kind: "relationship-identity-claim",
        workspaceId: emulatorWorkspaceId,
        identityKey: relationship.identityKey,
        ownerId: relationship.id,
        fromNodeId: relationship.fromNodeId,
        toNodeId: relationship.toNodeId,
        relationshipType: relationship.relationshipType,
        createdBy: emulatorActorId,
        updatedBy: emulatorActorId,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });
    assert.equal((await assertSucceeds(getDoc(legacyRelationshipIdentityClaimReference))).data()?.ownerId, relationship.id);
    await assertFails(updateDoc(legacyRelationshipIdentityClaimReference, {
      ownerId: "invented-owner",
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(deleteDoc(legacyRelationshipIdentityClaimReference));
    await assertFails(setDoc(doc(
      adminDb,
      "internalKnowledgeUniqueness",
      `relationship-identity-claim:${relationship.identityKey}:new`,
    ), {
      id: `relationship-identity-claim:${relationship.identityKey}:new`,
      kind: "relationship-identity-claim",
      workspaceId: emulatorWorkspaceId,
      identityKey: `${relationship.identityKey}:new`,
      ownerId: relationship.id,
      createdBy: emulatorActorId,
      updatedBy: emulatorActorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(deleteDoc(doc(adminDb, "internalKnowledgeUniqueness", `relationship-registry:${emulatorWorkspaceId}`)));

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await deleteDoc(doc(firestore, "internalKnowledgeRelationships", relationship.id));
      await deleteDoc(doc(
        firestore,
        "internalKnowledgeAuditEvents",
        canonicalKnowledgeAuditEventId("relationship", relationship.id, 1),
      ));
      await deleteDoc(doc(
        firestore,
        "internalKnowledgeAuditEvents",
        canonicalKnowledgeAuditEventId("relationship", relationship.id, 2),
      ));
    });

    const attemptRelationshipCreate = async (
      overrides: Record<string, unknown> = {},
      omittedFields: string[] = [],
    ) => {
      const auditId = canonicalKnowledgeAuditEventId("relationship", relationship.id, 1);
      const candidate: Record<string, unknown> = {
        ...relationshipRecord,
        createdBy: emulatorActorId,
        updatedBy: emulatorActorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 1,
        latestVersionKey: "v1",
        latestConfidenceKey: "v1",
        latestStatusKey: "v1",
        lastAuditEventId: auditId,
        versionHistory: {
          v1: {
            ...relationshipRecord.versionHistory.v1,
            version: 1,
            changedAt: serverTimestamp(),
            changedBy: emulatorActorId,
          },
        },
        confidenceHistory: {
          v1: {
            ...relationshipRecord.confidenceHistory.v1,
            version: 1,
            changedAt: serverTimestamp(),
            changedBy: emulatorActorId,
          },
        },
        statusHistory: {
          v1: {
            ...relationshipRecord.statusHistory.v1,
            version: 1,
            changedAt: serverTimestamp(),
            changedBy: emulatorActorId,
          },
        },
        ...overrides,
      };
      for (const field of omittedFields) delete candidate[field];
      const batch = writeBatch(adminDb);
      batch.set(relationshipReference, candidate);
      batch.set(doc(adminDb, "internalKnowledgeAuditEvents", auditId), auditRecord(
        "relationship",
        relationship.id,
        1,
        { eventType: "created", summary: "Direct relationship creation validation." },
      ));
      return batch.commit();
    };

    await assertFails(attemptRelationshipCreate({}, ["versionHistory"]));
    await assertFails(attemptRelationshipCreate({}, ["confidenceHistory"]));
    await assertFails(attemptRelationshipCreate({}, ["statusHistory"]));
    await assertFails(attemptRelationshipCreate({
      versionHistory: {
        v1: {
          ...relationshipRecord.versionHistory.v1,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
        },
        v2: {
          ...relationshipRecord.versionHistory.v1,
          version: 2,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
        },
      },
    }));
    await assertFails(attemptRelationshipCreate({
      confidenceHistory: {
        v1: {
          ...relationshipRecord.confidenceHistory.v1,
          changedAt: serverTimestamp(),
          changedBy: "spoofed-history-actor",
        },
      },
    }));
    await assertFails(attemptRelationshipCreate({
      statusHistory: {
        v1: {
          ...relationshipRecord.statusHistory.v1,
          changedAt: new Date("2001-01-01T00:00:00.000Z"),
          changedBy: emulatorActorId,
        },
      },
    }));
    await assertFails(attemptRelationshipCreate({ confidence: "invented-confidence" }));
    await assertFails(attemptRelationshipCreate({
      confidenceHistory: {
        v1: {
          ...relationshipRecord.confidenceHistory.v1,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
          unexpectedHistoryField: true,
        },
      },
    }));
    assert.equal((await getDoc(relationshipReference)).exists(), false);

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await deleteDoc(doc(firestore, "internalKnowledgeNodes", "school-rules"));
      await deleteDoc(doc(
        firestore,
        "internalKnowledgeAuditEvents",
        canonicalKnowledgeAuditEventId("node", "school-rules", 1),
      ));
      await deleteDoc(doc(
        firestore,
        "internalKnowledgeAuditEvents",
        canonicalKnowledgeAuditEventId("node", "school-rules", 2),
      ));
    });

    const attemptNodeCreate = async (
      overrides: Record<string, unknown> = {},
      omittedFields: string[] = [],
    ) => {
      const auditId = canonicalKnowledgeAuditEventId("node", "school-rules", 1);
      const candidate: Record<string, unknown> = {
        ...schoolRecord,
        createdBy: emulatorActorId,
        updatedBy: emulatorActorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 1,
        latestVersionKey: "v1",
        latestConfidenceKey: "v1",
        latestStatusKey: "v1",
        lastAuditEventId: auditId,
        versionHistory: {
          v1: {
            ...schoolRecord.versionHistory.v1,
            version: 1,
            changedAt: serverTimestamp(),
            changedBy: emulatorActorId,
          },
        },
        confidenceHistory: {
          v1: {
            ...schoolRecord.confidenceHistory.v1,
            version: 1,
            changedAt: serverTimestamp(),
            changedBy: emulatorActorId,
          },
        },
        statusHistory: {
          v1: {
            ...schoolRecord.statusHistory.v1,
            version: 1,
            changedAt: serverTimestamp(),
            changedBy: emulatorActorId,
          },
        },
        ...overrides,
      };
      for (const field of omittedFields) delete candidate[field];
      const batch = writeBatch(adminDb);
      batch.set(schoolReference, candidate);
      batch.set(doc(adminDb, "internalKnowledgeAuditEvents", auditId), auditRecord(
        "node",
        "school-rules",
        1,
        { eventType: "created", summary: "Direct node creation validation." },
      ));
      return batch.commit();
    };

    await assertFails(attemptNodeCreate({}, ["versionHistory"]));
    await assertFails(attemptNodeCreate({}, ["confidenceHistory"]));
    await assertFails(attemptNodeCreate({}, ["statusHistory"]));
    await assertFails(attemptNodeCreate({
      versionHistory: {
        v1: {
          ...schoolRecord.versionHistory.v1,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
        },
        v2: {
          ...schoolRecord.versionHistory.v1,
          version: 2,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
        },
      },
    }));
    await assertFails(attemptNodeCreate({
      confidenceHistory: {
        v1: {
          ...schoolRecord.confidenceHistory.v1,
          changedAt: serverTimestamp(),
          changedBy: "spoofed-history-actor",
        },
      },
    }));
    await assertFails(attemptNodeCreate({
      statusHistory: {
        v1: {
          ...schoolRecord.statusHistory.v1,
          changedAt: new Date("2001-01-01T00:00:00.000Z"),
          changedBy: emulatorActorId,
        },
      },
    }));
    await assertFails(attemptNodeCreate({ confidence: "invented-confidence" }));
    await assertFails(attemptNodeCreate({
      statusHistory: {
        v1: {
          ...schoolRecord.statusHistory.v1,
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
          unexpectedHistoryField: true,
        },
      },
    }));
    assert.equal((await getDoc(schoolReference)).exists(), false);

    const regionReference = doc(adminDb, "internalKnowledgeNodes", region.id);
    const regionSnapshot = await getDoc(regionReference);
    const regionRecord = regionSnapshot.data();
    assert.ok(regionRecord);
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const {
        versionHistory: _versionHistory,
        confidenceHistory: _confidenceHistory,
        statusHistory: _statusHistory,
        latestVersionKey: _latestVersionKey,
        latestConfidenceKey: _latestConfidenceKey,
        latestStatusKey: _latestStatusKey,
        legacyHistorySnapshot: _legacyHistorySnapshot,
        ...malformed
      } = regionRecord;
      void _versionHistory;
      void _confidenceHistory;
      void _statusHistory;
      void _latestVersionKey;
      void _latestConfidenceKey;
      void _latestStatusKey;
      void _legacyHistorySnapshot;
      await setDoc(doc(context.firestore(), "internalKnowledgeNodes", region.id), {
        ...malformed,
        versionHistory: "malformed-history",
        confidenceHistory: "malformed-history",
        statusHistory: "malformed-history",
      });
    });
    const malformedRegionAuditId = canonicalKnowledgeAuditEventId("node", region.id, 2);
    const malformedRegionBatch = writeBatch(adminDb);
    malformedRegionBatch.set(regionReference, {
      ...regionRecord,
      description: "Attempt to treat a partial canonical record as legacy.",
      version: 2,
      updatedBy: emulatorActorId,
      updatedAt: serverTimestamp(),
      latestVersionKey: "v2",
      lastAuditEventId: malformedRegionAuditId,
      versionHistory: {
        ...regionRecord.versionHistory,
        v2: {
          ...regionRecord.versionHistory.v1,
          version: 2,
          description: "Attempt to treat a partial canonical record as legacy.",
          changedAt: serverTimestamp(),
          changedBy: emulatorActorId,
          reason: "Partial canonical records are not eligible for legacy migration.",
        },
      },
    });
    malformedRegionBatch.set(
      doc(adminDb, "internalKnowledgeAuditEvents", malformedRegionAuditId),
      auditRecord("node", region.id, 2),
    );
    await assertFails(malformedRegionBatch.commit());
  } finally {
    await testEnvironment.cleanup();
  }
});
