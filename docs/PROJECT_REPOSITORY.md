# Project Repository

## Purpose

The Project Repository is the storage boundary for Headquarters project data. Release 2 Slice 1 keeps project data local to the browser session, but routes Create Project and Continue Project through the same repository contract that future Firestore persistence will use.

## Current Implementation

- `ProjectRepository` lives in the `domain/project` layer.
- `createInMemoryProjectRepository` provides a deterministic, non-network implementation.
- Executive Office supplies a session-backed store so placeholder projects survive page refreshes during the current browser session.
- No Firestore reads or writes are connected in this slice.

## Supported Operations

- `listByWorkspace(workspaceId)` returns projects scoped to a workspace.
- `getById(projectId)` returns one project or `null`.
- `create(project)` stores a placeholder project.
- `update(projectId, projectUpdate)` updates an existing project and returns the updated object.

## Headquarters Flow

1. Founder enters a request in Executive Conversation.
2. Intent Engine returns an `IntentResult`.
3. Execution Planning Engine returns an `ExecutionPlan`.
4. Project Orchestrator returns an orchestration result.
5. Executive Office creates or retrieves a placeholder `Project` through `ProjectRepository`.
6. The browser session store remains the temporary backing layer.

## Firestore Readiness

The repository interface is intentionally persistence-agnostic. A future Firestore implementation should satisfy the same `ProjectRepository` contract and replace the session-backed store without changing the Headquarters flow.

## Release 2 Limitation

This is not production persistence. Projects remain placeholder objects and are not written to Firestore, Firebase Storage, or any external service.
