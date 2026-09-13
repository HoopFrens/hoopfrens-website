# Instagram still graphics — local Founder review

Current checkpoint: September 13, 2026. The Founder’s “Let’s move forward” authorizes the previously proposed narrow Instagram still-graphics expansion. It does not authorize deployment, publishing, scheduling, video, voiceover, autonomous agents or changes to the public website. Release 4.1’s EO-055–EO-059 remain intact; this extension is tracked separately here without inventing a new release number or engineering-order assignment.

## Implemented experience

After saving a storyboard, open **Final Instagram graphics** in Story Studio. **Create exact-size proof** renders each slide as a 1080 × 1350 PNG. Review the actual PNGs, caption and proposed alt text; explicitly approve the proof; then download an ordered ZIP containing the PNGs, caption, alt text, evidence/source manifest and approval record. Approval is for graphic download, not publication.

The original Hoop Frens treatment uses ink, ivory and scarlet, a photo-led layout, bundled Barlow typography, a consistent masthead and counters, and numbered question rows for multiline takeaway cards. Fonts are SIL Open Font License assets with bundled licenses, provenance URLs and SHA-256 hashes. Text is converted to measured glyph paths; it cannot silently overflow, use substituted fonts or invent lettering inside a photo. Text below the minimum readable size, unsupported glyphs and missing photos fail with actionable messages. Proposed fonts and layouts still need Founder acceptance.

Public-source photo URLs are the supported intake method in this first extension. The renderer downloads, validates, hashes and privately preserves delivered source bytes, then decodes/reorients/strips metadata for composition. It applies crop and resampling, with no generative image editing. File picker uploads, private school-supplied media and cloud buckets are not implemented or enabled.

## Approval and evidence controls

- Only the authenticated administrator who owns the exact approved SchoolSpotlightPackage can render its saved storyboard. The server reads authoritative storyboard/research records, revalidates current package integrity, and freezes their exact revisions/hashes.
- It rechecks the snapshot before proof completion, approval and each download. Changed storyboard, evidence, school approval or package content invalidates old exports. Rendering does not write canonical records or alter six-platform drafts.
- Proofs may be reviewed with outstanding copy checks. Final approval requires all copy/caption reviews, evidence selections and sufficient photo resolution. The September 13 Founder instruction removes photo-rights approval as a download gate; unknown rights stay visibly unverified. Arbitrary edited prose still requires Founder semantic review; reference validation is not automatic proof of factual meaning.
- The approval screen requires review of rendered crops, typography, credit, caption and alt text. The server records actor/time and a hash of the exact proof file set. The ZIP contains those same PNG bytes. File hash mismatch denies approval/download.
- Proof image endpoints require authentication too. Source originals have no download route and are not bundled in the ZIP. No public object URLs, API keys, raw provider messages or credentials are included.

## Local operation and resource limits

On September 11, 2026, the Founder explicitly approved continuing with local media storage. Source photos, PNG proofs, ZIP exports and render review records remain on this Mac, with no new cloud storage service or spending authorized. The existing $0.50/request and $10/month AI controls are unchanged; rendering makes zero OpenAI requests.

Set server-only `HOOPFRENS_RENDERING_MODE=local` for local operation. Optional `HOOPFRENS_RENDERING_DIR` must be an absolute private directory outside the implementation checkout; the default is `~/.local/share/hoopfrens/instagram-renders`. The renderer refuses Vercel execution and non-loopback request hosts. Run the local server bound to `127.0.0.1`; host checks are defense in depth, not a replacement for binding and authentication. The existing authorized Firebase server setup is still needed for read-only binding verification. No environment values were committed or changed by this extension.

The store uses owner-hashed directories, mode 0700 directories/0600 files, restricted artifact names, no-follow file reads, atomic metadata replacement and a short cross-process metadata lock. It retains jobs, immutable input snapshots, source hashes and sanitized event records across local server restarts. It permits one active rendering job, two explicit attempts per request, a 120-second deadline, 8 MB input images, a 32-million-pixel decoding limit, at most 80 MB per complete job, at most 50 undeleted jobs and a 512 MB store ceiling. New work reserves worst-case disk headroom; retries recheck capacity. Render limits are resource bounds, not a claimed dollar billing cap.

