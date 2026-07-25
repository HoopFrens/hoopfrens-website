# Data Model

Canonical domain contracts live in `domain/`.

`types/workspace.ts` remains as a compatibility export for older imports while foundation work moves the real interfaces into domain folders.

Core records include:

- `Workspace`
- `Project`
- `KnowledgeNode`
- `KnowledgeRelationship`
- `KnowledgeSource`
- `KnowledgeAuditEvent`
- `FounderWorkflowDraft`
- `Asset`
- `Person`
- `Organization`
- `Decision`
- `Conversation`
- `ProductionPackage`
- `SchoolSpotlightPackage`
- `Source`
- `Event`
- `ExecutiveEvent`

The model uses string IDs and ISO date strings so the contracts map cleanly to Firestore documents.

The earlier pre-implementation `KnowledgeEntity` concept is superseded by the canonical Knowledge Graph records above. Knowledge Graph relationships are first-class persisted records, not relationship ID arrays.

Shared enums live in `domain/shared/enums.ts`.

## Knowledge Graph Domain

`domain/knowledge` owns the canonical graph contracts, runtime validators, integrity evaluation, relationship policy, repository interfaces, Firestore converters, and Firestore and in-memory repository implementations.

- `KnowledgeNode` represents a canonical School, Coach, Conference, Player, Facility, Region, State, Organization, Project, or Content entity. Every node has stable identity, workspace ownership, confidence, status, canonical source IDs, timestamps, actor attribution, and version, confidence, and status histories.
- `KnowledgeRelationship` represents a directed, source-backed connection between two active same-workspace nodes. Endpoint IDs, relationship type, derived identity, and any exclusive-claim identity become immutable after creation.
- `KnowledgeSource` represents reusable provenance. Active verified claims reference canonical source IDs; source display details are hydrated from the source collection rather than caller-authored embedded summaries.
- `KnowledgeAuditEvent` is an immutable, actor-bound record linked to the exact subject version produced by a supported mutation.

Canonical version histories preserve prior subject state in map-shaped entries. Confidence and status histories preserve their prior and resulting values, sources where applicable, authenticated actor, authoritative mutation time, and reason. The corresponding audit event is written atomically with the subject mutation. Hard deletion is denied; active records move to Archived while their history remains readable.

One relationship compatibility policy defines valid directed node-type pairs, inverse semantic identities, exclusive endpoints, and multiplicity. Forms, runtime validation, repositories, integrity evaluation, tests, and Firestore-enforceable endpoint checks consume that same policy.

## Knowledge Graph Persistence

The Firestore-backed repository persists protected Headquarters data in:

- `internalKnowledgeNodes`
- `internalKnowledgeRelationships`
- `internalKnowledgeSources`
- `internalKnowledgeAuditEvents`
- `internalKnowledgeUniqueness`

Every canonical record belongs to one workspace. Active node and relationship evidence must resolve to active source records in that same workspace. Relationship endpoints must also be active and same-workspace. Approved-admin client access is enforced by the Headquarters authorization boundary and Firestore rules.

Transactional uniqueness registries atomically claim canonical node names and aliases, exact relationship identities, endpoint activity, exclusive claims, and source usage. They close concurrent duplicate and archive/create races through the supported repository. These aggregate registries are appropriate for the current low-volume Founder workflow but are accepted P2 scaling debt and require sharding before document-size or contention limits become material.

Firestore rules validate mutation-critical client invariants, while audit-label and metadata semantics rely on the supported repository and complete runtime shape validation remains a repository responsibility. Direct approved-admin client writes outside that repository are accepted P2 application-admin hardening debt. Firebase Admin SDK and Console access bypass Firestore rules by platform design and remain an accepted P3 operational boundary governed by project IAM.

## Legacy Compatibility

Legacy records remain readable without page-load mutation. On the first supported mutation, eligible pre-versioned records are enrolled into canonical identity and source-usage registries, source references are revalidated, and original list-shaped histories are preserved in `legacyHistorySnapshot`. Any canonical entries synthesized for fields that were never historically versioned are compatibility reconstructions, not independently authenticated history. Legacy embedded source summaries and compact School references remain historical compatibility data; current canonical displays resolve provenance and connected facts from source and relationship records.

The inability to reconstruct historical facts that were never stored is accepted P2 legacy-compatibility debt. It does not weaken exhaustive validation for current canonical records.

Release 2 shared Region values remain compatible with their existing records. Knowledge Graph School classification uses the separate approved nine-region Hoop Frens model and deterministic state-to-region mapping.

## Founder-Simple Domain

