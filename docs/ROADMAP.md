# Headquarters Product Roadmap

## September 13 — Production release preparation

The Founder instructed “move to production” and confirmed keeping media local with a “Finish on this Mac” handoff. This authorizes release preparation and deployment when the established gates and operational prerequisites pass; prior no-deployment language is historical. It does not authorize legacy PR #2 or #5 changes.

Current preparation: patched Next.js/eslint-config-next 16.3.5 and Firebase Admin 14.4.0; production server-only Firebase credential support; explicit cloud-to-local rendering handoff that opens only an available package for the signed-in account. Server rendering remains local-only. Existing AI limits are unchanged.

Validation: 56 focused server/workflow tests and 121 domain/UI/rules tests passed with no skips (177 total), full ESLint, TypeScript and production build passed. A stale navigation-label assertion was updated to the approved simple labels. Initial all-tests invocation mixed React server and browser conditions; initial reused-emulator failures disappeared with the correct conditions and a clean isolated emulator. Synthetic browser verification confirmed the cloud handoff text and fixed localhost link. No real paid research ran.

The current production dependency audit has zero critical/high and two moderate reports (gaxios/uuid). The reachable dependency use found in gaxios is uuid v4 for multipart boundaries; the advisory concerns supplied buffers in v3/v5/v6. This is retained dependency debt, not a claim of whole-program vulnerability clearance.

Production still requires secure OpenAI/Firebase server credential provisioning, authenticated smoke verification, and final independent review. Automatic approval review rejected the attempted production credential transfer before execution and requested explicit approval for those specific credentials/destination; no secret was transferred. The Founder decision is pending. Engineering Complete → Founder Validation → Independent Review → Merge Approval remain distinct gates; successful checks alone do not pass all four. Main/production and legacy PRs remain unchanged at this preparation checkpoint.


## September 13 — Founder-authorized commit and push

The Founder explicitly instructed “Commit and push.” This supersedes the earlier uncommitted/unpushed hold for the accumulated governed-content, local Instagram rendering and school-to-post workflow implementation on `codex/main/release-4-1-governed-content-intelligence`. Earlier checkpoint descriptions of uncommitted work are historical. Credentials, local media, generated proofs, ZIPs and test artifacts stay outside Git. This instruction authorizes Git publication only; it does not pass Founder Validation, Independent Review or Merge Approval, authorize merging legacy PRs, or authorize production deployment. Existing dependency findings and the first real new-school/football trial remain release prerequisites.


## 1. Vision

Headquarters is the internal operating environment for Hoop Frens, an AI-native basketball intelligence platform. It gives the Founder one place to direct work, understand company state, continue active projects, review deliverables, and make decisions.

Headquarters is not the public Hoop Frens website. It is the private operating system behind the company.

## 2. Product Principles

- **Intent first.** The Founder starts with a direction expressed in natural language. The system converts that direction into structured intent, an execution plan, and an orchestrated pathway.
- **Projects coordinate work.** Projects connect knowledge, assets, people, organizations, decisions, and workspaces.
- **One active workspace.** Every project belongs to exactly one active workspace and records its workspace history.
- **Founder control.** Review and approval remain explicit Founder actions.
- **Deterministic before AI.** Core workflows must be understandable, testable, and reliable before production AI is introduced.
- **Source-aware intelligence.** Future intelligence must preserve provenance and verification state.
- **Private by default.** Headquarters uses existing admin authentication and remains separate from public website behavior.
- **Calm executive UX.** The interface prioritizes clear direction, useful intelligence, and focused action over dashboard noise.

## 3. Current Release Status

