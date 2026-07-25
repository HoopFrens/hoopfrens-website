# School Spotlight Founder Workflow

## Status and Purpose

This document defines the implemented deterministic School Spotlight experience for EO-052 through EO-054. Engineering is complete with all P1 remediation applied. Founder Validation, including the targeted post-remediation repeat using the existing Malone University Version 2, passed. Final Independent Review passed with zero P0 and zero P1 findings; required pull-request checks and the merge remain pending.

The workflow turns verified Headquarters information into an editable, Hoop Frens-branded content package without AI, external search, external APIs, automated publishing, or unsupported facts.

The Founder experience is:

`Request -> Review -> Customize -> Approve`

The canonical project lifecycle remains authoritative underneath this experience.

## Founder Goal

Prepare a useful, accurate, platform-specific School Spotlight that can support Hoop Frens social, video, and website production while preserving sources, missing-information states, edit history, and explicit Founder approval.

The experience should match the practical usefulness of strong school and facility content creators while remaining original to Hoop Frens positioning, voice, and visual identity. It must not copy another creator’s language, identity, or protected content.

## Screen-by-Screen Journey

### 1. Request a School Spotlight

The entry screen asks only:

- Which School?
- What should this Spotlight accomplish?
- Who should it reach?
- Where will it be used?

The Founder may select an existing School or choose Add School. Search results use School names and familiar location labels, never internal IDs.

Headquarters should derive:

- canonical School identity;
- current verified School facts;
- connected Conference, Coach, Facility, Project, and Content records;
- existing active School Spotlight project or draft, when one exists;
- verification status and source availability; and
- sensible platform and Hoop Frens brand defaults.

Starting the flow creates or resumes a `FounderWorkflowDraft`. It does not create partial canonical knowledge or silently advance a project.

### 2. Define the Outcome

The form uses progressive disclosure and asks for business intent in this order:

1. **What should this Spotlight accomplish?** This required multi-select includes Introduce the school, Showcase basketball facilities, Explain the basketball program, Highlight the student-athlete experience, Help recruits evaluate the school, Correct a misconception, Promote a specific strength, Tell a unique school story, Increase awareness, and Other. Choosing `Other` reveals an explanation field. `Anything else Headquarters should know?` is an optional textarea. Headquarters never supplies an unselected goal.
2. **Who should it reach?** This required multi-select includes Players, Parents and families, High school coaches, College coaches, Recruits, Current students, Alumni, Basketball fans, and Other. Choosing `Other` reveals an explanation field. At least one audience is required before continuing.
3. **Where will it be used?** The existing platform selections remain Instagram Reel, TikTok, and YouTube Short. These selections determine where the shared vertical-video plan may be used. They do not publish, schedule, upload, or generate a separate package for each platform.
4. **What should viewers remember most?** The primary-emphasis choices are Facilities, Basketball program, Coaching staff, Academic opportunities, Campus experience, Location, Recruiting opportunity, Player development, Affordability, School culture, and Other. Choosing `Other` reveals an explanation field. `Add a more specific angle` is optional. The helper text is: `Choose the main idea the audience should remember after seeing the Spotlight.`
5. **What media is available?** This multi-select includes School-provided photos, Campus photos, Gym or facility photos, Game footage, Practice footage, Player photos, Coach photos, Logos, No media yet, and Other. Selecting `No media yet` clears conflicting specific-media choices, and selecting a specific media type clears `No media yet`. Choosing `Other` reveals a description field. `Describe the media you already have` is optional. `I need a shot list` remains visible, with the helper: `The Spotlight package will include a recommended photo and video shot list.` Media choices describe availability only and never upload a file.
6. The existing call-to-action control follows these request fields.

Tone, length, hook direction, and other brand customization remain in the later Customize step. Defaults may come only from approved Hoop Frens settings and must remain visible and editable. Technical enum keys are never shown.

