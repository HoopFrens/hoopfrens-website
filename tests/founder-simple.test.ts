import assert from "node:assert/strict";
import test from "node:test";
import {
  FounderWorkflowStatus,
  FounderWorkflowStep,
  FounderWorkflowValidationError,
  SpotlightAudience,
  SpotlightEmphasis,
  SpotlightFactStatus,
  SpotlightGoal,
  SpotlightMedia,
  type SchoolSpotlightPackage,
  createInMemoryFounderWorkflowDraftRepository,
  createVolatileFounderWorkflowDraftStore,
  reconcileFounderWorkflowDraft,
} from "@/domain/founder-simple";
import {
  KnowledgeNodeType,
  createInMemoryKnowledgeGraphRepository,
  createVolatileKnowledgeGraphStore,
  isSchoolKnowledgeNode,
  parseKnowledgeNode,
} from "@/domain/knowledge";
import {
  createInMemoryProjectRepository,
  createVolatileProjectStore,
  ProjectType,
  ProjectWorkspace,
  type Project,
  type ProjectRepository,
} from "@/domain/project";
import type {
  OutlinePackage,
  OutlinePackageRepository,
  ProductionPackage,
  ProductionPackageRepository,
  ResearchPackage,
  ResearchPackageRepository,
} from "@/domain/services";
import { ProjectStatus, Priority, Scope } from "@/domain/shared";
import {
  addSchoolFromFounderReview,
  approveExactSchoolSpotlightPackage,
  assembleSchoolSpotlightPackage,
  createOrResumeSchoolSpotlightProject,
  createSchoolSpotlightDraftInput,
  deriveSchoolSpotlightFacts,
  FounderPackageReviewError,
  FounderSchoolSubmissionError,
  knowledgeService,
  loadExactActiveSchoolSpotlightPackage,
  prepareSchoolSpotlightForReview,
  projectWorkflowService,
} from "@/services";
import { executiveSpaces } from "@/components/executive/ExecutiveWorkspaceShell";
import { GuidedWorkflowShell } from "@/components/founder/GuidedWorkflowShell";
import {
  exactFounderReviewPackage,
  founderDraftUsingExistingSchool,
  UseExistingSchoolAction,
} from "@/components/founder/SchoolSpotlightJourney";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const workspaceId = "executive-workspace";
const actorId = "founder-admin";

function clock() {
  let value = 0;
  return () => new Date(Date.UTC(2026, 6, 18, 12, 0, value++)).toISOString();
}

