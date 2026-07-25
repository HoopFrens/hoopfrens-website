# Engineering Spec

Approved stack:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Shadcn UI
- Firebase Auth
- Firestore
- Firebase Storage
- Vercel
- GitHub

Foundation boundaries:

- `app/` remains responsible for Next.js routes.
- `components/` remains responsible for React UI.
- `types/` contains shared TypeScript contracts.
- `domain/` contains Executive Workspace business object contracts, shared enums, runtime validators, Firestore converters, integrity policies, and repository interfaces and implementations.
- `services/` contains application service boundaries.
- `lib/` contains existing shared implementation helpers.
- `firebase/` exposes Firebase integration boundaries.
- `docs/` contains architecture and operating notes.
- `tests/` is reserved for test coverage added with production behavior.

Current Headquarters services and the Release 3.1 Knowledge Graph are deterministic and do not call AI providers, OpenAI, external-search providers, or external APIs. Project, package, timeline, Founder-visit, and Knowledge Graph persistence use protected Firestore repositories.

Repository interfaces have Firestore and in-memory implementations. Canonical project mutations use transactions, optimistic conflict checks, and atomic artifact/event writes. Protected routes require the authenticated Firestore admin role in every environment.

## Knowledge Graph Engineering Boundary

`domain/knowledge` owns `KnowledgeNode`, `KnowledgeRelationship`, `KnowledgeSource`, `KnowledgeAuditEvent`, confidence and status histories, the approved relationship compatibility policy, strict runtime validation, integrity evaluation, and repository contracts. `services/knowledgeService.ts` exposes application behavior without making UI components responsible for persistence rules.

The Firestore repository owns:

- protected persistence in `internalKnowledgeNodes`, `internalKnowledgeRelationships`, `internalKnowledgeSources`, `internalKnowledgeAuditEvents`, and `internalKnowledgeUniqueness`;
- authenticated admin attribution and authoritative mutation timestamps;
- atomic subject, audit, uniqueness, endpoint, exclusive-claim, and source-usage writes;
- canonical node and relationship duplicate prevention under concurrency;
- active same-workspace endpoint and source validation;
- immutable endpoint identity and version, confidence, status, provenance, and archive history;
- archive guards that preserve active relationship and source dependencies; and
- legacy enrollment during the first supported mutation without modifying records during page load.

The in-memory repository mirrors the deterministic domain behavior for tests and stages the complete next subject-and-audit state before replacing current state.

## Authorization and Integrity

Only an authenticated user whose `users/{uid}` record has the approved admin role may read or write the protected Knowledge Graph through the client application. Non-admin and unauthenticated access remains denied. Firestore rules exclude all `internalKnowledge*` collections from the generic collection fallback, deny hard deletion, preserve immutable ownership claims, and bind supported mutations to actor, request time, canonical version, and audit records.

Runtime parsers enforce exact record shapes, enums, bounded arrays, canonical source references, consecutive current versions, School reference consistency, and the approved directed relationship policy before serialization and after Firestore reads. Verified claims require active canonical provenance from the same workspace.

One strict ISO calendar validator rejects impossible dates before normalization, supports valid leap dates and UTC or numeric offsets, and preserves the Founder-selected instant. Required `accessedAt` values fail before repository calls when missing or malformed; blank optional `publishedAt` values are omitted rather than serialized as `undefined`.

Records are archived, not deleted. Node archival is blocked while active relationships exist, and source archival is blocked while active canonical claims depend on it. Relationship creation and node archival contend on shared endpoint state so they cannot race into an active edge with an archived endpoint.

## Compatibility and Current Scope

Release 2 project, artifact, authorization, and legacy Region behavior remains separate and compatible. Knowledge Graph Schools use the approved nine-region model and deterministic state-to-region mapping. Eligible legacy Knowledge records remain readable; first supported mutation preserves raw history snapshots and creates explicit compatibility baselines without representing reconstructed values as verified historical facts.

The current operating boundary is one approved Founder and low-volume manual knowledge maintenance. Accepted P2 debt includes aggregate-registry document-size and contention limits, repository-derived audit-label and metadata semantics, the approved-admin direct-client trust boundary, and the inability to reconstruct legacy facts that were never stored. Registries must be sharded before higher-volume ingestion. Firebase Admin SDK and Console access remains an accepted P3 IAM-controlled platform bypass.

