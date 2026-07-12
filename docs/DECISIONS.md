# Headquarters Product and Architecture Decisions

This living log records the durable product and architecture decisions that guide Headquarters. It summarizes the current direction; detailed architecture records remain in [`docs/architecture-decisions`](./architecture-decisions/ADR-001-executive-workspace.md).

## Why Headquarters Exists

Headquarters is the private operating environment for Hoop Frens. It exists to give the Founder one coherent place to direct work, see what changed, understand what needs attention, continue active projects, review deliverables, and approve outcomes.

It is intentionally separate from the public website. Public experiences serve the Hoop Frens audience; Headquarters serves internal company operations.

## Executive Brief Philosophy

The Executive Brief should answer four questions:

1. What changed since the last visit?
2. What needs attention?
3. What is the top priority?
4. What should happen first?

The brief is not a notification feed, analytics dashboard, or activity dump. It should be concise, deduplicated, state-aware, and actionable. When project data does not support an alert, Headquarters should say so plainly rather than manufacture urgency.

The Founder Daily Brief is the primary opening experience in the Executive Office. It derives its priority, attention groups, readiness, workload, completed work, company health, and first action from canonical project state and the deterministic prioritization engine. Executive Conversation remains available directly after the brief for Founder direction.

## Founder Visit Continuity

Meaningful change requires a durable comparison point. Headquarters stores one authenticated Founder visit record per user in the protected `internalFounderVisits` Firestore collection. The record contains the current visit start, previous visit, and last-seen timestamps; it contains no project or conversation content.

A refresh within a 30-minute activity window remains part of the current visit and does not move the comparison point. A return after that window begins a new visit and promotes the prior visit start to `lastVisitAt`. This keeps “Since Your Last Visit” stable across refreshes while preserving the timestamp across sign-out and sign-in.

## Executive Intelligence Timeline Philosophy

The Executive Intelligence Timeline is the canonical history of meaningful project movement. It is stored in the protected `internalExecutiveEvents` Firestore collection and is shared by the Founder Daily Brief and Project Detail. Neither surface reconstructs timeline activity independently.

Project creation and project updates write their event records in the same Firestore batch or transaction as the canonical project change. Event IDs are deterministic, making retries and historical backfill idempotent. Existing project state and workspace histories are backfilled once into the event collection so pre-timeline work remains visible without becoming placeholder data.

Approved event types are project created, project state changed, workspace changed, research completed, outline completed, production completed, review requested, revision requested, approval completed, and publishing completed. A lifecycle transition produces the most specific applicable event rather than a duplicate generic state-change entry.

## Workspace Philosophy

Workspaces represent operating context, not separate products or disconnected data silos. The approved workspaces are Executive Office, Intelligence Center, Production Studio, Strategy Room, Product Lab, and Library.

Every project has exactly one `currentWorkspace`. Movement between workspaces is deterministic and recorded in `workspaceHistory` so the system preserves operational context without duplicating the project.

## Project Workspace Philosophy

The Project Workspace is the cross-workspace portfolio view for finding, prioritizing, and managing every Headquarters project. It is an operating view, not a seventh project workspace. Projects continue to belong to exactly one approved `currentWorkspace` while appearing together in this portfolio.

Search, filters, sorting, project briefs, and quick actions operate on the canonical Firestore project record. The Project Workspace does not maintain a separate project list or persistence model.

## Executive Services Philosophy

Executive Services perform structured work for Headquarters behind a typed service contract. Each service receives a canonical `Project` and returns a status, artifacts, a recommended next action, and the resulting project state.

The Service Registry selects work from project state rather than interface location or raw Founder language. Draft and Research projects route to ResearchService, Outline projects to OutlineService, Production projects to ProductionService, Review projects to ReviewService, and Approved projects to PublishingService.

Services are deterministic until a future Engineering Order explicitly approves AI. Generated artifacts are stored independently and linked to the project.