const schoolInput = {
  officialName: "Ashland University",
  city: "Ashland",
  state: "OH",
  athleticsWebsite: "https://goashlandeagles.com",
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

test("incomplete Founder autosave remains separate from canonical School information", async () => {
  const drafts = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  const knowledge = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const created = await drafts.create(createSchoolSpotlightDraftInput("spotlight-draft-only", actorId), { actorId });
  const saved = await drafts.update(created.id, {
    schoolDraft: { officialName: "Ashland University", city: "Ashland", state: "OH" },
  }, { actorId }, { expectedRevision: 1 });

  assert.equal(saved.revision, 2);
  assert.equal((await drafts.listByOwner(workspaceId, actorId))[0].schoolDraft?.officialName, "Ashland University");
  assert.deepEqual(await knowledge.listNodes(workspaceId), []);
  assert.deepEqual(await knowledge.listSources(workspaceId), []);
  assert.deepEqual(await knowledge.listRelationships(workspaceId), []);
});

test("draft persistence rejects stale revisions and preserves the newer save", async () => {
  const repository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  const created = await repository.create(createSchoolSpotlightDraftInput("spotlight-stale", actorId), { actorId });
  await assert.rejects(
    repository.create(createSchoolSpotlightDraftInput(created.id, "different-admin"), { actorId: "different-admin" }),
    /another Headquarters editor/i,
  );
  const updated = await repository.update(created.id, {
    request: { ...created.request, objective: "Explain Ashland's basketball pathway." },
  }, { actorId }, { expectedRevision: created.revision });
  await assert.rejects(
    repository.update(created.id, { step: FounderWorkflowStep.Review }, { actorId }, { expectedRevision: created.revision }),
    /newer saved version/i,
  );
  await assert.rejects(
    repository.getById(created.id, { actorId: "different-admin" }),
    /another Headquarters editor/i,
  );
  assert.equal((await repository.getById(created.id, { actorId }))?.revision, updated.revision);
});

test("guided Add School derives geography, supports one official URL, and remains duplicate-safe", async () => {
  const repository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const first = await addSchoolFromFounderReview(repository, schoolInput, actorId);
  const second = await addSchoolFromFounderReview(repository, schoolInput, actorId);
  const school = first.school;

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(school.id, second.school.id);
  assert.ok(isSchoolKnowledgeNode(school));
  assert.equal(school.state, "Ohio");
  assert.equal(school.region, "greater_lakes");
  assert.equal(school.schoolWebsite, undefined);
  assert.equal(school.athleticsWebsite, schoolInput.athleticsWebsite);
  assert.equal((await repository.listNodes(workspaceId)).filter((node) => node.type === KnowledgeNodeType.School).length, 1);
  assert.equal((await repository.listRelationships(workspaceId)).length, 2);
  assert.equal((await repository.listSources(workspaceId)).length, 1);
});

test("exact Malone University submission reuses Ohio geography and remains duplicate-aware", async () => {
  const repository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  await addSchoolFromFounderReview(repository, schoolInput, actorId);

  const first = await addSchoolFromFounderReview(repository, maloneSchoolInput, actorId);
  const duplicate = await addSchoolFromFounderReview(repository, maloneSchoolInput, actorId);

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.school.id, first.school.id);
  assert.equal(first.school.id, "school-malone-university");
  assert.equal(first.school.city, "Canton");
  assert.equal(first.school.state, "Ohio");
  assert.equal(first.school.region, "greater_lakes");
  assert.equal(first.school.governingBody, "NCAA");
  assert.equal(first.school.division, "Division 2");
  assert.equal(first.school.schoolWebsite, "https://malone.edu");
  assert.equal(first.school.athleticsWebsite, "https://malonepioneers.com");
  const latestVersion = first.school.versionHistory.at(-1);
  assert.ok(latestVersion?.schoolData);
  const reorderedSchoolData = Object.fromEntries(Object.entries(latestVersion.schoolData).reverse());
  const reopened = parseKnowledgeNode({
    ...first.school,
    versionHistory: [
      ...first.school.versionHistory.slice(0, -1),
      { ...latestVersion, schoolData: reorderedSchoolData },
    ],
  });
  assert.equal(reopened.id, first.school.id);
  const nodes = await repository.listNodes(workspaceId);
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.State).length, 1);
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.Region).length, 1);
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.School).length, 2);
  assert.equal((await repository.listSources(workspaceId)).length, 2);
  assert.equal((await repository.listRelationships(workspaceId)).length, 4);
});

test("Malone duplicate guidance offers and links the matching School without another canonical write", async () => {
  const repository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const first = await addSchoolFromFounderReview(repository, maloneSchoolInput, actorId);
  const duplicate = await addSchoolFromFounderReview(repository, maloneSchoolInput, actorId);
  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  const draft = await draftRepository.create(createSchoolSpotlightDraftInput("spotlight-malone-duplicate", actorId), { actorId });
  const linkedDraft = founderDraftUsingExistingSchool({ ...draft, schoolDraft: maloneSchoolInput }, duplicate.school.id);
  const markup = renderToStaticMarkup(createElement(UseExistingSchoolAction, {
    pending: false,
    onUseExisting: () => undefined,
  }));

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.match(markup, /Use Existing School/);
  assert.equal(linkedDraft.schoolId, first.school.id);
  assert.equal(linkedDraft.schoolDraft, undefined);
  assert.equal(linkedDraft.status, FounderWorkflowStatus.Archived);
  assert.equal((await repository.listNodes(workspaceId)).filter((node) => node.type === KnowledgeNodeType.School).length, 1);
  assert.equal((await repository.listSources(workspaceId)).length, 1);
  assert.equal((await repository.listRelationships(workspaceId)).length, 2);
});

test("Add School reports the affected URL field and a rules deployment next step", async () => {
  const repository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  await assert.rejects(
    addSchoolFromFounderReview(repository, {
      ...maloneSchoolInput,
      athleticsWebsite: "malonepioneers.com",
    }, actorId),
    (error: unknown) => error instanceof FounderSchoolSubmissionError
      && error.code === "invalid-url"
      && error.field === "athleticsWebsite"
      && /Athletics Website/i.test(error.message),
  );

  const permissionDenied = Object.assign(new Error("Raw Firestore transaction detail"), {
    code: "permission-denied",
  });
  const blockedRepository = {
    createSchoolBundle: async () => { throw permissionDenied; },
  } as unknown as Parameters<typeof addSchoolFromFounderReview>[0];
  await assert.rejects(
    addSchoolFromFounderReview(blockedRepository, maloneSchoolInput, actorId),
    (error: unknown) => error instanceof FounderSchoolSubmissionError
      && error.code === "environment-permission"
      && /current Headquarters Firestore rules are deployed/i.test(error.message)
      && !/Raw Firestore transaction detail/i.test(error.message),
  );
});

