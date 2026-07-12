# ADR-005 Knowledge System

## Status

Accepted

## Context

Hoop Frens depends on reliable basketball intelligence. Knowledge needs source tracking, verification status, and relationship mapping before summaries or recommendations can be trusted.

## Decision

Knowledge entities will be modeled independently from projects and assets. They will keep source IDs, tags, related entity IDs, verification status, and scope.

## Consequences

- `domain/knowledge` owns the `KnowledgeEntity` interface, converter stub, and repository interface.
- Source records remain shared so they can support knowledge, projects, assets, conversations, and decisions.
- Production AI summarization is deferred until the knowledge model and persistence rules are implemented.
