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

Current service modules are stubs only. They do not call AI providers, Firestore, Firebase Storage, or public APIs.

Repository interfaces are contracts only. Firestore implementations should be added in a later approved pass.
