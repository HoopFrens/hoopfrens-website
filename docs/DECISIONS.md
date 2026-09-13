# Headquarters Product and Architecture Decisions

## September 13 — Founder-authorized commit and push

The Founder explicitly instructed “Commit and push.” This supersedes the earlier uncommitted/unpushed hold for the accumulated governed-content, local Instagram rendering and school-to-post workflow implementation on `codex/main/release-4-1-governed-content-intelligence`. Earlier checkpoint descriptions of uncommitted work are historical. Credentials, local media, generated proofs, ZIPs and test artifacts stay outside Git. This instruction authorizes Git publication only; it does not pass Founder Validation, Independent Review or Merge Approval, authorize merging legacy PRs, or authorize production deployment. Existing dependency findings and the first real new-school/football trial remain release prerequisites.


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

## Founder Simplicity Philosophy

Release 3.2 adopts the Founder Simplicity Principle:

> The Founder should never be required to understand nodes, relationships, repositories, schemas, canonical records, or internal IDs to accomplish routine Hoop Frens work. Headquarters must translate business intent into system actions and expose technical concepts only when explicitly requested.

The primary Founder experience is `Request -> Review -> Customize -> Approve`. This is an experience model over the canonical project lifecycle, not a replacement for it. Headquarters may simplify navigation, labels, and data entry, but it may not hide failed prerequisites, create parallel project state, weaken source or runtime validation, or approve and publish without the existing explicit actions.

Routine flows lead with Add School, Build School Spotlight, and other business outcomes. Technical maintenance remains available through progressive disclosure. Founder-facing labels use Verified Source, Why We Trust This, Verification Status, and Information Needs Attention while preserving the exact canonical meaning underneath.

Autosave applies to a separate owner-restricted `FounderWorkflowDraft` persisted in `internalFounderWorkflowDrafts`, never to incomplete canonical Sources, nodes, relationships, projects, or packages. Deterministic School Spotlight assembly uses a versioned `SchoolSpotlightPackage` that extends the existing `ProductionPackage` contract. Protected integrity records enforce the supported nested package keys, field types, ownership, and linkage before a noncanonical staged header is atomically activated and linked through `internalProductionPackages`; every supported vertical-video scene index is checked against the exact `id`, `heading`, `narration`, and `visualDirection` shape. It is not a Review Package or Publishing Package and cannot publish or modify the public website. [ADR-006](./architecture-decisions/ADR-006-founder-workflow-drafts-and-spotlight-packages.md) records this implemented persistence boundary. EO-050 through EO-054 are Engineering Complete. Targeted post-remediation Founder Validation and final Independent Review passed with zero P0 and zero P1 findings; PR #7 is merged and Release 3.2 is released and production validated.

School Spotlight intent is captured as structured goals, audiences, platform uses, primary emphasis, optional specific angle, media availability, optional media descriptions, shot-list preference, and CTA. Platform choices reuse one vertical-video plan and do not publish, schedule, or upload. Legacy freeform objective, audience, emphasis, and comma-separated media values remain readable: recognized phrases map to structured choices and unmatched Founder wording is retained through visible compatibility context. This is a draft-schema evolution only; it does not alter canonical School or Source records, lifecycle/version enforcement, authorization, provenance, or the four approved EO-053 outputs. EO-055 was not part of Release 3.2; it is now authorized within the active Release 4.1 batch, with local implementation now present and connected validation pending.

## Knowledge Graph Foundation Philosophy

Release 3.1 establishes Knowledge, Relationship, and Source as separate canonical records before any reasoning capability is introduced. Nodes identify durable entities, directed relationships connect them, and source records preserve reusable evidence and reliability. Persisted claims reference canonical source IDs; source display summaries are resolved from source records. Connected Conference, Coach, Facility, Project, and Content facts are resolved from relationships rather than caller-authored compact references. Legacy compact references remain readable only as compatibility data.

Knowledge confidence is explicit and deterministic: Verified, Supported, Inferred, Unverified, or Conflicting. Verified records require active same-workspace canonical source evidence. Conflicting evidence is preserved and surfaced; it does not silently overwrite an existing exclusive relationship or merge the competing claims' source IDs. Each conflicting relationship retains at least one active source of its own, while conflicting nodes require at least two sources. Transactional node registries and immutable exact-owner entries in the workspace relationship registry make canonical name, alias, and exact-relationship uniqueness authoritative under concurrency through the supported repositories; untouched legacy identities are enrolled before the first affected mutation. The candidate, all competing claims needed for the decision, any peer whose confidence changes, registry state, and linked mutation audits are handled atomically in one bounded transaction.

