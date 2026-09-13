# Simple Instagram post workflow — September 13, 2026

## Current status

The waiting-only implementation described below is superseded by the connected September 13 school/team workflow. New requests now continue through official-site confirmation, selected-team research, explicit facts/package approval and automatic saved carousel assembly. See [current implementation, verification and Founder checklist](./SCHOOL_TO_POST_AUTOMATION.md).

## Earlier interface checkpoint — historical

### Founder direction

The Founder requested a workflow simple enough for a fifth grader: submit a school, research its basketball or football program, prepare an original Hoop Frens package, and get it ready to publish. The Founder selected **Instagram photo carousel with caption, ready for me to upload** as the first finished output. This authorizes simplifying the interface and capturing school/team requests. It does not authorize external publishing, cloud spending, claims of photo-rights clearance or canonical Knowledge Graph mutation.

## Implemented now

- The default Today page and Intelligence Center show **Make a school post**. Main workspace navigation has **Make a post**, **My work**, and collapsed **Advanced**. The detailed tools remain under More options.
- Choose a school by name or open its ready-work card. The latest eligible approved package is selected automatically; no version dropdown is required. Exact package/hash binding remains enforced by the server.
- Supported current flow: configured schools with approved packages, using the existing men's basketball research service. Existing reviewed facts open a prepared carousel immediately. New research remains Founder-initiated, reserves $0.50 and still requires semantic fact review before a post is prepared. No six-platform generation call is needed for a carousel.
- Simple post defaults use only reviewed supported claims, original headings and a short closing question card. Malone uses the two previously evaluated official photo candidates, with rights pending. With three facility claims the first fact is on the cover, making four slides. Other facts without the reviewed photo match use explicitly visible text cards; no school imagery is invented.
- Slides are visible together; optional wording/photo/crop changes live under Edit this slide. Caption is shown directly. The Founder can review copy together, edit each used photo credit, save for later, or move to final pictures. A text-card alternative is explicit.
- The existing local renderer makes exact PNG proofs, enforces copy review and image quality and exact version/hash checks, records explicit final approval, and provides **Download my Instagram post** with instructions for manual Instagram upload. The existing protections, two render attempts, cancellation and local storage limits remain in place.
- New school requests accept school name, team (men's basketball, women's basketball or football) and optional location. Server-only `internalContentIntelligenceSchoolRequests` records have owner scope, request-id idempotency and a 50-request-per-owner bound. Status is always **needs-setup**. The UI says **Waiting for setup — research not started**. These requests are visible after refresh; they do not incur AI charges or create KG/project/approved-package records.
- Unsaved edits block switching school/editor mode. Saved slide locks, optimistic revision checks and evidence changes continue to be enforced. School intake writes occur only when the Founder submits; no real test requests were submitted during this implementation.

## Unfinished at the earlier checkpoint (superseded by the connected workflow)

This is an improved first workflow, not completion of arbitrary-school automation. The research service still has two configured school policies and men's-basketball prompts. Football and women's-basketball requests are accepted into the waiting list, not processed. New schools still need reviewed identity/source policy and an eligible approved package. There is no background queue consumer. General school/team research, source onboarding, a simple operator action to resolve waiting requests require further engineering. No autonomous agents, videos, social account connection or publishing was activated.

Photo usage rights remain unverified; the Founder explicitly removed that download gate on September 13. Founder approval of the actual post remains pending. Local media backup/audit retention, the existing dependency security findings, independent review and all four release gates remain prerequisites. Do not label the whole program complete because the simple screen works.

## Verification

- 20 focused tests passed with zero skipped: 5 simple-workflow/request tests, 6 storyboard tests and 9 rendering tests, using isolated Firestore where needed.
- Tests cover latest-version selection, reviewed-claim-only drafts, pending rights/copy by default, absence of invented photos, input validation, owner-scoped/idempotent requests, no budget/KG/project writes from intake, immutable saves, locking, render bytes, stale/tamper denial, and proof/download controls.
- TypeScript and targeted ESLint passed; the production build passed.
- The actual SimplePostStudio was tested in a clearly labeled synthetic browser harness, using the real RenderService and RenderStore for the save → render → approve → download action. The fixture has no live identity or provider calls. It does not claim a real Founder approval.
- The authenticated live workspace loaded the new screen and current Malone version 2; opening it displayed the previously reviewed facts and photo candidates. No real storyboard save, content approval, rights attestation, school-request submission or provider request was performed during this validation.
- Desktop browser verification only for this new simplified screen; dedicated responsive interaction testing remains to be completed.

