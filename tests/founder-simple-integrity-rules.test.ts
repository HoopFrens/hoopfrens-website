import assert from "node:assert/strict";
import test from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import {
  createFirestoreFounderWorkflowDraftRepository,
  FounderWorkflowStatus,
  FounderWorkflowStep,
  SpotlightAudience,
  SpotlightBrandingPreset,
  SpotlightEmphasis,
  SpotlightGoal,
  SpotlightLength,
  SpotlightMedia,
  SpotlightPlatform,
  SpotlightTone,
  type SchoolSpotlightRequest,
} from "@/domain/founder-simple";
import { createSchoolSpotlightDraftInput } from "@/services";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const workspaceId = "executive-workspace";
const ownerId = "founder-admin";
const otherAdminId = "founder-admin-two";
const sourceId = "source-rules-official";
const schoolId = "school-rules-university";
const savedAt = "2026-07-19T12:00:00.000Z";

const request = {
  objective: "Introduce the School",
  goals: [SpotlightGoal.IntroduceSchool],
  audience: "Players",
  audiences: [SpotlightAudience.Players],
  platforms: [SpotlightPlatform.InstagramReel, SpotlightPlatform.TikTok, SpotlightPlatform.YouTubeShort],
  centralEmphasis: "Campus experience",
  primaryEmphasis: SpotlightEmphasis.CampusExperience,
  availableMedia: ["Campus photos"],
  media: [SpotlightMedia.CampusPhotos],
  needShotList: true,
  callToAction: "Learn more through the School's official channels.",
};

const maximumStructuredRequest: SchoolSpotlightRequest = {
  objective: "Use every approved School Spotlight request choice.",
  goals: Object.values(SpotlightGoal),
  goalOther: "Show the School's community connection.",
  supplementalGoalText: "Keep every selected goal visible in the exact review.",
  audience: "All approved audiences",
  audiences: Object.values(SpotlightAudience),
  audienceOther: "Community partners",
  platforms: Object.values(SpotlightPlatform),
  centralEmphasis: "Community connection",
  primaryEmphasis: SpotlightEmphasis.Other,
  emphasisOther: "Community connection",
  specificAngle: "Basketball creates belonging.",
  availableMedia: [
    "School-provided photos", "Campus photos", "Gym photos", "Game footage",
    "Practice footage", "Player photos", "Coach photos", "Logos", "Founder archive",
  ],
  media: Object.values(SpotlightMedia).filter((value) => value !== SpotlightMedia.NoMediaYet),
  mediaOther: "Founder archive",
  mediaDescription: "All media remains planning input until rights are confirmed.",
  needShotList: true,
  callToAction: "Learn more through the School's official channels.",
};

const customization = {
  tone: SpotlightTone.ClearAndConfident,
  length: SpotlightLength.Standard,
  hook: "Meet Rules University.",
  emphasis: "Campus experience",
  callToAction: "Learn more through the School's official channels.",
  mediaAvailability: ["Campus photos"],
  brandingPreset: SpotlightBrandingPreset.Headquarters,
  verticalVideoScript: "Meet Rules University and explore its basketball story.",
  instagramCaption: "Meet Rules University and explore its basketball story.",
  shotList: ["Campus", "Court", "Closing card"],
  rightsConfirmed: true,
};

const evidence = {
  sourceId,
  sourceVersion: 1,
  title: "Rules University Official Website",
  publisher: "Rules University",
  reliability: "official",
  accessedAt: savedAt,
};

const maximumEvidence = Array.from({ length: 2 }, (_, index) => ({
  ...evidence,
  sourceId: `source-rules-maximum-${index + 1}`,
  title: `Rules University Official Source ${index + 1}`,
}));

function ids(suffix: string) {
  const projectId = `project-rules-${suffix}`;
  const draftId = `draft-rules-${suffix}`;
  return {
    projectId,
    draftId,
    packageId: `production_${projectId}_v1`,
  };
}