| Release | Status | Current outcome |
| --- | --- | --- |
| Release 1 | Completed | Headquarters shell and the Founder create, continue, review, and approve workflow are established. |
| Release 2 | Released | Release 2.4 is released. Founder validation is complete, the final Release Gate is approved with minor follow-up, and EO-025 through EO-045 are complete. |
| Release 3 | Released | Release 3.1 Canonical Knowledge Graph, Release 3.2 EO-050 through EO-054, and Release 3.2.1 Production Workspace UI Hotfix are released. Release 3.2 and 3.2.1 are production validated. |
| Release 4.1 | Active implementation batch | EO-055 through EO-059 is implemented locally; connected Malone research, evidence review and six drafts succeeded after the tier update. Saved Instagram Story Studio is locally verified. Authenticated Founder interface validation and remaining release gates are pending. |

Release 2.4 and Release 3.1 are released. Release 3.2 was merged through PR #7 at `e5b9b5b473db01686cbf1843b39a4e9a0f055b83`; Release 3.2.1 was merged through PR #8 at `cb2a4695db1301a4db8967866fd637d2f314d822`. On September 6, 2026, GitHub main and Vercel Ready production were independently checked against that exact hotfix commit. The Founder supplied confirmation that both releases are production validated; this re-entry does not claim a new authenticated production UX test. Release 4.1 is the active authorized batch, with local implementation present and no Release 4 commit yet. See the [re-entry audit](./RELEASE_4_1_REENTRY_AUDIT.md).

## 4. Release 1 - Completed

Release 1 established the first usable Headquarters workflow.

- Executive Workspace shell with navigation for all six workspaces.
- Premium Executive Office experience with Executive Brief and Executive Conversation.
- Deterministic Intent Engine.
- Deterministic Execution Planning Engine.
- Deterministic Project Orchestrator.
- Create Project flow using placeholder project data.
- Continue Project flow with restored project context.
- Founder Review and Founder Approval flows.
- Repository abstraction with session-backed project availability.
- Local development and Founder quick-start documentation.

Release 1 is tagged `v0.1.0-headquarters-mvp`.

## 5. Release 2 - Released

Release 2 makes Headquarters persistent and state-aware.

### Release 2.4 Status

- **Status:** Released
- **EO-025 through EO-045:** Complete
- **Founder Validation:** Complete
- **Final Release Gate:** Approved with minor follow-up

| Engineering Order | Capability | Status |
| --- | --- | --- |
| EO-021 | Executive Intelligence foundation | Implemented and released |
| EO-022 | Viewport and composer layout | Implemented and released |
| EO-023 | Conversation activity alignment | Implemented and released |
| EO-024 | Executive Office final visual polish | Implemented and released |
| EO-025 | Firestore project repository | Approved and complete |
| EO-026 | Project State Engine and Workspace Model | Approved and complete |
| EO-027 | Executive Intelligence from Project State | Approved and complete |
| EO-028 | Product roadmap and decision log | Approved and complete |
| EO-029 | Project Workspace | Approved and complete |
| EO-030 | Executive Services Framework | Approved and complete |
| EO-031 | Research Service | Approved and complete |
| EO-032 | Research Package Viewer | Approved and complete |
| EO-033 | Executive Prioritization Engine | Approved and complete |
| EO-034 | Founder Daily Brief | Approved and complete |
| EO-035 | Executive Intelligence Timeline | Approved and complete |
| EO-036 | Executive Recommendation Engine | Approved and complete |
| EO-037 | Founder Daily Brief Generator | Approved and complete |
| EO-038 | Company Health Engine | Approved and complete |
| EO-039 | Founder Workload Engine | Approved and complete |
| EO-040 | Executive Dashboard Integration | Approved and complete |
| EO-041 | Business Object Framework | Approved and complete |
| EO-042 | Production Service | Approved and complete |
| EO-043 | Production Package Viewer | Approved and complete |
| EO-044 | Production Workflow Integration | Approved and complete |
| EO-045 | Production Readiness Engine | Approved and complete |

EO-025 through EO-045 are complete for Release 2.4. The hardening pass adds production admin authorization, explicit non-creating command handlers, centralized lifecycle enforcement, revision invalidation, concurrency protection, atomic artifact/project persistence, project-scoped artifact loading, canonical-state briefing fixes, retry-stable create idempotency, and regression tests. Founder validation is complete, and the final formal review approved the release with minor follow-up.

