# Execution Planning Test Plan

No test framework is configured in this repo yet, so this document captures expected coverage for the non-AI Execution Planning foundation.

## Intent Mapping

The execution planning service should map:

- `create` -> `create-project`
- `continue` -> `resume-project`
- `review` -> `review-package`
- `approve` -> `approve-work`
- `learn` -> `return-knowledge`
- `think` -> `create-strategic-brief`
- `search` -> `search-existing-objects`
- `navigate` -> `route-room`
- `unknown` -> `blocked-clarification`

## Blocked Unknown Intent

Unknown intent should return:

- `status: "blocked"`
- `clarificationRequired: true`
- a `clarificationQuestion`
- `founderReviewRequired: true`

## Contract Checks

Every generated plan should include:

- `id`
- `sourceIntent`
- `planType`
- `targetWorkspace`
- `targetRoom`
- `priority`
- `requiredSystems`
- `requiredSteps`
- `requiredDeliverables`
- `founderReviewRequired`
- `founderApprovalRequired`
- `clarificationRequired`
- `status`
- `createdAt`