function projectFixture(suffix: string) {
  const identity = ids(suffix);
  return {
    id: identity.projectId,
    workspaceId,
    ownerId,
    type: "school-spotlight",
    projectType: "school-spotlight",
    creationRequestId: `founder-simple-${identity.draftId}`,
    state: "production",
    status: "production",
    knowledgeEntityIds: [schoolId],
    activeProductionVersion: 1,
    activeSchoolSpotlightPackageId: identity.packageId,
  };
}

function draftFixture(suffix: string, requestValue: SchoolSpotlightRequest = request) {
  const identity = ids(suffix);
  return {
    ...createSchoolSpotlightDraftInput(identity.draftId, ownerId),
    schoolId,
    projectId: identity.projectId,
    step: FounderWorkflowStep.Approve,
    status: FounderWorkflowStatus.Active,
    request: requestValue,
    customization,
    currentPackageId: identity.packageId,
    currentPackageVersion: 1,
    createdAt: Timestamp.fromDate(new Date(savedAt)),
    updatedAt: Timestamp.fromDate(new Date(savedAt)),
    createdBy: ownerId,
    updatedBy: ownerId,
    revision: 1,
  };
}

function packageFixture(suffix: string, requestValue: SchoolSpotlightRequest = request) {
  const identity = ids(suffix);
  return {
    id: identity.packageId,
    projectId: identity.projectId,
    artifactType: "production-package",
    version: 1,
    status: "ready",
    createdAt: savedAt,
    updatedAt: savedAt,
    createdBy: ownerId,
    workspace: "production-studio",
    generatedByService: "production",
    summary: "Review-ready School Spotlight package for Rules University.",
    metadata: {
      workspaceId,
      projectType: "school-spotlight",
      schoolId,
      workflowDraftId: identity.draftId,
      productionComplete: true,
    },
    workspaceId,
    ownerId,
    projectTitle: "Rules University School Spotlight",
    projectType: "school-spotlight",
    outlinePackageId: `outline_${identity.projectId}`,
    workingDraft: "Meet Rules University and explore its basketball story.",
    productionChecklist: [
      { id: "spotlight-production-1", label: "Selected facts are represented in the package", required: true, completed: true },
      { id: "spotlight-production-2", label: "Vertical-video structure and Instagram caption are complete", required: true, completed: true },
    ],
    mediaChecklist: [
      { id: "spotlight-media-1", label: "Photo and video shot list is complete", required: true, completed: true },
    ],
    graphicsNeeded: [
      { id: "spotlight-graphics-1", label: "Hoop Frens brand treatment is selected", required: true, completed: true },
    ],
    publishingRequirements: [
      { id: "spotlight-rights-confirmed", label: "Media rights are confirmed", required: true, completed: true },
    ],
    qaChecklist: [
      { id: "spotlight-qa-1", label: "Unsupported facts remain excluded or explicitly Founder-authored", required: true, completed: true },
      { id: "spotlight-qa-2", label: "Source and verification package is attached", required: true, completed: true },
    ],
    nextRecommendedStep: "Review the exact package version and approve it or request changes.",
    active: true,
    packageKind: "school-spotlight",
    workflowDraftId: identity.draftId,
    schoolId,
    request: requestValue,
    customization,
    selectedFacts: [{
      id: "official-name",
      category: "Identity",
      label: "Official Name",
      value: "Rules University",
      status: "verified",
      founderAuthored: false,
      sources: [evidence],
      position: 1,
    }],
    excludedFactIds: [],
    unresolvedWarnings: [],
    verticalVideo: {
      title: "Rules University School Spotlight",
      hook: "Meet Rules University.",
      scenes: [
        { id: "scene-1", heading: "Hook", narration: "Meet Rules University.", visualDirection: "Open with approved School media." },
        { id: "scene-2", heading: "Official Name", narration: "Rules University", visualDirection: "Show an approved School fact card." },
        { id: "scene-3", heading: "Next Step", narration: "Learn more.", visualDirection: "Close with an approved Hoop Frens card." },
      ],
      callToAction: "Learn more.",
    },
    instagramCaption: "Meet Rules University.",
    shotList: ["Campus", "Court", "Closing card"],
    verificationSources: [evidence],
    rightsConfirmed: true,
    changeSummary: "Created the first Founder review version.",
  };
}

