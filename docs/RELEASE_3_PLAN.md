# Release 3 Architecture Plan

## Release Name

**Deterministic Knowledge and Founder-Simple Operations**

## Mission

Establish deterministic, source-aware knowledge and turn it into practical Founder workflows before adding governed AI reasoning to Headquarters, without weakening the workflow, authorization model, Founder control, or auditability established in Release 2.

## Current Scope and Status

EO-046 through EO-049 implement Release 3.1 Capability 1, the deterministic Knowledge Graph foundation. That capability is released, EO-046 through EO-049 are complete, and Engineering Complete, Founder Validation, Independent Review, and Merge Approval all passed. Accepted P2/P3 technical debt remains tracked. It contains no AI, model-provider integration, automated ingestion, external API, or external-search behavior.

Release 3.2 EO-050 through EO-054 implement the deterministic Founder-Simple Headquarters experience. Engineering is complete with all P1 remediation applied. Founder Validation, including the targeted post-remediation repeat using the existing Malone University Version 2, passed, and final Independent Review passed with zero P0 and zero P1 findings. Founder authorization for the commit, pull request, and conditional merge workflow is granted; required pull-request checks and the merge remain pending. These orders place guided business workflows above the released Knowledge Graph without changing its canonical architecture, and they contain no AI, model-provider integration, external API, external search, autonomous behavior, automated publishing, or public-site change.

Future AI and Chief Intelligence Officer capabilities belong to Release 4 and have not started. The pending decisions in [`RELEASE_3_1_DECISION_PACKAGE.md`](./RELEASE_3_1_DECISION_PACKAGE.md) govern only that future AI/CIO work; they do not block or retroactively gate Release 3.1 or deterministic Release 3.2 work. Every future AI/CIO capability still requires approved governance decisions, its own Engineering Order, capability-specific review, and the four-gate release process.

## Architecture Principles

- Deterministic project state, lifecycle policy, repositories, and authorization remain authoritative.
- AI output is untrusted advisory input until validated and approved.
- Secrets and provider credentials remain server-side and never enter browser bundles, Firestore documents, prompts, logs, or client-visible errors.
- Every AI request uses a structured contract, an approved purpose, bounded data, a cost ceiling, and an auditable outcome.
- AI failure must preserve the existing deterministic workflow.
- AI cannot approve, publish, weaken access controls, or bypass Founder confirmation.
- New trust boundaries require threat modeling before implementation.

## Release 3.2 — Founder-Simple Headquarters

### Permanent Principle

The Founder should never be required to understand nodes, relationships, repositories, schemas, canonical records, or internal IDs to accomplish routine Hoop Frens work. Headquarters must translate business intent into system actions and expose technical concepts only when explicitly requested.

The primary experience is `Request -> Review -> Customize -> Approve`. This experience does not replace the canonical lifecycle, authorization, provenance, history, or approval boundaries.

### Engineering Orders

| Engineering Order | Capability | Scope | Status |
| --- | --- | --- | --- |
| EO-050 | Founder-Simple Foundation | Exact primary navigation (`Today`, `Create`, `Work`, `Intelligence`, `Review & Approve`, `Library`), action catalog, guided-flow shell, terminology, progressive disclosure, and durable workflow-draft boundary | Ready to commit; Founder Validation and Independent Review passed |
| EO-051 | Guided Add School | Source-backed School intake with derived canonical values and no exposed internal IDs | Ready to commit; Founder Validation and Independent Review passed |
| EO-052 | School Spotlight Request and Verified Information Review | Structured goals, audiences, platform uses, emphasis, media availability, canonical School selection, source-backed fact resolution, and include/correct/exclude review | Ready to commit; Founder Validation and Independent Review passed |
| EO-053 | Deterministic School Spotlight Package | One reusable vertical-video package, one Instagram caption, one photo/video shot list, one source and verification package, versioning, and unresolved-information handling | Ready to commit; Founder Validation and Independent Review passed |
| EO-054 | Founder Customization and Approval | Tone, length, hook, emphasis, branding, media and CTA customization, revision, readiness explanations, and explicit existing-lifecycle approval | Ready to commit; Founder Validation and Independent Review passed |

EO-050 through EO-054 are the completed engineering batch for one Founder-visible journey without AI or external APIs. Targeted post-remediation Founder Validation reused the existing Malone University Version 2 and confirmed that `Request -> Review -> Customize -> Approve` remained functional, the exact approved version remained readable after refresh, and no duplicate School, project, workflow draft, or package was created. Approval did not publish, schedule, upload, or externally send content. No new browser-console or runtime errors were observed, and the deployed Firestore rules were confirmed active. Final Independent Review passed with zero P0 and zero P1 findings. Founder authorization is granted; required pull-request checks and the merge remain pending.

