# Founder-Simple Headquarters

## Status

Release 3.2 is a deterministic Founder-Simple Headquarters capability. EO-050 through EO-054 are **Engineering Complete with all P1 remediation applied**. **Founder Validation, including the targeted post-remediation repeat using the existing Malone University Version 2, passed.** Final Independent Review passed with zero P0 and zero P1 findings. Founder authorization for the commit, pull request, and conditional merge workflow is granted; required pull-request checks and the merge remain pending.

This capability does not authorize AI, external APIs, external search, autonomous employees, public-site changes, automated publishing, or EO work beyond EO-054.

## Founder Simplicity Principle

The Founder should never be required to understand nodes, relationships, repositories, schemas, canonical records, or internal IDs to accomplish routine Hoop Frens work. Headquarters must translate business intent into system actions and expose technical concepts only when explicitly requested.

The primary Founder experience is:

`Request -> Review -> Customize -> Approve`

This is an experience model, not a replacement for the canonical project lifecycle. Headquarters must continue enforcing:

`Draft -> Research -> Outline -> Production -> Review -> Approved -> Published -> Archived`

The Founder expresses the outcome, reviews sourced facts, corrects or excludes information, customizes the deliverable, and explicitly approves it. Headquarters derives technical values, validates prerequisites, preserves provenance, and explains missing information in plain business language.

## Product Boundaries

### Included in the initial Release 3.2 engineering scope

- Founder-Simple navigation and a clear quick-action entry point.
- A guided Add School workflow.
- A School Spotlight request wizard.
- A verified-information review screen.
- Deterministic, manual School Spotlight package assembly.
- Platform and Hoop Frens brand customization for the initial approved outputs.
- Durable autosaved workflow drafts.
- Explicit Founder approval after canonical lifecycle requirements are satisfied.
- Plain-language errors, missing-information requests, and disabled-action explanations.

### Not included

- AI generation, inference, summarization, or recommendations.
- OpenAI or any other model provider.
- Web search, automated source collection, or external APIs.
- Autonomous mutation, approval, publishing, or employee behavior.
- File or media uploads.
- Direct social-platform publishing or scheduling.
- Public-site changes.
- A redesign of the released Knowledge Graph.
- Automatic creation of unsupported School facts.
- Review or Publishing Package implementations.

## Recommended Navigation

Routine navigation should use business language and keep implementation surfaces available through progressive disclosure.

| Primary destination | Founder purpose | Existing system connection |
| --- | --- | --- |
| Today | Understand changes, priorities, health, and the best next action | Executive Office and Founder Daily Brief |
| Create | Start Add School, School Spotlight, Facility Tour, Coach Feature, Player Feature, Recruiting Guide, or Social Campaign work | Intent, project, knowledge, and service boundaries |
| Work | Continue active projects and understand status | Project Workspace |
| Intelligence | Find Schools, people, facilities, sources, and connected work | Knowledge Center read and guided-action views |
| Review & Approve | Review new intelligence and approve lifecycle-eligible content | Knowledge integrity and canonical project lifecycle |
| Library | Reopen approved packages, assets, and completed reference material | Library workspace |

Strategy Room, Product Lab, Production Studio, the full Knowledge Center Explorer, and other technical maintenance surfaces remain available under an Advanced or workspace switcher affordance. They are not removed or renamed at the domain level.

## Opening Executive Brief

The Founder-Simple opening screen should contain:

- `Good morning, Antwone`.
- Changes since the prior durable Founder visit.
- New School and Coach intelligence.
- Content opportunities grounded in canonical records.
- Items waiting for Founder review.
- Recommended work for today.
- Quick-create actions.
- A concise company-health summary.

Each recommendation must identify:

- what it is;
- why it matters;
- estimated Founder time; and
- the next deterministic action.

The brief must not manufacture changes, urgency, opportunities, or completion. Empty states should state plainly that no supported item is available.

## Primary Founder Actions

