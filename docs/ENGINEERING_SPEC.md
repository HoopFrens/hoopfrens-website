# Engineering Spec

Approved stack:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Shadcn UI
- Firebase Auth
- Firestore
- Firebase Storage
- Vercel
- GitHub

Foundation boundaries:

- `app/` remains responsible for Next.js routes.
- `components/` remains responsible for React UI.
- `types/` contains shared TypeScript contracts.
- `domain/` contains Executive Workspace business object contracts, shared enums, Firestore converter stubs, and repository interfaces.
- `services/` contains application service boundaries.
- `lib/` contains existing shared implementation helpers.
- `firebase/` exposes Firebase integration boundaries.
- `docs/` contains architecture and operating notes.
- `tests/` is reserved for test coverage added with production behavior.

Current Headquarters services are deterministic and do not call AI providers, OpenAI, or external APIs. Project, package, timeline, and Founder-visit persistence use protected Firestore repositories.

Repository interfaces have Firestore and in-memory implementations. Canonical project mutations use transactions, optimistic conflict checks, and atomic artifact/event writes. Protected routes require the authenticated Firestore admin role in every environment.