The School Spotlight request captures multi-select goals and audiences, Instagram Reel/TikTok/YouTube Short use of one shared vertical-video plan, one primary emphasis with an optional specific angle, structured media availability with optional descriptions, shot-list preference, and CTA. Legacy freeform objective, audience, emphasis, and comma-separated media values remain readable; recognized wording maps into the structured controls and unmatched Founder wording is preserved. These selections describe intent and available media only. They do not upload files, publish, schedule, call a platform, or change the four approved EO-053 outputs.

### Persistence Boundary

Release 3.2 implements an owner-restricted `FounderWorkflowDraft` in `internalFounderWorkflowDrafts` for refresh-safe incomplete guided-flow state. Draft autosave never creates partial canonical Knowledge, Source, project, or package records. The deterministic, versioned `SchoolSpotlightPackage` extends `ProductionPackage`, uses the existing `internalProductionPackages` collection and repository, and validates nested package integrity in protected `internalSchoolSpotlightPackage*` records before atomic activation. It is neither a Review Package nor a Publishing Package and cannot publish, schedule, upload, send, or modify the public website. [ADR-006](./architecture-decisions/ADR-006-founder-workflow-drafts-and-spotlight-packages.md) records the implemented architecture.

### Future Deterministic Product Directions

Facility Tour, Coach Feature, Player Feature, Compare Schools, Recruiting Guide, Social Campaign, New Intelligence review, an expanded cross-capability approval queue beyond the implemented School Spotlight queue, and an expanded Founder-Simple Executive Brief remain future product directions outside EO-050 through EO-054. They require separately approved Engineering Orders.

EO-055 has not started and is not authorized by Release 3.2 Capability 1.

## Release 4 — Proposed Future AI/CIO Capability Sequence

### Release 4.1 — Future AI/CIO Foundation and Governance

**Purpose**

Create the controlled execution boundary required before any Headquarters AI capability can be implemented. This includes a server-side AI gateway, secret isolation, provider abstraction, model-routing policy, structured request and response contracts, cost and token tracking, prompt and response audit records, bounded failure handling, and Founder approval rules.

**Allowed actions**

- Accept an authenticated, authorized, purpose-specific structured request on the server.
- Select an approved model route through policy rather than caller choice.
- Send only policy-approved data to the selected provider.
- Enforce request, token, cost, timeout, and retry limits.
- Return a structured response with provenance, model-route metadata, cost, token usage, confidence or uncertainty fields when meaningful, and a deterministic fallback state.
- Record approved audit metadata and retention-controlled content.

**Prohibited actions**

- Client-side provider calls or exposure of provider secrets.
- Caller-selected unrestricted models, system prompts, tools, or token limits.
- Direct project-state mutation, approval, publishing, authorization changes, or Firestore-rule changes.
- Autonomous retries without a bounded policy.
- Execution after a budget, rate, data, retention, or approval control fails.

**Security boundary**

The server-side gateway is the only provider boundary. It must authenticate the user, confirm the exact admin authorization required by Headquarters, validate the request contract, apply data minimization, enforce routing and spend policy, and sanitize provider failures before returning a response.

**Data inputs**

- Authorized user and request identity.
- Approved capability and purpose identifier.
- Minimal structured project context or artifact excerpts allowed by policy.
- Model-route, cost, token, timeout, retention, and audit policy.
- Explicit Founder confirmation when the request crosses an approval boundary.

**Outputs**

- Schema-validated AI response or deterministic failure/fallback result.
- Request correlation ID, policy decision, route, token usage, cost, latency, and outcome metadata.
- Optional retention-controlled prompt or response records only when Founder policy allows them.

**Approval requirements**

- Founder approval of all thirteen future AI/CIO governance decisions before AI implementation.
- Architecture and threat-model approval before gateway code is merged.
- Explicit Founder confirmation before any AI result is persisted as a durable artifact or offered to another tool.

**Test requirements**

- Authorization, secret-isolation, request-schema, response-schema, data-minimization, routing-policy, spend-limit, rate-limit, timeout, retry, provider-failure, redaction, retention, and audit-log tests.
- Negative tests proving the browser cannot access provider credentials or bypass model and budget policy.
- Deterministic fallback tests proving canonical workflows remain available when AI is disabled or unavailable.

**Founder validation requirements**

- Confirm authorized requests work and non-admin or unauthenticated requests fail without data disclosure.
- Confirm cost and token information is understandable before or immediately after execution, as policy requires.
- Confirm denied, timed-out, over-budget, malformed, and provider-failure states are clear and preserve work.
- Confirm no AI output changes project state or persists without the required approval.