type PackageFixture = ReturnType<typeof packageFixture> & Record<string, unknown>;

function sceneFixture(index: number): Record<string, unknown> {
  return {
    id: `scene-${index + 1}`,
    heading: `Scene ${index + 1}`,
    narration: `Narration ${index + 1}`,
    visualDirection: `Visual direction ${index + 1}`,
  };
}

function contentIntegrityFixture(suffix: string, scenes: Record<string, unknown>[]) {
  const packageId = `production_scene-rules-${suffix}_v1`;
  return {
    packageId,
    workspaceId,
    ownerId,
    workflowDraftId: `draft-scene-rules-${suffix}`,
    workingDraft: "Complete School Spotlight working draft.",
    verticalVideo: {
      title: "Rules University School Spotlight",
      hook: "Meet Rules University.",
      scenes,
      callToAction: "Learn more.",
    },
    instagramCaption: "Meet Rules University.",
    shotList: ["Campus", "Court", "Closing card"],
  };
}

function withoutFields<T extends Record<string, unknown>>(value: T, fields: string[]) {
  const result = { ...value };
  for (const field of fields) delete result[field];
  return result;
}

async function writePackageWithIntegrity(db: Firestore, value: PackageFixture) {
  const header = withoutFields(value, [
    "request", "customization", "selectedFacts", "excludedFactIds",
    "unresolvedWarnings", "verticalVideo", "instagramCaption", "shotList",
    "verificationSources", "productionChecklist", "mediaChecklist",
    "graphicsNeeded", "publishingRequirements", "qaChecklist", "workingDraft",
  ]);
  await setDoc(doc(db, "internalSchoolSpotlightPackageFacts", value.id), {
    packageId: value.id,
    workspaceId: value.workspaceId,
    ownerId: value.ownerId,
    selectedFactCount: value.selectedFacts.length,
    selectedFactIds: value.selectedFacts.map((fact) => fact.id),
    selectedFactPositions: value.selectedFacts.map((fact) => fact.position),
    verificationSourceIds: value.verificationSources.map((source) => source.sourceId),
    verificationSources: value.verificationSources,
  });
  for (const part of [1, 2] as const) {
    const selectedFacts = (part === 1 ? value.selectedFacts.slice(0, 4) : value.selectedFacts.slice(4, 8))
      .map((fact) => {
        const { sources, ...snapshot } = fact;
        return { ...snapshot, sourceIds: sources.map((source) => source.sourceId) };
      });
    await setDoc(
      doc(db, `internalSchoolSpotlightPackageFacts${part === 1 ? "A" : "B"}`, `${value.id}-${part}`),
      {
        packageId: value.id,
        workspaceId: value.workspaceId,
        ownerId: value.ownerId,
        part,
        selectedFacts,
      },
    );
  }
  await setDoc(doc(db, "internalSchoolSpotlightPackageContent", value.id), {
    packageId: value.id,
    workspaceId: value.workspaceId,
    ownerId: value.ownerId,
    workflowDraftId: value.workflowDraftId,
    workingDraft: value.workingDraft,
    verticalVideo: value.verticalVideo,
    instagramCaption: value.instagramCaption,
    shotList: value.shotList,
  });
  await setDoc(doc(db, "internalSchoolSpotlightPackageDelivery", value.id), {
    packageId: value.id,
    workspaceId: value.workspaceId,
    ownerId: value.ownerId,
    workflowDraftId: value.workflowDraftId,
    excludedFactIds: value.excludedFactIds,
    unresolvedWarnings: value.unresolvedWarnings,
    rightsConfirmed: value.rightsConfirmed,
    productionChecklist: value.productionChecklist,
    mediaChecklist: value.mediaChecklist,
    graphicsNeeded: value.graphicsNeeded,
    publishingRequirements: value.publishingRequirements,
    qaChecklist: value.qaChecklist,
  });
  await setDoc(doc(db, "internalSchoolSpotlightPackageRequest", value.id), {
    packageId: value.id,
    workspaceId: value.workspaceId,
    ownerId: value.ownerId,
    workflowDraftId: value.workflowDraftId,
    request: value.request,
  });
  await setDoc(doc(db, "internalSchoolSpotlightPackageCustomization", value.id), {
    packageId: value.id,
    workspaceId: value.workspaceId,
    ownerId: value.ownerId,
    workflowDraftId: value.workflowDraftId,
    customization: value.customization,
  });
  const packageReference = doc(db, "internalProductionPackages", value.id);
  await setDoc(packageReference, {
    ...header,
    status: "staged",
    active: false,
    factsIntegrityId: value.id,
    contentIntegrityId: value.id,
    deliveryIntegrityId: value.id,
    requestIntegrityId: value.id,
    customizationIntegrityId: value.id,
  });
  return updateDoc(packageReference, {
    status: "ready",
    active: true,
    updatedAt: value.updatedAt,
  });
}

