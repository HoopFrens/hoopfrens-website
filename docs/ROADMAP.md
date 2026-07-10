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
| Release 2 | In review | EO-025 through EO-045 are approved and complete in engineering; authenticated Founder validation remains before merge. |
| Release 3 | Planned | Knowledge operations and source-aware intelligence foundation. |
| Release 4 | Planned | Governed AI assistance built on the deterministic operating model. |

The current development focus is Release 2.4 pull-request review and authenticated Founder validation. No Release 3 or Release 4 scope should begin without an approved Engineering Order.

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

## 5. Release 2 - In Review

Release 2 makes Headquarters persistent and state-aware.

| Engineering Order | Capability | Status |
| --- | --- | --- |
| EO-021 | Executive Intelligence foundation | Implemented; review pending |
| EO-022 | Viewport and composer layout | Implemented; review pending |
| EO-023 | Conversation activity alignment | Implemented; review pending |
| EO-024 | Executive Office final visual polish | Implemented; review pending |
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

EO-025 through EO-045 are approved and complete for the Release 2.4 commit. Authenticated Founder validation and pull-request review remain required before merge.

## 6. Release 3 - Planned

Release 3 is the Knowledge Operations phase. Its direction is to make basketball intelligence durable, source-aware, and connected to projects.

Planned outcomes:

- Persisted Knowledge, Source, People, and Organization records.
- Verification status and source provenance applied consistently.
- Project-to-knowledge relationships available through repository boundaries.
- Intelligence Center workflows defined through future Engineering Orders.
- Executive intelligence grounded in approved internal records.

Detailed scope, workflows, and acceptance criteria remain subject to future Engineering Orders.

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

State changes are explicit and deterministic. Review and approval are separate states, and Founder approval is required before work moves beyond the approval boundary.

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