test("fact review groups missing information conservatively and allows explicit Founder wording", async () => {
  const repository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school } = await addSchoolFromFounderReview(repository, schoolInput, actorId);
  const graph = await knowledgeService.loadGraph(repository, workspaceId);
  const facts = deriveSchoolSpotlightFacts(graph, school.id);

  assert.equal(facts.find((fact) => fact.id === "official-name")?.status, SpotlightFactStatus.Verified);
  assert.equal(facts.find((fact) => fact.id === "facilities")?.status, SpotlightFactStatus.NotAvailable);
  assert.equal(facts.find((fact) => fact.id === "facilities")?.included, false);
  const founderFacility = facts.map((fact) => fact.id === "facilities"
    ? { ...fact, included: true, founderText: "Facility details will be confirmed before publication." }
    : fact);
  assert.equal(founderFacility.find((fact) => fact.id === "facilities")?.included, true);
});

test("unsupported or conflicting information cannot enter a package silently", async () => {
  const knowledgeRepository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school } = await addSchoolFromFounderReview(knowledgeRepository, schoolInput, actorId);
  const graph = await knowledgeService.loadGraph(knowledgeRepository, workspaceId);
  const project = projectInProduction(school.id);
  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  let draft = await draftRepository.create(createSchoolSpotlightDraftInput("spotlight-conflict", actorId), { actorId });
  const facts = deriveSchoolSpotlightFacts(graph, school.id);
  const conflicting = facts.map((fact) => fact.id === "division"
    ? { ...fact, status: SpotlightFactStatus.Conflicting, included: true, founderText: undefined }
    : fact);
  draft = await draftRepository.update(draft.id, {
    schoolId: school.id,
    projectId: project.id,
    facts: conflicting,
    customization: {
      ...draft.customization,
      hook: "Meet Ashland University.",
      verticalVideoScript: "Draft",
      instagramCaption: "Draft",
      rightsConfirmed: true,
    },
  }, { actorId });

  assert.throws(
    () => assembleSchoolSpotlightPackage(draft, graph, school, project, null),
    /explicit Founder wording/i,
  );
});

