# Project Orchestrator Test Plan

No test framework is configured in this repo yet, so this document captures expected coverage for the non-AI Project Orchestrator foundation.

## Plan Type Mapping

The orchestrator should map:

- `create-project` -> pending project creation path
- `resume-project` -> pending resume path
- `review-package` -> pending review path
- `approve-work` -> pending approval path
- `return-knowledge` -> pending knowledge path
- `create-strategic-brief` -> pending strategic brief path
- `search-existing-objects` -> pending search path
- `route-room` -> pending room route path

## Blocked Plans

Plans should return blocked status when:

- `ExecutionPlan.status` is `blocked`
- `ExecutionPlan.clarificationRequired` is `true`
- `ExecutionPlan.planType` is `blocked-clarification`
- no deterministic pathway exists for the plan type

## Contract Checks

Every orchestration result should include:

- `id`
- `requestId`
- `status`
- `completedSteps`
- `createdAt`

Blocked results should include:

- `blockedReason`
- `recommendedNextAction`