Every implemented service artifact uses one shared Business Object contract for identity, project linkage, type, version, status, timestamps, creator, workspace, generating service, summary, and metadata. Release 2.4 provides concrete type-specific payloads and repositories for Research, Outline, and Production Packages. Review and Publishing are reserved `ArtifactType` values and transaction collection mappings only; concrete package models, repositories, and viewers require future Engineering Orders. A generic repository interface keeps implemented service code independent from Firestore while concrete repositories retain protected type-specific collections.

Research Packages use `internalResearchPackages`, Outline Packages use `internalOutlinePackages`, and Production Packages use `internalProductionPackages`. Production versions use deterministic versioned document IDs so superseded packages remain historical. Revision makes the prior package inactive and requires a new active version before Review.

Outline completion produces an approved Outline Package and moves the project to Production Studio. ProductionService requires that approved outline, generates a persisted Production Package, and leaves the project in Production until the deterministic readiness engine confirms that the working draft, required checklists, graphics, media, publishing requirements, and QA are complete. Founder Review remains an explicit subsequent transition.

## Executive Prioritization Philosophy

Priority is computed from canonical project state rather than entered as a separate subjective ranking. The deterministic score considers lifecycle state, declared priority, due date, blockers, Founder dependency, active workspace, last activity, and progress.

Priority scores are derived at read time and are not stored in Firestore. This ensures a project reorders immediately when its state changes and prevents stale priority records. Risk is scored separately so urgent Founder work and operationally vulnerable work can be shown as distinct views.

Every prioritized recommendation must include plain-language reasons. Headquarters exposes the score, state context, blockers, timing, Founder dependency, and readiness behind the recommendation rather than presenting an unexplained rank.

## Executive Recommendation Philosophy

Priority Score and Recommendation Score answer different questions. Priority Score identifies important or vulnerable work; Recommendation Score selects the single best action for the Founder right now. Recommendation Score is derived at read time and is not stored in Firestore.

The deterministic recommendation engine evaluates every non-archived project using declared priority, project state, progress, current workspace, blockers, due date, last-activity recency, Founder dependency, and matching Executive Service completion events. Published projects remain eligible only for the Archive recommendation so completed work can leave the active portfolio.

Approved categories are Start, Continue, Review, Approve, Publish, Resolve Blocker, and Archive. Every recommendation includes a score, reasons, why the action matters now, the consequence of delay, and a coarse effort label. These fields explain business rules; they are not probabilities, model confidence, or time estimates.

The Founder Daily Brief displays exactly one recommendation. Project Workspace may display each project’s Recommendation Score for comparison and sorting, but it does not create a second company-level recommendation.

## Project State Philosophy

Projects are the coordinating business objects for execution. They connect intent, knowledge, assets, people, organizations, decisions, and deliverables.

The approved lifecycle is:

`Draft -> Research -> Outline -> Production -> Review -> Approved -> Published -> Archived`

Each project carries enough state to answer what it is, who owns it, where it is, how far it has progressed, what is blocking it, what happens next, and what happened most recently. State transitions are explicit. Founder review and Founder approval remain distinct control points.

One lifecycle policy is authoritative for interface availability and service/domain enforcement. The forward path is strictly sequential. Production may enter Review only with current readiness evidence; the supported revision transition is Review back to Production.

## Why Firestore

Firestore is the approved persistence layer because it fits the existing Firebase authentication stack, supports protected internal collections, maps naturally to the typed repository model, and provides the realtime client capabilities Headquarters may need later.

Application code accesses project data through repository interfaces. This keeps domain and workflow logic independent from Firestore details, preserves testability, and allows in-memory implementations where appropriate.

Firestore security must continue to rely on authenticated admin access. Session storage may preserve temporary interface context, but it is not the source of truth for persistent project records.

Every Headquarters route performs the Firestore `users/{uid}.role === "admin"` check in development and production before protected content renders. Missing documents, missing roles, non-admin roles, signed-out users, and lookup failures deny access. Firestore security rules remain the server-enforced data boundary.

Project mutations use Firestore transactions with canonical version/timestamp conflict checks. Artifact-producing services commit their Business Object and associated project advancement in the same transaction, so partial completion is not an accepted state.

## Why Deterministic Logic Before AI

Headquarters establishes structured intent, execution planning, orchestration, project state, and recommendations with deterministic logic before production AI is introduced.

