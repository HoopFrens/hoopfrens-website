# Release 3 Future AI/CIO Founder Decision Package

## Purpose

This package governs future AI-enabled and Chief Intelligence Officer capabilities only. Future AI/CIO implementation may not begin until the Founder approves every applicable decision below. The recommended defaults are intentionally conservative: they establish governance, cost control, data minimization, auditability, and deterministic fallback before AI features are enabled.

EO-046 through EO-049 are outside this decision gate. They implement the deterministic Release 3.1 Knowledge Graph foundation without AI, model routing, provider calls, automated ingestion, external APIs, or external search. Pending provider strategy, model routing, AI budgets, retention, outbound-data, AI-failure, and voice decisions do not block that completed Knowledge Graph work.

Record the final decision, rationale, approver, and approval date for each future AI/CIO item. Approval of this package authorizes AI/CIO architecture direction only; implementation still requires an Engineering Order, review plan, test plan, Founder validation checklist, and capability branch.

## Decision Summary

| # | Decision | Recommended default | Founder approval |
| --- | --- | --- | --- |
| 1 | AI provider strategy | One primary provider behind a provider-neutral server abstraction; no browser provider access | Pending |
| 2 | Initial model-routing policy | Server-controlled task allowlist with one approved route per capability and no caller-selected model | Pending |
| 3 | Maximum monthly AI budget | USD $100 pilot hard cap | Pending |
| 4 | Per-request cost limits | USD $0.50 hard cap; reject before execution when the estimate exceeds the cap | Pending |
| 5 | Data allowed to leave the application | Minimum approved, project-scoped context only; exclude secrets, credentials, auth data, and unrelated protected records | Pending |
| 6 | Prompt and response retention period | 30 days for approved raw content, followed by deletion; retain non-content audit metadata separately | Pending |
| 7 | Firestore response storage | Store only Founder-approved structured outputs; do not store raw prompts or raw responses by default | Pending |
| 8 | Founder approval rules | Explicit approval before durable persistence, deterministic state action, tool invocation, or external use | Pending |
| 9 | Audit-log requirements | Mandatory metadata log for every request and policy denial; retain for 12 months | Pending |
| 10 | Failure and fallback behavior | One bounded retry for eligible transient failures, then deterministic fallback with no state mutation | Pending |
| 11 | AI state-change recommendations | May recommend a specific deterministic action with rationale; may never execute it | Pending |
| 12 | Autonomous approval or publishing | Prohibited without exception | Pending |
| 13 | Voice sequencing | Defer voice until the future AI/CIO governance foundation is released and verified | Pending |

## 1. AI Provider Strategy

**Decision required:** Choose how Headquarters will select and integrate AI providers.

**Recommended default:** Use one primary provider at launch behind a provider-neutral, server-side abstraction. Keep a second provider as an architectural option, not an enabled runtime fallback. Provider credentials remain isolated on the server.

**Tradeoff:** A single enabled provider reduces integration, security, evaluation, and cost complexity. The abstraction reduces future lock-in, but avoiding an active multi-provider fallback means a provider outage will use the deterministic fallback rather than silently changing behavior or data handling.

**Founder decision:** Pending.

## 2. Initial Model-Routing Policy

**Decision required:** Define who chooses the model and how a request is routed.

**Recommended default:** Use a server-controlled allowlist with one approved model route per capability and request class. The caller supplies a capability and purpose, never an arbitrary model, system prompt, tool list, or token limit. Route changes require a reviewed policy change.

**Tradeoff:** Fixed policy is less flexible for experimentation but makes output quality, cost, retention, and risk reproducible. Controlled policy can expand after evaluations establish evidence for additional routes.

**Founder decision:** Pending.

## 3. Maximum Monthly AI Budget

**Decision required:** Set the maximum total AI spend for the initial pilot.

**Recommended default:** USD $100 per calendar month as a hard cap across all environments, with alerts at 50%, 75%, and 90%. Production and non-production usage must be separately visible within the same cap.

**Tradeoff:** A $100 cap supports bounded evaluation while limiting financial exposure. It may pause experimentation before month end; that is preferable to unreviewed overage during the governance pilot.

**Founder decision:** Pending.

## 4. Per-Request Cost Limits

**Decision required:** Set the maximum estimated and actual cost for one request.

**Recommended default:** USD $0.50 hard cap per request. Reject the request before execution when the estimate exceeds the cap, and terminate generation when provider usage reaches the approved bound. Any higher-cost evaluation requires a separate, time-limited Founder-approved policy.

**Tradeoff:** The cap prevents single-request surprises and encourages concise context. Some long research or editorial tasks may require decomposition or later explicit exceptions.

**Founder decision:** Pending.

## 5. Data Allowed to Leave the Application

**Decision required:** Define the protected data that may be sent to an AI provider.

**Recommended default:** Send only the minimum project-scoped fields and artifact excerpts required for the approved capability. Prohibit secrets, provider credentials, Firebase tokens, authentication data, user email addresses, unrelated project records, raw audit logs, and public-site administration data. Require explicit policy approval before sending personal information or unpublished source material not already covered by the capability.

