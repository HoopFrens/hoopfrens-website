# Intent Service Test Plan

No test framework is configured in this repo yet, so this document captures the expected test coverage for the non-AI Intent Engine foundation.

## Static Intent Examples

The intent service should classify these examples:

- `Spotlight Ashland` -> `create`
- `Continue Ashland` -> `continue`
- `Review today’s content` -> `review`
- `Approve the Parent Guide` -> `approve`
- `What do we know about Ferris State?` -> `learn`
- `Where should Hoop Frens go next?` -> `think`
- `Find D2 schools in Ohio` -> `search`
- `Open the Library` -> `navigate`

## Unknown Input

Unknown text should return:

- `intentType: "unknown"`
- `confidence: "unknown"`
- `clarificationRequired: true`
- a clarification question

## Contract Checks

Each result should include:

- `rawInput`
- `normalizedInput`
- `intentType`
- `confidence`
- `targetWorkspace`
- `targetRoom`
- `clarificationRequired`
- `recommendedNextAction`
- `createdAt`
