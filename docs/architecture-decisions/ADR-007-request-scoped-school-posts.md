# ADR-007 — Request-scoped school research and editorial packages

Status: locally implemented; pending Founder Validation and the established release gates. Date: September 13, 2026.

## Context

The Founder authorized connecting new-school and football requests to research and automatic Instagram post assembly, under the existing budget and local-media limits. Previously, research required an already-approved canonical project and one of two static school policies. Automatically creating or changing the canonical Knowledge Graph remains excluded. Photo-rights approval was explicitly removed earlier.

## Decision

Use the existing internal request as a separate research workspace. Founder confirmation of a retrieved official-site preview freezes school name, selected team, exact source domain, URL/hash and approval time. Preliminary research bindings carry scope `school-request`, version zero, and are never represented as an approved production package. Storyboard validation explicitly rejects that scope.

At explicit facts approval, reuse the released SchoolSpotlightPackage assembler with a transient evidence view. Persist an immutable package and editorial approval record under `internalContentIntelligenceRequestPackages`, update the request's approved-package pointer and research binding atomically, and retain the original run's preliminary provenance. No transient knowledge graph is persisted. The package's legacy summary retains at most eight facts/two sources; the full reviewed Research Package remains the evidence ledger and the package records its exact id/revision.

New approved bindings carry scope `request-package` plus immutable source policy and team. Binding checks validate owner/admin, current pointer, package schema/content hash, team, source approval and expected hash. Subsequent fact approval creates the next immutable version. All final drafts/exports require the approved binding. Existing canonical approved-project validation is unchanged.

After review, a separate idempotent assembly action searches official photos with existing bounds, deterministically prepares supported copy, chooses context-matching suggested images, and saves one draft revision. If a post already exists it is returned without overwriting edits. If photos fail, visible text cards preserve useful progress. No AI call is needed for this step.

## Consequences

New schools can proceed without canonical mutations or an advanced setup workspace. The Founder still confirms school identity/source authority and factual meaning. Website confirmation does not prove every source claim; photos retain unknown rights. The existing $0.50/$10 budget, source fetch restrictions, final proof approval and all release gates remain intact. One-site onboarding is intentionally narrower than universal domain discovery; broader sources/CDN support require evidence-driven follow-up.
