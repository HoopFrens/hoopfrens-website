# School-to-post automation — September 13, 2026

## September 13 — Founder-authorized commit and push

The Founder explicitly instructed “Commit and push.” This supersedes the earlier uncommitted/unpushed hold for the accumulated governed-content, local Instagram rendering and school-to-post workflow implementation on `codex/main/release-4-1-governed-content-intelligence`. Earlier checkpoint descriptions of uncommitted work are historical. Credentials, local media, generated proofs, ZIPs and test artifacts stay outside Git. This instruction authorizes Git publication only; it does not pass Founder Validation, Independent Review or Merge Approval, authorize merging legacy PRs, or authorize production deployment. Existing dependency findings and the first real new-school/football trial remain release prerequisites.


## Current implementation

New-school, men's-basketball, women's-basketball and football requests now connect to research and automatic Instagram post assembly. This supersedes the earlier waiting-only inbox. All implementation remains local, uncommitted and unpushed for Founder Validation.

1. Enter school and team. Existing eligible school/team work opens directly. A new request is saved without an AI charge.
2. Provide the official athletics website. The server retrieves a bounded preview; the Founder explicitly confirms that it belongs to the intended school. Confirmation stores the exact source domain and preview hash. This is source approval, not photo approval.
3. **Confirm school and start research** immediately runs the existing governed gateway for the selected team. It reserves $0.50 under the shared $10 monthly cap. The research prompt checks current team existence and prohibits substitution of another sport or an inactive historical program. Research Packages persist automatically; every candidate still needs semantic evidence review.
4. **Approve checked facts and build my post** approves an immutable editorial SchoolSpotlightPackage version, then automatically searches source photos, arranges supported facts into a carousel, adds a caption and saves a storyboard draft. Photo selection is a suggestion based on source context; no photo-rights attestation is fabricated. Missing suitable photos produce text cards.
5. Review or edit the post, make the actual PNGs, review the exact pictures and download the ZIP for manual Instagram upload. Football previews and PNGs use Field Notes and football wording.

Existing waiting requests have a Continue button. After an interruption, reopen the saved request or post. Paid research uses the existing request id and durable reservation system; ambiguous network failures do not automatically dispatch another paid call. Running requests can be stopped, expire on the existing deadline, and refresh while open. Assembly can be resumed without another AI call and returns the already-saved storyboard rather than overwriting edits. There is no detached background worker; the Mac and local server must stay running.

## Approval and data architecture

For new schools, preliminary research is explicitly bound to a confirmed **school request**, not falsely labeled an approved SchoolSpotlightPackage. It cannot generate a storyboard or final export at that stage. The Founder facts-review action creates and approves the exact editorial package using the released package assembler. Research then binds to that immutable package id/version/hash. School/team/source approval and current research revision are checked before saving and rendering. A later facts approval creates a new package version and invalidates old exports.

The internal `internalContentIntelligenceRequestPackages` collection holds immutable package snapshots and approval actor/time, exact source policy, and research provenance through the request/binding. Its namespace is already covered by the server-only Firestore rule. No rules deployment was needed. No canonical Knowledge Graph nodes/sources, canonical project lifecycle, or existing production packages are written. The legacy approved-project/split-package validation path remains intact. The new editorial package leaves `rightsConfirmed` false and records editorial-only approval; the Founder explicitly removed the separate photo-rights download gate.

See [ADR-007](./architecture-decisions/ADR-007-request-scoped-school-posts.md).

## Spending and operational bounds

- Existing OpenAI key reused under prior authorization; safe entry-presence check only, value not displayed. Permissions and environment files unchanged.
- $0.50 reserved per research/generation job, $10 shared per UTC month; failures and cancellations keep their reservations. At most twenty such jobs is not twenty guaranteed finished posts. External key usage and Firebase billing are outside this app allowance.
- Website preview, photo discovery, assembly, edits, PNGs and ZIPs use no OpenAI calls. No new storage subscription, cloud worker, background agent or social account connection.
- Existing source DNS/address/redirect/byte restrictions, gateway timeout/retry/cancellation/audit controls, private local media bounds and final proof approval remain active.

