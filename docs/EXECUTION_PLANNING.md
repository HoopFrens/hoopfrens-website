# Execution Planning

## Purpose

The Execution Planning Engine converts an `IntentResult` into an `ExecutionPlan` that downstream Hoop Frens services can use.

This implements the non-AI foundation for the HFPS Project Engine, Intent-First Operating Model, Conversation Engine, and ER-002: every service receives an `ExecutionPlan`, not raw intent.

## Relationship To The Intent Engine

The Intent Engine classifies Founder language into a structured `IntentResult`.

The Execution Planning Engine receives that `IntentResult` and decides:

- what kind of plan is needed
- which internal room should own it
- which systems are required
- what steps must happen before execution
- whether Founder review or approval is required
- whether clarification blocks the work

No production AI calls are made. No OpenAI connection is present. No Firestore reads or writes are used.

## ExecutionPlan Schema Summary

`ExecutionPlan` includes:

- `id`
- `intentResultId`
- `sourceIntent`
- `planType`
- `targetWorkspace`
- `targetRoom`
- `projectType`
- `priority`
- `scope`
- `region`
- `requiredSystems`
- `requiredSteps`
- `requiredDeliverables`
- `founderReviewRequired`
- `founderApprovalRequired`
- `clarificationRequired`
- `clarificationQuestion`
- `status`
- `createdAt`

## Deterministic Examples

| Intent type | Plan type |
| --- | --- |
| `create` | `create-project` |
| `continue` | `resume-project` |
| `review` | `review-package` |
| `approve` | `approve-work` |
| `learn` | `return-knowledge` |
| `think` | `create-strategic-brief` |
| `search` | `search-existing-objects` |
| `navigate` | `route-room` |
| `unknown` | `blocked-clarification` |

## Future AI Integration Notes

Future AI planning can improve step selection, system selection, and deliverable recommendations, but it should preserve the `ExecutionPlan` contract.

Before AI planning is introduced, define:

- allowed plan types
- confidence and fallback behavior
- audit logging
- Founder approval checkpoints
- Firestore persistence rules
- service handoff rules
- failure and rollback behavior
