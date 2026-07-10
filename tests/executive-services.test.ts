import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactStatus, ArtifactType, type BusinessObject } from "@/domain/business-object";
import { createProjectUpdateEvents, ExecutiveEventType } from "@/domain/event";
import { ProjectType, ProjectWorkspace, type Project, type ProjectRepository } from "@/domain/project";
import { RecommendationCategory } from "@/domain/recommendation";
import {
  ExecutiveServiceStatus,
  ExecutiveServiceType,
  ProductionReadinessStatus,
  type OutlinePackage,
  type OutlinePackageRepository,
  type ProductionPackage,
  type ProductionPackageRepository,
  type ResearchPackage,
  type ResearchPackageRepository,
} from "@/domain/services";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import {
  companyHealthService,
  createExecutiveServiceRegistry,
  executiveIntelligenceService,
  executivePrioritizationService,
  executiveRecommendationService,
  productionReadinessService,
  projectWorkflowService,
} from "@/services";

const now = "2026-07-09T12:00:00.000Z";

function createProject(state: ProjectStatus): Project {
  return {
    id: `project-${state}`,
    workspaceId: "executive-workspace",
    title: "Ashland University School Spotlight",
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    state,
    status: state,
    currentWorkspace:
      state === ProjectStatus.Production ? ProjectWorkspace.ProductionStudio : ProjectWorkspace.IntelligenceCenter,
    workspace: state === ProjectStatus.Production ? "Production Studio" : "Intelligence Center",
    workspaceHistory: [
      {
        workspace:
          state === ProjectStatus.Production ? ProjectWorkspace.ProductionStudio : ProjectWorkspace.IntelligenceCenter,
        enteredAt: now,
        reason: "Test project created",
      },
    ],
    stateHistory: [{ state, enteredAt: now, reason: "Test project created" }],
    progressPercent: 10,
    priority: Priority.High,
    ownerId: "founder",
    dependencies: [],
    currentBlocker: null,
    currentStep: state === ProjectStatus.Production ? "Production" : "Research",
    recommendedNextAction: state === ProjectStatus.Production ? "Generate the Production Package" : "Begin research",
    lastActivity: "Project created",
    scope: Scope.Internal,
    contributorIds: [],
    knowledgeEntityIds: [],
    assetIds: [],
    decisionIds: [],
    sourceIds: [],
    completedSoFar: ["Project brief"],
    remainingNextStep: state === ProjectStatus.Production ? "Production" : "Research",
    createdAt: now,
    updatedAt: now,
  };
}

function createRepositories(initialProject: Project) {
  let project = initialProject;
  let researchPackage: ResearchPackage | null = null;
  let outlinePackage: OutlinePackage | null = null;
  let productionPackage: ProductionPackage | null = null;

  const projectRepository: ProjectRepository = {
    async listByWorkspace() {
      return [project];
    },
    async getById(projectId) {
      return project.id === projectId ? project : null;
    },
    async create(nextProject) {
      project = nextProject;
      return project;
    },
    async update(projectId, update) {
      if (project.id !== projectId) throw new Error("Project not found");
      project = { ...project, ...update };
      return project;
    },
  };

  const researchPackageRepository: ResearchPackageRepository = {
    async getByProjectId(projectId) {
      return researchPackage?.projectId === projectId ? researchPackage : null;
    },
    async save(nextPackage) {
      researchPackage = nextPackage;
      return nextPackage;
    },
  };

  const outlinePackageRepository: OutlinePackageRepository = {
    async getByProjectId(projectId) {
      return outlinePackage?.projectId === projectId ? outlinePackage : null;
    },
    async save(nextPackage) {
      outlinePackage = nextPackage;
      return nextPackage;
    },
  };

  const productionPackageRepository: ProductionPackageRepository = {
    async getByProjectId(projectId) {
      return productionPackage?.projectId === projectId ? productionPackage : null;
    },
    async save(nextPackage) {
      productionPackage = nextPackage;
      return nextPackage;
    },
  };

  return {
    projectRepository,
    researchPackageRepository,
    outlinePackageRepository,
    productionPackageRepository,
    getProject: () => project,
    getResearchPackage: () => researchPackage,
    getOutlinePackage: () => outlinePackage,
    getProductionPackage: () => productionPackage,
  };
}

