# Local Development

## Setup

Work from the real Hoop Frens repository:

```bash
cd /Users/antwonewilliams/Documents/GitHub/hoopfrens-website
```

Install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.local.example .env.local
```

Fill in the Firebase web app values in `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Do not commit `.env.local`.

## Start The App

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If local routes return 404 while the terminal shows `Watchpack Error (watcher): Error: EMFILE: too many open files, watch`, run the dev server in polling mode:

```bash
WATCHPACK_POLLING=true npx next dev --webpack --hostname 127.0.0.1
```

Then open:

```text
http://127.0.0.1:3000/executive-workspace
```

## Login Process

1. Open `http://localhost:3000/admin/login`.
2. Sign in with Google or email/password using an approved Firebase admin account.
3. For local Executive Workspace access, the signed-in Firebase user must have `role: "admin"` at `users/{uid}`.
4. After signing in, open `http://localhost:3000/executive-workspace`.

This does not bypass authentication. In development, Executive Workspace checks the same admin role used by the admin dashboard. Production behavior is unchanged.

## Executive Workspace

Open:

```text
http://localhost:3000/executive-workspace
```

The Release 1 MVP is session-only. You can:

- Create a project with `Spotlight Ashland University`.
- Continue it with `Continue Ashland`.
- Open Project Detail.
- Review the project.
- Request revision.
- Approve the project.
- Return to Headquarters.

No AI, Firestore writes, publishing, or production workflows run in this local preview.

## Screenshot Generation

Preferred local setup:

```bash
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
npx playwright install chromium
```

Then run a local server:

```bash
npm run dev
```

Use Playwright or the Codex Playwright CLI wrapper to open:

```text
http://localhost:3000/executive-workspace
```

If screenshots fail, check:

- The browser binaries are installed and readable.
- `$HOME/.cache/ms-playwright` is writable.
- `$HOME/.npm` is writable.
- macOS privacy or sandbox settings are not blocking browser launch.
- Firebase env vars are present and the test user is signed in.

Known local Codex desktop limitation: Chromium may install successfully but fail to launch with `MachPortRendezvousServer ... Permission denied (1100)`. In that case, the preferred long-term solution is to run screenshot capture from a normal macOS terminal session, CI, or another environment where Chromium can register its Mach service.

## Common Troubleshooting

- `Firebase is not configured`: add Firebase values to `.env.local` and restart `npm run dev`.
- `Admin access required`: sign in with a Firebase user whose `users/{uid}` document has `role: "admin"`.
- `localhost:3000` is busy: stop the existing process or run Next on another port with `npm run dev -- -p 3001`.
- Routes return 404 in dev with `EMFILE` watcher errors: restart with `WATCHPACK_POLLING=true npx next dev --webpack --hostname 127.0.0.1`.
- Browser screenshot cannot launch: reinstall Chromium with `PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" npx playwright install chromium`.
- Session state looks stale: close the tab or clear browser session storage for `localhost:3000`.

## Known Limitations

- Project data is stored only in browser session storage.
- Firestore persistence is not connected for Headquarters project objects.
- AI, voice, publishing, and production workflows are inactive.
- Local screenshots require a working browser install and an authenticated session.