Records are archived rather than deleted, and canonical map-shaped versions plus deterministic actor-bound audit links preserve create, update, archive, confidence, evidence, and conflict history. Firestore rules preserve existing history entries, bind confidence and status transitions to the resulting subject state, require the next canonical version key, and constrain linked audit subject, version, actor, request-time timestamp, allowed fields, and metadata shape. The audit ID derives from subject type, subject ID, and current version key, preventing reuse of an earlier event; full legacy-history validation is divided across the atomic subject and audit writes to remain within Firestore's expression budget. A failed supported mutation rejects both writes. The in-memory repository mirrors that boundary by staging and validating the complete next subject-and-audit state before one replacement, so injected audit failure cannot leave a partial in-memory mutation. Missing or mismatched non-legacy audit references produce integrity warnings; records with an explicit `legacy:` sentinel remain readable as unaudited compatibility data until a supported mutation creates a current deterministic audit. Original pre-versioned list histories are retained as compatibility snapshots when a legacy record first advances. Canonical entries synthesized for fields missing from a pre-versioned record are compatibility reconstructions rather than independently authenticated historical attribution; when raw lists existed, `legacyHistorySnapshot` remains the authoritative pre-migration history.

Knowledge timestamps use one strict calendar validator before normalization. Impossible dates, invalid month/day combinations, non-leap-year February 29, malformed time values, and malformed UTC or numeric offsets are rejected rather than normalized into a different date. Local Founder-entered source dates preserve the intended instant; optional blank publication dates remain absent.

The pre-remediation Founder session remains historical functional evidence, and fixture-backed tests provide automated compatibility evidence for representative Ashland legacy data. Post-remediation Founder validation confirmed that the actual Founder-created Ashland University Athletics Source record and the actual Founder-created Ashland University School record were reopened successfully. Both records were edited and saved, refresh persistence passed, both records remained readable, and no runtime or browser-console errors were observed. Live relationship records were not separately revalidated and are not included in this confirmation. Release 3.1 Capability 1 is released, EO-046 through EO-049 are complete, and Engineering Complete, Founder Validation, Independent Review, and Merge Approval all passed. Accepted P2/P3 technical debt remains tracked. EO-050 through EO-054 are deterministic Release 3.2 work. Targeted post-remediation Founder Validation reused the existing Malone University Version 2 and confirmed that `Request -> Review -> Customize -> Approve` remained functional, the exact approved version remained readable after refresh, and no duplicate School, project, workflow draft, or package was created. Approval did not publish, schedule, upload, or externally send content. No new browser-console or runtime errors were observed, and the deployed Firestore rules were confirmed active. Engineering and final Independent Review are complete with zero P0 and zero P1 findings; PR #7 is merged and Release 3.2 is released and production validated.

Accepted P2 debt for the current low-volume Founder workflow includes aggregate-registry document-size and contention limits, repository-derived audit semantics, the approved-admin direct-client trust boundary, and qualified legacy reconstruction. Registries require sharding before scale approaches their limits. Firestore rules govern client SDK writes; privileged Firebase Admin SDK and Console access bypass those rules by platform design and remain an accepted P3 operational boundary controlled through project IAM and procedure.

School Intelligence uses a Knowledge Graph-specific nine-region Hoop Frens structure: Northeast, Mid-Atlantic, Southeast, Gulf States, Greater Lakes, Midwest, Texas, Southwest, and Northwest. Release 2's legacy shared Region values remain compatible and separate. State-to-region classification is deterministic, and School state and region values derive from canonical State and Region nodes rather than independent Founder input. The graph connects Conference, Coach, Facility, Project, and Content records through relationships. These records remain internal to Headquarters, inherit the existing fail-closed admin authorization boundary, and are not exposed to the public website.