**Release gate requirements**

- All four release gates must pass.
- Independent review must include the gateway trust boundary, secrets, data egress, retention, cost enforcement, auditability, and failure behavior.
- The future Executive Reasoning capability cannot begin implementation until the AI/CIO governance foundation is released and its controls are verified in the deployed environment.

### Release 4.2 — Executive Reasoning

**Purpose**

Add governed explanations of deterministic recommendations, risks, and opportunities while preserving canonical project state and the existing recommendation engine.

**Allowed actions**

- Explain why an existing deterministic recommendation is important.
- Summarize risks, opportunities, dependencies, and uncertainty from approved project context.
- Offer advisory alternatives and questions for Founder consideration.
- Cite the canonical inputs used to construct the explanation.

**Prohibited actions**

- Replacing deterministic priority or recommendation scores with opaque AI scores.
- Directly changing project state, priority, owner, readiness, history, or recommendation records.
- Inventing facts, dependencies, completion evidence, or confidence.
- Approving, publishing, or invoking privileged workflow actions.

**Security boundary**

The future AI/CIO gateway receives only authorized, minimal project context. The reasoning capability cannot access Firestore directly and cannot receive mutation tools.

**Data inputs**

- Canonical project state and selected state history.
- Deterministic priority and recommendation results with their reasons.
- Approved timeline, blocker, workload, and company-health summaries.
- Capability policy and Founder question.

**Outputs**

- Structured advisory explanation, risks, opportunities, rationale, confidence or uncertainty, cited input references, and suggested Founder questions.

**Approval requirements**

- Founder approval before saving an explanation beyond the approved transient retention window.
- Separate explicit confirmation for any later deterministic workflow action inspired by the advice.

**Test requirements**

- Grounding, input-citation, uncertainty, contradiction, stale-context, prompt-injection, data-minimization, cost-limit, and no-mutation tests.
- Tests proving deterministic recommendation values remain unchanged by AI availability or output.

**Founder validation requirements**

- Confirm explanations are useful, traceable, non-duplicative, and clearly advisory.
- Confirm low-confidence or unsupported reasoning is labeled or rejected.
- Confirm accepting or dismissing advice does not silently change canonical state.

**Release gate requirements**

- Complete the four gates independently from the AI/CIO governance foundation.
- Independent review must verify grounding, no-mutation behavior, prompt-injection resistance, and deterministic fallback.

### Release 4.3 — AI Research Analyst

**Purpose**

Support controlled-source research with citations, source provenance, unsupported-claim prevention, and Founder review before persistence.

**Allowed actions**

- Research within an approved source allowlist and query scope.
- Extract and summarize source-backed facts.
- Attach citations, retrieval time, source identity, and verification status to each material claim.
- Produce a draft Research artifact for Founder review.

**Prohibited actions**

- Unrestricted browsing, hidden sources, uncited material claims, or fabricated support.
- Treating source text as executable instructions.
- Persisting research as approved knowledge without Founder review.
- Substituting one project's research or sources into another project.
- Direct workflow advancement.

**Security boundary**

External retrieval occurs through a server-side, allowlisted research boundary separate from the browser and from canonical persistence. Retrieved content is untrusted data and must be isolated from system instructions, credentials, and privileged tools.

**Data inputs**

- Approved research question, project ID, source policy, and allowed domains or repositories.
- Retrieved source content and metadata.
- Existing project-scoped Research Package context when approved.

**Outputs**

- Structured draft claims, citations, provenance, unsupported or conflicting information, confidence, source coverage, and recommended follow-up.

**Approval requirements**

- Founder approval of source policy before execution.
- Founder review and explicit approval before any research output is persisted as a durable artifact or used to advance work.

**Test requirements**

- Source-allowlist, redirect, SSRF, prompt-injection, citation-binding, unsupported-claim, conflicting-source, unavailable-source, project-ownership, retention, and persistence-approval tests.

**Founder validation requirements**

- Confirm every material claim is traceable to a usable source or clearly marked unsupported.
- Confirm conflicting and missing evidence is surfaced rather than resolved by invention.
- Confirm rejected research is not persisted or substituted across projects.

**Release gate requirements**

- Complete all four gates.
- Independent review must cover retrieval security, source provenance, citation integrity, unsupported-claim handling, project scoping, and approval-before-persistence.

### Release 4.4 — AI Editorial Team

**Purpose**

Provide three governed editorial roles—Content Strategist, Production Editor, and Managing Editor—that create versioned, structured draft artifacts for Founder review.

**Allowed actions**