function assertBusinessObject(artifact: BusinessObject, artifactType: ArtifactType, serviceType: ExecutiveServiceType) {
  assert.ok(artifact.id);
  assert.ok(artifact.projectId);
  assert.equal(artifact.artifactType, artifactType);
  assert.ok(artifact.version >= 1);
  assert.ok(artifact.status);
  assert.ok(artifact.createdAt);
  assert.ok(artifact.updatedAt);
  assert.ok(artifact.createdBy);
  assert.ok(artifact.workspace);
  assert.equal(artifact.generatedByService, serviceType);
  assert.ok(artifact.summary);
  assert.ok(artifact.metadata);
}

test("registers all executive services and routes projects by state", () => {
  const repositories = createRepositories(createProject(ProjectStatus.Draft));
  const registry = createExecutiveServiceRegistry(repositories);

  assert.deepEqual(registry.registeredServices(), [
    ExecutiveServiceType.Research,
    ExecutiveServiceType.Outline,
    ExecutiveServiceType.Production,
    ExecutiveServiceType.Review,
    ExecutiveServiceType.Publishing,
  ]);
  assert.equal(registry.resolve(createProject(ProjectStatus.Draft))?.type, ExecutiveServiceType.Research);
  assert.equal(registry.resolve(createProject(ProjectStatus.Research))?.type, ExecutiveServiceType.Research);
  assert.equal(registry.resolve(createProject(ProjectStatus.Outline))?.type, ExecutiveServiceType.Outline);
  assert.equal(registry.resolve(createProject(ProjectStatus.Production))?.type, ExecutiveServiceType.Production);
  assert.equal(registry.resolve(createProject(ProjectStatus.Review))?.type, ExecutiveServiceType.Review);
  assert.equal(registry.resolve(createProject(ProjectStatus.Approved))?.type, ExecutiveServiceType.Publishing);
  assert.equal(registry.resolve(createProject(ProjectStatus.Published)), null);
  assert.equal(registry.resolve(createProject(ProjectStatus.Archived)), null);
});

test("Research, Outline, and Production packages inherit the Business Object model", async () => {
  const repositories = createRepositories(createProject(ProjectStatus.Draft));
  const registry = createExecutiveServiceRegistry(repositories);

  const researchResult = await registry.execute(repositories.getProject());
  const researchPackage = repositories.getResearchPackage();
  assert.equal(researchResult.status, ExecutiveServiceStatus.Completed);
  assert.equal(researchResult.artifacts[0]?.artifactType, ArtifactType.ResearchPackage);
  assert.equal(repositories.getProject().state, ProjectStatus.Outline);
  assert.ok(researchPackage);
  assertBusinessObject(researchPackage, ArtifactType.ResearchPackage, ExecutiveServiceType.Research);
  assert.equal(researchPackage.status, ArtifactStatus.Completed);

  const outlineResult = await registry.execute(repositories.getProject());
  const outlinePackage = repositories.getOutlinePackage();
  assert.equal(outlineResult.status, ExecutiveServiceStatus.Completed);
  assert.equal(outlineResult.artifacts[0]?.artifactType, ArtifactType.OutlinePackage);
  assert.equal(repositories.getProject().state, ProjectStatus.Production);
  assert.equal(repositories.getProject().currentWorkspace, ProjectWorkspace.ProductionStudio);
  assert.ok(outlinePackage);
  assertBusinessObject(outlinePackage, ArtifactType.OutlinePackage, ExecutiveServiceType.Outline);
  assert.equal(outlinePackage.status, ArtifactStatus.Approved);

  const productionResult = await registry.execute(repositories.getProject());
  const productionPackage = repositories.getProductionPackage();
  assert.equal(productionResult.status, ExecutiveServiceStatus.Completed);
  assert.equal(productionResult.artifacts[0]?.artifactType, ArtifactType.ProductionPackage);
  assert.equal(repositories.getProject().state, ProjectStatus.Production);
  assert.equal(repositories.getProject().currentStep, "Founder Review");
  assert.ok(productionPackage);
  assertBusinessObject(productionPackage, ArtifactType.ProductionPackage, ExecutiveServiceType.Production);
  assert.equal(productionPackage.status, ArtifactStatus.Ready);
  assert.ok(productionPackage.workingDraft);
  assert.ok(productionPackage.productionChecklist.length);
  assert.ok(productionPackage.mediaChecklist.length);
  assert.ok(productionPackage.graphicsNeeded.length);
  assert.ok(productionPackage.publishingRequirements.length);
  assert.ok(productionPackage.qaChecklist.length);
});