## Verification and practical limits

- 55 tests passed with zero skipped against isolated Firestore and synthetic provider responses. Existing binding, budget, owner, source-policy, evidence, cancellation, immutable-save and renderer regressions remain covered.
- New end-to-end service cases for all three teams cover request → source confirmation → research → explicit package approval → automatic storyboard → real PNG proof → approved ZIP. They verify idempotency, one $0.50 synthetic reservation, source-preview mismatch rejection, team-appropriate photo suggestions, wrong-owner denial, immutable package versions, stale export rejection, and absence of canonical writes.
- Production build/TypeScript and focused ESLint passed. Follow-up focused tests passed after adding exact research provenance and excluding preliminary requests from the advanced approved-package selector.
- Browser verification uses the real SimplePostStudio, repository, research service, assembly service and local renderer with an isolated database and clearly labeled synthetic source/provider responses. It confirms new football submission, website confirmation, automatic research transition, fact review, automatic saved four-slide assembly, Field Notes previews, loaded actual PNG proofs, final approval, download action and saved-work recovery after refresh. No real Founder content approval is claimed.
- No paid OpenAI call, real new-school request, real package approval, canonical write, upload or publication occurred during this verification. The updated authenticated live workspace loaded successfully. The existing Great Lakes Christian College men’s-basketball request is visible with Continue: confirm website, ready for the first real Founder trial. Existing unsaved work in another tab was left intact.
- Source discovery is deliberately narrow: one Founder-confirmed athletics domain per new request, not automatic internet-wide identity discovery. Sites with cross-domain redirects, unreadable HTML or unsupported image CDN transports may need an appropriate official starting URL or later transport support. No guarantee of suitable photographs in every category.
- First real new-school/football research quality and the final Founder experience still require validation. Previously recorded dependency advisories remain a P1 release prerequisite; this work does not remediate or independently re-audit them. Local backup/retention policy and independent review also remain pending.

## Exact files for this pass

New: `components/founder/SchoolSourceSetup.tsx`, `server/content-intelligence/request-package.ts`, `server/content-intelligence/assemble.ts`, `tests/school-workflow.test.ts`, this document, and `docs/architecture-decisions/ADR-007-request-scoped-school-posts.md`.

Updated: `app/api/content-intelligence/route.ts`; `components/founder/SimplePostStudio.tsx`, `GovernedContentIntelligence.tsx`, `InstagramStoryEditor.tsx`; `domain/content-intelligence/types.ts`, `policy.ts`, `simple-post.ts`, `storyboard.ts`, `editorial.ts`, `rendering.ts`; `server/content-intelligence/repository.ts`, `service.ts`, `gateway.ts`, `photos.ts`; `server/instagram-render/service.ts`, `renderer.ts`; `docs/SIMPLE_POST_WORKFLOW.md`, `LOW_COST_AUTOMATION_PLAN.md`, `DECISIONS.md`, `ROADMAP.md`. Other existing worktree changes predate this pass.

## Founder validation

- Open http://localhost:3017/executive-workspace/intelligence-center. Enter a real school and select the intended team.
- Confirm its official athletics website and start one bounded research run.
- Check team identity, current facts, source evidence and unresolved gaps. Approve only supported facts.
- Confirm the post assembles automatically. Replace any unsuitable suggested photo; verify its source and credit.
- Check copy, make PNGs, inspect and approve the exact pictures, download/open the ZIP. Upload manually when ready.
- Reopen saved work and confirm it does not charge for research again.

Engineering Complete → Founder Validation → Independent Review → Merge Approval remain the four gates. No gate is passed merely by a successful test. No commit, push, merge, deployment or legacy PR mutation.