async function seedCanonicalContext(
  db: Firestore,
  suffix: string,
  requestValue: SchoolSpotlightRequest = request,
) {
  await Promise.all([
    setDoc(doc(db, "internalKnowledgeSources", sourceId), {
      id: sourceId,
      workspaceId,
      status: "active",
      version: 1,
      title: evidence.title,
      publisher: evidence.publisher,
      reliability: evidence.reliability,
      accessedAt: evidence.accessedAt,
    }),
    setDoc(doc(db, "internalKnowledgeNodes", schoolId), {
      id: schoolId,
      workspaceId,
      type: "school",
      status: "active",
    }),
    setDoc(doc(db, "internalProjects", ids(suffix).projectId), projectFixture(suffix)),
    setDoc(doc(db, "internalFounderWorkflowDrafts", ids(suffix).draftId), draftFixture(suffix, requestValue)),
  ]);
}

async function expectRulesSuccess<T>(label: string, operation: Promise<T>) {
  try {
    return await assertSucceeds(operation);
  } catch (error) {
    throw new Error(`${label} unexpectedly failed.`, { cause: error });
  }
}

test("Founder workflow drafts are readable and mutable only by their approved-admin owner", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const environment = await initializeTestEnvironment({
    projectId: "hoopfrens-founder-owner-isolation-rules",
    firestore: { host, port: Number(portValue), rules: await readFile("firestore.rules", "utf8") },
  });
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await Promise.all([
        setDoc(doc(context.firestore(), "users", ownerId), { role: "admin" }),
        setDoc(doc(context.firestore(), "users", otherAdminId), { role: "admin" }),
        setDoc(doc(context.firestore(), "users", "member"), { role: "member" }),
      ]);
    });
    const ownerDb = environment.authenticatedContext(ownerId).firestore() as unknown as Firestore;
    const otherAdminDb = environment.authenticatedContext(otherAdminId).firestore() as unknown as Firestore;
    const memberDb = environment.authenticatedContext("member").firestore();
    const signedOutDb = environment.unauthenticatedContext().firestore();
    const repository = createFirestoreFounderWorkflowDraftRepository(ownerDb);
    const created = await repository.create(
      createSchoolSpotlightDraftInput("owner-isolation-draft", ownerId),
      { actorId: ownerId },
    );
    const reference = doc(ownerDb, "internalFounderWorkflowDrafts", created.id);

    await expectRulesSuccess("Owner direct read", getDoc(reference));
    await assertFails(getDoc(doc(otherAdminDb, "internalFounderWorkflowDrafts", created.id)));
    await assertFails(getDoc(doc(memberDb, "internalFounderWorkflowDrafts", created.id)));
    await assertFails(getDoc(doc(signedOutDb, "internalFounderWorkflowDrafts", created.id)));
    await expectRulesSuccess("Owner-filtered owner query", getDocs(query(
      collection(ownerDb, "internalFounderWorkflowDrafts"),
      where("workspaceId", "==", workspaceId),
      where("ownerId", "==", ownerId),
    )));
    await assertFails(getDocs(collection(ownerDb, "internalFounderWorkflowDrafts")));
    await expectRulesSuccess("Other admin's empty owner-filtered query", getDocs(query(
      collection(otherAdminDb, "internalFounderWorkflowDrafts"),
      where("workspaceId", "==", workspaceId),
      where("ownerId", "==", otherAdminId),
    )));
    await assertFails(getDocs(query(
      collection(otherAdminDb, "internalFounderWorkflowDrafts"),
      where("workspaceId", "==", workspaceId),
      where("ownerId", "==", ownerId),
    )));
    await assertFails(updateDoc(doc(otherAdminDb, "internalFounderWorkflowDrafts", created.id), {
      step: FounderWorkflowStep.Review,
      updatedAt: new Date(),
      updatedBy: otherAdminId,
      revision: 2,
    }));
    await assert.rejects(
      createFirestoreFounderWorkflowDraftRepository(otherAdminDb).getById(created.id, { actorId: otherAdminId }),
      /permission[_-]denied/i,
    );
  } finally {
    await environment.cleanup();
  }
});