test("Production Service blocks without an approved Outline Package", async () => {
  const project = createProject(ProjectStatus.Production);
  const repositories = createRepositories(project);
  const registry = createExecutiveServiceRegistry(repositories);
  const result = await registry.execute(project);

  assert.equal(result.status, ExecutiveServiceStatus.Blocked);
  assert.match(result.recommendedNextAction, /approved Outline Package/);
  assert.equal(repositories.getProductionPackage(), null);
  assert.equal(repositories.getProject().updatedAt, project.updatedAt);
});

test("Production Readiness returns Ready for Review, Needs Production, and Blocked", async () => {
  const repositories = createRepositories(createProject(ProjectStatus.Draft));
  const registry = createExecutiveServiceRegistry(repositories);
  await registry.execute(repositories.getProject());
  await registry.execute(repositories.getProject());
  await registry.execute(repositories.getProject());
  const project = repositories.getProject();
  const productionPackage = repositories.getProductionPackage();
  assert.ok(productionPackage);

  const ready = productionReadinessService.evaluate(project, productionPackage, new Date(now));
  const missing = productionReadinessService.evaluate(project, null, new Date(now));
  const incomplete = productionReadinessService.evaluate(
    project,
    {
      ...productionPackage,
      status: ArtifactStatus.Draft,
      qaChecklist: productionPackage.qaChecklist.map((item, index) =>
        index === 0 ? { ...item, completed: false } : item,
      ),
    },
    new Date(now),
  );
  const blocked = productionReadinessService.evaluate(
    { ...project, currentBlocker: "Required graphic rights are missing" },
    productionPackage,
    new Date(now),
  );

  assert.equal(ready.status, ProductionReadinessStatus.ReadyForReview);
  assert.equal(missing.status, ProductionReadinessStatus.NeedsProduction);
  assert.equal(incomplete.status, ProductionReadinessStatus.NeedsProduction);
  assert.ok(incomplete.missingRequirements.includes(productionPackage.qaChecklist[0].label));
  assert.equal(blocked.status, ProductionReadinessStatus.Blocked);
});

test("Production completion updates timeline, recommendation, attention, health, and review transition", async () => {
  const repositories = createRepositories(createProject(ProjectStatus.Draft));
  const registry = createExecutiveServiceRegistry(repositories);
  await registry.execute(repositories.getProject());
  await registry.execute(repositories.getProject());
  const beforeProduction = repositories.getProject();
  await registry.execute(beforeProduction);
  const productionComplete = repositories.getProject();
  const events = createProjectUpdateEvents(beforeProduction, productionComplete, "founder");
  const productionEvent = events.find((event) => event.eventType === ExecutiveEventType.ProductionCompleted);
  assert.ok(productionEvent);

  const recommendation = executiveRecommendationService.evaluate(productionComplete, events, new Date(now));
  assert.equal(recommendation.category, RecommendationCategory.Review);
  assert.equal(recommendation.actionLabel, "Begin Review");

  const prioritization = executivePrioritizationService.prioritize([productionComplete], new Date(now));
  const intelligence = executiveIntelligenceService.generate(
    prioritization.assessments,
    [recommendation],
    null,
  );
  assert.equal(intelligence.needsAttention[0]?.label, "Ready for Review");

  const reviewHealth = companyHealthService
    .evaluate([productionComplete], events, new Date(now))
    .find((item) => item.label === "Reviews");
  assert.equal(reviewHealth?.status, "Yellow");

  const reviewUpdate = projectWorkflowService.createUpdate(productionComplete, "review", now);
  assert.equal(reviewUpdate.state, ProjectStatus.Review);
  assert.equal(reviewUpdate.currentWorkspace, ProjectWorkspace.ExecutiveOffice);
});
