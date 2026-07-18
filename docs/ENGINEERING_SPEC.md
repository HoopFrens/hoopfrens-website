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