New drafts store goals, audiences, platforms, primary emphasis, optional specific angle, media availability, optional descriptions, shot-list preference, and CTA as structured values. Existing freeform drafts remain readable: recognized legacy phrases map into the matching selections, comma-separated media values remain available, and unmatched Founder wording is preserved visibly through `Other` or legacy context rather than discarded.

### 3. Review Verified Information

Headquarters groups source-backed information into plain sections such as:

- School identity and nickname;
- location and approved Hoop Frens region;
- division and governing body;
- Conference;
- Coaches;
- Facilities;
- enrollment and tuition when verified;
- recruiting notes;
- official School and athletics links; and
- connected Hoop Frens projects or content.

Each fact shows:

- the fact in plain language;
- a human-readable Verification Status;
- `Why We Trust This` with the source title and publisher;
- last verified or accessed time when useful; and
- Include, Exclude, or Correct controls.

Corrections with canonical verified evidence remain source-backed. Founder wording entered without new canonical evidence is explicitly labeled Founder-authored in the exact package and is not presented as verified or used to overwrite canonical knowledge. A correction must not silently overwrite verified knowledge from a weaker source. Conflicting evidence remains visible as `Sources Disagree`.

Unsupported information displays:

`Not available from verified sources.`

The Founder may continue with that fact excluded or pause and add supporting information. Headquarters never fills the gap by guessing.

### 4. Review the Content Plan

Before assembly, Headquarters presents a deterministic outline containing:

- selected goals and audiences;
- selected platforms;
- primary emphasis and optional specific angle;
- selected verified facts;
- excluded and unavailable facts;
- proposed platform sections;
- described photo/video availability and shot-list preference;
- missing media or verification needs;
- source coverage; and
- next required action.

The Founder confirms the plan or returns to edit it. This confirmation does not equal project approval or publication.

### 5. Customize the Package

The Founder can adjust:

- Hoop Frens tone preset;
- platform selection;
- length;
- hook template;
- fact order and emphasis;
- media placement;
- CTA;
- included captions, cards, and script sections; and
- Founder-authored wording.

Deterministic templates may arrange selected facts and placeholders. They must not create new factual claims, fabricate quotations, or present an unsupported narrative as verified.

### 6. Assemble the Package

Headquarters creates a versioned `SchoolSpotlightPackage`, implemented as a compatible `ProductionPackage` subtype and stored through the existing `internalProductionPackages` repository, containing:

- package and project identity;
- selected canonical School and source references;
- goals, audiences, platforms, tone, length, hook, primary emphasis, optional specific angle, media availability, and CTA;
- selected, excluded, unavailable, and conflicting facts;
- platform-specific sections;
- photo and video shot list;
- media and production checklist;
- source and verification package;
- unresolved items;
- active version and prior-version history; and
- readiness and approval information.

The package is a deterministic internal draft. It is not a Review Package, Publishing Package, public-site article, social post, or published asset.

Media descriptions and shot-list choices are planning metadata. The workflow has no file-upload, social-upload, scheduling, or publishing integration.

Before activation, Firestore validates the supported nested facts, evidence, content, request, customization, delivery, rights, checklist, ownership, and linkage shape in protected `internalSchoolSpotlightPackage*` integrity records. The content rules enforce exact per-scene keys and string field types for every supported vertical-video scene position. The package header is initially noncanonical `staged` data. One transaction then activates that exact package, links it to the project, and supersedes the prior active version. Normal review lookup never returns a staged package.

### 7. Edit and Compare Versions

The Founder may edit wording, selections, ordering, branding, platform choices, and media plans. Material edits create a new version and preserve the prior version.

The review screen identifies:

- what changed;
- which facts and sources are included;
- unresolved or unavailable information;
- missing required production items;
- current lifecycle state;
- whether Founder Review is available; and
- the next valid action when it is not.

### 8. Approve or Request Revision

