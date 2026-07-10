import assert from "node:assert/strict";
import test from "node:test";
import { resolveFounderVisit, type FounderVisit } from "@/domain/briefing";
import { createProjectHistoryEvents, ExecutiveEventType } from "@/domain/event";
import { ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import { executivePrioritizationService, founderDailyBriefService } from "@/services";

const now = new Date("2026-07-09T16:00:00.000Z");

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
      {
        workspace: ProjectWorkspace.IntelligenceCenter,
        enteredAt: "2026-07-01T12:00:00.000Z",
        reason: "Project created",
      },
    ],
    stateHistory: [
      {
        state,
        enteredAt: "2026-07-01T12:00:00.000Z",
        reason: "Project created",
      },
    ],
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
    updatedAt: "2026-07-09T14:00:00.000Z",
    ...overrides,
  };
}

test("uses local browser time for the Founder greeting and provides the empty state", () => {
  const morning = founderDailyBriefService.generate([], [], null, new Date(2026, 6, 9, 9));
  const afternoon = founderDailyBriefService.generate([], [], null, new Date(2026, 6, 9, 14));
  const evening = founderDailyBriefService.generate([], [], null, new Date(2026, 6, 9, 19));

  assert.equal(morning.greeting, "Good morning, Antwone.");
  assert.equal(afternoon.greeting, "Good afternoon, Antwone.");
  assert.equal(evening.greeting, "Good evening, Antwone.");
  assert.equal(morning.empty, true);
  assert.equal(morning.estimatedWorkload.actionCount, 0);
  assert.equal(morning.estimatedWorkload.label, "Light");
  assert.deepEqual(morning.estimatedWorkload.breakdown, {
    reviewsWaiting: 0,
    approvalsWaiting: 0,
    highPriorityProjects: 0,
    blockedProjects: 0,
    founderOwnedTasks: 0,
  });
  assert.deepEqual(morning.estimatedWorkload.topFocusAreas, []);
  assert.equal(morning.todaysRecommendation, null);
  assert.equal(morning.recommendedFirstAction, null);
});

test("preserves the prior Headquarters visit across refreshes and advances it for a new session", () => {
  const firstVisitAt = "2026-07-09T12:00:00.000Z";
  const firstRegistration = resolveFounderVisit(null, "founder", "executive-workspace", firstVisitAt);
  assert.equal(firstRegistration.previousVisitAt, null);
  assert.equal(firstRegistration.isNewSession, true);

  const refreshRegistration = resolveFounderVisit(
    firstRegistration.visit,
    "founder",
    "executive-workspace",
    "2026-07-09T12:05:00.000Z",
  );
  assert.equal(refreshRegistration.previousVisitAt, null);
  assert.equal(refreshRegistration.isNewSession, false);
  assert.equal(refreshRegistration.visit.currentVisitStartedAt, firstVisitAt);

  const newSessionRegistration = resolveFounderVisit(
    refreshRegistration.visit,
    "founder",
    "executive-workspace",
    "2026-07-09T12:36:00.000Z",
  );
  assert.equal(newSessionRegistration.previousVisitAt, firstVisitAt);
  assert.equal(newSessionRegistration.isNewSession, true);

  const persistedVisit: FounderVisit = newSessionRegistration.visit;
  const secondRefresh = resolveFounderVisit(
    persistedVisit,
    "founder",
    "executive-workspace",
    "2026-07-09T12:40:00.000Z",
  );
  assert.equal(secondRefresh.previousVisitAt, firstVisitAt);
  assert.equal(secondRefresh.isNewSession, false);
});

