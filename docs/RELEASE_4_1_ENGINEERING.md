# Release 4.1 engineering contract

September 11 extension: the Founder separately authorized local Instagram still-graphics rendering. [Implementation and verification](./INSTAGRAM_STILL_RENDERING.md) supersede the historical blanket exclusion of final PNG rendering for that narrow extension only. The original EO-055–EO-059 batch, all four release gates, and exclusions for video/voice/publishing remain intact.

Current September 9 interface checkpoint: the saved Instagram Story Studio is implemented locally with original starter hooks, editable slides/caption, evidence links, photo references/permissions, crop preview, locks and immutable revisions. Manual edits do not call AI. See [Story Studio scope, verification and Founder checklist](./RELEASE_4_1_STORY_STUDIO.md). Final rendering remains a separate proposed scope; earlier dated hold notes below are historical.

Status: local implementation and verification present; connected validation pending, not release approval. September 6, 2026 Founder authorization covers EO-055–EO-059, $0.50/request and $10/month. Founder confirms the new OpenAI key's organization, project and restricted permissions. Model-list access was verified with HTTP 200 without displaying credentials.

## Trust boundaries and acceptance design

Only authenticated existing Headquarters admins may use the server gateway. Firebase Admin verifies revoked/expired tokens and current users/{uid}.role. Every package, project, run and research artifact is owner/workspace scoped. Read the approved package and all integrity parts in a transaction; bind the immutable content hash and exact approval version. Recheck those reads before every durable result and review. No canonical collection writes are exposed.

Server-owned internalContentIntelligence* collections hold runs, monthly reservations, structured Research Packages and drafts. Browser clients cannot write or read them directly. The existing wildcard Firestore rule must exclude this namespace. Server Firebase credentials require ADC or a securely provisioned service account; production cannot fall back to in-memory persistence or browser authority. Admin IAM remains an operational trust boundary and must be scoped appropriately.

Reserve $0.50 atomically before each research/generation job against the shared $10 UTC-calendar-month budget. Retain the conservative reservation even after cancellation, failure or process loss; show reserved budget separately from measured token usage. At most one job per owner is active, with global monthly contention serialized transactionally. A per-call conservative token/tool cost bound is recorded before dispatch; accumulated bounds may never exceed the reservation. One retry only for 429/5xx; ambiguous network failure is not automatically retried. A stable client request ID prevents duplicate billing on replay. Cancellation is durable, aborts active local HTTP work, and prevents late writes; remote provider processing may continue and its reservation is retained. No autonomous job scheduler is introduced.

Research uses Responses with one bounded web_search call restricted to the policy domains. Source URLs returned by the provider are untrusted: exact approved host validation, HTTPS only, no credentials/ports, DNS public-address validation and pinned lookup for each redirect; bounded size, timeout and HTML/text only. No paywall/authentication bypass. Fetch failure becomes missing information. Store short evidence excerpts, timestamps and content hashes, not full source pages or raw provider conversations. Responses use store:false; this does not promise provider zero retention.

Extract candidate claims against fetched source text. A quote must be present in the retrieved body and the source must be in policy. The ledger distinguishes needs-review, supported, rejected and conflicting. Founder review attests semantic support and current school applicability; quotation matching alone never marks a claim supported. Competing values for the same field are visible and cannot be accepted together. Nonselected or unavailable facts remain explicit gaps. Reviews increment the ledger revision and invalidate prior draft linkage.

Generation consumes only supported claim IDs and a versioned original Hoop Frens pattern registry. The model selects structured pattern/claim arrangements; it cannot author unvalidated free-text factual hooks, captions, CTAs or visuals. Render platform drafts deterministically from original registry wording and reviewed claim text, with evidence next to every factual block. X length, output counts, reference integrity and all six platforms are enforced. No content is published or approved automatically. Pattern repetition is an intentional initial quality limitation, visible in the evaluation.

## Verification plan