Automated ingestion, AI inference, model-provider integration, external research, CIO reasoning, autonomous mutation, and high-volume scale are not implemented.

## Release 3.2 Founder-Simple Boundary

EO-050 through EO-054 are deterministic work with **Engineering Complete**. Founder Validation, including the targeted post-remediation repeat using the existing Malone University Version 2, and final Independent Review passed with zero P0 and zero P1 findings. They add a business-language experience above the existing service, repository, Knowledge Graph, and project-lifecycle boundaries without redesigning those canonical models.

The implemented primary navigation is `Today`, `Create`, `Work`, `Intelligence`, `Review & Approve`, and `Library`. Routine flows use business actions and progressive disclosure. Existing workspaces and the Knowledge Center Explorer remain available as advanced operating surfaces rather than being removed at the architecture level.

The implemented `Request -> Review -> Customize -> Approve` experience is not a second project lifecycle. Existing transition policy, production readiness, revision invalidation, artifact versioning, Founder approval, authorization, audit, and Firestore repository behavior remain authoritative.

Release 3.2 implements two Founder-Simple domain boundaries:

- `FounderWorkflowDraft` stores authenticated, workspace-owned, refresh-safe progress for an incomplete guided workflow. Reads and writes require the exact authenticated approved-admin owner. Draft autosave cannot create or weaken canonical Knowledge, Source, relationship, project, or package records.
- `SchoolSpotlightPackage` extends `ProductionPackage` and stores deterministic, versioned School Spotlight selections, initial output sections, canonical source references, customization, unresolved items, readiness, and approval information. Firestore validates nested facts, evidence, content, request, customization, delivery, rights, and linkage in protected integrity records before atomically activating the exact package header and project link. The initial outputs are one reusable vertical-video package for Instagram Reel, TikTok, and YouTube Short; one Instagram caption; one photo/video shot list; and one source and verification package.

The School Spotlight request schema records structured goals and audiences, platform uses, one primary emphasis, optional emphasis detail, structured media availability, optional media descriptions, shot-list preference, and CTA. Draft validation requires at least one audience and preserves the existing platform rules. `No media yet` is mutually exclusive with specific media selections. Legacy freeform objective, audience, emphasis, and comma-separated media values are normalized for display without deleting the original unmatched wording. Old drafts therefore remain readable while new drafts no longer depend on parsing prose.

Drafts persist through the dedicated `internalFounderWorkflowDrafts` collection and repository. `SchoolSpotlightPackage` uses `ArtifactType.ProductionPackage`, deterministic version IDs, an `internalProductionPackages` header, and protected `internalSchoolSpotlightPackage*` integrity records. These paths preserve owner-restricted approved-admin access, workspace identity, created/updated actor and time attribution, optimistic draft/project conflict handling, retry-safe staged package recovery, active/superseded version history, and public-site isolation.

Targeted post-remediation Founder Validation reused the existing Malone University Version 2 and confirmed that `Request -> Review -> Customize -> Approve` remained functional, the exact approved version remained readable after refresh, and no duplicate School, project, workflow draft, or package was created. Approval did not publish, schedule, upload, or externally send content. No new browser-console or runtime errors were observed, and the deployed Firestore rules were confirmed active. Final Independent Review passed with zero P0 and zero P1 findings; required pull-request checks and the merge remain pending.

The guided Add School confirmation is a typed Knowledge Graph bundle mutation. The Firestore repository commits Source, canonical geography, School, relationships, registry state, and audits in one transaction; its in-memory counterpart stages and replaces the complete state once. Fault-injection and emulator race coverage verify all-or-nothing persistence and idempotent duplicate handling.

`SchoolSpotlightPackage` is not a Review Package or Publishing Package and cannot upload, schedule, directly publish, or mutate the public website. Future platform outputs, external publishing, AI assistance, external search, and autonomous behavior remain outside EO-050 through EO-054. EO-055 has not started. See [Founder-Simple Headquarters](./FOUNDER_SIMPLE.md), [School Spotlight Workflow](./SCHOOL_SPOTLIGHT_WORKFLOW.md), and [ADR-006](./architecture-decisions/ADR-006-founder-workflow-drafts-and-spotlight-packages.md).
