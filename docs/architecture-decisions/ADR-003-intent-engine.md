# ADR-003 Intent Engine

## Status

Accepted

## Context

Hoop Frens will eventually need to interpret internal requests and route them to the right business object or workflow.

## Decision

The intent engine remains a service boundary only during foundation work. No production AI calls, prompt orchestration, or automated routing behavior are implemented yet.

## Consequences

- `intentService` stays a typed stub.
- Future AI behavior must connect through approved service contracts.
- Intent results should reference domain objects rather than inventing separate application state.