Approve is enabled only when the existing canonical lifecycle policy permits approval. The Founder may:

- approve the active package through the existing workflow action;
- request revision; or
- return to customization.

Approval does not publish anything. Direct publishing, scheduling, platform APIs, and public-site mutation remain outside Release 3.2.

## Canonical Lifecycle Mapping

| Founder step | Canonical behavior |
| --- | --- |
| Request | Autosaves `FounderWorkflowDraft`; creates or resumes a School Spotlight project only through an explicit deterministic action |
| Review | Reads canonical knowledge and supports explicit Research and Outline actions without skipping prerequisites |
| Customize | Produces an active versioned `SchoolSpotlightPackage` while preserving project and package history |
| Approve | Uses the existing Review-to-Approved Founder action only after production readiness and lifecycle prerequisites pass |

The interface may simplify labels, but it may not hide a failed prerequisite, perform an invalid transition, or maintain a parallel project status.

## Initial EO-053 Output Matrix

| Output | Deterministic package structure | Required Founder choices | Media requirements | Approval behavior |
| --- | --- | --- | --- | --- |
| Vertical-video package for Instagram Reel, TikTok, and YouTube Short | One reusable hook, short scene sequence, on-screen fact cards, voiceover placeholders, adaptation notes, and CTA | Tone, length, hook, selected facts, emphasis, CTA | Vertical video or shot plan | Internal editable draft only |
| Instagram caption | Hook, selected fact blocks, Founder-authored transitions, CTA | Tone, length, facts, CTA | Optional image selection | Internal editable draft only |
| Photo and video shot list | Required, optional, and missing shots organized by platform | Available media, location access, priorities | Media inventory | Production planning only |
| Source and verification package | Included claims mapped to canonical source records and verification state | Included/excluded claims | None | Remains internal and inspectable |

Platform templates define structure, labels, constraints, and placeholders. They do not generate original prose through AI. Founder-authored text and deterministic text fragments must remain distinguishable from verified factual fields.

## Future Output Matrix

The complete product direction may later add an Instagram carousel, X post or thread, Facebook post, longer YouTube script, and website spotlight article. Those outputs are not part of EO-053 or the initial Release 3.2 implementation and require later approved scope. The initial vertical-video package may be adapted manually for Reel, TikTok, and YouTube Short; EO-053 does not create three independently generated packages.

## Autosave and Resume

- Autosave stores only the authenticated Founder’s workflow draft.
- The draft records the current step, selected School, selected facts, excluded facts, customization, platform choices, unresolved items, and last saved time.
- School Spotlight request state includes structured goals, audiences, platforms, emphasis, media availability, optional descriptions, shot-list preference, and CTA.
- Recognized legacy freeform values are projected into structured selections; unmatched objective, audience, emphasis, and comma-separated media wording remains readable and editable without data loss.
- Draft ownership, workspace, and optimistic revision are explicit. Direct document reads, queries, and updates are restricted to the authenticated approved-admin owner.
- Refresh and sign-in resume the latest eligible draft without creating a second project or package.
- Canonical Add School submission uses atomic uniqueness claims and retry-safe bundle creation. School Spotlight package identity uses deterministic project/version IDs, optimistic project checks, and staged retry recovery.
- Canonical Source, node, relationship, project, and package mutations occur only through their approved service/repository boundaries.
- Deleting or abandoning a draft must not delete canonical records or prior package versions.

## Failure and Missing-Information Behavior