function projectInProduction(schoolId: string) {
  const now = "2026-07-18T13:00:00.000Z";
  return {
    id: "project-ashland-spotlight",
    workspaceId,
    title: "Ashland University School Spotlight",
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    state: ProjectStatus.Production,
    status: ProjectStatus.Production,
    currentWorkspace: ProjectWorkspace.ProductionStudio,
    workspace: "Production Studio",
    workspaceHistory: [{ workspace: ProjectWorkspace.ProductionStudio, enteredAt: now, reason: "Test" }],
    stateHistory: [
      { state: ProjectStatus.Draft, enteredAt: now, reason: "Test" },
      { state: ProjectStatus.Research, enteredAt: now, reason: "Test" },
      { state: ProjectStatus.Outline, enteredAt: now, reason: "Test" },
      { state: ProjectStatus.Production, enteredAt: now, reason: "Test" },
    ],
    progressPercent: 55,
    priority: Priority.Medium,
    ownerId: actorId,
    dependencies: [],
    currentBlocker: null,
    currentStep: "Production",
    recommendedNextAction: "Build package",
    lastActivity: "Test",
    scope: Scope.Internal,
    contributorIds: [],
    knowledgeEntityIds: [schoolId],
    assetIds: [],
    decisionIds: [],
    sourceIds: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function packageRepositories() {
  let research: ResearchPackage | null = null;
  let outline: OutlinePackage | null = null;
  let production: ProductionPackage | null = null;
  const researchRepository: ResearchPackageRepository = {
    async getByProjectId(projectId) { return research?.projectId === projectId ? research : null; },
    async save(value) { research = value; return value; },
  };
  const outlineRepository: OutlinePackageRepository = {
    async getByProjectId(projectId) { return outline?.projectId === projectId ? outline : null; },
    async save(value) { outline = value; return value; },
  };
  const productionRepository: ProductionPackageRepository = {
    async getById(packageId) { return production?.id === packageId ? production : null; },
    async getByProjectId(projectId) { return production?.projectId === projectId && production.active !== false ? production : null; },
    async getLatestByProjectId(projectId) { return production?.projectId === projectId ? production : null; },
    async save(value) { production = value; return value; },
  };
  return {
    researchRepository,
    outlineRepository,
    productionRepository,
    setProduction(value: ProductionPackage) { production = value; },
  };
}

test("School Spotlight approval always requires an exact package, including omitted approval fields", async () => {
  const repository = createInMemoryProjectRepository(createVolatileProjectStore());
  const stateOnlyProject = await repository.create({
    ...projectInProduction("school-without-package"),
    id: "project-school-without-package",
  });

  await assert.rejects(
    repository.update(stateOnlyProject.id, {
      state: ProjectStatus.Approved,
      status: ProjectStatus.Approved,
    }, { expectedUpdatedAt: stateOnlyProject.updatedAt }),
    /exact active School Spotlight package version/i,
  );

  const packageId = "production_school-with-package_v1";
  const reviewProject = await repository.create({
    ...projectInProduction("school-with-package"),
    id: "project-school-with-package",
    state: ProjectStatus.Review,
    status: ProjectStatus.Review,
    activeProductionVersion: 1,
    activeSchoolSpotlightPackageId: packageId,
  });

  await assert.rejects(
    repository.approveWithProductionPackage(
      reviewProject.id,
      packageId,
      1,
      { state: ProjectStatus.Approved, status: ProjectStatus.Approved },
      { expectedUpdatedAt: reviewProject.updatedAt },
    ),
    /exact active School Spotlight package version/i,
  );
});

test("School Spotlight packages version deterministically and approval binds the exact active version", async () => {
  const knowledgeRepository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school } = await addSchoolFromFounderReview(knowledgeRepository, schoolInput, actorId);
  const graph = await knowledgeService.loadGraph(knowledgeRepository, workspaceId);
  const projectRepository = createInMemoryProjectRepository(createVolatileProjectStore());
  let project = await projectRepository.create(projectInProduction(school.id));
  const repositories = packageRepositories();

  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  let draft = await draftRepository.create(createSchoolSpotlightDraftInput("spotlight-versioned", actorId), { actorId });
  draft = await draftRepository.update(draft.id, {
    schoolId: school.id,
    projectId: project.id,
    step: FounderWorkflowStep.Customize,
    request: { ...draft.request, objective: "Introduce Ashland's basketball pathway." },
    facts: deriveSchoolSpotlightFacts(graph, school.id),
    customization: {
      ...draft.customization,
      hook: "Meet Ashland University.",
      callToAction: "Visit the official athletics website.",
      verticalVideoScript: "Meet Ashland University.\n\nA Division II basketball pathway.",
      instagramCaption: "Meet Ashland University and explore its basketball pathway.",
      shotList: ["Campus", "Court", "Closing card"],
      rightsConfirmed: true,
    },
  }, { actorId });

  const versionOne = assembleSchoolSpotlightPackage(draft, graph, school, project, null, "2026-07-18T13:01:00.000Z");
  project = await prepareSchoolSpotlightForReview({
    projectRepository,
    researchPackageRepository: repositories.researchRepository,
    outlinePackageRepository: repositories.outlineRepository,
    productionPackageRepository: repositories.productionRepository,
    project,
    spotlightPackage: versionOne,
  });
  repositories.setProduction(versionOne);
  assert.equal(project.state, ProjectStatus.Review);
  assert.equal(project.activeProductionVersion, 1);

  project = await projectRepository.update(
    project.id,
    projectWorkflowService.createUpdate(project, "request-revision", "2026-07-18T13:02:00.000Z"),
    { expectedUpdatedAt: project.updatedAt },
  );
  const versionTwo = assembleSchoolSpotlightPackage({
    ...draft,
    customization: { ...draft.customization, hook: "Ashland basketball, clearly explained." },
  }, graph, school, project, versionOne, "2026-07-18T13:03:00.000Z");
  project = await prepareSchoolSpotlightForReview({
    projectRepository,
    researchPackageRepository: repositories.researchRepository,
    outlinePackageRepository: repositories.outlineRepository,
    productionPackageRepository: repositories.productionRepository,
    project,
    spotlightPackage: versionTwo,
  });
  repositories.setProduction(versionTwo);

  assert.equal(versionTwo.version, 2);
  assert.equal(versionTwo.previousPackageId, versionOne.id);
  assert.ok(versionTwo.verticalVideo.scenes.length > 2);
  assert.ok(versionTwo.instagramCaption.length > 0);
  assert.ok(versionTwo.shotList.length > 0);
  assert.ok(versionTwo.verificationSources.length > 0);
  assert.equal("instagramCarousel" in versionTwo, false);
  assert.equal("facebookPost" in versionTwo, false);
  await assert.rejects(
    approveExactSchoolSpotlightPackage(projectRepository, project, versionOne),
    /exact package version/i,
  );
  await assert.rejects(
    projectRepository.update(
      project.id,
      { state: ProjectStatus.Approved, status: ProjectStatus.Approved },
      { expectedUpdatedAt: project.updatedAt },
    ),
    /exact active School Spotlight package version/i,
  );
  await assert.rejects(
    projectRepository.approveWithProductionPackage(
      project.id,
      versionTwo.id,
      versionTwo.version,
      { state: ProjectStatus.Approved, status: ProjectStatus.Approved },
      { expectedUpdatedAt: project.updatedAt },
    ),
    /exact active School Spotlight package version/i,
  );
  await assert.rejects(
    projectRepository.approveWithProductionPackage(
      project.id,
      versionTwo.id,
      versionTwo.version,
      {
        ...projectWorkflowService.createUpdate(project, "approve"),
        approvedSchoolSpotlightPackageId: versionOne.id,
        approvedSchoolSpotlightPackageVersion: versionOne.version,
      },
      { expectedUpdatedAt: project.updatedAt },
    ),
    /exact active School Spotlight package version/i,
  );
  const approved = await approveExactSchoolSpotlightPackage(projectRepository, project, versionTwo);
  assert.equal(approved.state, ProjectStatus.Approved);
  assert.equal(approved.approvedSchoolSpotlightPackageId, versionTwo.id);
  assert.equal(approved.approvedSchoolSpotlightPackageVersion, 2);
});

test("Review Exact Version resumes an interrupted Malone package without creating version two", async () => {
  const knowledgeRepository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school } = await addSchoolFromFounderReview(knowledgeRepository, maloneSchoolInput, actorId);
  const graph = await knowledgeService.loadGraph(knowledgeRepository, workspaceId);
  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  let draft = await draftRepository.create(createSchoolSpotlightDraftInput("spotlight-malone-review", actorId), { actorId });
  let project: Project = {
    ...projectInProduction(school.id),
    id: "project-malone-review",
    title: "Malone University School Spotlight",
    creationRequestId: `founder-simple-${draft.id}`,
  };
  draft = await draftRepository.update(draft.id, {
    schoolId: school.id,
    projectId: project.id,
    step: FounderWorkflowStep.Customize,
    request: {
      ...draft.request,
      objective: "Showcase basketball facilities",
      goals: [SpotlightGoal.ShowcaseFacilities],
      audience: "Players",
      audiences: [SpotlightAudience.Players],
      centralEmphasis: "Campus experience",
      primaryEmphasis: SpotlightEmphasis.CampusExperience,
      media: [SpotlightMedia.PracticeFootage],
      availableMedia: ["Practice footage"],
    },
    facts: deriveSchoolSpotlightFacts(graph, school.id),
    customization: {
      ...draft.customization,
      hook: "Meet Malone University.",
      callToAction: "Learn more through the School's official channels.",
      verticalVideoScript: "Meet Malone University and explore its basketball facilities.",
      instagramCaption: "Meet Malone University and explore its basketball facilities.",
      shotList: ["Campus", "Court", "Closing card"],
      rightsConfirmed: true,
    },
  }, { actorId });
  const versionOne = assembleSchoolSpotlightPackage(
    draft,
    graph,
    school,
    project,
    null,
    "2026-07-19T07:01:00.000Z",
  );
  project = {
    ...project,
    ...projectWorkflowService.createUpdate(project, "complete-production", "2026-07-19T07:02:00.000Z"),
    activeProductionVersion: versionOne.version,
    activeSchoolSpotlightPackageId: versionOne.id,
  };
  const baseProjectRepository = createInMemoryProjectRepository(createVolatileProjectStore([project]));
  const repositories = packageRepositories();
  repositories.setProduction(versionOne);
  let artifactWriteCount = 0;
  const projectRepository: ProjectRepository = {
    ...baseProjectRepository,
    async updateWithArtifacts(...args) {
      artifactWriteCount += 1;
      return baseProjectRepository.updateWithArtifacts(...args);
    },
  };

  const reviewed = await prepareSchoolSpotlightForReview({
    projectRepository,
    researchPackageRepository: repositories.researchRepository,
    outlinePackageRepository: repositories.outlineRepository,
    productionPackageRepository: repositories.productionRepository,
    project,
    spotlightPackage: versionOne,
  });

  assert.equal(reviewed.state, ProjectStatus.Review);
  assert.equal(reviewed.activeProductionVersion, 1);
  assert.equal(reviewed.activeSchoolSpotlightPackageId, versionOne.id);
  assert.equal(artifactWriteCount, 0);
  assert.equal((await repositories.productionRepository.getById(versionOne.id))?.version, 1);

  await assert.rejects(
    loadExactActiveSchoolSpotlightPackage({
      ...repositories.productionRepository,
      async getById() { return null; },
    }, project, draft.id),
    (error: unknown) => error instanceof FounderPackageReviewError
      && error.code === "exact-version-missing"
      && /cannot find that saved version/i.test(error.message)
      && /No new version was created/i.test(error.message),
  );
});

