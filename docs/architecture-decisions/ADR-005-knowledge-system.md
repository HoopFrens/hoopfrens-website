# ADR-005 Knowledge System

## Status

Accepted and implemented by EO-046 through EO-049

## Context

Hoop Frens depends on reliable basketball intelligence. Knowledge needs source tracking, verification status, and relationship mapping before summaries or recommendations can be trusted.

## Decision

Knowledge is persisted as separate canonical `KnowledgeNode`, `KnowledgeRelationship`, and `KnowledgeSource` records with immutable `KnowledgeAuditEvent` attribution. Nodes identify durable entities; directed relationships encode only approved endpoint combinations; sources preserve reusable provenance. Every canonical record belongs to a workspace.

`domain/knowledge` owns the contracts, shared relationship policy, strict runtime validators, integrity evaluator, converters, and repository interfaces. Firestore and in-memory repositories are implemented. The Firestore repository persists the protected `internalKnowledgeNodes`, `internalKnowledgeRelationships`, `internalKnowledgeSources`, `internalKnowledgeAuditEvents`, and `internalKnowledgeUniqueness` collections.

Supported mutations preserve canonical source IDs, immutable version/confidence/status history, request-time actor attribution, archive history, and atomic subject/audit writes. Transactional registries enforce canonical node and relationship identity through the supported repository.

The Knowledge Graph is deterministic infrastructure. It contains no AI, model-provider integration, external search, automated collection, or CIO reasoning. Future AI/CIO capabilities must consume this foundation through approved repository and service boundaries and require separate authorization.

## Consequences

- Canonical graph records are persisted and protected rather than represented by converter stubs or relationship ID arrays.
- Active claims must reference active canonical sources in the same workspace. Caller-authored embedded source summaries are not authoritative.
- Records are archived rather than hard-deleted. Nodes with active relationships and sources used by active claims cannot be archived until dependencies are resolved.
- Legacy conversion is compatibility-only: page load does not mutate production data, original list histories are retained when present, and synthesized canonical baselines are not represented as authenticated historical facts.
- **P2 scaling debt:** Aggregate uniqueness registries have document-size and contention limits for the current low-volume Founder workflow and require future sharding before scale makes those limits material.
- **P2 application-admin hardening debt:** Firestore rules validate mutation-critical client invariants, while audit-label and metadata semantics and exhaustive runtime schema validation remain repository responsibilities. Approved administrators writing outside the supported repository remain an application-admin trust boundary.
- **P2 legacy-compatibility debt:** Historical facts that were never versioned cannot be exhaustively reconstructed; preserved raw snapshots remain authoritative when present, and synthesized entries stay explicitly qualified compatibility baselines.
- **P3 operational boundary:** Firebase Admin SDK and Console access bypass Firestore rules by platform design and remain governed by project IAM and operational controls.
- Production AI summarization, automated ingestion, external research, and CIO reasoning remain future work under separately approved Engineering Orders.
