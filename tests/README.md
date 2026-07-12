# Headquarters Tests

The test suite covers deterministic Executive Workspace services and Release 2.4 hardening invariants, including:

- admin authorization allow/deny behavior;
- explicit command routing and create idempotency;
- lifecycle and Production readiness gates;
- revision invalidation and historical Production Packages;
- stale/concurrent mutation conflicts;
- atomic artifact/project failure paths;
- Executive Intelligence, Company Health, Founder Daily Brief, prioritization, and recommendations;
- admin collection slug-state isolation.

Run the complete suite with:

```sh
npx --no-install tsx --test tests/*.test.ts
```