- Auth: missing, expired, revoked, wrong project, nonadmin and cross-owner denial.
- Exact-version checks: inactive/staged/orphaned/mismatched/superseded package and edited approval/content fail closed, including a race during completion.
- Source policy: unapproved host, credentials, non-HTTPS, private IPv4/IPv6, DNS/redirect rebinding, huge body, timeout, malformed provider response and prompt-injection attempts.
- Ledger: missing quote, invented source, conflict, missing information, rejected fact, unsupported draft reference and stale revision.
- Budget/run: concurrent reservations, duplicate replay, rate limit retry ceiling, cancellation-before/during/after work, persistence failure, interrupted job and UTC rollover.
- Complete existing local suite, Firestore emulator namespace-denial and repository transaction tests, typecheck/lint/build, and protected browser workflow.
- Connected Malone: reopen actual approved Version 2; preserve package identity/hash and canonical record counts; conduct research, review facts and generate all six draft types with exact linkage. Record real provider, persistence and browser evidence separately from fixture tests.

## Release gates

Engineering Complete → Founder Validation → Independent Review → Merge Approval. None is passed by this design document. Keep all work uncommitted and unpushed. EO-060+, rendering, voice, publishing, scheduling, uploading, sending, analytics connectors, autonomous agents, public-site changes and Knowledge Graph replacement remain excluded.

## Official references checked

- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/moderation
- https://developers.openai.com/api/docs/pricing
- https://firebase.google.com/docs/admin/setup

## Runtime prerequisites and limits