## Changed source files in this pass

New: `components/founder/SimplePostStudio.tsx`, `domain/content-intelligence/simple-post.ts`, `tests/simple-post.test.ts`, and this document.

Updated: `components/founder/FounderIntelligence.tsx`, `GovernedContentIntelligence.tsx`, `InstagramStoryEditor.tsx`, `InstagramRenderPanel.tsx`; `components/executive/ExecutiveWorkspaceShell.tsx`; `app/executive-workspace/today/page.tsx`; `app/executive-workspace/intelligence-center/page.tsx`; `app/api/content-intelligence/route.ts`; `server/content-intelligence/repository.ts`; `docs/DECISIONS.md`; `docs/ROADMAP.md`.

These sit on the existing uncommitted implementation branch. Nothing is staged, committed, pushed or deployed. Prior review patches remain historical snapshots; they do not include this pass. Engineering Complete → Founder Validation → Independent Review → Merge Approval remain intact.

## Founder validation

1. Open http://localhost:3017/executive-workspace/intelligence-center and select Malone University.
2. Check whether the prepared pictures and caption are understandable without instructions. Edit only what needs changing.
3. Use Find school photos, choose a suitable image for a slide, and check its credit. No separate photo approval is required.
4. Check the copy, save, make the actual pictures, inspect them and approve the exact set if satisfied.
5. Download and open the ZIP. Check picture order, caption and alt text. Upload manually only when ready.
6. Treat other-school/team submissions as waiting requests until their research support is implemented.

## September 13 update — broader photos, no separate photo approval

The Founder explicitly removed the photo approval requirement. Pending usage rights are now a nonblocking notice, not a claim that permission exists. Used photo credits are deduplicated and added automatically to the exported caption. Copy review, exact proof approval, evidence/version integrity and minimum image quality remain required. Captions including credits cannot exceed 2,200 characters. Historical proofs retain their original policy; create new pictures to apply the updated policy.

**Find school photos** searches the institution and athletics domains for courts, fields, weight rooms, campus views, locker rooms and game action. Categories are suggestions, not verified descriptions. It reads at most eight pages for 45 seconds, offers at most 36 candidates, caches results for 15 minutes and permits one active search per owner. Searches make no OpenAI calls, purchase no storage, and do not write canonical records. Failed pages and empty categories stay visible. Source HTML is not retained.

A connected Malone scan read eight pages and returned six candidates: two court, one field and three uncategorized images. One page could not be read. It did not establish that weight-room, locker-room or campus images were available.

Verification for this update: 15 photo-discovery/render tests passed without skips; nine additional storyboard/simple-workflow tests passed, with two database-dependent tests skipped because the emulator was not running. TypeScript, targeted ESLint and the production build passed. The existing database persistence tests were not rerun against live production. The authenticated local browser returned the same six Malone candidates, displayed the new category/slide picker and credits controls, and successfully placed a chosen image on a slide. The unsaved verification edit was cleared afterward; no real storyboard was saved. Desktop visual inspection passed. No paid provider calls or real content approval occurred.

Exact source changes: new `domain/content-intelligence/photos.ts`, `server/content-intelligence/photos.ts`, `components/founder/SchoolPhotoPicker.tsx`, `tests/school-photos.test.ts`; updated `server/content-intelligence/sources.ts`, `app/api/content-intelligence/route.ts`, `domain/content-intelligence/storyboard.ts`, `domain/content-intelligence/rendering.ts`, `server/instagram-render/service.ts`, `components/founder/SimplePostStudio.tsx`, `components/founder/InstagramStoryEditor.tsx`, `components/founder/InstagramRenderPanel.tsx`, `tests/instagram-render.test.ts`. Documentation: this file, `INSTAGRAM_STILL_RENDERING.md`, `DECISIONS.md`, `ROADMAP.md` and new `LOW_COST_AUTOMATION_PLAN.md`.
