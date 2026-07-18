# Headquarters Product Roadmap

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
| Release 3 | In progress | Release 3.1 Capability 1, the deterministic Knowledge Graph foundation, is implemented, Founder validated, and ready for its final commit and pull request; EO-050 and AI implementation have not started. |
| Release 4 | Planned | Governed AI assistance built on the deterministic operating model. |

Release 2.4 is complete. Release 3.1 Knowledge Graph work is limited to approved EO-046 through EO-049 and is implemented, Founder validated, and awaiting its final commit and pull request. EO-050, AI reasoning, and Release 4 implementation have not started and require separately approved Engineering Orders.

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

## 6. Release 3 - In Progress

Release 3 is the Executive Reasoning planning phase. Its Knowledge Operations direction remains to make basketball intelligence durable, source-aware, and connected to projects; implementation remains subject to the approved architecture and capability sequence.

### Release 3.1 Capability Status

- **Release 3:** In progress within EO-046 through EO-049 only
- **Release 3.1 Capability 1:** Ready for final commit and pull request
- **Knowledge Graph foundation:** Implemented and verified
- **Founder functional validation:** Complete, including post-remediation reopening, editing, saving, refresh persistence, readability, and console-health confirmation for the actual Ashland University Athletics Source and Ashland University School records
- **EO-050 / CIO capability:** Not started
- **AI implementation:** Not started

| Engineering Order | Capability | Status |
| --- | --- | --- |
| EO-046 | Knowledge Graph Foundation | Ready for final commit and pull request |
| EO-047 | School Intelligence | Ready for final commit and pull request |
| EO-048 | Knowledge Explorer | Ready for final commit and pull request |
| EO-049 | Knowledge Relationships | Ready for final commit and pull request |

Release 3 direction beyond Capability 1:

- Persisted Knowledge, Source, People, and Organization records.
- Verification status and source provenance applied consistently.
- Project-to-knowledge relationships available through repository boundaries.
- Intelligence Center workflows defined through future Engineering Orders.
- Executive intelligence grounded in approved internal records.

Additional Release 3 scope beyond EO-046 through EO-049 remains subject to future approved Engineering Orders.

EO-046 through EO-049 are implemented for review as a deterministic, protected foundation: canonical nodes, relationships, sources, confidence, School Intelligence, Firestore repositories, integrity checks, audit history, and the Knowledge Center Explorer at `/executive-workspace/knowledge`. The P1 integrity remediation adds strict calendar-date validation, rule-enforced canonical history maps and linked audit shape, transactional uniqueness/provenance/archive guards, and staged in-memory subject-and-audit atomicity. Automated and emulator verification is complete for the remediation.

The Founder functional session with populated protected data occurred before the integrity remediation, and fixture-backed Ashland tests demonstrate representative legacy compatibility. Post-remediation Founder validation confirmed that the actual Founder-created Ashland University Athletics Source record and the actual Founder-created Ashland University School record were reopened successfully. Both records were edited and saved, refresh persistence passed, both records remained readable, and no runtime or browser-console errors were observed. Live relationship records were not separately revalidated and are not included in this confirmation. EO-046 through EO-049 are ready for their final commit and pull request. Automated imports, AI reasoning, external search, and CIO behavior are not included.

Remaining technical debt is explicit. Accepted P2 debt includes aggregate-registry document-size and contention limits, repository-derived audit semantics, the approved-admin direct-client trust boundary, and qualified legacy reconstruction; registries require sharding before scale makes their limits material. Privileged Firebase Admin SDK or Console access bypassing Firestore rules remains an accepted P3 operational boundary governed by project IAM and operational controls.

## 7. Release 4 - Planned

Release 4 is the governed AI assistance phase. Production AI may be introduced only after deterministic workflows and trusted data foundations are approved.

Planned outcomes:

- AI-assisted intent interpretation behind the existing Intent Engine contract.
- AI-assisted research, synthesis, and recommendations using verified sources.
- Clear confidence, provenance, and Founder review requirements.
- Observability, cost controls, failure handling, and auditability.
- Deterministic fallback behavior for critical workflows.

No AI provider, model, automation policy, or production workflow is approved by this roadmap alone.

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
- [Architecture Decisions](./architecture-decisions/ADR-001-executive-workspace.md)

## Documentation Governance

Beginning with EO-028, every approved Engineering Order must update this roadmap when milestone scope, status, sequencing, or completion changes. The same order must update the [Decision Log](./DECISIONS.md) when it changes a product or architecture decision.
