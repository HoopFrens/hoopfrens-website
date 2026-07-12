# ADR-002 Business Objects

## Status

Accepted

## Context

The platform needs stable objects that can support basketball intelligence work without being tied to a single page, report, or AI workflow.

## Decision

The Executive Workspace is organized around five primary business object groups:

- Knowledge
- Projects
- Assets
- People & Organizations
- Decisions

Supporting objects include workspace, conversation, source, event, and production package records.

## Consequences

- Each primary object gets a dedicated domain folder.
- Shared identifiers, dates, enums, and converters live in `domain/shared`.
- Repository interfaces define expected persistence behavior before Firestore implementation is added.