| Condition | Founder-facing behavior | System behavior |
| --- | --- | --- |
| School not found | Offer Add School | Preserve the request draft; do not create a placeholder School |
| No verified source | Ask for one Verified Source | Block verified canonical creation and package claim inclusion |
| Required fact unavailable | Show `Not available from verified sources.` | Exclude the fact or record an unresolved item |
| Sources conflict | Show `Sources Disagree` and both positions | Preserve conflict; do not choose silently |
| Save conflict | Explain that newer work exists and offer reload/review | Reject stale mutation; preserve both safe states where applicable |
| Invalid lifecycle action | Explain the missing prerequisite and next action | Reject the transition without a runtime overlay |
| Persistent storage unavailable | Preserve visible input where safely possible and explain retry | Do not report success or create partial canonical state |
| Package incomplete | List exact remaining items | Keep approval disabled |
| Required audience missing | Explain that at least one audience must be selected and move focus to that group | Keep the draft intact and block continuation before repository submission |
| Approval succeeds | Confirm Approved and show the next valid action | Persist only the canonical approved transition |

Primary error copy must not expose Firestore paths, repository names, stack traces, enum keys, or internal IDs.

## Accessibility and Responsive Requirements

- Laptop-first layout at common 13-inch, 14-inch, and 16-inch viewports.
- One obvious primary action per screen.
- Complete keyboard access and visible focus.
- Structured multi-select controls expose checkbox semantics, labels, and selected state to assistive technology.
- When continuation is blocked, focus moves to the first unresolved required field rather than only to a summary message.
- Status, verification, and disabled explanations announced to assistive technology.
- No hover-only evidence or disabled-action explanation.
- No clipped headings, hidden selected facts, overlapping badges, or truncated critical values.
- Review and package content use a dedicated large overlay or full workspace surface, not a narrow sidebar.
- Focus trapping, Escape dismissal, background interaction prevention, and focus restoration for modal experiences.
- Progress is textual as well as visual.

## Acceptance Criteria

- An approved admin can start, autosave, refresh, and resume a School Spotlight request.
- Non-admin and unauthenticated users cannot read drafts, packages, or canonical knowledge.
- The Founder can select a School without seeing or copying an internal ID.
- The Founder can select multiple goals and audiences, and at least one audience is required.
- `Other` inputs, platforms, primary emphasis, optional specific angle, media availability, media descriptions, and shot-list preference persist through autosave, refresh, and resume.
- `No media yet` cannot remain selected with a specific media type.
- Legacy request drafts remain readable and preserve unmatched freeform values.
- Every included factual claim resolves to active same-workspace canonical evidence or is explicitly labeled as Founder-authored wording; unavailable and conflicting information cannot enter silently.
- The Founder can include, exclude, and correct facts before assembly.
- The four approved initial outputs appear as structured, editable package sections: one reusable vertical-video package, one Instagram caption, one photo/video shot list, and one source and verification package.
- Future platform outputs are clearly marked out of scope and are not required for EO-053 acceptance.
- No output is represented as AI-generated, automatically researched, approved, or published.
- Tone, platform, length, hook, emphasis, media, and CTA choices persist deterministically.
- Package versions and source selections survive refresh and reopen.
- Invalid project transitions remain blocked with a Founder-friendly explanation.
- Founder approval uses the existing lifecycle and never publishes automatically.
- Public-site files and behavior remain unchanged.
- No media is uploaded, no platform is called, and no content is scheduled or published by this workflow.
- Typecheck, lint, production build, focused workflow tests, authorization tests, persistence tests, lifecycle regression tests, and responsive Founder validation pass before release.

## Verification State

EO-052 through EO-054 are Engineering Complete. Targeted post-remediation Founder Validation reused the existing Malone University Version 2 and confirmed that `Request -> Review -> Customize -> Approve` remained functional, the exact approved version remained readable after refresh, and no duplicate School, project, workflow draft, or package was created. Approval did not publish, schedule, upload, or externally send content. No new browser-console or runtime errors were observed, and the deployed Firestore rules were confirmed active. Final Independent Review passed with zero P0 and zero P1 findings. Founder authorization for the commit, pull request, and conditional merge workflow is granted; required pull-request checks and the merge remain pending.

EO-055 has not started. This workflow adds no AI, external search, external API, upload, scheduling, publishing, or public-site capability.