| Action | Founder goal | Simplest entry | Headquarters derives | Founder confirms | Output | Missing-information behavior |
| --- | --- | --- | --- | --- | --- | --- |
| Add School | Add a trustworthy School record | School name plus one verified source | IDs, timestamps, state-region consistency, provenance, and eligible connections | Source details and sourced School facts | Canonical School and approved connections | Preserve the draft and request only the missing required evidence |
| Build School Spotlight | Prepare a multi-platform School feature | Select a School and one or more goals | Existing verified facts, connected records, project context, and source package | Goals, audiences, platforms, emphasis, media availability, facts, brand choices, and approval | Versioned `SchoolSpotlightPackage` | Mark unsupported facts unavailable and keep the project editable |
| Build Facility Tour | Prepare a facility-centered package | Select School or Facility | Verified facility facts and School connection | Facility, available media, emphasis, and selected facts | Facility Tour request/package | Ask for a verified Facility record or source; do not infer one |
| Create Coach Feature | Prepare a Coach profile | Select School or Coach | Verified Coach-School connection and source-backed facts | Subject, angle, facts, media, and CTA | Coach Feature request/package | Surface missing or conflicting Coach evidence |
| Create Player Feature | Prepare a Player profile | Select Player | Verified Player-School connection and available facts | Subject, objective, facts, media, and CTA | Player Feature request/package | Keep unsupported biographical claims excluded |
| Compare Schools | Compare source-backed School information | Select two or more Schools | Comparable verified fields and evidence status | Comparison purpose and included criteria | Deterministic comparison package | Show unavailable or non-comparable fields without inventing parity |
| Build Recruiting Guide | Prepare an informational guide | Select School, region, or approved scope | Verified School, division, location, facility, and recruiting facts | Audience, scope, emphasis, and CTA | Recruiting Guide request/package | Separate sourced facts from Founder-authored advice |
| Create Social Campaign | Repackage approved material | Select an approved package | Eligible platform formats, asset availability, and brand defaults | Platforms, timing intent, tone, CTA, and selected content | Editable campaign plan | Identify missing assets; do not publish, schedule, or call platform APIs |
| Review New Intelligence | Resolve new or changed knowledge | Open the review queue | Changed claims, evidence status, conflicts, and affected records | Accept, correct, exclude, or defer | Reviewed deterministic knowledge action | Preserve disagreement and request stronger evidence |
| Approve Content | Approve a lifecycle-eligible deliverable | Open the approval queue | Current project state, active package version, readiness, and unresolved issues | Explicit approval or revision request | Existing canonical approval transition | Explain disabled approval and the next required action |

Only Add School and School Spotlight are part of EO-050 through EO-054. The remaining actions describe the product structure and require later approved Engineering Orders.

## Structured School Spotlight Request

The School Spotlight request captures Founder intent through structured, plain-language selections in this order:

1. **What should this Spotlight accomplish?** The Founder selects one or more goals: Introduce the school, Showcase basketball facilities, Explain the basketball program, Highlight the student-athlete experience, Help recruits evaluate the school, Correct a misconception, Promote a specific strength, Tell a unique school story, Increase awareness, or Other. `Other` reveals a description field. The optional `Anything else Headquarters should know?` field preserves additional context without inventing a goal.
2. **Who should it reach?** At least one audience is required: Players, Parents and families, High school coaches, College coaches, Recruits, Current students, Alumni, Basketball fans, or Other. `Other` reveals a description field.
3. **Where will it be used?** The available selections remain Instagram Reel, TikTok, and YouTube Short. Platform choices determine where the same shared vertical-video plan may be used; they do not publish, schedule, upload, or create three independently generated packages.
4. **What should viewers remember most?** The Founder may choose one primary emphasis: Facilities, Basketball program, Coaching staff, Academic opportunities, Campus experience, Location, Recruiting opportunity, Player development, Affordability, School culture, or Other. `Other` reveals a description field. `Add a more specific angle` is optional. The interface explains: `Choose the main idea the audience should remember after seeing the Spotlight.`
5. **What media is available?** The Founder may select School-provided photos, Campus photos, Gym or facility photos, Game footage, Practice footage, Player photos, Coach photos, Logos, No media yet, or Other. Selecting `No media yet` clears conflicting specific-media choices, and selecting a specific type clears `No media yet`. `Other` reveals a description field. `Describe the media you already have` is optional, and `I need a shot list` records the Founder’s planning preference. The interface explains: `The Spotlight package will include a recommended photo and video shot list.` These controls describe media availability only; they do not upload files.
6. The existing call-to-action choice remains in the flow after the structured request fields.