For local connected validation, provision an existing authorized Firebase service-account file outside the repository and set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path in the local server environment. Do not paste its contents into chat or commit it. The current server reads Application Default Credentials and the existing `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. A production host needs an approved ADC/workload-identity setup; this implementation does not assume that a local credential path exists on Vercel. On September 7 the Founder supplied a downloaded credential, which was verified as project-matching, moved outside the repository with owner-only permissions, and connected through the ignored local environment. Server authentication and Firestore reads passed.

The shared reservation is an application budget, not an account-wide OpenAI billing cap. All paid environments must use the same durable budget authority. Browser rules must deny the entire new namespace before gateway enablement. The namespace-only rule was activated with explicit Founder authorization on September 8 and its exact source verified; the website implementation remains local. Retained data consists of structured research/drafts, short evidence quotes, source hashes/URLs/access times, explicit reviews, and sanitized run/provider-attempt metadata. Raw provider errors/conversations and full page bodies are not persisted. Retention deletion/TTL and pre-authentication denial audit are not implemented.

Earlier local verification: 20/20 focused tests and 10/10 existing emulator tests passed. The broader local suite had 120 passes and 10 emulator skips. Final typecheck, lint and webpack production build passed. The build generated 38 static pages and the dynamic gateway route without compiler warnings. Direct enum imports in existing validation keep browser repositories out of the server dependency chain. A browser fixture tested evidence decisions and all six platform formats; 390px viewport had no horizontal overflow. A live official Malone source fetch and actual approved package binding passed. After the September 8 tier update, connected research/extraction/output moderation and Research Package persistence passed. Explicit Founder review revision 2 and six actual drafts now persist; authenticated browser validation and final editorial acceptance remain pending. Refer to the re-entry audit for dependency advisory counts and all gate limitations.

Model pricing checked September 6, 2026: gpt-4.1-mini input $0.40/output $1.60 per million tokens; web search $10/1,000 calls plus a fixed 8,000 input-token search block for this model. The server conservatively bounds token input by UTF-8 bytes plus protocol overhead, output by the explicit maximum, and tool cost separately. Recheck provider pricing before release or changing the fixed route. Official model reference: https://developers.openai.com/api/docs/models/gpt-4.1-mini .

Final protected-route smoke check: signed-out GET and POST to the gateway returned 401 with the safe sign-in error; a cross-origin POST returned 403. The local protected page displayed Access Required without browser errors. Source-diff credential-pattern scanning returned no matches, and the server key environment name was absent from compiled client assets. Git whitespace and relative documentation-link checks passed. No environment file is tracked. Review patch and per-file checksum manifest are stored outside the repository at `/private/tmp/hoopfrens-r41-founder-review.patch` and `/private/tmp/hoopfrens-r41-founder-review-manifest.json`.

## September 7 activation hold (historical; resolved September 8)

The actual approved Malone Version 2 passed read-only repository binding validation, including owner-account availability. Live rules lack the new namespace exclusion and include a separate console edit to Spotlight scene validation. Preserve that edit in a namespace-only activation patch; do not blindly deploy the repository rules over current production. Review and reconcile this drift before any later full rules deployment.

The gateway now rejects paid research/generation unless `HOOPFRENS_CONTENT_INTELLIGENCE_ENABLED=true`. The flag is currently unset. A guard test proves disabled execution cannot reserve budget or dispatch provider work. The exact patch against live rules passed 54 denial checks in the emulator, and the focused suite passed 20/20. Applying the live database protection is pending Founder authorization. No production rules or records were changed. Paid research and Founder evidence/draft review remain pending.

## September 8 activation result (initial provider failure is historical)

Founder authorization “Apply” was executed against the unchanged reviewed live baseline. The namespace-only rule is active as ruleset `f3672249-7639-485c-8452-e7461541df40`, source SHA-256 `e130b13e8a3b0e605725e9b6f3aedb2b62f5222e054b7d7830e96fd97c6fb6ad`. Existing console changes were preserved. Earlier September 7 activation-hold notes are historical; the database protection blocker is resolved.

A connected run through the real service reserved $0.50 and failed at input moderation within its two-attempt ceiling. No Responses call, Research Package, or draft was created. Sanitized follow-up diagnostics confirmed moderation HTTP 429 with rate-limit language; quota/billing exhaustion is not established. The exact approved package/project hashes and all eight canonical collection counts were unchanged. The enable flag was true only in that bounded evaluation process; it remains unset in the local environment pending provider availability. No website deployment occurred. See the audit for run IDs, evidence paths, retained reservation, and remaining gates.


## September 8 current connected checkpoint

The tier update resolved moderation HTTP 429. Connected execution then revealed that gpt-4.1-mini rejects web-search domain filters. Research now uses gpt-5-mini with low reasoning and the same one-call/domain restrictions; extraction/arrangement retain gpt-4.1-mini. Search bounds use $0.25/$2 per million input/output tokens and reserve the whole 128k search context plus protocol/request input, maximum output/reasoning and the $0.01 tool call. This supersedes the former 8k search-block bound. No limit or approved-source constraint was relaxed.

The source cleaner preserves public articles within form wrappers and removes form controls. Malone's verified Osborne Hall page is a priority source. The final connected Research Package contains five candidates from four sources, with source gaps and two rejected candidates visible; all five require Founder review. Explicit wording edits are bounded to 240 characters, preserve evidence and are recorded as previous/reviewed text in the revision audit. This permits original, factual Hoop Frens wording instead of copying source promotional text.

Eight total connected runs retain $4.00 of the $10 monthly application budget, including failures/diagnostics. Final research run call bounds total $0.067570, not measured charges. Canonical project/package hashes and all eight collection counts remain unchanged. No claim has been approved, no six-platform generation has run, and no website deployment occurred. Normal local enablement remains separate from process-only evaluation enablement. See the current audit and proposed Founder evidence review for exact IDs and pending decisions.

Final tier-update checks: 25/25 focused tests passed in the isolated emulator, including transaction audit preservation and stale/wrong-owner denial for wording edits. Typecheck, lint and the Next.js 16.2.9 Turbopack production build passed. A synthetic browser flow verified edited wording persists through review and appears in all six drafts, with unchanged evidence and a 390px layout without horizontal overflow or browser errors. Server readback matches the actual latest Research Package; same-ID replay caused zero provider calls or additional reservations. These are distinct from pending authenticated Founder browser validation and real six-platform generation.


Current approval/generation update: following explicit Founder evidence approval, four proposed facts are supported with reviewed wording and one duplicate rejected at research revision 2. The real service generated and read back all six platform drafts; monthly reservations are $4.50/$10. Canonical hashes/counts remain unchanged. Content quality remains limited by sparse selections and repetitive registry framing. Separately requested built-in image previews visualize the conversation's four-slide Instagram concept; they do not establish an integrated rendering pipeline or approval of final output quality. See the audit's current result for exact IDs and artifact paths.
