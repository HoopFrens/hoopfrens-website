# Low-cost school-to-Instagram completion plan

Status: September 13, 2026. The school/team request workflow is now connected locally; see [implemented behavior and verification limits](./SCHOOL_TO_POST_AUTOMATION.md). The sequence below is the earlier plan retained for context. The current finished output is an Instagram carousel and caption for manual upload.

## Cost boundaries

- Preserve the Founder-approved $0.50 maximum reservation per initiated research/generation job and $10 per UTC month shared project cap. Full reservations remain charged to the app allowance after failure/cancellation; twenty reserved jobs is not twenty guaranteed finished posts. These controls cover this gateway, not outside key usage or Firebase billing.
- Reuse reviewed facts, stored source references and local media. Editing captions/slides, photo discovery and PNG/ZIP rendering make no OpenAI calls.
- Run only when the Founder requests work. No always-running research agents, paid image generation, video generation, additional media subscription or cloud worker is needed for the first local workflow. The Mac and local server must be running.
- Firebase continues to hold existing structured records and authentication. No new service is provisioned; existing provider charges are separate from the AI limit.
- Keep model choice, bounded retrieval, retry limits, cancellation and durable reservations server-side. Show estimated maximum before a paid action and stop at the cap. Do not promise actual cost per post before measured representative runs.

## Original implementation sequence (now connected locally)

1. **Resolve a submitted school and team.** Verify school identity and its official athletics domains; isolate men's basketball, women's basketball and football. Resolve ambiguity with one plain question. Current policies are static and research prompts are men's-basketball-specific.
2. **Connect waiting requests to research.** Add a resumable, Founder-started processor with visible progress, cancellation and failure recovery. Persist the Research Package automatically. Current school requests only wait for setup; there is no queue consumer.
3. **Keep evidence review simple.** Show supported facts, unresolved conflicts and missing information in plain language. Preserve one exact approved SchoolSpotlightPackage version. An explicit package approval/onboarding action is still needed for a new school; do not silently create canonical records or bypass approval hashes.
4. **Prepare the full post.** Choose only reviewed claims, organize four to six original slides, run the free photo finder and suggest photos suited to each claim. Prefer distinct relevant facility/campus images; offer text cards where no suitable image exists. Do not label photos from filenames as verified facilities.
5. **One final check, then download.** Show the actual PNGs and credited caption together. Preserve proof/version integrity and manual final review. Deliver the ordered ZIP for manual upload. No social account integration is needed.

## Acceptance checks

- One configured basketball program, one previously unconfigured school, and one football request complete the real intended path with the correct team and supported claims.
- Unsupported facts, wrong-school images, stale packages, duplicate requests, cancellation, interrupted work and exhausted budget have clear recovery behavior.
- No repeated AI charge for reopening/editing an existing post. No automatic canonical mutation or publication.
- Founder can complete school → facts → pictures → download without opening advanced tools. Independent review, known dependency remediation and all four release gates remain required before release.

## Photo update delivered now

The separate photo-approval checkbox/download blocker is removed. Unknown rights remain recorded as unknown. Photo credits are appended automatically. The official-site picker covers courts, fields, weight rooms, campus, locker rooms, game action and uncategorized photos; available results vary by source. Credit alone does not grant usage permission ([U.S. Copyright Office](https://www.copyright.gov/engage/photographers/)).

No paid OpenAI requests, new cloud storage purchase, Git commit/push or deployment occurred during this photo update.