New drafts store these selections structurally so search, validation, resume, and deterministic package assembly do not depend on parsing prose. Existing drafts remain readable: recognized legacy objective, audience, emphasis, and comma-separated media wording is mapped into the structured controls, while unmatched wording is preserved visibly through `Other` or legacy context. Compatibility never discards or silently rewrites Founder-authored text.

## Progressive Disclosure Rules

1. Routine screens lead with the Founder goal and next decision, not the storage model.
2. Required information appears before optional information.
3. Advanced source, confidence, history, relationship, and internal identifiers remain collapsed by default.
4. Verification is summarized in plain language while the exact canonical source remains inspectable.
5. A required technical value should be derived when the canonical record already determines it.
6. The Founder should never copy an internal ID between forms.
7. Disabled actions include a visible reason and the next valid action; hover alone is insufficient.
8. Errors use a Founder-facing summary. Raw Firestore, repository, and validation details stay out of the primary message.
9. Autosave applies to workflow drafts. It must not create partial canonical Sources, nodes, relationships, projects, or packages.
10. A final review shows the exact records and deterministic actions that will occur before the Founder confirms.
11. Accessibility information, source evidence, and audit history must remain reachable even when advanced details are collapsed.

## Founder-Friendly Terminology

| Internal or advanced term | Routine Founder label |
| --- | --- |
| Create Node | Add School / Add Person / Add Facility |
| Create Relationship | Connect School Information |
| Knowledge Node | School, Coach, Facility, or other business noun |
| Knowledge Relationship | Connection |
| Canonical Source | Verified Source |
| Provenance | Why We Trust This |
| Confidence enum | Verification Status |
| Verified | Verified |
| Supported | Supported by Sources |
| Inferred | Needs Confirmation |
| Unverified | Not Yet Verified |
| Conflicting | Sources Disagree |
| Archive | Move to Archive |
| Repository error | Headquarters could not save this yet |
| Integrity warning | Information Needs Attention |
| Project lifecycle transition | Next Step |
| Production readiness | Ready for Founder Review |

The underlying domain names remain unchanged. Plain labels must not alter the meaning of confidence, status, provenance, or lifecycle policy.

## Durable Founder-Simple Records

Release 3.2 implements two protected internal business objects, defined by [ADR-006](./architecture-decisions/ADR-006-founder-workflow-drafts-and-spotlight-packages.md):

- `FounderWorkflowDraft` stores an authenticated Founder’s incomplete guided-workflow progress without creating incomplete canonical records.
- `SchoolSpotlightPackage` is a compatible `ProductionPackage` subtype stored and versioned through the existing `internalProductionPackages` collection and repository. It stores deterministic School Spotlight selections, platform sections, source references, customization, unresolved items, readiness, and approval state.

`FounderWorkflowDraft` records persist in `internalFounderWorkflowDrafts` and are readable or writable only by their authenticated approved-admin owner. `SchoolSpotlightPackage` nested facts, evidence, content, request, customization, delivery, and rights data are validated in protected `internalSchoolSpotlightPackage*` integrity records before a noncanonical staged package is atomically activated and linked to its project. Both record shapes have runtime validation, repository coverage, and Firestore boundary enforcement.

School Spotlight draft requests preserve structured goals, audiences, platforms, primary emphasis, optional specific angle, media availability, optional media descriptions, shot-list preference, and CTA. Legacy freeform request values remain compatibility data and are projected into the structured experience without losing unmatched Founder wording. Draft-only autosave remains owner-scoped and noncanonical; it cannot create or modify a Source, School, project, or package until the Founder reaches the corresponding explicit approved action.

Founder confirmation in Add School invokes one `KnowledgeGraphRepository.createSchoolBundle` operation. Its Firestore implementation commits the verified Source, canonical State and Region reuse or creation, School, both geography relationships, provenance registries, and immutable audit events in one transaction. The in-memory implementation stages the same complete result before one state replacement. A failed or retried confirmation therefore cannot leave a partial canonical School bundle.

## Engineering Order Sequence