Knowledge Center is the manual deterministic exploration and maintenance surface at `/executive-workspace/knowledge`. Release 3.2 Founder-Simple flows sit above that released surface without redesigning its canonical model. Founder-initiated governed research and content drafting are separately authorized under Release 4.1, EO-055 through EO-059. Autonomous collection and CIO behavior remain excluded. See the current decision below and the re-entry audit.

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
- **Founder-Simple** names the routine business-language experience governed by the Founder Simplicity Principle.
- **Founder Workflow Draft** names durable, non-canonical autosave state for an incomplete guided flow.
- **School Spotlight Package** names the deterministic, versioned `ProductionPackage` subtype used for the initial Founder-Simple output; it does not mean Review Package, Publishing Package, or published content.
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
- [Founder-Simple Headquarters](./FOUNDER_SIMPLE.md)
- [School Spotlight Workflow](./SCHOOL_SPOTLIGHT_WORKFLOW.md)
- [ADR-001: Executive Workspace](./architecture-decisions/ADR-001-executive-workspace.md)
- [ADR-002: Business Objects](./architecture-decisions/ADR-002-business-objects.md)
- [ADR-003: Intent Engine](./architecture-decisions/ADR-003-intent-engine.md)
- [ADR-004: Project Engine](./architecture-decisions/ADR-004-project-engine.md)
- [ADR-005: Knowledge System](./architecture-decisions/ADR-005-knowledge-system.md)
- [ADR-006: Founder Workflow Drafts and School Spotlight Packages](./architecture-decisions/ADR-006-founder-workflow-drafts-and-spotlight-packages.md)

## September 10–11, 2026 — Local Instagram still graphics

The Founder accepted the proposed narrow still-graphics scope with “Let’s move forward.” Local implementation now includes private approved-source photo intake, exact 1080 × 1350 PNG proofs, explicit proof approval, ZIP/caption/alt-text/source records, cancellation, bounded retries and artifact/version checks. On September 11, the Founder explicitly confirmed “Let’s continue with local media storage.” Media and render review records remain in the private local store on this Mac; no new cloud storage service or spend is authorized. Local backup and audit retention remain operating-policy prerequisites. The current public-read Storage rules are not used. Existing OpenAI permissions and AI spending limits remain unchanged; rendering makes no provider requests. Photo rights and final Malone proof approval remain pending. All work stays uncommitted/unpushed, with no deployment or later video/publishing capabilities. See [implementation, verification and remaining gates](./INSTAGRAM_STILL_RENDERING.md).

## September 9, 2026 — Saved Instagram Story Studio

The Founder authorized interface improvements following carousel review. EO-058/EO-059 now include a saved original story brief, deterministic starter hooks, editable slide/caption drafts, approved evidence selection, source-photo references, permission records, crop preview, saved locks and immutable owner-restricted revisions. Arbitrary edited prose requires explicit Founder semantic review; reference validation alone does not prove factual meaning. Saves make no provider calls or canonical changes. Final graphic rendering and secure media uploads remain a separate proposal, not authorized implementation. All changes remain uncommitted and unpushed; all four release gates are preserved. See [scope, verification, exact files and rendering prerequisites](./RELEASE_4_1_STORY_STUDIO.md).

## September 6, 2026 — Release 4.1 Governed Content Intelligence

Authority: explicit Founder re-entry instruction, subsequent creation and local storage of a new OpenAI key after reuse proved unavailable, and confirmation of project, permissions, and spending limits. Release 3.2 and Release 3.2.1 are released and production validated. GitHub PR #7 and PR #8 are merged; current main and Vercel Ready production match `cb2a4695db1301a4db8967866fd637d2f314d822`.

The active authorized batch is EO-055 through EO-059, with local implementation present and connected verification pending. OpenAI target: organization **Hoop Frens**, project **Hoop Frens Content Intelligence**. Initial permissions: List models Read; Responses Write; Moderations Request; Text-to-speech None until EO-062; Realtime, Chat Completions, Embeddings, Images, and unrelated endpoints None. The Founder stored the new key directly. Safe local presence and model-list HTTP 200 checks passed without displaying the value. The Founder confirms the target organization/project and permissions; those permissions were not independently audited in the Platform dashboard. The initial September 8 moderation failure was resolved after the Founder updated the tier. Governed Responses research/extraction and Research Package persistence now pass; The Founder later explicitly approved the evidence/wording proposal, and all six platform drafts now persist; authenticated browser and final editorial acceptance remain pending.

The Founder explicitly authorizes initiated web research and automatic Research Package creation. This supersedes historical proposals requiring a second approval merely to persist that requested research artifact. It does not approve canonical Knowledge Graph mutation, content approval, publishing, external sending, or automatic lifecycle advancement. Generated internal drafts must bind to one exact approved SchoolSpotlightPackage version and reject unsupported material claims.

