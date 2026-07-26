import assert from "node:assert/strict";
import test from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, type Firestore, getDoc, getDocs, setDoc, setLogLevel } from "firebase/firestore";
import { readFile } from "node:fs/promises";
import {
  createFirestoreFounderWorkflowDraftRepository,
  FounderWorkflowStep,
  normalizeSchoolSpotlightRequest,
  type FounderWorkflowDraft,
  type SchoolSpotlightPackage,
} from "@/domain/founder-simple";
import { createFirestoreKnowledgeGraphRepository, KnowledgeNodeType } from "@/domain/knowledge";
import {
  createFirestoreProjectRepository,
  ProjectType,
  ProjectWorkspace,
  type Project,
} from "@/domain/project";
import {
  createFirestoreProductionPackageRepository,
  type OutlinePackageRepository,
  type ResearchPackageRepository,
} from "@/domain/services";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import {
  addSchoolFromFounderReview,
  assembleSchoolSpotlightPackage,
  createSchoolSpotlightDraftInput,
  deriveSchoolSpotlightFacts,
  FounderSchoolSubmissionError,
  knowledgeService,
  prepareSchoolSpotlightForReview,
  projectWorkflowService,
} from "@/services";
import { firstTwoTransactionBarrier } from "./knowledge-graph-emulator-fixtures";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const actorId = "founder-admin";
const workspaceId = "executive-workspace";
const schoolInput = {
  officialName: "Atomic Firestore University",
  city: "Ashland",
  state: "OH",
  athleticsWebsite: "https://athletics.atomic-firestore.example",
  governingBody: "NCAA",
  division: "Division II",
};

const maloneSchoolInput = {
  officialName: "Malone University",
  city: "Canton",
  state: "OH",
  governingBody: "NCAA",
  division: "Division 2",
  schoolWebsite: "https://malone.edu",
  athleticsWebsite: "https://malonepioneers.com",
};

setLogLevel("silent");

function productionProject(schoolId: string, creationRequestId: string): Project {
  const now = "2026-07-19T07:00:00.000Z";
  return {
    id: "project-malone-exact-review",
    workspaceId,
    title: "Malone University School Spotlight",
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    state: ProjectStatus.Production,
    status: ProjectStatus.Production,
    currentWorkspace: ProjectWorkspace.ProductionStudio,
    workspace: "Production Studio",
    workspaceHistory: [{ workspace: ProjectWorkspace.ProductionStudio, enteredAt: now, reason: "Founder test" }],
    stateHistory: [{ state: ProjectStatus.Production, enteredAt: now, reason: "Founder test" }],
    progressPercent: 55,
    priority: Priority.Medium,
    ownerId: actorId,
    dependencies: [],
    currentBlocker: null,
    currentStep: "Production",
    recommendedNextAction: "Build package",
    lastActivity: "Founder test",
    scope: Scope.Internal,
    contributorIds: [],
    knowledgeEntityIds: [schoolId],
    assetIds: [],
    decisionIds: [],
    sourceIds: [],
    completedSoFar: ["School selected", "Spotlight request saved"],
    createdAt: now,
    updatedAt: now,
    version: 1,
    creationRequestId: `founder-simple-${creationRequestId}`,
  };
}