Cancellation is checked during intake/composition and before completion. Incomplete files are removed on failure/cancellation. Expired jobs become failed on status refresh and can be retried once. Interrupted metadata writes fail closed; a verified dead-process `.write-lock` requires operator removal before continuing. Do not delete a live process’s lock or run multiple server instances against this local store. **Delete render files** removes media/download files while retaining the job audit and saved storyboard; audit TTL/deletion policy remains a release prerequisite. The private local store is not a cloud storage implementation or a substitute for a production retention/backup policy.

The repository’s existing Storage rules permit public reads, so they were not used or changed. Cloud activation requires an approved budget, a private storage/worker design, access/retention controls, and independent review. No bucket provisioning or rules deployment occurred.

## Local sign-in correction — September 11, 2026

A live read of Firebase's public authorized-domain configuration confirmed that `localhost` is allowed and `127.0.0.1` is not. Use `http://localhost:3017/admin/login` for Google sign-in and keep the same hostname when opening the workspace. The server remains bound to loopback `127.0.0.1`; the renderer already accepts the `localhost` request hostname. No Firebase settings, credentials or access rules were changed. The login page now provides specific recovery guidance for unauthorized domains, blocked/closed popups, network failures and disabled Google sign-in. On the unapproved numeric loopback address, the domain error offers a link to the same page/port on localhost. Completing sign-in still requires the Founder; if the embedded browser cannot finish the popup, use the same localhost address in Chrome or Safari.

## Approved media transport mapping

Official Malone image requests were observed redirecting to `images.sidearmdev.com/convert`, with an encoded image under `dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/malonepioneers.com/images/...`. The media-only validator permits that exact conversion target for the same original school image path, or the exact corresponding CDN file. It does not permit arbitrary proxy targets, another school’s path, duplicate query parameters, extra query values or user-supplied CDN starting URLs. Every network hop still requires HTTPS, public IPv4 DNS results pinned to the request, bounded redirects/time/size and a decoded JPG/PNG/WebP. Research-source allowlists are unchanged. The source hash refers to the delivered bytes; the host may convert its original file format.

## September 11 verification (historical)

- **40 focused tests passed:** 31 content/evidence/persistence tests against isolated Firestore, plus 9 renderer tests. Zero skipped in those runs.
- Renderer coverage includes deterministic exact dimensions, text/glyph rejection, malformed/oversized/SVG image rejection, metadata stripping, school-specific redirect isolation, private file permissions and symlink/path rejection, proof/final download gates, exact ZIP PNG hashes, persistence across store instances, tamper/stale-version denial, cancellation/concurrency/retry limits, expired state, and signed-out/cross-origin/external-host route rejection.
- The existing storyboard transaction test now verifies read-only render snapshots reject wrong-owner/stale-board/changed-package requests.
- Browser testing used the actual render panel and RenderService with clearly labeled synthetic data: proof generation, 1080 × 1350 loaded image bytes, explicit proof approval, ZIP download action, reload persistence, permission-pending denial and a 390px viewport without horizontal overflow or browser error logs. This does not claim authenticated Founder browser validation against production Firebase.
- Final checks: all 40 focused tests, lint and the production build/TypeScript check passed. Build trace inspection showed bundled fonts and no environment files. No final deployment test is claimed.
- The real app was started on loopback port 3017 with rendering enabled only in that process. The protected Intelligence Center correctly showed Access Required when signed out. No saved environment file was changed. Founder can sign in at `http://localhost:3017/executive-workspace/intelligence-center` while the local server remains running.

## Connected Malone evaluation

Read-only server checks reconfirmed approved SchoolSpotlightPackage version 2 and its unchanged content hash `b2a74faed6155f24aceb873c9cbda6181813222d43e7faa7458dd3555b84b7f3`, plus reviewed Research Package revision 2. A local evaluation storyboard rendered four proofs using approved claims 1, 2 and 5 and the actual Osborne Hall / Hal Smith Court photos. The closing questions are editorial questions, not assertions about Malone access or scheduling.

Artifacts: `/Users/antwonewilliams/Documents/Hoop Frens/output/malone-render-proof/`. Each slide is 1080 × 1350; all four were visually inspected. The final closing-card refinement replayed hash-verified photo downloads from the same evaluation. `evaluation.json` records bindings, source dimensions/hashes, exact files and outstanding review items. The evaluation storyboard was not saved to production. There were zero provider calls, zero production writes and no change to canonical records. The original scene/lettering was preserved by photographic placement; only two distinct photos are available, so some imagery repeats.