test("approval never publishes or schedules the School Spotlight package", async () => {
  const draft = createSchoolSpotlightDraftInput("spotlight-boundary", actorId);
  assert.equal(draft.status, FounderWorkflowStatus.Active);
  assert.equal("publishedAt" in draft, false);
  assert.equal("scheduledAt" in draft, false);
});

test("a new Spotlight draft does not resume a previously approved School project", async () => {
  const knowledgeRepository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school } = await addSchoolFromFounderReview(knowledgeRepository, schoolInput, actorId);
  const projectRepository = createInMemoryProjectRepository(createVolatileProjectStore());
  const prior = projectInProduction(school.id);
  await projectRepository.create({
    ...prior,
    id: "project-prior-approved",
    creationRequestId: "founder-simple-prior-draft",
    state: ProjectStatus.Approved,
    status: ProjectStatus.Approved,
    progressPercent: 90,
  });
  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  const newDraft = await draftRepository.create(createSchoolSpotlightDraftInput("new-draft", actorId), { actorId });

  const created = await createOrResumeSchoolSpotlightProject(projectRepository, newDraft, school, actorId);
  assert.equal(created.id, "project-new-draft");
  assert.equal(created.state, ProjectStatus.Draft);
});

test("a new Spotlight draft never reuses another draft's nonterminal School project", async () => {
  const knowledgeRepository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school } = await addSchoolFromFounderReview(knowledgeRepository, schoolInput, actorId);
  const projectRepository = createInMemoryProjectRepository(createVolatileProjectStore());
  const prior = await projectRepository.create({
    ...projectInProduction(school.id),
    id: "project-prior-active",
    creationRequestId: "founder-simple-prior-draft",
  });
  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  const newDraft = await draftRepository.create(createSchoolSpotlightDraftInput("new-active-draft", actorId), { actorId });

  const created = await createOrResumeSchoolSpotlightProject(projectRepository, newDraft, school, actorId);

  assert.equal(created.id, `project-${newDraft.id}`);
  assert.equal(created.creationRequestId, `founder-simple-${newDraft.id}`);
  assert.notEqual(created.id, prior.id);
  assert.equal((await projectRepository.getById(prior.id))?.updatedAt, prior.updatedAt);
  assert.equal((await projectRepository.listByWorkspace(workspaceId)).length, 2);
});

