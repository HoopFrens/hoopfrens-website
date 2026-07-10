import assert from "node:assert/strict";
import test from "node:test";
import { ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import { executivePrioritizationService } from "@/services";

const now = new Date("2026-07-09T12:00:00.000Z");

function createProject(id: string, overrides: Partial<Project> = {}): Project {
  const state = overrides.state || overrides.status || ProjectStatus.Draft;
  return {
    id,
    workspaceId: "executive-workspace",
    title: `Project ${id}`,
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    state,
    status: state,
    currentWorkspace: ProjectWorkspace.IntelligenceCenter,
    workspace: "Intelligence Center",
    workspaceHistory: [{ workspace: ProjectWorkspace.IntelligenceCenter, enteredAt: "2026-07-01T12:00:00.000Z", reason: "Project created" }],
    stateHistory: [{ state, enteredAt: "2026-07-01T12:00:00.000Z", reason: "Project created" }],
    progressPercent: 10,
    priority: Priority.Medium,
    ownerId: "founder",
    dependencies: [],
    currentBlocker: null,
    currentStep: "Research",
    recommendedNextAction: "Begin research",
    lastActivity: "Project created",
    scope: Scope.Internal,
    contributorIds: [],
    knowledgeEntityIds: [],
    assetIds: [],
    decisionIds: [],
    sourceIds: [],
    completedSoFar: [],
    remainingNextStep: "Research",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-09T10:00:00.000Z",
    ...overrides,
  };
}

test("generates ranked Founder, risk, waiting, and ready project groups", () => {
  const projects = [
    createProject("founder-review", {
      state: ProjectStatus.Review,
      status: ProjectStatus.Review,
      priority: Priority.Critical,
      currentWorkspace: ProjectWorkspace.ExecutiveOffice,
      currentStep: "Founder Review",
      recommendedNextAction: "Complete Founder Review",
      dueDate: "2026-07-10T12:00:00.000Z",
      progressPercent: 75,
    }),
    createProject("blocked-overdue", {
      state: ProjectStatus.Production,
      status: ProjectStatus.Production,
      priority: Priority.High,
      currentBlocker: "Missing final footage",
      dueDate: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-06-15T12:00:00.000Z",
      progressPercent: 60,
    }),
    createProject("ready-outline", {
      state: ProjectStatus.Outline,
      status: ProjectStatus.Outline,
      priority: Priority.High,
      currentStep: "Outline",
      recommendedNextAction: "Create the project outline",
      progressPercent: 35,
    }),
    createProject("published", {
      state: ProjectStatus.Published,
      status: ProjectStatus.Published,
      progressPercent: 100,
    }),
  ];

  const result = executivePrioritizationService.prioritize(projects, now);

  assert.equal(result.assessments.length, 3);
  assert.equal(result.topFounderPriorities.length, 3);
  assert.equal(result.projectsAtRisk[0]?.project.id, "blocked-overdue");
  assert.equal(result.projectsWaitingOnFounder[0]?.project.id, "founder-review");
  assert.ok(result.projectsReadyToAdvance.some((assessment) => assessment.project.id === "ready-outline"));
  assert.ok(result.assessments.every((assessment) => assessment.priorityScore >= 0 && assessment.priorityScore <= 100));
  assert.ok(result.assessments.every((assessment) => assessment.reasons.length > 0));
  assert.ok(result.projectsAtRisk.every((assessment) => assessment.riskReasons.length > 0));
});

test("priority order changes when project state changes", () => {
  const highPriorityDraft = createProject("high-draft", {
    priority: Priority.High,
    state: ProjectStatus.Draft,
    status: ProjectStatus.Draft,
  });
  const mediumOutline = createProject("medium-outline", {
    priority: Priority.Medium,
    state: ProjectStatus.Outline,
    status: ProjectStatus.Outline,
    progressPercent: 35,
    currentStep: "Outline",
    recommendedNextAction: "Create the project outline",
  });

  const beforeStateChange = executivePrioritizationService.prioritize([highPriorityDraft, mediumOutline], now);
  assert.equal(beforeStateChange.topFounderPriorities[0]?.project.id, "high-draft");

  const outlineMovedToReview = createProject("medium-outline", {
    priority: Priority.Medium,
    state: ProjectStatus.Review,
    status: ProjectStatus.Review,
    currentWorkspace: ProjectWorkspace.ExecutiveOffice,
    progressPercent: 75,
    currentStep: "Founder Review",
    recommendedNextAction: "Complete Founder Review",
  });
  const afterStateChange = executivePrioritizationService.prioritize([highPriorityDraft, outlineMovedToReview], now);

  assert.equal(afterStateChange.topFounderPriorities[0]?.project.id, "medium-outline");
  assert.ok(
    (afterStateChange.topFounderPriorities[0]?.priorityScore || 0) >
      (beforeStateChange.topFounderPriorities.find((assessment) => assessment.project.id === "medium-outline")?.priorityScore || 0),
  );
});