- **Content Strategist:** propose audience, angle, structure, distribution considerations, and content requirements from approved inputs.
- **Production Editor:** produce or revise a working draft against an approved Outline and source-backed Research.
- **Managing Editor:** evaluate a draft against defined editorial, evidence, brand, and readiness checklists.
- Produce new versioned draft artifacts with role, inputs, provenance, and change summaries.

**Prohibited actions**

- Autonomous approval, publishing, lifecycle advancement, or public-site mutation.
- Inventing sources or treating unsupported claims as verified.
- Overwriting prior artifact versions or editing another project's artifacts.
- Bypassing the approved Research, Outline, Production, Review, or Founder approval sequence.

**Security boundary**

Each editorial role is a separate capability contract behind the future AI/CIO gateway. Roles receive only approved, project-scoped artifacts and expose no direct persistence or publishing tool. Deterministic services own version creation and persistence after approval.

**Data inputs**

- Project-scoped approved Research and Outline artifacts.
- Current Production draft and version history when authorized.
- Editorial checklist, brand guidance, audience, format, and approved source evidence.

**Outputs**

- Structured strategy, draft, or editorial-review artifact.
- Version, role, input references, citations, change summary, checklist results, unresolved issues, and recommended next step.

**Approval requirements**

- Founder approval before persisting a generated artifact version.
- Founder-controlled deterministic action before Review, approval, or publishing.
- Explicit reapproval after material regeneration or revision.

**Test requirements**

- Role-boundary, artifact-ownership, versioning, overwrite prevention, source-grounding, unsupported-claim, stale-input, cost-limit, prompt-injection, approval, and no-publish tests.

**Founder validation requirements**

- Confirm each role is understandable and stays within its editorial responsibility.
- Confirm version history, citations, unresolved issues, and change summaries remain visible.
- Confirm no generated draft becomes approved or public without explicit Founder action.

**Release gate requirements**

- Complete all four gates.
- Independent review must verify role separation, artifact versioning, project ownership, approval boundaries, and absence of autonomous publishing.

### Release 4.5 — Executive Voice

**Purpose**

Add a realtime voice interface to already approved Headquarters capabilities after the governance foundation is complete.

**Allowed actions**

- Stream audio through an approved Realtime API architecture.
- Transcribe Founder speech and read back authorized, non-sensitive responses.
- Propose calls to a narrow allowlist of approved tools.
- Ask for explicit confirmation before any privileged or persistent action.
- Record retention-controlled transcript and audit metadata according to approved policy.

**Prohibited actions**

- Direct privileged actions without confirmation.
- Background listening, undeclared recording, unrestricted tool access, autonomous approval, or publishing.
- Exposure of provider credentials or protected data through client logs, transcripts, or audio responses.
- Implementation before the future AI/CIO governance foundation is complete and released.

**Security boundary**

Voice is an interface to approved tools, not an authorization mechanism. The server validates identity, session, tool allowlist, confirmation state, data minimization, cost policy, and transcript retention before any action proceeds.

**Data inputs**

- Authenticated realtime session, audio frames, language and accessibility settings.
- Approved tool schemas, minimal authorized context, confirmation state, and cost policy.

**Outputs**

- Streaming transcript and audio response.
- Proposed tool call, confirmation prompt, final tool outcome, cost and token or audio usage, and audit metadata.

**Approval requirements**

- Founder approval of realtime provider, audio-data policy, retention, consent experience, cost ceilings, tool allowlist, and confirmation language.
- Explicit per-action confirmation for privileged, persistent, approval, or externally visible actions.

**Test requirements**

- Authentication, session isolation, consent, interruption, transcript accuracy, accidental activation, replay, tool-allowlist, confirmation, cancellation, cost-limit, timeout, retention, redaction, and no-autonomous-action tests.

**Founder validation requirements**

- Confirm recording state and consent are always clear.
- Confirm interruptions, corrections, cancellations, and confirmations behave predictably.
- Confirm voice cannot bypass typed-interface authorization or approval requirements.
- Confirm transcript and cost controls are understandable and controllable.

**Release gate requirements**

- The future AI/CIO governance foundation must already be released and independently verified.
- Voice requires its own threat model and all four gates.
- Independent review must cover realtime session security, consent, transcript handling, tool confirmation, data egress, and cost controls.

## Sequence Governance

EO-050 through EO-054 are deterministic Release 3.2 orders, not AI/CIO orders. Each future Release 4 AI/CIO capability requires its own approved Engineering Order and bounded branch. A later capability may depend on a released earlier capability, but planning approval does not authorize implementation. Executive Voice remains deferred until the AI/CIO governance foundation is complete. None of this future sequencing blocks the deterministic EO-046 through EO-049 Knowledge Graph or deterministic Founder-Simple implementation. No capability may weaken the Release 2 lifecycle, authorization, persistence, Founder approval, or audit standards.