test("a saved Spotlight request cannot be rebound to a different School", async () => {
  const knowledgeRepository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school: ashland } = await addSchoolFromFounderReview(knowledgeRepository, schoolInput, actorId);
  const { school: malone } = await addSchoolFromFounderReview(knowledgeRepository, maloneSchoolInput, actorId);
  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  const draft = await draftRepository.create(createSchoolSpotlightDraftInput("school-bound-draft", actorId), { actorId });
  const boundProject = {
    ...projectInProduction(ashland.id),
    id: `project-${draft.id}`,
    creationRequestId: `founder-simple-${draft.id}`,
  };
  const projectRepository = createInMemoryProjectRepository(createVolatileProjectStore([boundProject]));

  await assert.rejects(
    createOrResumeSchoolSpotlightProject(projectRepository, draft, malone, actorId),
    (error: unknown) => error instanceof FounderWorkflowValidationError
      && /already connected to another School/i.test(error.message)
      && /start a new Spotlight/i.test(error.message),
  );
  assert.equal((await projectRepository.listByWorkspace(workspaceId)).length, 1);
  assert.deepEqual((await projectRepository.getById(boundProject.id))?.knowledgeEntityIds, [ashland.id]);
});

test("package linkage mismatches are rejected before any lifecycle or artifact write", async () => {
  const knowledgeRepository = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore(), { now: clock() });
  const { school } = await addSchoolFromFounderReview(knowledgeRepository, schoolInput, actorId);
  const graph = await knowledgeService.loadGraph(knowledgeRepository, workspaceId);
  const draftRepository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  let draft = await draftRepository.create(createSchoolSpotlightDraftInput("preflight-draft", actorId), { actorId });
  const project = {
    ...projectInProduction(school.id),
    state: ProjectStatus.Draft,
    status: ProjectStatus.Draft,
    creationRequestId: `founder-simple-${draft.id}`,
  };
  draft = await draftRepository.update(draft.id, {
    schoolId: school.id,
    projectId: project.id,
    facts: deriveSchoolSpotlightFacts(graph, school.id),
    customization: {
      ...draft.customization,
      hook: "Meet Ashland University.",
      verticalVideoScript: "Meet Ashland University.",
      instagramCaption: "Meet Ashland University.",
      shotList: ["Campus"],
      rightsConfirmed: true,
    },
  }, { actorId });
  const validPackage = assembleSchoolSpotlightPackage(draft, graph, school, project, null);
  const baseProjectRepository = createInMemoryProjectRepository(createVolatileProjectStore([project]));
  let projectWrites = 0;
  let artifactWrites = 0;
  let researchWrites = 0;
  let outlineWrites = 0;
  let productionWrites = 0;
  const projectRepository: ProjectRepository = {
    ...baseProjectRepository,
    async update(...args) {
      projectWrites += 1;
      return baseProjectRepository.update(...args);
    },
    async updateWithArtifacts(...args) {
      artifactWrites += 1;
      return baseProjectRepository.updateWithArtifacts(...args);
    },
  };
  const researchRepository: ResearchPackageRepository = {
    async getByProjectId() { return null; },
    async save(value) { researchWrites += 1; return value; },
  };
  const outlineRepository: OutlinePackageRepository = {
    async getByProjectId() { return null; },
    async save(value) { outlineWrites += 1; return value; },
  };
  const productionRepository: ProductionPackageRepository = {
    async getById() { return null; },
    async getByProjectId() { return null; },
    async getLatestByProjectId() { return null; },
    async save(value) { productionWrites += 1; return value; },
  };

  for (const mismatchedPackage of [
    { ...validPackage, workflowDraftId: "another-draft" },
    { ...validPackage, schoolId: "another-school" },
  ]) {
    await assert.rejects(
      prepareSchoolSpotlightForReview({
        projectRepository,
        researchPackageRepository: researchRepository,
        outlinePackageRepository: outlineRepository,
        productionPackageRepository: productionRepository,
        project,
        spotlightPackage: mismatchedPackage,
      }),
      (error: unknown) => error instanceof FounderPackageReviewError
        && error.code === "exact-version-linkage"
        && /No new version was created/i.test(error.message),
    );
  }

  assert.equal(projectWrites, 0);
  assert.equal(artifactWrites, 0);
  assert.equal(researchWrites, 0);
  assert.equal(outlineWrites, 0);
  assert.equal(productionWrites, 0);
});