### Release 2.4 Technical Debt

- A moderate transitive PostCSS advisory remains through Next.js.
- No exploitable Headquarters input path was identified for the advisory.
- Continue monitoring Next.js for a safe upstream PostCSS patch; do not apply a framework-changing downgrade or unverified override.
- Future release validation records should include the validation date, browser version, and deployed Firestore rules version or deployment time.

Release 2.4 implements concrete Research, Outline, and Production Packages only. Review and Publishing remain reserved artifact types; concrete Review or Publishing package models, repositories, and viewers are not part of this release.

## 6. Release 3 - Released

Release 3 establishes deterministic, source-aware knowledge and then makes that capability useful through a Founder-Simple Headquarters experience. It does not introduce production AI. Governed Executive Reasoning remains planned for Release 4.

### Release 3.1 Capability Status

- **Release 3:** Released through Release 3.2.1; further capabilities require separate approved Engineering Orders
- **Release 3.1 Capability 1:** Released
- **Knowledge Graph foundation:** Implemented, verified, and released
- **Release gates:** Engineering Complete, Founder Validation, Independent Review, and Merge Approval passed
- **Founder functional validation:** Complete, including post-remediation reopening, editing, saving, refresh persistence, readability, and console-health confirmation for the actual Ashland University Athletics Source and Ashland University School records
- **AI implementation:** Not started

| Engineering Order | Capability | Status |
| --- | --- | --- |
| EO-046 | Knowledge Graph Foundation | Complete |
| EO-047 | School Intelligence | Complete |
| EO-048 | Knowledge Explorer | Complete |
| EO-049 | Knowledge Relationships | Complete |

Release 3 direction beyond Capability 1:

- Persisted Knowledge, Source, People, and Organization records.
- Verification status and source provenance applied consistently.
- Project-to-knowledge relationships available through repository boundaries.
- Intelligence Center workflows defined through future Engineering Orders.
- Executive intelligence grounded in approved internal records.

Additional Release 3 scope beyond EO-046 through EO-049 remains subject to future approved Engineering Orders.

EO-046 through EO-049 are complete and released as a deterministic, protected foundation: canonical nodes, relationships, sources, confidence, School Intelligence, Firestore repositories, integrity checks, audit history, and the Knowledge Center Explorer at `/executive-workspace/knowledge`. The P1 integrity remediation adds strict calendar-date validation, rule-enforced canonical history maps and linked audit shape, transactional uniqueness/provenance/archive guards, and staged in-memory subject-and-audit atomicity. Automated and emulator verification is complete for the remediation.

The Founder functional session with populated protected data occurred before the Knowledge Graph integrity remediation, and fixture-backed Ashland tests demonstrate representative legacy compatibility. Post-remediation Founder validation confirmed that the actual Founder-created Ashland University Athletics Source record and the actual Founder-created Ashland University School record were reopened successfully. Both records were edited and saved, refresh persistence passed, both records remained readable, and no runtime or browser-console errors were observed. Live relationship records were not separately revalidated and are not included in this confirmation. EO-046 through EO-049 are complete and released after all four release gates passed. Automated imports, AI reasoning, external search, and CIO behavior are not included and have not started. EO-050 through EO-054 are separately implemented deterministic Release 3.2 work; Engineering, targeted post-remediation Founder Validation, and final Independent Review are complete with zero P0 and zero P1 findings.

Remaining technical debt is explicit. Accepted P2 debt includes aggregate-registry document-size and contention limits, repository-derived audit semantics, the approved-admin direct-client trust boundary, and qualified legacy reconstruction; registries require sharding before scale makes their limits material. Privileged Firebase Admin SDK or Console access bypassing Firestore rules remains an accepted P3 operational boundary governed by project IAM and operational controls.

### Release 3.2 Founder-Simple Headquarters

