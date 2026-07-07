# Data Model

The initial domain contracts live in `domain/`.

`types/workspace.ts` remains as a compatibility export for older imports while foundation work moves the real interfaces into domain folders.

Core records:

- `Workspace`
- `Project`
- `KnowledgeEntity`
- `Asset`
- `Person`
- `Organization`
- `Decision`
- `Conversation`
- `ProductionPackage`
- `Source`
- `Event`

The model uses string IDs and ISO date strings so the contracts can map cleanly to Firestore documents later.

Relationships are represented with ID arrays for now. This keeps the model explicit without adding database reads, writes, or denormalization behavior before those decisions are implemented.

Shared enums live in `domain/shared/enums.ts`.

Firestore converters are stubs only. They provide typed converter boundaries without adding collection paths, security assumptions, or production persistence behavior.