**Tradeoff:** Data minimization reduces privacy and confidentiality risk but may limit answer quality when omitted context is genuinely relevant. The remedy is explicit data-policy review, not silent context expansion.

**Founder decision:** Pending.

## 6. Prompt and Response Retention Period

**Decision required:** Decide how long raw prompt and response content may be retained.

**Recommended default:** Retain approved raw prompt and response content for no more than 30 days for evaluation and incident investigation, then delete it. Store no raw content when the capability can meet its audit requirement with structured metadata alone.

**Tradeoff:** Thirty days supports debugging and evaluation while limiting long-term exposure. Shorter retention reduces risk but makes delayed investigations harder; longer retention increases privacy, access-control, and deletion obligations.

**Founder decision:** Pending.

## 7. Firestore Response Storage

**Decision required:** Decide whether AI responses may be stored in Firestore.

**Recommended default:** Store only schema-validated, Founder-approved structured outputs as versioned, project-scoped artifacts. Do not store raw prompts, raw responses, hidden instructions, or provider payloads in Firestore by default.

**Tradeoff:** Approved structured storage supports durable work and provenance without turning Firestore into an unrestricted transcript archive. It requires an explicit review step and may slow rapid experimentation.

**Founder decision:** Pending.

## 8. Founder Approval Rules

**Decision required:** Define when explicit Founder approval is mandatory.

**Recommended default:** Require explicit approval before an AI output is durably persisted, converted into a deterministic state action, sent to another tool, shared externally, or used in public content. Transient advisory output may be displayed without a second approval after the Founder intentionally initiates the request.

**Tradeoff:** This preserves control and auditability but adds friction to multi-step workflows. Approval may later be streamlined only for narrowly defined, reversible, low-risk actions with separate evidence and authorization.

**Founder decision:** Pending.

## 9. Audit-Log Requirements

**Decision required:** Define what every AI execution and denial must record.

**Recommended default:** Require a 12-month metadata audit record containing request ID, authorized user ID, capability, purpose, project ID when applicable, policy version, provider and model route, input classification, prompt-template version, output-schema version, token usage, cost, latency, outcome, failure category, approval events, retention class, and artifact reference. Do not place secrets or unrestricted prompt and response content in the metadata log.

**Tradeoff:** Detailed metadata supports cost management, incident response, reproducibility, and compliance. It creates storage and access-control obligations and must be kept separate from raw-content retention.

**Founder decision:** Pending.

## 10. Failure and Fallback Behavior

**Decision required:** Define behavior for timeouts, provider errors, malformed output, policy denial, or exhausted budget.

**Recommended default:** Allow one bounded retry only for explicitly eligible transient failures when the retry stays within the original cost and time budget. Otherwise return a Founder-friendly failure state, record the outcome, preserve user input, perform no state mutation, and keep the deterministic workflow available.

**Tradeoff:** Bounded retry improves resilience without hiding repeated cost or latency. Some failures will require the Founder to try again later, but silent model switching or unbounded retries would undermine predictability.

**Founder decision:** Pending.

## 11. AI Recommendations About State Changes

**Decision required:** Decide whether AI may suggest lifecycle or project changes.

**Recommended default:** AI may recommend one or more existing deterministic actions with rationale, cited project context, and uncertainty. It may not create a new transition, bypass policy, call the workflow service, or mutate state. The Founder must invoke the existing action separately.

**Tradeoff:** Advisory recommendations can improve decision support while preserving the trusted lifecycle. Requiring a separate deterministic action prevents seamless autonomous flow but maintains a clear approval and audit boundary.

**Founder decision:** Pending.

## 12. Autonomous Approval or Publishing

**Decision required:** Confirm whether AI may approve or publish autonomously.

**Recommended default:** Confirm that AI may never approve, publish, change authorization, or bypass Founder review autonomously. These prohibitions have no model-confidence exception.

**Tradeoff:** This preserves the highest-risk human control points. It limits automation speed, but approval and publishing affect canonical and externally visible state and therefore require deliberate human action.

**Founder decision:** Pending.

## 13. Voice Sequencing

**Decision required:** Decide whether Executive Voice may begin before the governance foundation is complete.

**Recommended default:** Defer voice implementation until the future AI/CIO governance foundation is released, deployed controls are Founder-validated, and an independent review approves the gateway, audit, spend, retention, and confirmation boundaries. Voice then requires its own Engineering Order and review.

**Tradeoff:** Deferral delays a high-value interface, but voice adds realtime sessions, audio data, transcript retention, accidental activation, tool confirmation, and cost risks. Building it on a proven governance boundary reduces rework and exposure.

**Founder decision:** Pending.

## Approval Record

Future AI/CIO architecture status remains **Awaiting Founder architecture approval** until all thirteen decisions are completed. This status does not apply to or block the deterministic EO-046 through EO-049 Knowledge Graph.

- Founder: Pending
- Approval date: Pending
- Approved decisions or amendment reference: Pending
- Approved monthly budget: Pending
- Approved per-request limit: Pending
- Future AI/CIO implementation Engineering Order: Not created; EO-050 has not started
