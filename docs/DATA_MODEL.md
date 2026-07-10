# Data Model

The initial domain contracts live in `domain/`.

`types/workspace.ts` remains as a compatibility export for older imports while foundation work moves the real interfaces into domain folders.

Core records:

- `Workspace`
- `Project`
- `KnowledgeEntity`
- `Asset`
- `Person`
- `Organization`
- `Decision`
- `Conversation`
- `ProductionPackage`
- `Source`
- `Event`
- `ExecutiveEvent`

The model uses string IDs and ISO date strings so the contracts map cleanly to Firestore documents.

Relationships are represented with ID arrays for now. This keeps the model explicit without adding database reads, writes, or denormalization behavior before those decisions are implemented.

Shared enums live in `domain/shared/enums.ts`.

## Service Business Objects

Every persisted Headquarters service artifact implements the shared `BusinessObject` contract:

- `id`
- `projectId`
- `artifactType`
- `version`
- `status`
- `createdAt` and `updatedAt`
- `createdBy`
- `workspace`
- `generatedByService`
- `summary`
- Firestore-safe `metadata`

Approved artifact types are Research Package, Outline Package, Production Package, Review Package, and Publishing Package. Type-specific package interfaces add their operational payload without redefining artifact identity or provenance.

`BusinessObjectRepository<T>` provides the shared package repository boundary. Concrete repositories preserve type-specific collection ownership while exposing the same `getByProjectId` and `save` contract.

## Executive Events

`ExecutiveEvent` is the canonical timeline record for meaningful project movement. Each event stores:

- `timestamp`
- `eventType`
- `projectId` and a denormalized project reference
- concise `summary`
- `relatedWorkspace`
- `projectHref`
- `workspaceId` and `actorId`

Approved event types are project created, project state changed, workspace changed, research completed, outline completed, production completed, review requested, approval completed, and publishing completed.

Production completion stores `productionCompletedAt` on the project so timeline backfill keeps the original completion time after later review or approval updates.

Executive events are stored under `internalExecutiveEvents`. Project creation uses a Firestore batch and project updates use a Firestore transaction so the project record and its timeline events commit together. Deterministic event IDs make retries and project-history backfill idempotent.

Current protected internal collections include `internalProjects`, `internalResearchPackages`, `internalOutlinePackages`, `internalProductionPackages`, `internalFounderVisits`, and `internalExecutiveEvents`. Existing admin authorization rules continue to govern these records.

## Derived Recommendations

`ProjectRecommendation` is a derived, non-persisted operating view. It links the canonical `Project` to a deterministic category, Recommendation Score, reasons, why-now explanation, delay impact, effort label, Founder dependency, and relevant service-completion event.

Recommendation records are recalculated from current project and event data. They are not written to Firestore, preventing stale scores and keeping the recommendation immediately responsive to project state changes.