All Malone image permissions remain pending, and the new layout/copy/caption still require Founder review. No final Malone approval or approved ZIP was created. The generated PNGs are review proofs.

## Findings and prerequisites

- **P1 release prerequisite:** existing Next.js 16.2.9 / its nested Sharp dependency have current security advisories, including critical-severity framework advisories. This task did not validate exploitability or update the public-site framework. Resolve and regression-test this separately before any release. Final dependency audit: 15 total advisories (8 moderate, 6 high, 1 critical), including existing transitive dependencies. Direct renderer dependencies Sharp 0.35.4, fflate 0.8.3 and opentype.js 1.3.4 have no advisory entries in that audit; the remaining Sharp finding is Next’s nested version.
- No P0 or additional P1 defect was identified in the focused rendering checks. This is not an independent security review.
- Check image identity and credit. The September 13 photo picker offers additional official-site candidates; usage rights remain a nonblocking notice.
- Founder must accept the brand/type/layout treatment, review the current semantic copy/alt text, and validate real authenticated save → render → approve → download in the local app.
- Local media storage is Founder-approved. Local backup, audit retention/deletion and operational lock recovery still need an operating policy before release. Cloud storage is outside this batch; any future activation requires separate authorization.

## Exact source files for this extension

New: `domain/content-intelligence/rendering.ts`; `server/instagram-render/media.ts`, `renderer.ts`, `store.ts`, `service.ts`; `server/instagram-render/fonts/BarlowCondensed-Bold.ttf`, `Barlow-Regular.ttf`, `BarlowCondensed-OFL.txt`, `Barlow-OFL.txt`, `manifest.json`; `app/api/instagram-render/route.ts`; `components/founder/InstagramRenderPanel.tsx`; `tests/instagram-render.test.ts`; this document.

Updated: `components/admin/AdminLogin.tsx` (local sign-in recovery); `server/content-intelligence/repository.ts`; `components/founder/InstagramStoryEditor.tsx`; `tests/content-storyboard.test.ts`; `next.config.ts`; `package.json`; `package-lock.json`; `docs/ROADMAP.md`; `docs/DECISIONS.md`; `docs/RELEASE_4_1_STORY_STUDIO.md`; `docs/RELEASE_4_1_ENGINEERING.md`.

These changes sit on top of the prior uncommitted Release 4.1 work. Nothing was staged, committed, pushed, merged or deployed. Legacy PR #2 and #5 were not changed. Engineering Complete → Founder Validation → Independent Review → Merge Approval remain the required gates; rendering success does not pass them.

## Founder checklist

- [x] Approve local media storage with no new cloud storage spending (September 11, 2026).
- [ ] Inspect all four Malone PNG proofs, their exact copy, crop and credits.
- [ ] Check photo credits and sources. Usage notes are optional; no separate photo approval is required.
- [ ] Review caption and proposed alt text; shorten or revise copy if necessary.
- [ ] Accept or revise the original Hoop Frens typography/layout.
- [ ] In the authenticated local app, save the exact storyboard and create a new proof.
- [ ] Inspect every slide; approve that proof; download and open the PNG/ZIP package.
- [ ] Change a storyboard/evidence revision and confirm the old download is refused.
- [ ] Complete independent review, dependency remediation and all remaining release gates.

Implementation references: [Sharp image metadata](https://sharp.pixelplumbing.com/api-input/), [OpenType glyph paths and measurement](https://github.com/opentypejs/opentype.js), [fflate ZIP API](https://github.com/101arrowz/fflate), [Google Fonts Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed). Installed versions and actual generated files, rather than documentation alone, were verified locally.

## September 13 policy update

`instagram-stills-v2-credited-photos` removes the separate photo-rights download blocker and adds used-photo credits to `caption.txt` and the proof review screen. The source manifest still records actual pending rights; no record is automatically marked cleared. Captions with credits over 2,200 characters are blocked with an actionable message. Historical proof blockers are immutable: make a new proof to apply this policy. Fifteen current photo/render tests pass, including export with unverified rights and adequate image quality, while low-resolution and stale/tampered artifacts remain blocked. See [current photo workflow](./SIMPLE_POST_WORKFLOW.md).