- **Status:** Released and production validated through PR #7; all four release gates passed
- **Founder workflow:** `Request -> Review -> Customize -> Approve`
- **Canonical lifecycle:** Unchanged and authoritative
- **AI, external APIs, external search, and autonomy:** Not included
- **Release gates:** Engineering Complete, Founder Validation, Independent Review, and Merge Approval passed; PR #7 merged July 26, 2026

The Founder Simplicity Principle is permanent: the Founder should not need to understand nodes, relationships, repositories, schemas, canonical records, or internal IDs to complete routine Hoop Frens work. Headquarters must translate business intent into deterministic system actions and reveal implementation details only when explicitly requested.

| Engineering Order | Capability | Status |
| --- | --- | --- |
| EO-050 | Founder-Simple Foundation | Released and production validated |
| EO-051 | Guided Add School | Released and production validated |
| EO-052 | School Spotlight Request and Verified Information Review | Released and production validated |
| EO-053 | Deterministic School Spotlight Package | Released and production validated |
| EO-054 | Founder Customization and Approval | Released and production validated |

The completed engineering batch provides Founder-Simple navigation, guided Add School, a structured School Spotlight request wizard, source-backed fact review, deterministic manual content-package assembly, platform and branding customization, durable workflow drafts, and explicit Founder approval through the existing lifecycle. The request records multi-select goals and audiences, the three approved uses for one shared vertical-video plan, a primary emphasis with optional specific angle, structured media availability with optional descriptions, shot-list preference, and CTA. Recognized legacy freeform request values map into those controls, while unmatched Founder wording remains visible and editable rather than being discarded.

Drafts persist in `internalFounderWorkflowDrafts`. `SchoolSpotlightPackage` is a compatible `ProductionPackage` stored and versioned in the existing `internalProductionPackages` collection. The batch does not redesign the released Knowledge Graph, fabricate facts, upload media, publish or schedule content, modify the public website, or authorize later Founder actions. EO-055 was not part of Release 3.2; it is now authorized within the active Release 4.1 batch, with local implementation now present and connected validation pending.

Targeted post-remediation Founder Validation reused the existing Malone University Version 2 and confirmed that `Request -> Review -> Customize -> Approve` remained functional, the exact approved version remained readable after refresh, and no duplicate School, project, workflow draft, or package was created. Approval did not publish, schedule, upload, or externally send content. No new browser-console or runtime errors were observed, and the deployed Firestore rules were confirmed active. Final Independent Review passed with zero P0 and zero P1 findings.

Additional deterministic actions—Facility Tour, Coach Feature, Player Feature, Compare Schools, Recruiting Guide, Social Campaign, New Intelligence review, a centralized content-approval queue, and an expanded Founder-Simple Executive Brief—remain product directions that require later approved Engineering Orders.

### Release 3.2.1 Production Workspace UI Hotfix

Released and production validated. PR #8 corrected the Projects table, Executive Services layout, and visible Sign Out action. Existing Malone University approved Version 2 was preserved according to the release evidence. Production Ready at `cb2a4695db1301a4db8967866fd637d2f314d822` was rechecked September 6, 2026.

## 7. Release 4.1 - Active Implementation Batch

September 10–11 scope extension: the Founder authorized the proposed Instagram still-graphics work. A local-only renderer and proof-approval/download interface are now implemented alongside Release 4.1; final graphic exports no longer remain wholly excluded from the program. Cloud deployment, video/voice, publishing and scheduling remain excluded. This extension does not silently renumber EO-055–EO-059 or authorize other later orders. See [local still-graphics implementation, evidence and release prerequisites](./INSTAGRAM_STILL_RENDERING.md).

**Governed Content Intelligence** is the current Founder-authorized batch. After initially selecting reuse, the Founder created and stored a new key and confirmed the intended organization, project, and restricted permissions. Safe model-list verification returned HTTP 200. The Founder approved $0.50 per request and $10 per month. Firebase server authentication, reads and live database protection were verified. The tier update resolved the earlier moderation limit; connected Malone research, explicit evidence review revision 2 and all six platform drafts succeeded. The September 9 saved Instagram Story Studio adds local editing and layout review without an AI charge. See the [current interface scope and checklist](./RELEASE_4_1_STORY_STUDIO.md). Authenticated Founder browser validation remains pending.