test("School Spotlight content rules validate every field at every supported scene index", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const environment = await initializeTestEnvironment({
    projectId: "hoopfrens-founder-scene-integrity-rules",
    firestore: { host, port: Number(portValue), rules: await readFile("firestore.rules", "utf8") },
  });
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", ownerId), { role: "admin" });
    });
    const adminDb = environment.authenticatedContext(ownerId).firestore() as unknown as Firestore;
    const sceneIndexes = Array.from({ length: 10 }, (_, index) => index);
    const malformedScenes: Array<{
      label: string;
      mutate: (scene: Record<string, unknown>) => Record<string, unknown>;
    }> = [
      { label: "id-type", mutate: (scene) => ({ ...scene, id: 42 }) },
      { label: "heading-type", mutate: (scene) => ({ ...scene, heading: 42 }) },
      { label: "narration-type", mutate: (scene) => ({ ...scene, narration: 42 }) },
      { label: "visual-direction-type", mutate: (scene) => ({ ...scene, visualDirection: 42 }) },
      { label: "unsupported-on-screen-text", mutate: (scene) => ({ ...scene, onScreenText: "Not supported" }) },
      { label: "unsupported-duration", mutate: (scene) => ({ ...scene, duration: 15 }) },
    ];

    for (const index of sceneIndexes) {
      for (const malformed of malformedScenes) {
        const suffix = `${malformed.label}-${index}`;
        const scenes = sceneIndexes.map(sceneFixture);
        scenes[index] = malformed.mutate(scenes[index]);
        const content = contentIntegrityFixture(suffix, scenes);
        await assertFails(setDoc(
          doc(adminDb, "internalSchoolSpotlightPackageContent", content.packageId),
          content,
        ));
      }
    }

    const maximumContent = contentIntegrityFixture("maximum-valid", sceneIndexes.map(sceneFixture));
    await expectRulesSuccess(
      "Maximum ten-scene content integrity document",
      setDoc(
        doc(adminDb, "internalSchoolSpotlightPackageContent", maximumContent.packageId),
        maximumContent,
      ),
    );
  } finally {
    await environment.cleanup();
  }
});

