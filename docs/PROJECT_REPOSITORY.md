# Project Repository

## Purpose

The Project Repository is the canonical storage and mutation boundary for Headquarters project data. Release 2.4 persists projects in the protected `internalProjects` Firestore collection; browser session storage is limited to temporary interface context such as the current conversation view.

## Current Implementation

- `ProjectRepository` lives in `domain/project` and keeps workflow services independent from Firestore.
- `createFirestoreProjectRepository` is the production implementation.
- `createInMemoryProjectRepository` remains available for deterministic tests.
- Executive Office and Project Workspace both read and mutate the same Firestore-backed project records.
- Firestore rules require an authenticated `users/{uid}` document whose `role` is exactly `admin` for protected internal reads and writes.

## Supported Operations

- `listByWorkspace(workspaceId)` returns canonical projects for one Headquarters workspace.
- `getById(projectId)` returns one project or `null`.
- `create(project)` creates one deterministic project document. Repeating the same creation request ID returns the existing document instead of creating a duplicate.
- `update(projectId, projectUpdate, options)` performs a Firestore transaction, checks the expected timestamp or version, preserves history, increments the record version, and writes timeline events atomically.
- `updateWithArtifacts(projectId, projectUpdate, artifacts, options)` commits the project mutation, associated Business Object artifacts, and timeline events in one Firestore transaction.

## Write Paths

1. Executive Conversation classifies every command and dispatches it through an explicit intent handler.
2. Only `create` intent reaches project creation. Continue, Review, Approve, Search, navigation, and unsupported commands either operate on existing records or return clarification.
3. Create commands use a per-submission request ID and deterministic project document ID. The UI also locks the submission while it is in flight.
4. Research, Outline, and Production services build typed packages and commit each package with its project advancement through `updateWithArtifacts`.
5. Direct workflow changes use `update` with optimistic conflict protection. A stale client cannot overwrite a newer canonical project or its histories.
6. Deterministic Executive Intelligence events are written in the same transaction as each canonical project change.

## Lifecycle Enforcement

`projectLifecyclePolicy` is the authoritative transition policy used by both workflow services and UI action availability:

`Draft -> Research -> Outline -> Production -> Review -> Approved -> Published -> Archived`

Production can enter Review only when the active Production Package passes `productionReadinessService`. Invalid direct transitions throw at the workflow/domain boundary even if a caller bypasses the interface.

Revision is the explicit `Review -> Production` exception. It clears production completion and readiness markers, supersedes the previously active Production Package as a historical version, appends state/workspace/timeline history, and requires a new Production completion before Review is available again.

## Business Object Repositories

- Research Packages: `internalResearchPackages`
- Outline Packages: `internalOutlinePackages`
- Production Packages: `internalProductionPackages`
- Timeline events: `internalExecutiveEvents`
- Founder visit continuity: `internalFounderVisits`

Production Packages use versioned document IDs. Only the current non-superseded package is active; prior versions remain historical and cannot satisfy readiness after revision.

## Concurrency and Atomicity

Firestore transactions read the canonical project before writing. Mutations may include `expectedUpdatedAt` or `expectedVersion`; mismatches fail with a conflict instead of merging stale state over newer work. Incoming state and workspace histories are merged with canonical history before the new version is stored.

Artifact-producing services do not save the artifact and project as separate operations. If the transaction fails, neither the artifact nor the state advancement is committed.

## Validation Requirements

Release 2.4 repository changes require:

- authorization regression tests for admin, non-admin, missing user/role, lookup failure, and signed-out states;
- explicit intent-routing and duplicate-create tests;
- lifecycle, readiness, revision invalidation, concurrency, and atomic failure-path tests;
- Company Health and Daily Brief canonical-state tests;
- `npm run typecheck`;
- `npm run lint`;
- `npx --no-install tsx --test tests/*.test.ts`;
- `npx next build --webpack`;
- authenticated admin allow and authenticated non-admin denial validation before merge.