test("Founder draft recovery follows only the exact canonical review and approval package", async () => {
  const draftInput = createSchoolSpotlightDraftInput("spotlight-recovery", actorId);
  const draft = {
    ...draftInput,
    schoolId: "school-recovery",
    projectId: "project-recovery",
    createdAt: "2026-07-18T15:00:00.000Z",
    updatedAt: "2026-07-18T15:00:00.000Z",
    createdBy: actorId,
    updatedBy: actorId,
    revision: 2,
  };
  const reviewProject = {
    ...projectInProduction("school-recovery"),
    id: "project-recovery",
    state: ProjectStatus.Review,
    status: ProjectStatus.Review,
    activeProductionVersion: 3,
    activeSchoolSpotlightPackageId: "package-recovery-v3",
  };
  const exactPackage = {
    id: "package-recovery-v3",
    projectId: reviewProject.id,
    workspaceId: reviewProject.workspaceId,
    ownerId: reviewProject.ownerId,
    packageKind: "school-spotlight",
    workflowDraftId: draft.id,
    schoolId: "school-recovery",
    active: true,
    version: 3,
  } as unknown as ProductionPackage;

  assert.deepEqual(reconcileFounderWorkflowDraft(draft, reviewProject, exactPackage), {
    status: FounderWorkflowStatus.Active,
    step: FounderWorkflowStep.Approve,
    currentPackageId: exactPackage.id,
    currentPackageVersion: 3,
  });
  assert.equal(reconcileFounderWorkflowDraft(draft, reviewProject, {
    ...exactPackage,
    workflowDraftId: "different-draft",
  } as unknown as ProductionPackage), null);

  const approvedProject = {
    ...reviewProject,
    state: ProjectStatus.Approved,
    status: ProjectStatus.Approved,
    approvedSchoolSpotlightPackageId: exactPackage.id,
    approvedSchoolSpotlightPackageVersion: 3,
  };
  assert.deepEqual(reconcileFounderWorkflowDraft(draft, approvedProject, exactPackage), {
    status: FounderWorkflowStatus.Completed,
    step: FounderWorkflowStep.Approve,
    currentPackageId: exactPackage.id,
    currentPackageVersion: 3,
  });

  const exactReviewPackage = exactPackage as unknown as SchoolSpotlightPackage;
  assert.equal(exactFounderReviewPackage(draft, reviewProject, exactReviewPackage), exactReviewPackage);
  assert.equal(exactFounderReviewPackage(draft, approvedProject, exactReviewPackage), exactReviewPackage);
  assert.equal(exactFounderReviewPackage(draft, {
    ...approvedProject,
    approvedSchoolSpotlightPackageId: "different-approved-package",
  }, exactReviewPackage), null);
  assert.equal(exactFounderReviewPackage(draft, reviewProject, {
    ...exactReviewPackage,
    id: "newer-but-unlinked-v4",
    version: 4,
  }), null);
  assert.equal(exactFounderReviewPackage(draft, {
    ...reviewProject,
    activeProductionVersion: null,
    productionReadinessInvalidatedAt: "2026-07-18T16:00:00.000Z",
  }, exactReviewPackage), null);
});

