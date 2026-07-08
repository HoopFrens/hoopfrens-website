# Project Orchestrator

## Purpose

The Project Orchestrator receives an `ExecutionPlan`, coordinates the correct service pathway, and returns an `OrchestrationResult`.

This is the non-AI foundation for the HFPS Project Engine, Intent-First Operating Model, Conversation Engine, and ER-002: every service receives an `ExecutionPlan`, not raw intent.

## Current Scope

The current orchestrator does not create projects, call AI, connect OpenAI, connect Firestore, or run production workflows.

It maps known execution plan types to deterministic pending orchestration pathways.

## Deterministic Pathways

| Execution plan type | Orchestration pathway |
| --- | --- |
| `create-project` | pending project creation path |
| `resume-project` | pending resume path |
| `review-package` | pending review path |
| `approve-work` | pending approval path |
| `return-knowledge` | pending knowledge path |
| `create-strategic-brief` | pending strategic brief path |
| `search-existing-objects` | pending search path |
| `route-room` | pending room route path |
| `blocked-clarification` | blocked result |

## Result Contract

`OrchestrationResult` includes:

- `id`
- `requestId`
- `status`
- `completedSteps`
- `blockedReason`
- `recommendedNextAction`
- `createdAt`
- `completedAt`

## Future Implementation Notes

Future releases can replace the deterministic placeholders with real service calls while preserving the `ExecutionPlan -> OrchestrationResult` contract.

Before production orchestration is added, define:

- project creation rules
- service handoff contracts
- Firestore persistence rules
- founder review checkpoints
- approval gates
- failure handling
- audit logging
