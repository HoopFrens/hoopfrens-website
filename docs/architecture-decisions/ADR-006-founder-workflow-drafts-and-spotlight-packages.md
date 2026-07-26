# ADR-006 Founder Workflow Drafts and School Spotlight Packages

## Status

Accepted and implemented by EO-050 through EO-054. Engineering remediation is complete. Founder Validation, including the targeted post-remediation repeat using the existing Malone University Version 2, passed. Final Independent Review passed with zero P0 and zero P1 findings, and Founder authorization for the commit, pull request, and conditional merge workflow is granted.

## Context

Founder-Simple work must survive refresh without writing incomplete form state into the canonical Knowledge Graph, project, or package collections. School Spotlight also needs one durable package version that preserves the exact reviewed content and can be approved only through the existing project lifecycle.

Session-only state cannot provide reliable continuation. Canonical Knowledge records cannot double as form drafts without weakening source and history guarantees. A School Spotlight production artifact must not be represented as a Review Package, Publishing Package, published asset, or external-platform action.

## Decision

### `FounderWorkflowDraft`

`FounderWorkflowDraft` is a protected, noncanonical autosave record in `internalFounderWorkflowDrafts`. The implemented record contains:

- ID, workspace ID, owner ID, and School Spotlight workflow kind;
- current `request`, `review`, `customize`, or `approve` step;
- active, completed, or archived status;
- optional School draft, canonical School ID, project ID, and current package ID/version;
- structured request choices, selected facts, and customization;
- created and updated timestamps;
- created-by and updated-by actor IDs; and
- an optimistic integer revision.

Direct reads, owner-filtered queries, and updates require an approved admin whose authenticated UID exactly matches `ownerId`. A second approved admin cannot read or mutate another admin's incomplete draft. Non-admin and signed-out access remains denied. Runtime repositories also require the authenticated actor and verify ownership.

The draft does not implement a schema-version field, idempotency key, resumed/submitted/abandoned timestamps, per-change actor history, or change-summary history. Those concepts are not release guarantees.

Legacy School Spotlight request wording remains readable. Recognized legacy values are projected into structured controls, and unmatched Founder wording remains visible and editable rather than being silently discarded.

Guided Add School uses `KnowledgeGraphRepository.createSchoolBundle`. That transaction creates or reuses the verified Source, State, approved Hoop Frens Region, School, geography relationships, uniqueness/provenance registries, and audit events as one atomic unit. A retry returns the established canonical School, while a failed transaction exposes none of the canonical bundle.

### `SchoolSpotlightPackage`

`SchoolSpotlightPackage` is a deterministic `ProductionPackage` subtype stored in `internalProductionPackages`. Each immutable version contains the exact project, workspace, owner, draft, School, request, customization, facts, evidence, vertical-video plan, Instagram caption, shot list, verification material, rights state, checklists, and version linkage reviewed by the Founder.

Firestore stores the rules-validated supported nested package sections in protected `internalSchoolSpotlightPackage*` integrity records. Every allowed vertical-video scene position must match the exact supported field shape and types. A package header linked to those integrity records is first written as noncanonical `staged` state. One transaction then activates that exact header, links it to the project, and supersedes the prior active version. Normal package lookup excludes staged records. A retry may replace only the same owner's staged integrity records; activated package integrity records cannot be edited or deleted.

Every transition into Approved requires the exact active package ID and version. Rules and repositories verify project, package, draft, workspace, owner, School, request, customization, rights, and version linkage. A state-only update or an update with omitted, stale, mismatched, orphaned, malformed, superseded, or inactive package details is rejected.

The package has one `createdBy` actor and created/updated timestamps, plus version linkage and an active/superseded state. It does not provide a general immutable actor-event history or change-summary history beyond the fields actually stored on each package version.

The package is not a Review Package or Publishing Package. Approval does not publish, schedule, upload, send, call an external platform, or modify the public website.

## Consequences

- Refresh-safe draft persistence remains separate from canonical Knowledge and package persistence.
- Incomplete Add School and School Spotlight input cannot masquerade as canonical records.
- Package creation and project linkage are retry-safe without exposing a partial package as active.
- Exact-version approval remains an explicit Review-to-Approved project transition.
- Release 2 project lifecycle and package compatibility remain authoritative.
- Retention policy for completed or abandoned drafts remains follow-up work.
- The current rules and bounded nested package envelope are designed for the single-Founder, low-volume Release 3.2 scope.
- A package version supports one to eight selected facts and up to two active canonical verification sources; additional evidence must be consolidated or deferred to a later package version.

## Founder Validation Evidence

Targeted post-remediation Founder Validation reused the existing Malone University School Spotlight Version 2. `Request -> Review -> Customize -> Approve` remained functional, and the exact approved Version 2 remained readable after refresh. No duplicate School, project, workflow draft, or package was created. Approval did not publish, schedule, upload, or externally send content. No new browser-console or runtime errors were observed, and the deployed Firestore rules were confirmed active. Final Independent Review passed with zero P0 and zero P1 findings.

## Rejected Alternatives

- Store incomplete fields on Knowledge Graph records.
- Use browser session state as the only draft store.
- Treat every autosave as a package version.
- Reuse Review Package or Publishing Package.
- Publish directly from a School Spotlight package.

EO-055 has not started. AI, external search, external APIs, upload, scheduling, publishing, autonomous behavior, and public-site changes remain outside this decision.