test("School Spotlight rules reject state-only approval and malformed or unlinked exact packages", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const environment = await initializeTestEnvironment({
    projectId: "hoopfrens-founder-package-integrity-rules",
    firestore: { host, port: Number(portValue), rules: await readFile("firestore.rules", "utf8") },
  });
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", ownerId), { role: "admin" });
      for (const suffix of [
        "valid", "malformed-fact", "missing-source", "wrong-owner",
        "wrong-school", "invalid-version", "extra-field", "malformed-evidence",
        "malformed-video", "malformed-shot-list", "malformed-checklist",
        "duplicate-fact", "mismatched-evidence", "inactive",
      ]) {
        await seedCanonicalContext(context.firestore() as unknown as Firestore, suffix);
      }
      await seedCanonicalContext(
        context.firestore() as unknown as Firestore,
        "maximum",
        maximumStructuredRequest,
      );
      await setDoc(doc(context.firestore(), "internalProjects", "project-rules-type-only"), {
        id: "project-rules-type-only",
        workspaceId,
        ownerId,
        type: "school-spotlight",
        projectType: "school-spotlight",
        state: "review",
        status: "review",
        knowledgeEntityIds: [],
      });
      await Promise.all(maximumEvidence.map((source) => setDoc(
        doc(context.firestore(), "internalKnowledgeSources", source.sourceId),
        {
          id: source.sourceId,
          workspaceId,
          status: "active",
          version: source.sourceVersion,
          title: source.title,
          publisher: source.publisher,
          reliability: source.reliability,
          accessedAt: source.accessedAt,
        },
      )));
    });
    const adminDb = environment.authenticatedContext(ownerId).firestore() as unknown as Firestore;

    const valid = packageFixture("valid");
    const validPackageRef = doc(adminDb, "internalProductionPackages", valid.id);
    await expectRulesSuccess("Valid fully linked package creation", writePackageWithIntegrity(adminDb, valid));

    const maximumBase = packageFixture("maximum", maximumStructuredRequest);
    const maximumFacts = Array.from({ length: 8 }, (_, index) => ({
      ...maximumBase.selectedFacts[0],
      id: `maximum-fact-${index + 1}`,
      label: `Maximum supported fact ${index + 1}`,
      value: `Verified value ${index + 1}`,
      position: index + 1,
      sources: [maximumEvidence[index % maximumEvidence.length]],
    }));
    const maximumPackage = {
      ...maximumBase,
      selectedFacts: maximumFacts,
      verificationSources: maximumEvidence,
      verticalVideo: {
        ...maximumBase.verticalVideo,
        scenes: [
          { id: "scene-hook", heading: "Hook", narration: "Meet Rules University.", visualDirection: "Open." },
          ...maximumFacts.map((fact, index) => ({
            id: `scene-fact-${index + 1}`,
            heading: fact.label,
            narration: fact.value,
            visualDirection: "Show an approved School fact card.",
          })),
          { id: "scene-next", heading: "Next Step", narration: "Learn more.", visualDirection: "Close." },
        ],
      },
    } as PackageFixture;
    await expectRulesSuccess(
      "Maximum valid structured request and eight-fact package",
      writePackageWithIntegrity(adminDb, maximumPackage),
    );

    const validProjectRef = doc(adminDb, "internalProjects", ids("valid").projectId);
    await expectRulesSuccess("Valid transition into review", updateDoc(validProjectRef, { state: "review", status: "review" }));
    await assertFails(updateDoc(validProjectRef, { state: "approved", status: "approved" }));
    await assertFails(updateDoc(validProjectRef, {
      state: "approved",
      status: "approved",
      approvedSchoolSpotlightPackageId: valid.id,
    }));
    await assertFails(updateDoc(validProjectRef, {
      state: "approved",
      status: "approved",
      approvedSchoolSpotlightPackageId: valid.id,
      approvedSchoolSpotlightPackageVersion: 2,
    }));
    await expectRulesSuccess("Valid exact-package approval", updateDoc(validProjectRef, {
      state: "approved",
      status: "approved",
      approvedSchoolSpotlightPackageId: valid.id,
      approvedSchoolSpotlightPackageVersion: 1,
    }));

    await assertFails(updateDoc(
      doc(adminDb, "internalProjects", "project-rules-type-only"),
      { state: "approved", status: "approved" },
    ));

    const inactive = packageFixture("inactive");
    await expectRulesSuccess("Second valid package creation", writePackageWithIntegrity(adminDb, inactive));
    const inactiveProjectRef = doc(adminDb, "internalProjects", ids("inactive").projectId);
    await expectRulesSuccess("Inactive-package project transition into review", updateDoc(inactiveProjectRef, {
      state: "review",
      status: "review",
    }));
    await expectRulesSuccess("Supersede the package before approval", updateDoc(
      doc(adminDb, "internalProductionPackages", inactive.id),
      { active: false, supersededAt: savedAt, updatedAt: savedAt },
    ));
    await assertFails(updateDoc(inactiveProjectRef, {
      state: "approved",
      status: "approved",
      approvedSchoolSpotlightPackageId: inactive.id,
      approvedSchoolSpotlightPackageVersion: 1,
    }));

    const malformedFact = packageFixture("malformed-fact");
    const factWithoutStatus = withoutFields(malformedFact.selectedFacts[0], ["status"]);
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...malformedFact,
      selectedFacts: [factWithoutStatus],
    } as PackageFixture));

    const duplicateFact = packageFixture("duplicate-fact");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...duplicateFact,
      selectedFacts: [
        duplicateFact.selectedFacts[0],
        { ...duplicateFact.selectedFacts[0], value: "A second value", position: 2 },
      ],
      verticalVideo: {
        ...duplicateFact.verticalVideo,
        scenes: [
          duplicateFact.verticalVideo.scenes[0],
          duplicateFact.verticalVideo.scenes[1],
          { ...duplicateFact.verticalVideo.scenes[1], id: "scene-duplicate" },
          duplicateFact.verticalVideo.scenes[2],
        ],
      },
    } as PackageFixture));

    const mismatchedEvidence = packageFixture("mismatched-evidence");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...mismatchedEvidence,
      selectedFacts: [{ ...mismatchedEvidence.selectedFacts[0], sources: [maximumEvidence[0]] }],
    } as PackageFixture));

    const missingSource = packageFixture("missing-source");
    const missingEvidence = { ...evidence, sourceId: "source-does-not-exist" };
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...missingSource,
      verificationSources: [missingEvidence],
      selectedFacts: [{ ...missingSource.selectedFacts[0], sources: [missingEvidence] }],
    } as PackageFixture));

    const malformedEvidence = packageFixture("malformed-evidence");
    const evidenceWithoutAccessedAt = withoutFields(evidence, ["accessedAt"]);
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...malformedEvidence,
      verificationSources: [evidenceWithoutAccessedAt],
      selectedFacts: [{ ...malformedEvidence.selectedFacts[0], sources: [evidenceWithoutAccessedAt] }],
    } as unknown as PackageFixture));

    const malformedVideo = packageFixture("malformed-video");
    const sceneWithoutNarration = withoutFields(malformedVideo.verticalVideo.scenes[1], ["narration"]);
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...malformedVideo,
      verticalVideo: {
        ...malformedVideo.verticalVideo,
        scenes: [malformedVideo.verticalVideo.scenes[0], sceneWithoutNarration, malformedVideo.verticalVideo.scenes[2]],
      },
    } as unknown as PackageFixture));

    const malformedShotList = packageFixture("malformed-shot-list");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...malformedShotList,
      shotList: ["Campus", { unexpected: true }],
    } as unknown as PackageFixture));

    const malformedChecklist = packageFixture("malformed-checklist");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...malformedChecklist,
      productionChecklist: [{
        ...malformedChecklist.productionChecklist[0],
        label: "Unrecognized checklist wording",
      }],
    } as unknown as PackageFixture));

    const wrongOwner = packageFixture("wrong-owner");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...wrongOwner,
      ownerId: otherAdminId,
      createdBy: otherAdminId,
    } as PackageFixture));

    const wrongSchool = packageFixture("wrong-school");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...wrongSchool,
      schoolId: "school-unrelated",
      metadata: { ...wrongSchool.metadata, schoolId: "school-unrelated" },
    } as PackageFixture));

    const invalidVersion = packageFixture("invalid-version");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...invalidVersion,
      version: 0,
    } as PackageFixture));

    const extraField = packageFixture("extra-field");
    await assertFails(writePackageWithIntegrity(adminDb, {
      ...extraField,
      unsupportedInternalState: "not-allowed",
    } as PackageFixture));

    const orphan = packageFixture("orphan");
    await assertFails(writePackageWithIntegrity(adminDb, orphan));
    await assertFails(updateDoc(validPackageRef, {
      selectedFacts: [{ id: "broken" }],
    }));
  } finally {
    await environment.cleanup();
  }
});
