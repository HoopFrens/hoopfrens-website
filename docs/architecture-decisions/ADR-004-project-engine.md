# ADR-004 Project Engine

## Status

Accepted

## Context

Projects are the execution layer for Hoop Frens internal work, connecting knowledge, assets, contributors, and decisions.

## Decision

Projects will be represented as domain records with explicit status, priority, scope, ownership, contributor, source, asset, knowledge, and decision relationships.

## Consequences

- `domain/project` owns the `Project` interface, converter stub, and repository interface.
- Project services can remain implementation-free until Firestore behavior is approved.
- Project records can later become the coordinating object for briefs, production packages, and internal workflows.