Hoop Frens voice is basketball-first, clear, confident, educational, premium sports editorial, respectful of every level, and useful to athletes and parents. No hype, fabricated facts, or recruiting promises. High-level format inspiration may include overlooked schools, facilities-first hooks, concrete basketball details, athlete/parent education, recurring series, and sports-media pacing. Another creator's phrases, scripts, designs, templates, logos, editing sequences, or brand voice must not be copied.

The Founder approved $0.50/request and $10/month. This supersedes the historical $100/month proposal. The implementation conservatively retains a full $0.50 reservation for each initiated research or generation job, including success, failure, and cancellation: at most 20 jobs per UTC calendar month in the shared Firebase project. Model routing is an engineering choice: gpt-5-mini for domain-filtered web research, gpt-4.1-mini for extraction/arrangement, and omni-moderation-latest for safety checks. The search route was corrected after a verified gpt-4.1-mini domain-filter rejection, with a conservative full-context cost bound and unchanged spending limits. Historical retention durations remain unapproved; only structured artifacts, short evidence excerpts, review records, and sanitized run/call metadata are retained. No raw provider conversations or full fetched pages are persisted. Runtime fails closed without Firebase server authorization and durable reservations. Operational retention and dependency-advisory disposition must be settled before release. EO-060 and later, final PNG/MP4/voiceover rendering, publishing, scheduling, uploading, external sending, analytics connectors, autonomous agents, public-site changes, and replacement of the Knowledge Graph are excluded. All implementation must remain uncommitted and unpushed for Founder Validation. Preserve Engineering Complete, Founder Validation, Independent Review, and Merge Approval. [Re-entry evidence and checklist](./RELEASE_4_1_REENTRY_AUDIT.md).


September 8 checkpoint: the Founder-approved namespace-only Firestore protection was activated and verified while preserving live console changes. The actual Malone Version 2 passed connected binding checks. A bounded research run reserved $0.50 and stopped at OpenAI input moderation; follow-up diagnostics show HTTP 429 rate limiting. No Research Package or drafts were created and canonical hashes/counts were unchanged. Provider moderation availability, the successful connected content evaluation, and all four release gates remain pending. Source work remains uncommitted and unpushed; no website deployment occurred. See the current re-entry audit for evidence.


## September 13, 2026 — Simple post maker first

The Founder requested a much simpler school-to-post workflow and selected an Instagram photo carousel with caption for manual upload as the first output. The default local workspace now uses Choose a school → Check your post → Download, hides version selection and detailed tools, prepares a draft from existing reviewed facts, and preserves evidence/photo/copy approval before final downloads. New school/team requests are saved as waiting for setup; arbitrary-school and football research remain unfinished and must not be advertised as running. No automated publishing, cloud spending, autonomous agents or canonical mutations are enabled. See [current behavior, tests and remaining product gap](./SIMPLE_POST_WORKFLOW.md).

## September 13 — Photo selection and cost-controlled completion

The Founder explicitly removed separate photo approval and requested broader facility/campus imagery. The local implementation now discovers official-school photo candidates without AI calls, provides category/slide selection, includes used-photo credits in the downloaded caption, and keeps unknown usage rights visible without blocking export. Exact evidence binding, copy review, proof approval and all four release gates remain intact. New proofs are required to use the updated rendering policy.

Arbitrary-school and football automation remain unfinished. The next implementation sequence and spending boundaries are documented in [the low-cost completion plan](./LOW_COST_AUTOMATION_PLAN.md). There is no new cloud storage, provider permission, publishing, background agent or deployment authorization implied by this checkpoint. Work remains uncommitted and unpushed.

## September 13 — Connected new-school and football workflow

The Founder authorized the next implementation step. New-school, men's-basketball, women's-basketball and football requests now proceed from explicit official-site confirmation to selected-team research and automatic saved Instagram assembly after facts review. This supersedes the prior waiting-only checkpoint. Preliminary request research is clearly separate from an approved package; the explicit facts-review action approves one immutable editorial SchoolSpotlightPackage version before assembly/export. Canonical Knowledge Graph and project lifecycle records remain untouched. Football output uses Field Notes.

The existing $0.50/request and $10/month allowance, local media, manual final review/upload and all four release gates remain. Fifty-five isolated tests passed; real new-school/football provider quality and Founder acceptance are still to be validated. No paid provider requests, commit/push, deployment or legacy PR changes during this implementation. [Current behavior and exact files](./SCHOOL_TO_POST_AUTOMATION.md), [ADR-007](./architecture-decisions/ADR-007-request-scoped-school-posts.md).
