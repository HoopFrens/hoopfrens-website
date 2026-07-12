import assert from "node:assert/strict";
import test from "node:test";
import { ExecutiveEventType, type ExecutiveEvent } from "@/domain/event";
import { ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import { RecommendationCategory, RecommendationEffort } from "@/domain/recommendation";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import { executiveRecommendationService } from "@/services";

const now = new Date("2026-07-10T16:00:00.000Z");

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
    workspaceHistory: [
      { workspace: ProjectWorkspace.IntelligenceCenter, enteredAt: "2026-07-09T12:00:00.000Z", reason: "Project created" },
    ],
    stateHistory: [{ state, enteredAt: "2026-07-09T12:00:00.000Z", reason: "Project created" }],
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
    createdAt: "2026-07-09T12:00:00.000Z",
    updatedAt: "2026-07-10T14:00:00.000Z",
    ...overrides,
  };
}

function createServiceEvent(project: Project, eventType: ExecutiveEventType): ExecutiveEvent {
  return {
    id: `${project.id}-${eventType}`,
    workspaceId: project.workspaceId,
    actorId: project.ownerId,
    timestamp: project.updatedAt,
    eventType,
    projectId: project.id,
    project: { id: project.id, title: project.title },
    summary: `${eventType} recorded.`,
    relatedWorkspace: project.currentWorkspace,
    projectHref: `/executive-workspace/projects?projectId=${project.id}`,
  };
}

test("maps active project state to every approved recommendation category", () => {
  const cases: Array<[Project, RecommendationCategory]> = [
    [createProject("start"), RecommendationCategory.Start],
    [createProject("continue", { state: ProjectStatus.Research, status: ProjectStatus.Research }), RecommendationCategory.Continue],
    [
      createProject("review", {
        state: ProjectStatus.Review,
        status: ProjectStatus.Review,
        currentStep: "Founder Review",
        recommendedNextAction: "Review the package",
      }),
      RecommendationCategory.Review,
    ],
    [
      createProject("approve", {
        state: ProjectStatus.Review,
        status: ProjectStatus.Review,
        currentStep: "Founder Approval",
        recommendedNextAction: "Confirm approval",
      }),
      RecommendationCategory.Approve,
    ],
    [createProject("publish", { state: ProjectStatus.Approved, status: ProjectStatus.Approved }), RecommendationCategory.Publish],
    [createProject("blocked", { currentBlocker: "Missing verified source" }), RecommendationCategory.ResolveBlocker],
    [createProject("archive", { state: ProjectStatus.Published, status: ProjectStatus.Published }), RecommendationCategory.Archive],
  ];

  for (const [project, category] of cases) {
    const recommendation = executiveRecommendationService.evaluate(project, [], now);
    assert.equal(recommendation.category, category);
    assert.ok(recommendation.reason.length >= 2);
    assert.ok(recommendation.whyNow);
    assert.ok(recommendation.delayImpact);
    assert.ok(recommendation.estimatedEffort);
  }
});

test("changes recommendation score and explanation as project state changes", () => {
  const draft = createProject("state-change", { priority: Priority.High });
  const draftRecommendation = executiveRecommendationService.evaluate(draft, [], now);
  const review = createProject("state-change", {
    state: ProjectStatus.Review,
    status: ProjectStatus.Review,
    currentWorkspace: ProjectWorkspace.ExecutiveOffice,
    currentStep: "Founder Review",
    recommendedNextAction: "Review the package",
    progressPercent: 75,
    priority: Priority.High,
  });
  const reviewRecommendation = executiveRecommendationService.evaluate(review, [], now);

  assert.equal(draftRecommendation.category, RecommendationCategory.Start);
  assert.equal(reviewRecommendation.category, RecommendationCategory.Review);
  assert.ok(reviewRecommendation.score > draftRecommendation.score);
  assert.notDeepEqual(reviewRecommendation.reason, draftRecommendation.reason);
  assert.match(reviewRecommendation.whyNow, /Founder action/);
});

test("uses service completion to raise score and explain a low-effort continuation", () => {
  const project = createProject("ashland", {
    title: "Ashland University School Spotlight",
    state: ProjectStatus.Outline,
    status: ProjectStatus.Outline,
    progressPercent: 35,
    currentStep: "Outline",
    recommendedNextAction: "Create the project outline",
    lastActivity: "Research complete",
  });
  const researchCompleted = createServiceEvent(project, ExecutiveEventType.ResearchCompleted);
  const withoutCompletion = executiveRecommendationService.evaluate(project, [], now);
  const withCompletion = executiveRecommendationService.evaluate(project, [researchCompleted], now);

  assert.equal(withCompletion.category, RecommendationCategory.Continue);
  assert.equal(withCompletion.estimatedEffort, RecommendationEffort.Low);
  assert.ok(withCompletion.score > withoutCompletion.score);
  assert.deepEqual(withCompletion.reason.slice(0, 3), [
    "Research is complete.",
    "Outline has not been started.",
    "No blockers exist.",
  ]);
  assert.match(withCompletion.whyNow, /previous service is complete/);
  assert.match(withCompletion.delayImpact, /next lifecycle stage remains idle/);
});

test("ranks multiple projects deterministically and excludes archived work", () => {
  const projects = [
    createProject("routine"),
    createProject("overdue-review", {
      state: ProjectStatus.Review,
      status: ProjectStatus.Review,
      currentWorkspace: ProjectWorkspace.ExecutiveOffice,
      currentStep: "Founder Review",
      recommendedNextAction: "Review the package",
      priority: Priority.Critical,
      progressPercent: 80,
      dueDate: "2026-07-08T16:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
    }),
    createProject("blocked", {
      priority: Priority.High,
      progressPercent: 50,
      currentBlocker: "Founder decision required",
    }),
    createProject("archived", { state: ProjectStatus.Archived, status: ProjectStatus.Archived }),
  ];

  const result = executiveRecommendationService.rank(projects, [], now);

  assert.equal(result.recommendations.length, 3);
  assert.equal(result.topRecommendation?.project.id, "overdue-review");
  assert.ok(result.recommendations.every((recommendation, index) => index === 0 || result.recommendations[index - 1].score >= recommendation.score));
  assert.equal(result.recommendations.some((recommendation) => recommendation.project.id === "archived"), false);
});