test("Firestore Add School transaction is all-or-nothing and retry-idempotent", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const environment = await initializeTestEnvironment({
    projectId: "hoopfrens-founder-school-bundle-test",
    firestore: {
      host,
      port: Number(portValue),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });

  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", actorId), { role: "admin" });
    });
    const adminDb = environment.authenticatedContext(actorId).firestore() as unknown as Firestore;
    const faultingRepository = createFirestoreKnowledgeGraphRepository(adminDb, {
      beforeAuditWrite: async (event) => {
        if (event.subjectType === "relationship") {
          throw new Error("Injected Firestore School bundle audit failure");
        }
      },
    });

    await assert.rejects(
      addSchoolFromFounderReview(faultingRepository, schoolInput, actorId),
      (error: unknown) => error instanceof FounderSchoolSubmissionError
        && error.code === "unexpected"
        && error.cause instanceof Error
        && /Injected Firestore School bundle audit failure/.test(error.cause.message),
    );
    assert.deepEqual(await faultingRepository.listSources(workspaceId), []);
    assert.deepEqual(await faultingRepository.listNodes(workspaceId), []);
    assert.deepEqual(await faultingRepository.listRelationships(workspaceId), []);
    assert.deepEqual(await faultingRepository.listAuditEvents(workspaceId), []);

    const barrier = firstTwoTransactionBarrier();
    const repositoryA = createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: barrier });
    const repositoryB = createFirestoreKnowledgeGraphRepository(adminDb, { afterClaimRead: barrier });
    const [first, second] = await Promise.all([
      addSchoolFromFounderReview(repositoryA, schoolInput, actorId),
      addSchoolFromFounderReview(repositoryB, schoolInput, actorId),
    ]);

    assert.equal(first.school.id, second.school.id);
    assert.deepEqual([first.created, second.created].sort(), [false, true]);
    assert.equal((await repositoryA.listSources(workspaceId)).length, 1);
    const nodes = await repositoryA.listNodes(workspaceId);
    assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.State).length, 1);
    assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.Region).length, 1);
    assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.School).length, 1);
    assert.equal((await repositoryA.listRelationships(workspaceId)).length, 2);
    assert.equal((await repositoryA.listAuditEvents(workspaceId)).length, 6);

    await environment.withSecurityRulesDisabled(async (context) => {
      const registries = await getDocs(collection(context.firestore(), "internalKnowledgeUniqueness"));
      await Promise.all(registries.docs.map((snapshot) => deleteDoc(snapshot.ref)));
    });

    const malone = await addSchoolFromFounderReview(repositoryA, maloneSchoolInput, actorId);
    assert.equal(malone.created, true);
    assert.equal(malone.school.id, "school-malone-university");
    assert.equal(malone.school.state, "Ohio");
    assert.equal(malone.school.region, "greater_lakes");
    assert.equal(malone.school.division, "Division 2");
    assert.equal(malone.school.schoolWebsite, "https://malone.edu");
    assert.equal(malone.school.athleticsWebsite, "https://malonepioneers.com");
    const afterMaloneNodes = await repositoryA.listNodes(workspaceId);
    assert.equal(afterMaloneNodes.filter((node) => node.type === KnowledgeNodeType.State).length, 1);
    assert.equal(afterMaloneNodes.filter((node) => node.type === KnowledgeNodeType.Region).length, 1);
    assert.equal(afterMaloneNodes.filter((node) => node.type === KnowledgeNodeType.School).length, 2);
    assert.equal((await repositoryA.listSources(workspaceId)).length, 2);
    assert.equal((await repositoryA.listRelationships(workspaceId)).length, 4);
    assert.equal((await repositoryA.listAuditEvents(workspaceId)).length, 10);
  } finally {
    await environment.cleanup();
  }
});

