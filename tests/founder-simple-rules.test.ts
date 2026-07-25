import assert from "node:assert/strict";
import test from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import {
  SpotlightAudience,
  SpotlightEmphasis,
  SpotlightGoal,
  SpotlightMedia,
  createFirestoreFounderWorkflowDraftRepository,
} from "@/domain/founder-simple";
import { sanitizeFirestoreDocument } from "@/domain/shared";
import { createSchoolSpotlightDraftInput } from "@/services";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

test("Founder workflow drafts are admin-only, actor-bound, versioned, and not hard-deletable", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const environment = await initializeTestEnvironment({
    projectId: "hoopfrens-founder-workflow-rules",
    firestore: {
      host,
      port: Number(portValue),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "founder-admin"), { role: "admin" });
      await setDoc(doc(context.firestore(), "users", "member"), { role: "member" });
    });
    const adminDb = environment.authenticatedContext("founder-admin").firestore() as unknown as Firestore;
    const memberDb = environment.authenticatedContext("member").firestore();
    const signedOutDb = environment.unauthenticatedContext().firestore();
    const repository = createFirestoreFounderWorkflowDraftRepository(adminDb);
    const created = await repository.create(
      createSchoolSpotlightDraftInput("spotlight-rules", "founder-admin"),
      { actorId: "founder-admin" },
    );
    assert.equal(created.revision, 1);
    assert.deepEqual(created.request.goals, []);
    assert.deepEqual(created.request.audiences, []);
    assert.deepEqual(created.request.media, []);
    assert.equal(created.request.needShotList, false);
    const reference = doc(adminDb, "internalFounderWorkflowDrafts", created.id);
    await assertSucceeds(getDoc(reference));
    await assertFails(getDoc(doc(memberDb, "internalFounderWorkflowDrafts", created.id)));
    await assertFails(getDoc(doc(signedOutDb, "internalFounderWorkflowDrafts", created.id)));

    const partialSchool = await repository.update(created.id, {
      schoolDraft: { officialName: "Ashland University", city: "", state: "" },
    }, { actorId: "founder-admin" }, { expectedRevision: 1 });
    assert.equal(partialSchool.revision, 2);
    for (const collectionName of [
      "internalKnowledgeSources",
      "internalKnowledgeNodes",
      "internalKnowledgeRelationships",
      "internalKnowledgeAuditEvents",
      "internalKnowledgeUniqueness",
    ]) {
      assert.equal((await getDocs(collection(adminDb, collectionName))).empty, true);
    }

    const updated = await repository.update(created.id, {
      request: {
        ...created.request,
        objective: "Introduce the school; Explain the basketball program",
        goals: [SpotlightGoal.IntroduceSchool, SpotlightGoal.ExplainBasketballProgram],
        audience: "Players, Recruits",
        audiences: [SpotlightAudience.Players, SpotlightAudience.Recruits],
        availableMedia: ["No media yet"],
        media: [SpotlightMedia.NoMediaYet],
        needShotList: true,
      },
    }, { actorId: "founder-admin" }, { expectedRevision: 2 });
    assert.equal(updated.revision, 3);

    const maximumStructured = await repository.update(created.id, {
      request: {
        ...updated.request,
        objective: "All approved Spotlight goals",
        goals: Object.values(SpotlightGoal),
        goalOther: "A Founder-authored goal",
        supplementalGoalText: "Preserve this supporting context.",
        audience: "All approved Spotlight audiences",
        audiences: Object.values(SpotlightAudience),
        audienceOther: "Community partners",
        centralEmphasis: "A Founder-authored emphasis",
        primaryEmphasis: SpotlightEmphasis.Other,
        emphasisOther: "Community connection",
        specificAngle: "Basketball creates belonging.",
        availableMedia: [
          "School-provided photos",
          "Campus photos",
          "Gym or facility photos",
          "Game footage",
          "Practice footage",
          "Player photos",
          "Coach photos",
          "Logos",
          "Founder archive",
        ],
        media: Object.values(SpotlightMedia).filter((value) => value !== SpotlightMedia.NoMediaYet),
        mediaOther: "Founder archive",
        mediaDescription: "Rights will be confirmed before approval.",
      },
    }, { actorId: "founder-admin" }, { expectedRevision: 3 });
    assert.equal(maximumStructured.revision, 4);

    await assertFails(updateDoc(reference, sanitizeFirestoreDocument({
      request: {
        ...updated.request,
        availableMedia: ["No media yet", "Campus photos"],
        media: [SpotlightMedia.NoMediaYet, SpotlightMedia.CampusPhotos],
      },
      updatedAt: serverTimestamp(),
      updatedBy: "founder-admin",
      revision: 5,
    })));

    const legacyInput = createSchoolSpotlightDraftInput("legacy-spotlight-rules", "founder-admin");
    const legacyReference = doc(adminDb, "internalFounderWorkflowDrafts", legacyInput.id);
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "internalFounderWorkflowDrafts", legacyInput.id), {
        ...legacyInput,
        request: {
          objective: "Tell a distinctive Ashland story",
          audience: "Players, families, local community",
          platforms: ["instagram-reel"],
          centralEmphasis: "A welcoming campus",
          availableMedia: ["Campus photos", "Founder archive"],
          callToAction: "Learn more.",
        },
        createdAt: Timestamp.fromDate(new Date("2026-07-18T12:00:00.000Z")),
        updatedAt: Timestamp.fromDate(new Date("2026-07-18T12:00:00.000Z")),
        createdBy: "founder-admin",
        updatedBy: "founder-admin",
        revision: 1,
      });
    });
    const legacy = await repository.getById(legacyInput.id, { actorId: "founder-admin" });
    assert.ok(legacy);
    assert.deepEqual(legacy.request.goals, [SpotlightGoal.Other]);
    assert.equal(legacy.request.goalOther, "Tell a distinctive Ashland story");
    assert.ok(legacy.request.audiences.includes(SpotlightAudience.Players));
    assert.ok(legacy.request.audiences.includes(SpotlightAudience.Other));
    const migrated = await repository.update(legacy.id, {
      request: { ...legacy.request, needShotList: true },
    }, { actorId: "founder-admin" }, { expectedRevision: 1 });
    assert.equal(migrated.revision, 2);
    assert.equal(migrated.request.objective, "Tell a distinctive Ashland story");
    assert.equal(migrated.request.needShotList, true);
    const rawMigrated = (await getDoc(legacyReference)).data()?.request;
    assert.ok(rawMigrated);
    assert.deepEqual(rawMigrated.goals, [SpotlightGoal.Other]);
    assert.deepEqual(rawMigrated.media, [SpotlightMedia.CampusPhotos, SpotlightMedia.Other]);

    await assertFails(setDoc(doc(memberDb, "internalFounderWorkflowDrafts", "member-draft"), {
      id: "member-draft",
      workspaceId: "executive-workspace",
      ownerId: "member",
      kind: "school-spotlight",
    }));
    await assertFails(deleteDoc(reference));

    await setDoc(doc(adminDb, "internalProductionPackages", "spotlight-package-access"), {
      published: false,
      projectId: "project-access",
      version: 1,
    });
    await assertSucceeds(getDoc(doc(adminDb, "internalProductionPackages", "spotlight-package-access")));
    await assertFails(getDoc(doc(memberDb, "internalProductionPackages", "spotlight-package-access")));
    await assertFails(getDoc(doc(signedOutDb, "internalProductionPackages", "spotlight-package-access")));

  } finally {
    await environment.cleanup();
  }
});
