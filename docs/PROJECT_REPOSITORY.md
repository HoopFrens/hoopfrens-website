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
5. EO-053 builds `SchoolSpotlightPackage` as a compatible Production Package. It uses `updateWithArtifacts` to persist the exact version in `internalProductionPackages`, supersede the prior active version, complete Production, and bind the project’s active Spotlight package ID.
6. EO-054 approves only the exact active Spotlight package ID and version through `approveWithProductionPackage`; a stale or superseded package cannot satisfy approval.
7. Direct workflow changes use `update` with optimistic conflict protection. A stale client cannot overwrite a newer canonical project or its histories.
8. Deterministic Executive Intelligence events are written in the same transaction as each canonical project change.

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

`SchoolSpotlightPackage` extends `ProductionPackage`. Its canonical header uses `internalProductionPackages`, while protected `internalSchoolSpotlightPackage*` integrity records enforce its supported nested keys, field types, ownership, and linkage before atomic activation. Content validation applies the exact supported scene shape to every vertical-video scene index. Founder workflow autosave remains separate and owner-restricted in `internalFounderWorkflowDrafts`. EO-050 through EO-054 are Engineering Complete; targeted post-remediation Founder Validation and final Independent Review passed with zero P0 and zero P1 findings.

## Concurrency and Atomicity

Firestore transactions read the canonical project before writing. Mutations may include `expectedUpdatedAt` or `expectedVersion`; mismatches fail with a conflict instead of merging stale state over newer work. Incoming state and workspace histories are merged with canonical history before the new version is stored.

Release 2 artifact-producing services keep the artifact and project in one transaction. School Spotlight first writes a noncanonical staged package linked to rules-validated integrity records and then atomically activates that exact package with the project link and prior-version supersession. If activation fails, no package becomes active and no project state advances; the same owner may safely retry the deterministic staged version.

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