This sequence provides:

- Predictable and testable workflows.
- Clear failure and clarification states.
- Stable contracts for future AI services.
- Founder control over review and approval.
- A reliable fallback when AI is unavailable.
- A trustworthy baseline for evaluating whether AI improves the product.

Future AI must operate behind approved service boundaries. It must not replace canonical project state, repository rules, access control, or explicit approval requirements.

## UX Principles

- Headquarters should feel like a premium executive operating environment, not a conventional dashboard.
- The Founder Daily Brief is the primary opening experience and leads with the action that matters most.
- Executive Conversation remains the persistent direction surface and follows the brief without being removed or obscured.
- Typography, spacing, and editorial hierarchy carry more weight than decorative UI.
- Black, white, charcoal, and restrained Hoop Red define the visual system.
- Cards answer one clear question and avoid repeating information.
- Charts, graphs, notification feeds, and unnecessary sidebar controls are excluded unless a future decision explicitly requires them.
- Conversation language should be calm and human. Engineering or orchestration terminology should not appear in normal Founder-facing states.
- Layouts must remain usable at laptop and mobile sizes, with content never hidden behind the composer.
- Accessibility, clear focus states, and readable contrast are product requirements.

## Naming Conventions

- **Headquarters** is the product name for the internal Executive Workspace experience.
- **Executive Workspace** names the internal application architecture and route family.
- **Executive Office** is the primary Headquarters room for direction, briefings, review, and approval.
- **Executive Brief** names the concise, state-derived briefing surface.
- **Executive Conversation** names the Founder command and response surface.
- **Activity** names the conversation transcript.
- **Executive Intelligence Timeline** names the durable, Firestore-backed project event history.
- **Project State** refers to the canonical lifecycle and operational fields of a project.
- Workspace and project type display names use title case; code enum values use lowercase kebab case where applicable.
- Domain types use singular PascalCase names. Services and repositories use descriptive camelCase instances and PascalCase interfaces.
- Founder-facing copy avoids implementation terms such as intent result, execution plan, orchestrator, or blocked plan.

## Engineering Principles

- Preserve public website behavior unless an Engineering Order explicitly changes it.
- Reuse existing authentication and admin authorization. Never add a production auth bypass.
- Keep domain contracts, services, repositories, and interface components separated by responsibility.
- Services receive structured domain inputs. Downstream execution services receive an `ExecutionPlan`, not raw Founder input.
- Repository interfaces define persistence boundaries; Firestore implementations remain replaceable.
- Keep canonical state in Firestore and temporary interface state in browser session storage only when needed.
- Prefer deterministic behavior and explicit transitions over hidden automation.
- Add production AI, external APIs, or automated publishing only through approved Engineering Orders.
- Protect secrets and environment files; never commit credentials.
- Keep changes scoped, preserve working code, and verify with typecheck, lint, and a production build.
- Do not commit or deploy without explicit authorization.

## Documentation Governance

Beginning with EO-028, every approved Engineering Order must:

- Update [`ROADMAP.md`](./ROADMAP.md) when milestone scope, progress, sequencing, or release status changes.
- Update this file when a product or architecture decision changes.
- Keep detailed, decision-specific rationale in a new or updated Architecture Decision Record when the change has meaningful technical consequences.

Documentation updates are part of the Engineering Order's acceptance criteria, not a later cleanup task.

## Related Documentation

- [Product Roadmap](./ROADMAP.md)
- [Hoop Frens Platform System](./HFPS.md)
- [Data Model](./DATA_MODEL.md)
- [Engineering Spec](./ENGINEERING_SPEC.md)
- [ADR-001: Executive Workspace](./architecture-decisions/ADR-001-executive-workspace.md)
- [ADR-002: Business Objects](./architecture-decisions/ADR-002-business-objects.md)
- [ADR-003: Intent Engine](./architecture-decisions/ADR-003-intent-engine.md)
- [ADR-004: Project Engine](./architecture-decisions/ADR-004-project-engine.md)
- [ADR-005: Knowledge System](./architecture-decisions/ADR-005-knowledge-system.md)
