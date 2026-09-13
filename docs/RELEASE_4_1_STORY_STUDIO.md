# Instagram Story Studio — Founder review

September 11 update: the Founder accepted the final still-graphics proposal below. Its local implementation and current verification are recorded in [Instagram still rendering](./INSTAGRAM_STILL_RENDERING.md). Earlier “not implemented” rendering statements in this September 9 checkpoint are historical. Cloud storage, file-picker uploads, video and publishing remain outside the delivered scope.

September 9, 2026. Local, uncommitted interface refinement within EO-058/EO-059. Final rendering is a proposal only. The four release gates remain Engineering Complete → Founder Validation → Independent Review → Merge Approval; this work does not pass them automatically.

## Founder experience

Open Content Intelligence and choose an approved School Spotlight with reviewed research. Choose Court spotlight, Facility tour, Athlete journey, or Campus visit guide; specify audience, reader action, optional angle, selected approved details and 3–8 starter slides. The starter provides original hook choices and approved claim wording. Empty detail slots remain visible rather than inventing facts.

Arrange slides; edit headlines and on-slide wording; link each factual slide to approved evidence; inspect quotations and source links beside the editor. Choose photo-first or text-card layouts, register approved-domain original photo URLs, record credit/date/permission notes, and adjust crop focus in a phone-size preview. Caption editing is separate from on-slide copy and the existing six-platform drafts. Changing the brief changes the direction and hook options but does not automatically rewrite existing slides or caption.

Readiness checks flag missing photos, permission gaps, unsupported detail selections, repeated photos/copy, crowded copy, and incomplete Founder review. Freeform editorial text remains a draft: the Founder must attest that its factual assertions match the selected evidence. The system validates references; it does not independently prove the meaning of arbitrary edited prose. Save records a new immutable revision. Saved slide locks protect content, photo references and order; unlock and save before editing. A competing save requires loading the latest revision. Unsaved edits retain their evidence snapshot during refresh; the server rejects a save if the live evidence/package has changed. Discard edits and refresh to adopt changed evidence.

## Persistence and boundaries

`internalContentIntelligenceStoryboards` holds current owner-restricted storyboards, and `internalContentIntelligenceStoryboardVersions` holds immutable revisions. Each revision has the server-verified exact approved SchoolSpotlightPackage binding, Research Package ID/revision, actor and timestamp. The authenticated server is the only write path; the existing protected namespace covers both collections. Saving drafts does not reserve budget, call OpenAI, or mutate canonical records. No new dependency or provider permission is required.

Photo references are limited to approved school HTTPS domains and JPG/PNG/WebP URL paths. The browser displays the source original with a crop; the server does not download or store it. This permits layout review, not a stable production asset pipeline. Permission records are Founder attestations, not independently verified licenses.

Not implemented: AI prose rewriting or per-slide regeneration, uploaded/private media intake, historical revision browsing/restoration, final exports, render jobs, publishing, scheduling, video or voiceover. Current preview may scroll long copy and is not an exact-size export proof.

## Verification and Malone status

- Focused suite: 31/31 passed, zero skipped, using isolated Firestore. Coverage includes malformed/forged references, image-domain restrictions, permissions, locked slides/assets/order, concurrent saves, stale evidence/package rejection, immutable revision readback, owner isolation, protected namespaces and no budget/run/canonical writes from storyboard saves.
- Typecheck, lint and Next.js production build passed. Browser fixture uses the actual editor and domain validation with synthetic approved Malone data; its saves are local fixture persistence, not production Firebase.
- Browser checks: original Malone photo loads; copy edit/save/reload persists at revision 4; a saved lock disables editing and unlocking remains disabled until separately saved. Desktop 1280px and mobile 390px have no horizontal page overflow. No browser error logs observed.
- Earlier connected Malone research revision 2 and all six real platform drafts remain recorded in the engineering audit. No paid provider call or production data write was performed for this interface refinement. Authenticated Founder save/reload of the new storyboard against real Malone data remains required.
- No P0/P1 defect was identified in these focused checks. This is not an independent security review or production acceptance.

## Exact files changed for this refinement

- `domain/content-intelligence/storyboard.ts` — storyboard schema, starter, validation, locks and readiness.
- `server/content-intelligence/repository.ts` — transactional revision persistence and owner state readback.
- `app/api/content-intelligence/route.ts` — authenticated storyboard save action and bounded payload.
- `components/founder/InstagramStoryEditor.tsx` — brief, editor, media references, review and preview.
- `components/founder/GovernedContentIntelligence.tsx` — editor integration and protection of unsaved edits.
- `tests/content-storyboard.test.ts` — domain and Firestore coverage.
- `package.json` — adds storyboard tests to the focused command.
- `docs/RELEASE_4_1_STORY_STUDIO.md`, `docs/RELEASE_4_1_ENGINEERING.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md` — scope, current status and review evidence.

These are a subset of the existing uncommitted Release 4.1 working tree. No commit, push, deployment or legacy PR action is authorized by this refinement.

## Proposed separate scope: final Instagram still graphics

Authorize a bounded rendering batch before implementing it. Proposed outputs: ordered 1080×1350 PNG slides, a ZIP, caption, alt text and a source/permission manifest. Map this batch to the established later engineering orders during approval; do not silently include EO-060 or change the active Release 4.1 batch.

1. **Approve the creative specification.** Original Hoop Frens layouts, brand marks, licensed fonts, typography, crop/safe-area rules, maximum copy, slide roles and export acceptance criteria. Use untouched documentary photos; no generated facility lettering or invented scenes. Broader source facts and varied cleared photos are needed for a full Malone facility tour or athlete journey.
2. **Approve media intake and storage.** Secure original-file upload or approved-source retrieval; private storage and authorized reads; content hashes, MIME/size checks, redirect/SSRF protection, provenance and usage-rights records. Specify retention/deletion and the storage project/bucket. Current public image links are insufficient as permanent inputs.
3. **Implement deterministic rendering.** Render a frozen approved storyboard/evidence/package revision using original photos and locked fonts. Enforce exact pixel dimensions, text fit, contrast, crop, ordering, file integrity and downloadable artifacts. Generate review proofs before final export approval. OpenAI Images permission can remain None for this approach.
4. **Add controlled render jobs.** Durable state, idempotency, bounded retries, cancellation, timeout, failure recovery, audit, version invalidation and artifact access controls. Approve a separate compute/storage cost ceiling; the $0.50/request and $10/month AI limits do not automatically cover infrastructure costs.
5. **Validate and release through all four gates.** Test Malone end to end, including bad/missing assets, expired permission, long headlines, changed evidence, repeated requests and download authorization. Founder approval of the exact final graphics remains separate from evidence approval.

The expansion still excludes MP4, voiceover, uploading to social platforms, publishing, scheduling, external sending, analytics, autonomous agents and public-site changes. Those require their own scope. No additional OpenAI permission is needed merely to render approved text and existing photos.

## Founder Validation checklist

- [ ] Open the real approved Malone Version 2 and its reviewed evidence.
- [ ] Build a short court spotlight; compare the hook options and selected facts.
- [ ] Edit and reorder slides; inspect evidence and separate caption.
- [ ] Register permitted original photos and verify crop/credit/rights warnings.
- [ ] Save, refresh and reopen; confirm the exact evidence/package version persists.
- [ ] Lock/save, then unlock/save before editing; test a second-window revision conflict.
- [ ] Check desktop and phone readability with actual copy and images.
- [ ] Confirm manual edits incur no AI charge and do not alter six-platform drafts or canonical records.
- [ ] Approve the interface or list revisions; separately authorize any final-rendering scope, assets and infrastructure budget.