`domain/founder-simple` owns the EO-050 through EO-054 workflow types, runtime validation, draft repository contract, Firestore and in-memory draft repositories, and compatible School Spotlight production-artifact shape. Engineering is complete with all P1 remediation applied. Founder Validation, including the targeted post-remediation repeat using the existing Malone University Version 2, and final Independent Review passed with zero P0 and zero P1 findings; required pull-request checks and the merge remain pending.

- `FounderWorkflowDraft` stores authenticated, workspace- and owner-scoped progress for the deterministic `Request -> Review -> Customize -> Approve` experience. Its Firestore collection is `internalFounderWorkflowDrafts`. Direct reads, owner-filtered queries, repository lookup, and updates require the authenticated approved-admin owner. Revision checks reject stale saves, and draft persistence does not create partial Knowledge Graph records or silently advance project state.
- `SchoolSpotlightPackage` extends `ProductionPackage`, uses `ArtifactType.ProductionPackage`, and stores its canonical header in `internalProductionPackages`. Protected `internalSchoolSpotlightPackageFacts`, `internalSchoolSpotlightPackageContent`, `internalSchoolSpotlightPackageDelivery`, `internalSchoolSpotlightPackageRequest`, and `internalSchoolSpotlightPackageCustomization` records enforce the supported nested facts, canonical source evidence, vertical-video package, Instagram caption, shot list, unresolved warnings, rights confirmation, request, and customization before activation. Every supported vertical-video scene position must contain exactly the string fields `id`, `heading`, `narration`, and `visualDirection`.

The Release 3.2 package envelope supports one to eight selected facts and up to two active canonical verification sources. Facts are stored in two bounded four-fact integrity parts with an exact unique ID/position manifest so the maximum supported request remains below Firestore's rules-expression ceiling without accepting reordered, duplicated, or incomplete fact fragments.

Guided Add School uses the released Knowledge Graph model through a typed `createSchoolBundle` repository operation. Firestore commits or reuses the Source, State, Region, School, two geography relationships, uniqueness/provenance registries, and their audit events as one transaction. The in-memory repository publishes the equivalent staged state atomically. Deterministic identities and canonical registry ownership make confirmation retry-safe without creating a second School.

Project records retain the active and approved School Spotlight package ID and version so approval is bound to the exact active Production Package version. A package header linked to rules-validated integrity records is first noncanonical `staged` data; one transaction activates that exact version, links the project, and supersedes the prior active package. Normal package lookup excludes staged records. Revision preserves the earlier Production Package and requires a new active version. The integrity collections are protected implementation records, not alternate package types.

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

`ArtifactType` reserves Research Package, Outline Package, Production Package, Review Package, and Publishing Package as typed artifact categories. Release 2.4 implements concrete payload models and repositories for Research, Outline, and Production Packages. Release 3.2 adds `SchoolSpotlightPackage` as a compatible Production Package subtype; it does not add a new artifact enum or collection. Review and Publishing remain reserved artifact types for future Engineering Orders; they do not yet have concrete package payload interfaces, standalone repositories, or package viewers.

`BusinessObjectRepository<T>` provides the shared package repository boundary. The implemented Research, Outline, and Production repositories preserve type-specific collection ownership while exposing the same `getByProjectId` and `save` contract. The project transaction layer reserves Review and Publishing collection mappings so future typed artifacts can be committed atomically, but those mappings are not concrete package implementations.

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

Executive events are stored under `internalExecutiveEvents`. Project creation and updates use Firestore transactions so the project record, timeline events, and associated service artifacts commit together. Deterministic project and event IDs make create retries and project-history backfill idempotent. Project versions and expected timestamps reject stale mutations.

Protected project and service collections include `internalProjects`, `internalResearchPackages`, `internalOutlinePackages`, `internalProductionPackages`, `internalFounderVisits`, and `internalExecutiveEvents`. Release 3.2 adds protected `internalFounderWorkflowDrafts` plus the `internalSchoolSpotlightPackage*` integrity collections. School Spotlight package headers use `internalProductionPackages`. The protected Knowledge Graph collections are documented separately above.

Production Packages are versioned Business Objects with an active/superseded marker. Revision preserves the prior version historically, clears canonical production completion/readiness fields, and requires a newly completed active version.

## Derived Recommendations

`ProjectRecommendation` is a derived, non-persisted operating view. It links the canonical `Project` to a deterministic category, Recommendation Score, reasons, why-now explanation, delay impact, effort label, Founder dependency, and relevant service-completion event.

Recommendation records are recalculated from current project and event data. They are not written to Firestore, preventing stale scores and keeping the recommendation immediately responsive to project state changes.
