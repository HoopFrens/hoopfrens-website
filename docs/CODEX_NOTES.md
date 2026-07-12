# Codex Notes

This foundation pass is intentionally limited.

Rules for future work:

- Do not add production AI calls until the Executive Workspace behavior is explicitly approved.
- Do not add public-facing pages as part of foundation work.
- Keep existing working code intact.
- Prefer typed service boundaries before wiring Firestore reads or writes.
- Update `docs/DATA_MODEL.md` when changing shared domain contracts.
- Add tests alongside the first real service behavior.
- Keep `types/workspace.ts` as a compatibility bridge unless all imports have moved to `domain/`.
