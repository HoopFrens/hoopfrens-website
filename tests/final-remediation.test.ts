import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactForProject,
  scopeArtifactResponse,
  type ProjectScopedArtifact,
} from "@/components/executive/projectArtifactState";
import { ArtifactStatus, ArtifactType } from "@/domain/business-object";
import { createInMemoryProjectRepository, createVolatileProjectStore, ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import {
  ExecutiveServiceType,
  type OutlinePackage,
  type ProductionPackage,
  type ResearchPackage,
} from "@/domain/services";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import {
  createSubmissionIdempotencyTracker,
  executiveCommandService,
  intentService,
  productionReadinessService,
  projectCommandTargetService,
} from "@/services";

const timestamp = "2026-07-11T12:00:00.000Z";

function createProject(id: string, title: string, state = ProjectStatus.Production): Project {
  return {
    id,
    workspaceId: "executive-workspace",
    title,
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    state,
    status: state,
    currentWorkspace: ProjectWorkspace.ProductionStudio,
    workspaceHistory: [{ workspace: ProjectWorkspace.ProductionStudio, enteredAt: timestamp, reason: "Test" }],
    stateHistory: [{ state, enteredAt: timestamp, reason: "Test" }],
    progressPercent: 70,
    priority: Priority.High,
    ownerId: "founder",
    dependencies: [],
    currentBlocker: null,
    currentStep: "Founder Review",
    recommendedNextAction: "Begin Founder Review",
    lastActivity: "Production complete",
    productionCompletedAt: timestamp,
    activeProductionVersion: 1,
    scope: Scope.Internal,
    contributorIds: [],
    knowledgeEntityIds: [],
    assetIds: [],
    decisionIds: [],
    sourceIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createProductionPackage(projectId: string): ProductionPackage {
  return {
    id: `production_${projectId}_v1`,
    projectId,
    artifactType: ArtifactType.ProductionPackage,
    version: 1,
    status: ArtifactStatus.Ready,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "founder",
    workspace: ProjectWorkspace.ProductionStudio,
    generatedByService: ExecutiveServiceType.Production,
    summary: "Ready package",
    metadata: {},
    workspaceId: "executive-workspace",
    ownerId: "founder",
    projectTitle: projectId,
    projectType: ProjectType.SchoolSpotlight,
    outlinePackageId: `outline_${projectId}`,
    workingDraft: "Complete draft",
    productionChecklist: [],
    mediaChecklist: [],
    graphicsNeeded: [],
    publishingRequirements: [],
    qaChecklist: [],
    nextRecommendedStep: "Begin Founder Review",
    active: true,
  };
}

function createResearchPackage(projectId: string): ResearchPackage {
  return {
    id: `research_${projectId}`,
    projectId,
    artifactType: ArtifactType.ResearchPackage,
    version: 1,
    status: ArtifactStatus.Completed,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "founder",
    workspace: ProjectWorkspace.IntelligenceCenter,
    generatedByService: ExecutiveServiceType.Research,
    summary: "Research package",
    metadata: {},
    workspaceId: "executive-workspace",
    ownerId: "founder",
    projectTitle: projectId,
    projectType: ProjectType.SchoolSpotlight,
    objective: "Research",
    researchChecklist: [],
    informationNeeded: [],
    sourceChecklist: [],
    expectedDeliverables: [],
    recommendedNextStep: "Outline",
  };
}

function createOutlinePackage(projectId: string): OutlinePackage {
  return {
    id: `outline_${projectId}`,
    projectId,
    artifactType: ArtifactType.OutlinePackage,
    version: 1,
    status: ArtifactStatus.Approved,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "founder",
    workspace: ProjectWorkspace.ProductionStudio,
    generatedByService: ExecutiveServiceType.Outline,
    summary: "Outline package",
    metadata: {},
    workspaceId: "executive-workspace",
    ownerId: "founder",
    projectTitle: projectId,
    projectType: ProjectType.SchoolSpotlight,
    objective: "Produce a school spotlight",
    audience: "Hoop Frens readers",
    narrativeAngle: "Community impact",
    sections: [],
    keyPoints: [],
    productionRequirements: [],
    recommendedNextStep: "Production",
  };
}

test("stale artifact responses cannot cross project ownership", () => {
  const projectAPackage = createProductionPackage("project-a");
  const delayedAResponse = scopeArtifactResponse("project-a", "project-b", projectAPackage);
  assert.equal(delayedAResponse, null);

  const projectBPackage = createProductionPackage("project-b");
  const acceptedBResponse = scopeArtifactResponse("project-b", "project-b", projectBPackage);
  assert.equal(artifactForProject(acceptedBResponse, "project-b")?.projectId, "project-b");
  assert.equal(artifactForProject(acceptedBResponse, "project-a"), null);
});

test("rapid project switching keeps Research, Outline, and Production artifacts scoped", () => {
  let productionState: ProjectScopedArtifact<ProductionPackage> | null = null;
  let researchState: ProjectScopedArtifact<ResearchPackage> | null = null;
  let outlineState: ProjectScopedArtifact<OutlinePackage> | null = null;

  productionState = scopeArtifactResponse("project-b", "project-b", createProductionPackage("project-b"));
  researchState = scopeArtifactResponse("project-b", "project-b", createResearchPackage("project-b"));
  outlineState = scopeArtifactResponse("project-b", "project-b", createOutlinePackage("project-b"));

  assert.equal(scopeArtifactResponse("project-a", "project-b", createProductionPackage("project-a")), null);
  assert.equal(scopeArtifactResponse("project-a", "project-b", createResearchPackage("project-a")), null);
  assert.equal(scopeArtifactResponse("project-a", "project-b", createOutlinePackage("project-a")), null);
  assert.equal(artifactForProject(productionState, "project-b")?.projectId, "project-b");
  assert.equal(artifactForProject(researchState, "project-b")?.projectId, "project-b");
  assert.equal(artifactForProject(outlineState, "project-b")?.projectId, "project-b");
});

test("Production readiness rejects a package owned by another project", () => {
  const readiness = productionReadinessService.evaluate(
    createProject("project-b", "Project B"),
    createProductionPackage("project-a"),
    new Date(timestamp),
  );

  assert.equal(readiness.status, "needs-production");
  assert.deepEqual(readiness.missingRequirements, ["Active Production Package"]);
});

test("malformed and ambiguous command targets never resolve a project", () => {
  const projects = [
    createProject("ashland-state", "Ashland State University School Spotlight"),
    createProject("ashland-tech", "Ashland Tech School Spotlight", ProjectStatus.Review),
  ];

  for (const command of ["Review !!!", "Approve !!!", "Continue !!!"]) {
    const classified = intentService.classify({ workspaceId: "executive-workspace", text: command });
    assert.equal(classified.ok, true);
    if (!classified.ok) continue;
    const result = projectCommandTargetService.resolve(projects, classified.data.relatedEntityName);
    assert.deepEqual(result, { ok: false, reason: "invalid-reference" });
  }

  assert.deepEqual(projectCommandTargetService.resolve(projects, "Ashland"), {
    ok: false,
    reason: "ambiguous-reference",
  });
});

test("exact titles and explicit unambiguous context resolve correctly", () => {
  const projects = [
    createProject("ashland-university", "Ashland University School Spotlight"),
    createProject("ashland-tech", "Ashland Tech School Spotlight"),
  ];

  const exact = projectCommandTargetService.resolve(projects, "Ashland University School Spotlight");
  assert.equal(exact.ok, true);
  if (exact.ok) assert.equal(exact.project.id, "ashland-university");

  const contextual = projectCommandTargetService.resolve(projects, undefined, "ashland-tech");
  assert.equal(contextual.ok, true);
  if (contextual.ok) assert.equal(contextual.project.id, "ashland-tech");

  assert.deepEqual(projectCommandTargetService.resolve(projects), {
    ok: false,
    reason: "missing-reference",
  });
});

test("create retries reuse one idempotency key until definitive success", async () => {
  let sequence = 0;
  const tracker = createSubmissionIdempotencyTracker(() => `submission-${++sequence}`);
  const command = "Create a school spotlight for Ashland University";
  const firstSubmissionId = tracker.idFor(command);
  const firstRequestId = executiveCommandService.createRequestId("founder", firstSubmissionId);
  const firstProjectId = executiveCommandService.projectIdForRequest(firstRequestId);
  const repository = createInMemoryProjectRepository(createVolatileProjectStore());
  const firstProject = await repository.create(createProject(firstProjectId, "Ashland University School Spotlight", ProjectStatus.Draft));

  // Simulate a refresh or fetch failure after the create transaction committed.
  const retrySubmissionId = tracker.idFor(command);
  const retryProjectId = executiveCommandService.projectIdForRequest(
    executiveCommandService.createRequestId("founder", retrySubmissionId),
  );
  const retriedProject = await repository.create(createProject(retryProjectId, "Ashland University School Spotlight", ProjectStatus.Draft));

  assert.equal(retrySubmissionId, firstSubmissionId);
  assert.equal(retryProjectId, firstProject.id);
  assert.equal(retriedProject.id, firstProject.id);
  assert.equal((await repository.listByWorkspace("executive-workspace")).length, 1);

  tracker.complete(command);
  assert.notEqual(tracker.idFor(command), firstSubmissionId);
  assert.notEqual(tracker.idFor("Create a school spotlight for Ashland Tech"), firstSubmissionId);
});