test("interrupted Review and Approval draft synchronization remains retry-safe", async () => {
  const repository = createInMemoryFounderWorkflowDraftRepository(createVolatileFounderWorkflowDraftStore(), clock());
  let persisted = await repository.create(createSchoolSpotlightDraftInput("spotlight-interrupted-sync", actorId), { actorId });
  persisted = await repository.update(persisted.id, {
    projectId: "project-interrupted-sync",
    step: FounderWorkflowStep.Customize,
  }, { actorId }, { expectedRevision: persisted.revision });

  const reviewProject = {
    ...projectInProduction("school-interrupted-sync"),
    id: "project-interrupted-sync",
    state: ProjectStatus.Review,
    status: ProjectStatus.Review,
    activeProductionVersion: 4,
    activeSchoolSpotlightPackageId: "package-interrupted-sync-v4",
  };
  const exactPackage = {
    id: "package-interrupted-sync-v4",
    projectId: reviewProject.id,
    packageKind: "school-spotlight",
    workflowDraftId: persisted.id,
    version: 4,
  } as unknown as ProductionPackage;

  let injectFailure = true;
  async function reconcileAndPersist(canonicalProject: typeof reviewProject) {
    const current = await repository.getById(persisted.id, { actorId });
    assert.ok(current);
    const repair = reconcileFounderWorkflowDraft(current, canonicalProject, exactPackage);
    if (!repair) return current;
    if (injectFailure) {
      injectFailure = false;
      throw new Error("Injected draft synchronization failure");
    }
    return repository.update(current.id, repair, { actorId }, { expectedRevision: current.revision });
  }

  await assert.rejects(reconcileAndPersist(reviewProject), /Injected draft synchronization failure/);
  assert.equal((await repository.getById(persisted.id, { actorId }))?.step, FounderWorkflowStep.Customize);
  persisted = await reconcileAndPersist(reviewProject);
  assert.equal(persisted.step, FounderWorkflowStep.Approve);
  assert.equal(persisted.currentPackageVersion, 4);

  const approvedProject = {
    ...reviewProject,
    state: ProjectStatus.Approved,
    status: ProjectStatus.Approved,
    approvedSchoolSpotlightPackageId: exactPackage.id,
    approvedSchoolSpotlightPackageVersion: 4,
  };
  injectFailure = true;
  await assert.rejects(reconcileAndPersist(approvedProject), /Injected draft synchronization failure/);
  assert.equal((await repository.getById(persisted.id, { actorId }))?.status, FounderWorkflowStatus.Active);
  persisted = await reconcileAndPersist(approvedProject);
  assert.equal(persisted.status, FounderWorkflowStatus.Completed);
  assert.equal(persisted.currentPackageId, exactPackage.id);
});

test("Founder-Simple navigation and progress use the approved business language", () => {
  const approvedLabels = ["Today", "Create", "My work", "Make a post", "Review & Approve", "Library"];
  for (const label of approvedLabels) assert.ok(executiveSpaces.some((space) => space.label === label));
  assert.ok(executiveSpaces.some((space) => space.label === "Knowledge Center"));

  const markup = renderToStaticMarkup(createElement(GuidedWorkflowShell, {
    title: "Ashland University",
    eyebrow: "School Spotlight",
    step: FounderWorkflowStep.Review,
    saveStatus: "saved",
    summary: createElement("p", null, "Ashland University"),
    actions: createElement("button", null, "Customize Package"),
  }, createElement("p", null, "Review trusted information.")));
  assert.match(markup, /Request/);
  assert.match(markup, /Review/);
  assert.match(markup, /Customize/);
  assert.match(markup, /Approve/);
  assert.match(markup, /aria-current="step"/);
  assert.doesNotMatch(markup, /repository|schema|source ID|internal ID|enum key/i);
});
