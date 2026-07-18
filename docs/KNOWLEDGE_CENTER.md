# Knowledge Center

## Purpose

Knowledge Center is the protected Headquarters workspace for exploring and maintaining the Release 3.1 Knowledge Graph foundation. Its canonical route is `/executive-workspace/knowledge`.

The workspace is deterministic and explicitly labeled `No AI`. It does not search the web, generate conclusions, or modify the public website.

## Access

Knowledge Center renders inside the existing Executive Workspace shell and uses the same authenticated admin gate as every Headquarters route. Non-admin and unauthenticated users cannot render the graph or read protected data.

## Overview

The overview reports:

- Total nodes
- Total relationships
- Verified nodes
- Unverified nodes
- Conflicting nodes and relationships
- Recently updated records

The Explorer supports text search, filters for node type, confidence, status, region, and state, and sorting by name, updated time, confidence, or type. Search includes canonical names, aliases, tags, descriptions, source titles, and School intelligence fields.

## Node and Relationship Views

Selecting a node opens a large responsive overlay that contains:

- Canonical identity, type, category, confidence, status, and timestamps
- School Intelligence fields when the node is a School
- Incoming and outgoing relationships with evidence and status
- Complete source records and reliability
- Connected projects and content
- Integrity warnings for the selected record
- Edit and archive actions

The overlay uses one close action, traps focus, closes with Escape, prevents background scrolling and interaction, and restores focus when dismissed. Connected nodes can be expanded in the same overlay, and connected projects open in the existing Project Workspace.

## Manual Actions

Authenticated administrators can manually create sources, create/edit/archive nodes, and create relationships. The node form supports general nodes plus the canonical School, Project, and Content fields. Source IDs must resolve to existing active same-workspace source records. Source dates use strict calendar validation before ISO normalization, so impossible dates and malformed UTC or numeric offsets are rejected with the Founder-facing source message instead of silently rolling into another date. The relationship form uses the canonical compatibility matrix to show only valid active source and target node types for the selected directed relationship. Invalid, reversed, unsupported, orphaned, cross-workspace, archived, or insufficiently sourced records are rejected with a visible Headquarters message. Equivalent concurrent creates resolve to the established canonical record without persisting a duplicate.

Archiving preserves the record and its history. A node with active relationships identifies those relationships and remains unarchivable until they are archived. The interface does not hard-delete canonical knowledge.

## Empty, Loading, and Error States

An empty graph displays a clear no-records state and keeps the create action available. Loading, persistent-storage unavailable, validation, and persistence failures are surfaced in visible status regions. The page does not substitute records from another project or workspace.

## Validation Checklist

- Admin authentication allows the protected route.
- Non-admin and unauthenticated access remain denied.
- Overview metrics and recently updated records render from canonical data.
- Search, filters, and sorting are deterministic.
- School region and state filters use approved data.
- Node details show source provenance, confidence, relationships, and projects.
- Incoming and outgoing relationship direction is clear.
- Create, edit, and archive reject invalid records and preserve history.
- Impossible calendar dates are rejected before persistence; valid local, UTC, and offset instants reopen consistently.
- Canonical history and linked audit records retain their required actor, time, subject, version, and field shape.
- The overlay remains usable at laptop and smaller viewports.
- No AI, LLM, external search, or public-site behavior is present.

## Validation Status and Remaining Work

The Founder completed functional Knowledge Center validation with populated protected Firestore data before the P1 integrity remediation. That earlier session covered the protected route, approved-admin access, then-deployed rules, source dates and persistence, State/Region/School creation, Ohio to Greater Lakes mapping, provenance, relationship direction and ownership, search, filters, sorting, archive visibility, non-admin and signed-out denial, responsive Founder UX, and console health.

The remediation now has automated runtime, in-memory, rules, and emulator evidence. The in-memory repository stages and validates a complete next state before replacing subject and audit state together, and Firestore rules constrain canonical history maps plus the linked audit shape. Fixture-backed Ashland tests demonstrate representative legacy compatibility.

