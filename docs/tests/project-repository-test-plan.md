# Project Repository Test Plan

## Scope

Validate that Headquarters project creation and continuation use `ProjectRepository` while keeping persistence local to the browser session.

## Manual Test Cases

1. Create a placeholder project.
   - Enter `Spotlight Ashland University`.
   - Confirm Headquarters displays `Project Created`.
   - Confirm the project title is `Ashland University School Spotlight`.
   - Confirm status is `Draft`.

2. Continue the created project.
   - Enter `Continue Ashland`.
   - Confirm Headquarters displays `Project Briefing`.
   - Confirm the same project title appears.
   - Confirm completed work and remaining next step appear.

3. Continue the only session project without a school name.
   - Enter `Pick up where we left off`.
   - Confirm Headquarters restores the existing project.

4. Multiple-project clarification.
   - Create two placeholder projects.
   - Enter `Continue yesterday's project`.
   - Confirm Headquarters asks which project to continue.

5. Session-only persistence.
   - Refresh the browser tab and confirm session projects are still available.
   - Close the browser session and confirm no production persistence is expected.

## Automated Verification

- `npm run typecheck`
- `npm run lint`
- `npx next build --webpack`

## Out of Scope

- Firestore repository implementation.
- AI-generated project metadata.
- Voice input.
- Cross-session persistence.