test("uses EO-033 priority and separates Founder attention, risk, and readiness", () => {
  const projects = [
    createProject("review", {
      state: ProjectStatus.Review,
      status: ProjectStatus.Review,
      priority: Priority.Critical,
      currentWorkspace: ProjectWorkspace.ExecutiveOffice,
      currentStep: "Founder Review",
      recommendedNextAction: "Review the package",
      progressPercent: 75,
    }),
    createProject("clarification", {
      currentStep: "Founder clarification",
      recommendedNextAction: "Provide clarification",
    }),
    createProject("founder-blocker", {
      currentBlocker: "Founder decision required",
      recommendedNextAction: "Founder decision",
    }),
    createProject("overdue", { dueDate: "2026-07-01T12:00:00.000Z" }),
    createProject("stale-high", {
      priority: Priority.High,
      updatedAt: "2026-06-01T12:00:00.000Z",
    }),
    createProject("stale-medium", {
      priority: Priority.Medium,
      updatedAt: "2026-06-01T12:00:00.000Z",
    }),
    createProject("missing-next-action", {
      currentStep: "",
      recommendedNextAction: "",
    }),
    createProject("ready-outline", {
      state: ProjectStatus.Outline,
      status: ProjectStatus.Outline,
      currentStep: "Outline",
      recommendedNextAction: "Create the project outline",
      progressPercent: 35,
    }),
  ];

  const prioritization = executivePrioritizationService.prioritize(projects, now);
  const brief = founderDailyBriefService.generate(projects, [], "2026-07-09T13:00:00.000Z", now);
  const waitingIds = new Set(brief.projectsWaitingOnFounder.map((assessment) => assessment.project.id));
  const riskIds = new Set(brief.projectsAtRisk.map((assessment) => assessment.project.id));
  const readyIds = new Set(brief.projectsReadyToAdvance.map((assessment) => assessment.project.id));

  assert.equal(brief.topPriority?.project.id, prioritization.topFounderPriorities[0]?.project.id);
  assert.ok(waitingIds.has("review"));
  assert.ok(waitingIds.has("clarification"));
  assert.ok(waitingIds.has("founder-blocker"));
  assert.ok(riskIds.has("founder-blocker"));
  assert.ok(riskIds.has("overdue"));
  assert.ok(riskIds.has("stale-high"));
  assert.ok(riskIds.has("missing-next-action"));
  assert.equal(riskIds.has("stale-medium"), false);
  assert.ok(readyIds.has("ready-outline"));
  assert.equal(readyIds.has("review"), false);
});

test("deduplicates service activity and retains completed work", () => {
  const researchCompletedAt = "2026-07-09T15:00:00.000Z";
  const project = createProject("research-complete", {
    state: ProjectStatus.Outline,
    status: ProjectStatus.Outline,
    stateHistory: [
      {
        state: ProjectStatus.Draft,
        enteredAt: "2026-07-01T12:00:00.000Z",
        reason: "Project created",
      },
      {
        state: ProjectStatus.Outline,
        enteredAt: researchCompletedAt,
        reason: "Research completed",
      },
    ],
    updatedAt: researchCompletedAt,
    lastActivity: "Research complete",
    currentStep: "Outline",
    recommendedNextAction: "Create the project outline",
  });

  const events = createProjectHistoryEvents(project);
  const brief = founderDailyBriefService.generate([project], events, "2026-07-09T14:00:00.000Z", now);

  assert.equal(brief.sinceLastVisit.length, 1);
  assert.equal(brief.sinceLastVisit[0]?.eventType, ExecutiveEventType.ResearchCompleted);
  assert.equal(brief.recentlyCompletedWork.length, 1);
  assert.equal(brief.recentlyCompletedWork[0]?.projectId, project.id);
});

test("changes the workload label from Light to Moderate to Heavy", () => {
  const reviewProject = (index: number) =>
    createProject(`review-${index}`, {
      state: ProjectStatus.Review,
      status: ProjectStatus.Review,
      currentWorkspace: ProjectWorkspace.ExecutiveOffice,
      currentStep: "Founder Review",
      recommendedNextAction: "Review the package",
    });

  const light = founderDailyBriefService.generate([], [], null, now);
  const moderate = founderDailyBriefService.generate(Array.from({ length: 3 }, (_, index) => reviewProject(index)), [], null, now);
  const heavy = founderDailyBriefService.generate(Array.from({ length: 6 }, (_, index) => reviewProject(index)), [], null, now);

  assert.equal(light.estimatedWorkload.actionCount, 0);
  assert.equal(light.estimatedWorkload.label, "Light");
  assert.equal(moderate.estimatedWorkload.actionCount, 3);
  assert.equal(moderate.estimatedWorkload.label, "Moderate");
  assert.equal(moderate.estimatedWorkload.breakdown.reviewsWaiting, 3);
  assert.equal(moderate.estimatedWorkload.breakdown.founderOwnedTasks, 3);
  assert.equal(heavy.estimatedWorkload.actionCount, 6);
  assert.equal(heavy.estimatedWorkload.label, "Heavy");
});

