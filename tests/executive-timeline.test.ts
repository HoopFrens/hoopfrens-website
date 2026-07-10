import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectHistoryEvents,
  createProjectUpdateEvents,
  ExecutiveEventType,
  groupExecutiveEvents,
  InMemoryExecutiveEventRepository,
} from "@/domain/event";
import { ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import { eventService, founderDailyBriefService } from "@/services";

const timestamps = {
  created: "2026-07-08T12:00:00.000Z",
  research: "2026-07-08T13:00:00.000Z",
  outline: "2026-07-08T14:00:00.000Z",
  production: "2026-07-08T15:00:00.000Z",
  review: "2026-07-08T16:00:00.000Z",
  approved: "2026-07-08T17:00:00.000Z",
  published: "2026-07-08T18:00:00.000Z",
};

function createLifecycleProject(): Project {
  return {
    id: "ashland-spotlight",
    workspaceId: "executive-workspace",
    title: "Ashland University School Spotlight",
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    state: ProjectStatus.Published,
    status: ProjectStatus.Published,
    currentWorkspace: ProjectWorkspace.Library,
    workspace: "Library",
    workspaceHistory: [
      { workspace: ProjectWorkspace.ExecutiveOffice, enteredAt: timestamps.created, reason: "Founder created project" },
      { workspace: ProjectWorkspace.IntelligenceCenter, enteredAt: timestamps.created, reason: "Research queued" },
      { workspace: ProjectWorkspace.ProductionStudio, enteredAt: timestamps.production, reason: "Production started" },
      { workspace: ProjectWorkspace.ExecutiveOffice, enteredAt: timestamps.review, reason: "Founder review requested" },
      { workspace: ProjectWorkspace.Library, enteredAt: timestamps.published, reason: "Publishing completed" },
    ],
    stateHistory: [
      { state: ProjectStatus.Draft, enteredAt: timestamps.created, reason: "Project created" },
      { state: ProjectStatus.Research, enteredAt: timestamps.research, reason: "Research started" },
      { state: ProjectStatus.Outline, enteredAt: timestamps.outline, reason: "Research completed" },
      { state: ProjectStatus.Production, enteredAt: timestamps.production, reason: "Outline completed" },
      { state: ProjectStatus.Review, enteredAt: timestamps.review, reason: "Founder review requested" },
      { state: ProjectStatus.Approved, enteredAt: timestamps.approved, reason: "Founder approval completed" },
      { state: ProjectStatus.Published, enteredAt: timestamps.published, reason: "Publishing completed" },
    ],
    progressPercent: 100,
    priority: Priority.High,
    ownerId: "founder",
    dependencies: [],
    currentBlocker: null,
    currentStep: "Published",
    recommendedNextAction: "No action required",
    lastActivity: "Publishing complete",
    scope: Scope.Internal,
    contributorIds: [],
    knowledgeEntityIds: [],
    assetIds: [],
    decisionIds: [],
    sourceIds: [],
    completedSoFar: ["Research", "Outline", "Production", "Founder approval", "Publishing"],
    remainingNextStep: "Published",
    createdAt: timestamps.created,
    updatedAt: timestamps.published,
  };
}

test("generates every approved Executive Intelligence event from project history", () => {
  const project = createLifecycleProject();
  const events = createProjectHistoryEvents(project);
  const eventTypes = new Set(events.map((event) => event.eventType));

  assert.ok(eventTypes.has(ExecutiveEventType.ProjectCreated));
  assert.ok(eventTypes.has(ExecutiveEventType.ProjectStateChanged));
  assert.ok(eventTypes.has(ExecutiveEventType.WorkspaceChanged));
  assert.ok(eventTypes.has(ExecutiveEventType.ResearchCompleted));
  assert.ok(eventTypes.has(ExecutiveEventType.OutlineCompleted));
  assert.ok(eventTypes.has(ExecutiveEventType.ReviewRequested));
  assert.ok(eventTypes.has(ExecutiveEventType.ApprovalCompleted));
  assert.ok(eventTypes.has(ExecutiveEventType.PublishingCompleted));
  assert.ok(events.every((event) => event.timestamp && event.project.id === project.id));
  assert.ok(events.every((event) => event.summary && event.relatedWorkspace && event.projectHref.includes(project.id)));
  assert.ok(events.every((event, index) => index === 0 || Date.parse(events[index - 1].timestamp) >= Date.parse(event.timestamp)));
});

test("generates live state and workspace events from one project update", () => {
  const previousProject = createLifecycleProject();
  previousProject.state = ProjectStatus.Production;
  previousProject.status = ProjectStatus.Production;
  previousProject.currentWorkspace = ProjectWorkspace.ProductionStudio;
  previousProject.updatedAt = timestamps.production;
  previousProject.stateHistory = previousProject.stateHistory?.slice(0, 4);
  previousProject.workspaceHistory = previousProject.workspaceHistory.slice(0, 3);

  const updatedProject = {
    ...previousProject,
    state: ProjectStatus.Review,
    status: ProjectStatus.Review,
    currentWorkspace: ProjectWorkspace.ExecutiveOffice,
    updatedAt: timestamps.review,
    stateHistory: [
      ...(previousProject.stateHistory || []),
      { state: ProjectStatus.Review, enteredAt: timestamps.review, reason: "Founder review requested" },
    ],
    workspaceHistory: [
      ...previousProject.workspaceHistory,
      { workspace: ProjectWorkspace.ExecutiveOffice, enteredAt: timestamps.review, reason: "Founder review requested" },
    ],
  };

  const events = createProjectUpdateEvents(previousProject, updatedProject, "founder");
  assert.deepEqual(
    new Set(events.map((event) => event.eventType)),
    new Set([ExecutiveEventType.ReviewRequested, ExecutiveEventType.WorkspaceChanged]),
  );
  assert.ok(events.every((event) => event.timestamp === timestamps.review));
});

test("groups timeline events into Today, Yesterday, and Earlier with newest first", () => {
  const project = createLifecycleProject();
  const baseEvent = createProjectHistoryEvents(project)[0];
  const now = new Date(2026, 6, 9, 12, 0, 0);
  const events = [
    { ...baseEvent, id: "today", timestamp: new Date(2026, 6, 9, 10, 0, 0).toISOString() },
    { ...baseEvent, id: "yesterday", timestamp: new Date(2026, 6, 8, 18, 0, 0).toISOString() },
    { ...baseEvent, id: "earlier", timestamp: new Date(2026, 6, 1, 12, 0, 0).toISOString() },
  ];

  const groups = groupExecutiveEvents(events, now);
  assert.deepEqual(groups.map((group) => group.label), ["Today", "Yesterday", "Earlier"]);
  assert.deepEqual(groups.map((group) => group.events[0]?.id), ["today", "yesterday", "earlier"]);
});

test("backfills Firestore-shaped events idempotently and makes them the Daily Brief source", async () => {
  const project = createLifecycleProject();
  const repository = new InMemoryExecutiveEventRepository();
  const firstSynchronization = await eventService.synchronizeProjectHistory(repository, [project], []);
  const persistedEvents = await repository.listByWorkspace(project.workspaceId);
  const secondSynchronization = await eventService.synchronizeProjectHistory(repository, [project], persistedEvents);

  assert.equal(firstSynchronization.length, secondSynchronization.length);
  assert.equal(new Set(secondSynchronization.map((event) => event.id)).size, secondSynchronization.length);

  const withoutEvents = founderDailyBriefService.generate(
    [project],
    [],
    "2026-07-08T11:00:00.000Z",
    new Date("2026-07-09T12:00:00.000Z"),
  );
  const withEvents = founderDailyBriefService.generate(
    [project],
    secondSynchronization,
    "2026-07-08T11:00:00.000Z",
    new Date("2026-07-09T12:00:00.000Z"),
  );

  assert.equal(withoutEvents.sinceLastVisit.length, 0);
  assert.ok(withEvents.sinceLastVisit.length > 0);
  assert.equal(withEvents.sinceLastVisit[0]?.eventType, ExecutiveEventType.PublishingCompleted);
});