| Engineering Order | Capability | Status |
| --- | --- | --- |
| EO-055 | Secure AI Gateway and Governance Policy | Local implementation; connected service checks passed; release review pending |
| EO-056 | Governed Research and Approved-Source Intake | Connected Malone Research Package persisted; Founder browser validation pending |
| EO-057 | Claim, Evidence, Confidence, and Conflict Ledger | Malone review revision 2 persisted; Founder browser validation pending |
| EO-058 | Hoop Frens Editorial Pattern and Voice Registry | Original registry and editable storyboard present; editorial validation pending |
| EO-059 | Structured Platform Output Generation | Six connected drafts persisted; Story Studio locally verified; Founder validation pending |

The approved scope is Founder-initiated research with automatic Research Package creation, an approved-source policy, claim-level citations and evidence, rejection of unsupported claims, visible conflicts and missing information, original Hoop Frens editorial content, and structured Instagram, TikTok, YouTube, Facebook, X, and website drafts. Every result must link to exactly one approved SchoolSpotlightPackage version. Budget, bounded retry, cancellation, audit, failure controls, and a connected Malone University evaluation are required. Canonical Knowledge Graph mutations are never automatic.

EO-060 and later remain outside the original Release 4.1 batch. The separately authorized local still-graphics extension above now implements exact-size PNG proofs and approved downloads. MP4/voiceover, social uploading, publishing, scheduling, external sending, analytics connectors, autonomous agents, public-site changes and Knowledge Graph replacement remain excluded. Website drafts are internal draft content only.

The established gates remain **Engineering Complete → Founder Validation → Independent Review → Merge Approval**. Release 4.1 has passed none of these gates. Keep all work uncommitted and unpushed for Founder Validation. Legacy PR #2 and PR #5 require separate Founder authorization before closing or merging. The [re-entry audit](./RELEASE_4_1_REENTRY_AUDIT.md) records current evidence and remaining prerequisites.

## 8. Workspace Model

Every project belongs to exactly one active workspace through `currentWorkspace`. Each transition is recorded in `workspaceHistory` with its time and reason.

| Workspace | Responsibility |
| --- | --- |
| Executive Office | Direction, briefings, review, approval, and company-level decisions |
| Intelligence Center | Research, knowledge development, and source verification |
| Production Studio | Content planning, production, and revision |
| Strategy Room | Strategic analysis, priorities, and recommendations |
| Product Lab | Product, website, and platform improvements |
| Library | Durable knowledge, assets, sources, and completed reference material |

Transitions are deterministic and follow the needs of the project. A representative path is:

`Executive Office -> Intelligence Center -> Production Studio -> Executive Office -> Published`

## 9. Project Types

The approved project types are:

- School Spotlight
- Podcast Episode
- News Story
- Recruiting Analysis
- Social Video
- Resource Guide
- Partnership
- Website Improvement
- Merchandise

New project types require an approved product decision and corresponding domain-model update.

## 10. Project Lifecycle

The canonical lifecycle is:

`Draft -> Research -> Outline -> Production -> Review -> Approved -> Published -> Archived`

Projects track state, progress, priority, ownership, optional due date, dependencies, blockers, current step, recommended next action, last activity, current workspace, and workspace history.

State changes are explicit and deterministic through one shared lifecycle policy. Production readiness is required before Review; Review may return to Production only through the revision path, which invalidates stale readiness and supersedes the prior Production Package. Review and approval are separate states, and Founder approval is required before work moves beyond the approval boundary.

## 11. Success Metrics

Release targets should be set only after baseline usage is measured. Headquarters will evaluate success across these measures:

- **Founder workflow completion:** Create, continue, review, and approve flows complete without losing context.
- **Project persistence:** Project state survives refresh and sign-out/sign-in without data loss.
- **State integrity:** Every project has a valid type, lifecycle state, active workspace, owner, current step, and recommended next action.
- **Decision readiness:** The Executive Brief surfaces the highest-priority action without duplicate or irrelevant entries.
- **Time to direction:** The Founder can understand company state and begin the recommended action quickly.
- **Operational reliability:** Typecheck, lint, build, authentication, and repository operations remain healthy.
- **Public-site isolation:** Headquarters changes do not alter public website behavior.
- **Trust:** Future intelligence can be traced to its sources, verification state, and related business objects.

## Related Documentation

- [Hoop Frens Platform System](./HFPS.md)
- [Data Model](./DATA_MODEL.md)
- [Engineering Spec](./ENGINEERING_SPEC.md)
- [Decision Log](./DECISIONS.md)
- [Founder-Simple Headquarters](./FOUNDER_SIMPLE.md)
- [School Spotlight Workflow](./SCHOOL_SPOTLIGHT_WORKFLOW.md)
- [Architecture Decisions](./architecture-decisions/ADR-001-executive-workspace.md)

## Documentation Governance

Beginning with EO-028, every approved Engineering Order must update this roadmap when milestone scope, status, sequencing, or completion changes. The same order must update the [Decision Log](./DECISIONS.md) when it changes a product or architecture decision.


September 8 checkpoint: the Founder-approved namespace-only Firestore protection was activated and verified while preserving live console changes. The actual Malone Version 2 passed connected binding checks. A bounded research run reserved $0.50 and stopped at OpenAI input moderation; follow-up diagnostics show HTTP 429 rate limiting. No Research Package or drafts were created and canonical hashes/counts were unchanged. Provider moderation availability, the successful connected content evaluation, and all four release gates remain pending. Source work remains uncommitted and unpushed; no website deployment occurred. See the current re-entry audit for evidence.


### September 13 Founder workflow priority

Instagram carousel + caption for manual upload is the first simple user journey. The local default now offers school selection, prepared post review, and local image download; existing detailed tools are secondary. School/team intake is present, but general school onboarding and football research are not connected. This is an interface/inbox checkpoint, not completion of the broader school-to-publish goal and not a passed release gate. [Simple workflow implementation and remaining work](./SIMPLE_POST_WORKFLOW.md).

## September 13 — Photo selection and cost-controlled completion

The Founder explicitly removed separate photo approval and requested broader facility/campus imagery. The local implementation now discovers official-school photo candidates without AI calls, provides category/slide selection, includes used-photo credits in the downloaded caption, and keeps unknown usage rights visible without blocking export. Exact evidence binding, copy review, proof approval and all four release gates remain intact. New proofs are required to use the updated rendering policy.

Arbitrary-school and football automation remain unfinished. The next implementation sequence and spending boundaries are documented in [the low-cost completion plan](./LOW_COST_AUTOMATION_PLAN.md). There is no new cloud storage, provider permission, publishing, background agent or deployment authorization implied by this checkpoint. Work remains uncommitted and unpushed.

## September 13 — Connected new-school and football workflow

The Founder authorized the next implementation step. New-school, men's-basketball, women's-basketball and football requests now proceed from explicit official-site confirmation to selected-team research and automatic saved Instagram assembly after facts review. This supersedes the prior waiting-only checkpoint. Preliminary request research is clearly separate from an approved package; the explicit facts-review action approves one immutable editorial SchoolSpotlightPackage version before assembly/export. Canonical Knowledge Graph and project lifecycle records remain untouched. Football output uses Field Notes.

The existing $0.50/request and $10/month allowance, local media, manual final review/upload and all four release gates remain. Fifty-five isolated tests passed; real new-school/football provider quality and Founder acceptance are still to be validated. No paid provider requests, commit/push, deployment or legacy PR changes during this implementation. [Current behavior and exact files](./SCHOOL_TO_POST_AUTOMATION.md), [ADR-007](./architecture-decisions/ADR-007-request-scoped-school-posts.md).