test("Malone exact review strips optional undefined fields and resumes the saved package without a duplicate", {
  skip: !emulatorHost,
}, async () => {
  assert.ok(emulatorHost);
  const [host, portValue] = emulatorHost.split(":");
  const environment = await initializeTestEnvironment({
    projectId: "hoopfrens-founder-exact-review-test",
    firestore: {
      host,
      port: Number(portValue),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });

  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", actorId), { role: "admin" });
    });
    const adminDb = environment.authenticatedContext(actorId).firestore() as unknown as Firestore;
    const knowledgeRepository = createFirestoreKnowledgeGraphRepository(adminDb);
    const { school } = await addSchoolFromFounderReview(knowledgeRepository, maloneSchoolInput, actorId);
    const graph = await knowledgeService.loadGraph(knowledgeRepository, workspaceId);
    const draftId = "spotlight-malone-exact-review";
    const project = productionProject(school.id, draftId);
    await setDoc(doc(adminDb, "internalProjects", project.id), project);

    const draftInput = createSchoolSpotlightDraftInput(draftId, actorId);
    const draft: FounderWorkflowDraft = {
      ...draftInput,
      schoolId: school.id,
      projectId: project.id,
      step: FounderWorkflowStep.Customize,
      request: normalizeSchoolSpotlightRequest({
        objective: "Showcase basketball facilities",
        goals: ["showcase-facilities"],
        audience: "Players",
        audiences: ["players"],
        platforms: ["instagram-reel", "tiktok", "youtube-short"],
        centralEmphasis: "Campus experience",
        primaryEmphasis: "campus-experience",
        availableMedia: ["Practice footage"],
        media: ["practice-footage"],
        needShotList: false,
        callToAction: "Learn more through the School's official channels.",
      }),
      facts: deriveSchoolSpotlightFacts(graph, school.id),
      customization: {
        ...draftInput.customization,
        hook: "Meet Malone University.",
        emphasis: "Campus experience",
        callToAction: "Learn more through the School's official channels.",
        mediaAvailability: ["Practice footage"],
        verticalVideoScript: "Meet Malone University and explore its basketball facilities.",
        instagramCaption: "Meet Malone University and explore its basketball facilities.",
        shotList: ["Campus", "Court", "Closing card"],
        rightsConfirmed: true,
      },
      createdAt: "2026-07-19T07:00:00.000Z",
      updatedAt: "2026-07-19T07:00:00.000Z",
      createdBy: actorId,
      updatedBy: actorId,
      revision: 1,
    };
    const draftRepository = createFirestoreFounderWorkflowDraftRepository(adminDb);
    let persistedDraft = await draftRepository.create(draftInput, { actorId });
    persistedDraft = await draftRepository.update(persistedDraft.id, {
      schoolId: draft.schoolId,
      projectId: draft.projectId,
      step: draft.step,
      request: draft.request,
      facts: draft.facts,
      customization: draft.customization,
    }, { actorId }, { expectedRevision: persistedDraft.revision });
    const assembled = assembleSchoolSpotlightPackage(
      persistedDraft,
      graph,
      school,
      project,
      null,
      "2026-07-19T07:01:00.000Z",
    );
    assert.equal(assembled.selectedFacts.length, 7);
    const legacyUndefinedPackage: SchoolSpotlightPackage = {
      ...assembled,
      request: {
        ...assembled.request,
        goalOther: undefined,
        supplementalGoalText: undefined,
      },
    };
    await assert.rejects(
      async () => setDoc(
          doc(adminDb, "internalProductionPackages", legacyUndefinedPackage.id),
          legacyUndefinedPackage,
        ),
      /Unsupported field value: undefined/,
    );

    const projectRepository = createFirestoreProjectRepository(adminDb, actorId);
    const interruptedProject = await projectRepository.updateWithArtifacts(
      project.id,
      {
        ...projectWorkflowService.createUpdate(project, "complete-production", "2026-07-19T07:02:00.000Z"),
        activeProductionVersion: legacyUndefinedPackage.version,
        activeSchoolSpotlightPackageId: legacyUndefinedPackage.id,
      },
      [legacyUndefinedPackage],
      { expectedUpdatedAt: project.updatedAt },
    );
    const rawRequestIntegrity = (await getDoc(
      doc(adminDb, "internalSchoolSpotlightPackageRequest", legacyUndefinedPackage.id),
    )).data();
    assert.ok(rawRequestIntegrity);
    assert.equal("goalOther" in rawRequestIntegrity.request, false);
    assert.equal("supplementalGoalText" in rawRequestIntegrity.request, false);

    const productionRepository = createFirestoreProductionPackageRepository(adminDb);
    const researchRepository: ResearchPackageRepository = {
      async getByProjectId() { return null; },
      async save(value) { return value; },
    };
    const outlineRepository: OutlinePackageRepository = {
      async getByProjectId() { return null; },
      async save(value) { return value; },
    };
    const reviewedProject = await prepareSchoolSpotlightForReview({
      projectRepository,
      researchPackageRepository: researchRepository,
      outlinePackageRepository: outlineRepository,
      productionPackageRepository: productionRepository,
      project: interruptedProject,
      spotlightPackage: assembled,
    });

    assert.equal(reviewedProject.state, ProjectStatus.Review);
    assert.equal(reviewedProject.activeProductionVersion, 1);
    assert.equal(reviewedProject.activeSchoolSpotlightPackageId, assembled.id);
    assert.equal((await productionRepository.getById(assembled.id))?.version, 1);
    assert.equal((await getDocs(collection(adminDb, "internalProductionPackages"))).size, 1);
  } finally {
    await environment.cleanup();
  }
});