| Engineering Order | Capability | Planned outcome | Status |
| --- | --- | --- | --- |
| EO-050 | Founder-Simple Foundation | Principle, navigation, action catalog, shared guided-flow shell, terminology, progressive disclosure, and durable draft boundary | Ready to commit; Founder Validation and Independent Review passed |
| EO-051 | Guided Add School | Source-backed guided creation with derived state/region and no exposed IDs or duplicate authoring | Ready to commit; Founder Validation and Independent Review passed |
| EO-052 | School Spotlight Request and Verified Information Review | Request wizard, canonical School selection, deterministic fact resolution, and include/correct/exclude review | Ready to commit; Founder Validation and Independent Review passed |
| EO-053 | Deterministic School Spotlight Package | Versioned initial package with one reusable vertical-video plan, Instagram caption, photo/video shot list, source and verification package, and unresolved-information handling | Ready to commit; Founder Validation and Independent Review passed |
| EO-054 | Founder Customization and Approval | Tone/platform/brand customization, version review, revision, readiness explanation, and explicit existing-lifecycle approval | Ready to commit; Founder Validation and Independent Review passed |

EO-050 through EO-054 form the completed engineering batch for one Founder-visible path without AI or external APIs. EO-053 supports only one vertical-video package usable for Instagram Reel, TikTok, and YouTube Short; one Instagram caption; one photo/video shot list; and one source and verification package. Additional platform outputs remain future scope. Engineering completion does not waive Founder validation, independent review, or merge approval.

EO-055 has not started and is not authorized by this batch.

## Founder Validation Record

Targeted post-remediation Founder Validation reused the existing Malone University School Spotlight Version 2. `Request -> Review -> Customize -> Approve` remained functional, and the exact approved Version 2 remained readable after refresh. No duplicate School, project, workflow draft, or package was created. Approval did not publish, schedule, upload, or externally send content. No new browser-console or runtime errors were observed, and the deployed Firestore rules were confirmed active. Final Independent Review passed with zero P0 and zero P1 findings.

## Release 4 and Future Autonomy

Future governed AI/CIO work belongs to Release 4 and remains blocked by the decisions in [`RELEASE_3_1_DECISION_PACKAGE.md`](./RELEASE_3_1_DECISION_PACKAGE.md), despite that file’s historical name. Release 4 may assist with explanation, research, or editorial drafting only behind approved governance and deterministic service boundaries.

Autonomous employee behavior is a later, separately governed release. It is not part of Release 3.2 or authorized by this capability. AI or autonomous systems may not approve, publish, alter authorization, bypass lifecycle rules, or silently persist output.

## Release 3.2 Gate Status

- The Founder Simplicity Principle is recorded consistently in product and architecture documentation.
- Release 3.2 and EO-050 through EO-054 are Engineering Complete; targeted post-remediation Founder Validation and final Independent Review passed with zero P0 and zero P1 findings.
- Release 4 AI/CIO work remains separate and pending governance approval.
- Routine navigation and all ten primary Founder actions are defined in business language.
- Add School and School Spotlight have bounded deterministic implementations.
- The School Spotlight request uses structured multi-select goals and audiences, an explicit primary emphasis, and structured media availability while preserving legacy drafts losslessly.
- The School Spotlight platform matrix and complete screen flow are documented.
- Autosave persists in `internalFounderWorkflowDrafts` and remains separated from canonical Knowledge persistence.
- The existing Knowledge Graph, authorization boundary, project lifecycle, package history, and Founder approval controls remain authoritative.
- No upload, direct publishing, scheduling, external provider, external search, AI, EO-055 work, or public-site change is implied.

## Risks of Overbuilding

- Implementing all ten actions before validating one complete School Spotlight journey.
- Rebuilding the Knowledge Graph instead of placing a guided Founder experience above it.
- Creating a second project lifecycle or approval model.
- Treating deterministic template assembly as generated or verified prose.
- Autosaving incomplete forms into canonical collections.
- Introducing Review or Publishing Packages by implication.
- Hiding evidence so completely that the Founder cannot understand why a fact is trusted.
- Adding social publishing integrations while only draft formatting is approved.
- Expanding into bulk ingestion before the Knowledge Graph uniqueness registries are designed for higher scale.
- Letting engineering-complete language imply Founder validation, independent review, merge approval, or release completion.