Post-remediation Founder validation confirmed that the actual Founder-created Ashland University Athletics Source record and the actual Founder-created Ashland University School record were reopened successfully. Both records were edited and saved, refresh persistence passed, both records remained readable, and no runtime or browser-console errors were observed. Live relationship records were not separately revalidated and are not included in this confirmation. Release 3.1 Capability 1 is released, EO-046 through EO-049 are complete, and Engineering Complete, Founder Validation, Independent Review, and Merge Approval all passed. Accepted P2/P3 technical debt remains tracked. Import tooling, explicit conflict-resolution workflows, future CIO reasoning, and EO-050 remain outside these orders and have not started.

Accepted P2 debt includes the aggregate uniqueness registries' eventual document-size and contention limits, repository-derived audit semantics, the approved-admin direct-client trust boundary, and qualified legacy reconstruction. Privileged Firebase Admin SDK or Console access bypassing Firestore rules under project IAM remains an accepted P3 operational boundary. These do not change the supported client repository boundary, but they remain explicit review and operations concerns.

## Founder Validation Record Before Integrity Remediation

The Founder completed the following checklist using source-supported facts before the P1 integrity remediation. No unsupported record was added. This historical record must not be read as post-remediation live validation.

1. Sign in with the approved admin account and open `/executive-workspace/knowledge` from Knowledge Center navigation.
2. Create one official verified source, confirm the required Accessed At value, and copy the returned Source ID.
3. Create a verified State node and Region node using only the source-backed location and approved Hoop Frens Region value. Ohio requires Greater Lakes.
4. Create a verified School node, selecting the State and Region nodes and attaching the Source ID. Confirm the read-only State and Region fields derive automatically from those nodes.
5. Refresh, reopen the Source record, and confirm its Accessed At value and source-backed records persist.
6. Edit a permitted School field supported by the source, refresh, and confirm the edit persists.
7. Create `SCHOOL_LOCATED_IN_STATE` and `SCHOOL_LOCATED_IN_REGION` relationships using the same source.
8. Open the School and confirm both outgoing relationships, direction, confidence, and provenance render.
9. Verify name/alias search, Type/Confidence/Status/Region/State filters, and Name/Updated/Confidence/Type sorting.
10. Archive a validation-only node and confirm it remains available under Status: Archived and is not treated as active.
11. Confirm the authenticated non-admin account receives Access Restricted with no graph data.
12. Confirm a signed-out session is denied.
13. Confirm no browser console warnings or errors occur during the successful flow.

### Minimal Validation Records

Create these manually; placeholders below must be replaced with values visible in the selected official source.

- **KnowledgeSource:** `title`, official `url`, `publisher`, `sourceType=official`, `accessedAt`, `reliability=official`, optional `publishedAt`, verification `notes`, and any existing connected `projectIds`.
- **State node:** `type=state`, canonical `name`, `description`, `confidence=verified`, returned `sourceIds`, optional aliases/tags, and active status supplied by the form.
- **Region node:** `type=region`, approved Region `name`, `description`, `confidence=verified`, returned `sourceIds`, optional aliases/tags, and active status supplied by the form.
- **School node:** canonical `name` and `officialName`, `description`, `city`, derived `state`, selected State node, derived approved `region`, selected Region node, `division`, `governingBody`, `schoolWebsite`, `athleticsWebsite`, `confidence=verified`, canonical `sourceIds`, optional supported enrollment/tuition/institution type, supported recruiting notes, aliases/tags, and optional `lastVerifiedAt`. Conference, Coach, Facility, Project, and Content facts are added through relationships rather than compact School fields.
- **State relationship:** School as `fromNodeId`, State as `toNodeId`, `SCHOOL_LOCATED_IN_STATE`, `confidence=verified`, Source ID, optional supported description/project IDs.
- **Region relationship:** School as `fromNodeId`, Region as `toNodeId`, `SCHOOL_LOCATED_IN_REGION`, `confidence=verified`, Source ID, optional supported description/project IDs.