test("selects the relevant existing action for the highest-ranked project", () => {
  const start = founderDailyBriefService.generate([createProject("start")], [], null, now);
  const review = founderDailyBriefService.generate(
    [
      createProject("review", {
        state: ProjectStatus.Review,
        status: ProjectStatus.Review,
        currentStep: "Founder Review",
        recommendedNextAction: "Review the package",
      }),
    ],
    [],
    null,
    now,
  );
  const approval = founderDailyBriefService.generate(
    [
      createProject("approval", {
        state: ProjectStatus.Review,
        status: ProjectStatus.Review,
        currentStep: "Founder Approval",
        recommendedNextAction: "Confirm approval",
      }),
    ],
    [],
    null,
    now,
  );
  const researchProject = createProject("research-package", {
    state: ProjectStatus.Outline,
    status: ProjectStatus.Outline,
    stateHistory: [
      { state: ProjectStatus.Draft, enteredAt: "2026-07-09T13:00:00.000Z", reason: "Project created" },
      { state: ProjectStatus.Outline, enteredAt: "2026-07-09T15:00:00.000Z", reason: "Research completed" },
    ],
    updatedAt: "2026-07-09T15:00:00.000Z",
    lastActivity: "Research complete",
    currentStep: "Outline",
    recommendedNextAction: "Create the project outline",
  });
  const researchPackage = founderDailyBriefService.generate(
    [researchProject],
    createProjectHistoryEvents(researchProject),
    null,
    now,
  );
  const blocked = founderDailyBriefService.generate(
    [createProject("blocked", { currentBlocker: "Source verification required" })],
    [],
    null,
    now,
  );

  assert.equal(start.recommendedFirstAction?.type, "open-project");
  assert.equal(review.recommendedFirstAction?.type, "review");
  assert.equal(approval.recommendedFirstAction?.type, "approve");
  assert.equal(researchPackage.recommendedFirstAction?.type, "open-research-package");
  assert.equal(blocked.recommendedFirstAction?.type, "open-project");
  assert.match(review.recommendedFirstAction?.explanation || "", /[.]$/);
});

test("calculates all seven company health indicators from project and event state", () => {
  const websiteProject = createProject("website", {
    type: ProjectType.WebsiteImprovement,
    projectType: ProjectType.WebsiteImprovement,
    state: ProjectStatus.Production,
    status: ProjectStatus.Production,
    priority: Priority.Critical,
    currentBlocker: "Homepage deployment is blocked",
  });
  const researchProject = createProject("research-health");
  const reviewProject = createProject("review-health", {
    state: ProjectStatus.Review,
    status: ProjectStatus.Review,
    currentStep: "Founder Review",
    recommendedNextAction: "Review the package",
  });
  const approvedProject = createProject("publishing-health", {
    state: ProjectStatus.Approved,
    status: ProjectStatus.Approved,
  });
  const researchComplete = createProject("knowledge-health", {
    state: ProjectStatus.Outline,
    status: ProjectStatus.Outline,
    stateHistory: [
      { state: ProjectStatus.Draft, enteredAt: "2026-07-09T13:00:00.000Z", reason: "Project created" },
      { state: ProjectStatus.Outline, enteredAt: "2026-07-09T15:00:00.000Z", reason: "Research completed" },
    ],
    updatedAt: "2026-07-09T15:00:00.000Z",
  });
  const projects = [websiteProject, researchProject, reviewProject, approvedProject, researchComplete];
  const brief = founderDailyBriefService.generate(
    projects,
    createProjectHistoryEvents(researchComplete),
    null,
    now,
  );
  const healthByLabel = new Map(brief.companyHealth.map((item) => [item.label, item]));

  assert.equal(brief.companyHealth.length, 7);
  assert.equal(healthByLabel.get("Website")?.status, "Red");
  assert.equal(healthByLabel.get("Projects")?.status, "Red");
  assert.equal(healthByLabel.get("Reviews")?.status, "Yellow");
  assert.equal(healthByLabel.get("Publishing")?.status, "Yellow");
  assert.equal(healthByLabel.get("Research")?.status, "Yellow");
  assert.equal(healthByLabel.get("Knowledge")?.status, "Yellow");
  assert.equal(healthByLabel.get("AI Systems")?.status, "Offline");
});

test("removes the top recommendation from supporting intelligence lists", () => {
  const blockedProject = createProject("blocked-top", {
    priority: Priority.Critical,
    currentBlocker: "Founder decision required",
  });
  const readyProject = createProject("ready-second", {
    state: ProjectStatus.Outline,
    status: ProjectStatus.Outline,
    progressPercent: 35,
    currentStep: "Outline",
    recommendedNextAction: "Create the project outline",
  });
  const brief = founderDailyBriefService.generate([blockedProject, readyProject], [], null, now);

  assert.equal(brief.todaysRecommendation?.project.id, blockedProject.id);
  assert.equal(brief.needsAttentionCount, 1);
  assert.equal(brief.needsAttention.some((item) => item.project.id === blockedProject.id), false);
  assert.equal(
    brief.opportunitiesAndRecommendations.some((item) => item.project.id === blockedProject.id),
    false,
  );
  assert.ok(brief.opportunitiesAndRecommendations.some((item) => item.project.id === readyProject.id));
});
