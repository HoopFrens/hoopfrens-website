# Release 2.4 Deployment Validation

This checklist is the remaining manual release gate for PR #4. It must be run against the deployed Headquarters build and its current deployed Firebase rules. Do not record passwords, tokens, email addresses, user IDs, Firebase project IDs, document IDs, or private record contents in this file.

## Validation Record

- Deployed build or commit tested: `Founder result: ____________________`
- Validation date and time: `Founder result: ____________________`
- Browser and version: `Founder result: ____________________`
- Deployed Firestore rules version or deployment time: `Founder result: ____________________`
- Overall result: `Not run / Pass / Fail: ____________________`
- Sanitized notes or follow-up issue links: `Founder result: ____________________`

## Admin Account

Use an approved admin account. Record only Pass or Fail and sanitized notes.

- [ ] Sign in through the deployed Headquarters sign-in page. `Founder result: __________`
- [ ] Open every protected Headquarters route from navigation and by direct URL. Confirm each route loads protected content. `Founder result: __________`
- [ ] Open Projects and Project Detail. Confirm protected `internalProjects` data can be read. `Founder result: __________`
- [ ] Perform one permitted workflow write through the interface. Confirm the expected project state, history, timeline event, and related artifact write persist. `Founder result: __________`
- [ ] Refresh the page. Confirm the persisted state and history remain correct. `Founder result: __________`
- [ ] Sign out. Confirm protected content disappears and direct protected routes no longer load. `Founder result: __________`

## Authenticated Non-Admin Account

Use an authenticated account that is not approved as an admin. Do not change its role during this test.

- [ ] Sign in successfully with Firebase Authentication. `Founder result: __________`
- [ ] Confirm the Access Restricted view appears and no Headquarters data is visible. `Founder result: __________`
- [ ] Enter each protected Headquarters route directly. Confirm access remains denied. `Founder result: __________`
- [ ] Using the deployed application session, attempt a protected `internalProjects` read. Confirm Firestore denies it and no record data is returned. `Founder result: __________`
- [ ] Attempt a protected `internalProjects` write. Confirm Firestore denies it and no record changes. `Founder result: __________`
- [ ] Confirm the denial view displays neither the account email nor internal role terminology. `Founder result: __________`
- [ ] Use Sign Out. Confirm the session ends and protected access remains denied. `Founder result: __________`

## Unauthenticated Session

Use a private browser window with no Firebase session.

- [ ] Enter every protected Headquarters route directly. Confirm the sign-in boundary appears and protected content does not render. `Founder result: __________`
- [ ] Attempt a protected Firestore read from the deployed application context. Confirm it is denied and no protected data is returned. `Founder result: __________`
- [ ] Attempt a protected Firestore write from the deployed application context. Confirm it is denied and no record changes. `Founder result: __________`

## Lifecycle and Artifact Ownership

Use a disposable internal test project owned by the deployed environment. Record only project labels that contain no sensitive information.

- [ ] From Draft, attempt a direct transition to Review. Confirm the operation is rejected and no project, history, timeline, or artifact write occurs. `Founder result: __________`
- [ ] Run the valid sequence Draft → Research → Outline → Production. Confirm each state, workspace history entry, timeline event, and generated package persists after refresh. `Founder result: __________`
- [ ] Complete Production readiness and enter Review through the supported action. Confirm the active Production Package belongs to the same project. `Founder result: __________`
- [ ] Request a revision from Review. Confirm the project returns to Production, the prior Production Package is superseded, and readiness is invalidated. `Founder result: __________`
- [ ] Generate the new Production version. Confirm readiness uses only the new active version. `Founder result: __________`
- [ ] Rapidly switch between two projects while loading Research and Production viewers. Confirm neither viewer ever displays an artifact from the other project. `Founder result: __________`
- [ ] Complete the remaining valid sequence Review → Approved → Published → Archived. Confirm each permitted operation persists and invalid shortcuts remain unavailable. `Founder result: __________`

## Sign-Off

- Founder release-gate decision: `Pending / Passed / Failed: ____________________`
- Failed checklist items and sanitized issue references: `Founder result: ____________________`

PR #4 must not merge until all required items have a Founder-observed result and the overall release gate is Passed.

## PostCSS Advisory Technical Debt

`npm audit --omit=dev` reports moderate advisory `GHSA-qx2v-qp2m-jg93` against PostCSS versions below 8.5.10. The affected installation is transitive: `next@16.2.9` bundles `postcss@8.4.31`. The separate application build path from `@tailwindcss/postcss@4.3.0` resolves to patched `postcss@8.5.15`.

No application feature accepts untrusted CSS and serializes it into a style element, so the advisory has no identified exploitable Headquarters input path in Release 2.4. npm offers only a framework-changing downgrade to `next@9.3.3`, not a safe patch-level remediation. Release 2.4 therefore records the transitive advisory as technical debt rather than destabilizing the framework. Re-evaluate when Next publishes a compatible release that updates its bundled PostCSS; do not use an override without Next compatibility verification.
