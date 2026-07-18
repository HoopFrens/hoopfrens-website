# Knowledge Graph

## Status and Scope

EO-046 through EO-049 implement the deterministic Knowledge Graph foundation for Release 3.1. Founder validation of the protected Knowledge Center, persisted source/node/relationship flow, approved regional model, search, filters, sorting, archival visibility, access denial, and responsive Founder experience was completed before the P1 integrity remediation. The remediation now has complete automated and emulator verification.

Post-remediation Founder validation confirmed that the actual Founder-created Ashland University Athletics Source record and the actual Founder-created Ashland University School record were reopened successfully. Both records were edited and saved, refresh persistence passed, both records remained readable, and no runtime or browser-console errors were observed. Live relationship records were not separately revalidated and are not included in this confirmation. The capability is implemented, Founder validated, and awaiting its final commit and pull request.

The graph is an internal Headquarters capability. It does not add AI, external search, autonomous collection, or public-site behavior.

## Canonical Records

The graph persists three canonical record types and an immutable audit stream:

- `KnowledgeNode` represents a canonical entity.
- `KnowledgeRelationship` represents a directed, source-backed connection between two nodes.
- `KnowledgeSource` represents evidence that can support nodes and relationships.
- `KnowledgeAuditEvent` identifies the authenticated actor and immutable version produced by a mutation.

Supported node types are School, Coach, Conference, Player, Facility, Region, State, Organization, Project, and Content. Every node carries a stable ID, workspace ownership, category, canonical name, description, confidence, canonical source IDs, aliases, tags, status, actors, timestamps, and immutable version history. A node may carry at most three distinct aliases in addition to its canonical name so every identity can be checked within Firestore's rules-expression limit.

School nodes add official name, nickname, city, state, approved Hoop Frens knowledge region, division, governing body, official websites, optional enrollment and tuition, institution type, recruiting notes, and the last verification time. Conference, Coach, Facility, Project, and Content facts are resolved from active same-workspace relationships. Legacy compact School references remain readable for compatibility but are not persisted as authoritative current facts.

The canonical Knowledge Graph regions are Northeast, Mid-Atlantic, Southeast, Gulf States, Greater Lakes, Midwest, Texas, Southwest, and Northwest. National, West, and International remain valid only in the legacy Release 2 `Region` model; they are not Knowledge Graph regional classifications. School forms derive `state` from the selected State node and derive `region` from the selected approved Region node.

State mapping is deterministic: Northeast contains ME, NH, VT, MA, RI, CT, NY, and NJ; Mid-Atlantic contains DE, PA, DC, WV, and VA; Southeast contains NC, SC, GA, TN, and KY; Gulf States contains AL, FL, MS, and LA; Greater Lakes contains OH, MI, IL, IN, and WI; Midwest contains AR, MO, IA, MN, OK, KS, NE, ND, and SD; Texas contains TX, CO, and NM; Southwest contains AZ, UT, NV, and CA; Northwest contains WA, OR, ID, MT, WY, AK, and HI.

## Relationship Policy

One compatibility matrix is authoritative for forms, domain validation, repository mutations, integrity evaluation, and the endpoint checks that Firestore rules can enforce.

| Relationship | From | To | Exclusive endpoint | Active multiplicity |
| --- | --- | --- | --- | --- |
| `SCHOOL_LOCATED_IN_STATE` | School | State | From School | One State per School; many Schools per State |
| `SCHOOL_LOCATED_IN_REGION` | School | Region | From School | One Region per School; many Schools per Region |
| `SCHOOL_BELONGS_TO_CONFERENCE` | School | Conference | From School | One Conference per School; many Schools per Conference |
| `SCHOOL_HAS_COACH` | School | Coach | To Coach | Many Coaches per School; one School per Coach |
| `COACH_WORKS_AT_SCHOOL` | Coach | School | From Coach | One School per Coach; many Coaches per School |
| `SCHOOL_HAS_FACILITY` | School | Facility | To Facility | Many Facilities per School; one School per Facility |
| `FACILITY_BELONGS_TO_SCHOOL` | Facility | School | From Facility | One School per Facility; many Facilities per School |
| `CONFERENCE_GOVERNS_SCHOOL` | Conference | School | To School | Many Schools per Conference; one Conference per School |
| `PROJECT_ABOUT_SCHOOL` | Project | School | None | Many-to-many |
| `CONTENT_ABOUT_SCHOOL` | Content | School | None | Many-to-many |
| `PLAYER_CONNECTED_TO_SCHOOL` | Player | School | None | Many-to-many |

Relationships require two different active nodes in the same workspace. Reversed, incompatible, missing, archived, same-node, and cross-workspace endpoints are rejected. Endpoint identity and relationship type are immutable after creation.

The inverse labels `SCHOOL_HAS_COACH`/`COACH_WORKS_AT_SCHOOL`, `SCHOOL_HAS_FACILITY`/`FACILITY_BELONGS_TO_SCHOOL`, and `SCHOOL_BELONGS_TO_CONFERENCE`/`CONFERENCE_GOVERNS_SCHOOL` share one semantic identity and exclusive-claim namespace. Authoring the inverse label for the same endpoints resolves to the existing relationship instead of creating a duplicate fact.

## Firestore Persistence and Atomicity

The Firestore repository uses the protected Headquarters data boundary:

| Collection | Purpose |
| --- | --- |
| `internalKnowledgeNodes` | Canonical entity records and immutable versions |
| `internalKnowledgeRelationships` | Directed graph edges and immutable versions |
| `internalKnowledgeSources` | Canonical source provenance |
| `internalKnowledgeAuditEvents` | Immutable mutation attribution and version links |
| `internalKnowledgeUniqueness` | Transactional node and relationship identity registries, exclusive-claim state, source-usage state, and endpoint guards |

New node names and aliases are claimed through workspace-and-type-scoped transactional registries. Every new exact relationship claims its deterministic identity key in the workspace relationship registry in the same transaction as the relationship. Registry ownership entries cannot be removed or reassigned, so active retries resolve to the established canonical record and archived identities remain reserved. Before the first post-remediation mutation for an affected registry, the repository transactionally enrolls untouched legacy records and rejects any pre-existing collision instead of silently choosing an owner. Earlier per-relationship identity-claim documents remain immutable and readable to approved administrators, but the supported repository no longer creates or consults them.

Exclusive relationship conflicts are preserved without exceeding Firestore's fixed rules-expression budget. The candidate, all competing claims needed for the decision, any peer whose confidence changes, immutable identity ownership, source-usage state, and the linked mutation audits are handled in one bounded transaction. Each claim retains its own canonical source IDs; conflict detection changes confidence and history without merging one claim's evidence into another. A rejected transaction leaves no partial candidate, peer update, or audit record.

Repository interfaces isolate domain behavior from Firestore. The in-memory implementation follows the same endpoint, provenance, history, archival, attribution, and duplicate behavior for deterministic tests. Its mutations stage the complete next subject-and-audit state, validate that state, and then apply one store replacement; injected audit failure therefore leaves both the subject and audit stream unchanged. This is deterministic in-process parity evidence, not a substitute for Firestore transaction or emulator evidence.

New and updated records bind `createdBy`, `updatedBy`, audit `actorId`, and mutation times to the authenticated actor and authoritative write time. Caller-supplied actor or timestamp values are not authoritative. Rules require matching authenticated identity and request time, preserve the original creator, keep audit events immutable, and deny hard deletion. Rules also require canonical map-shaped version, status, and confidence histories; preserve prior history entries; require the next version entry; bind confidence, status, and provenance history to the resulting subject state; and constrain the linked audit document to its canonical subject, version, actor, timestamp, fields, and metadata shape. The audit ID is deterministic from subject type, subject ID, and the current version key, so an earlier audit cannot authorize a later mutation. The supported repository commits every subject mutation with its linked audit event in the same transaction. Full first-mutation legacy-history validation is divided across those atomic subject and audit writes to remain within Firestore's per-operation expression budget. An audit failure rejects the complete mutation instead of leaving a partially evidenced record. Missing or mismatched non-legacy audit references produce integrity warnings. Records carrying an explicit `legacy:` audit sentinel remain readable as unaudited compatibility data until a supported mutation creates a current deterministic audit. The generic collection rule excludes all protected Knowledge Graph collections.

From the repository root, deploy only these rules to the configured Firebase project with:

`npx --yes firebase-tools@15.23.0 deploy --only firestore:rules --project hoopfrens-web`

## Provenance and Confidence

Canonical evidence on nodes and relationships is persisted as source IDs. A rules-required empty `sources` marker prevents direct client writes from storing caller-supplied embedded summaries; display titles, publishers, reliability, and status are resolved from `internalKnowledgeSources`. Every source referenced by an active canonical claim must exist, be active, and belong to the same workspace. Missing, archived, and foreign-workspace sources are rejected for new or updated active claims. The integrity evaluator also surfaces unresolved or archived provenance in legacy records.

Nodes may reference up to four canonical sources and each relationship may reference up to two. These per-record provenance bounds keep Firestore rules evaluation within the platform's document-access limits; they do not impose a combined source cap across competing relationships. Additional evidence for one claim belongs in a consolidated canonical Source record rather than an unbounded embedded list.

Manually verified sources require `accessedAt`. One shared strict calendar-date validator rejects impossible dates, invalid month/day combinations, non-leap-year February 29, malformed time components, and malformed UTC or numeric offsets before normalization. The form initializes `accessedAt` from the Founder’s local date and time, preserves the selected instant during canonical ISO-8601 conversion, and restores the same local value when displayed. `publishedAt` remains optional and is omitted when blank. Optional `undefined` properties are removed before writes; required missing fields fail runtime validation with the Founder-facing source-date message.

Approved confidence values are Verified, Supported, Inferred, Unverified, and Conflicting. Verified claims require active canonical evidence. A Conflicting node requires at least two sources. Each Conflicting relationship requires at least one active source and retains its own evidence rather than inheriting or merging a competing claim's sources. An unresolved exclusive conflict cannot be promoted to Verified. A lower-confidence update cannot silently erase Verified evidence: prior sources, claim data, confidence, status, actor, time, and change reason remain in immutable versions and linked audit events.

## Archive Integrity

Records are archived rather than deleted. A node cannot be archived while it has active relationships; the Founder must archive those relationships first. The node archive and relationship-create paths contend on the same endpoint guards so they cannot race into an active relationship with an archived endpoint. The integrity evaluator reports legacy stale edges whose endpoints are missing or archived.

For supported repository mutations, active claims require active same-workspace sources and source-usage state is updated atomically with the claim. Supported source archival is blocked while indexed or legacy active claims reference that source. History is retained, and create, update, archive, confidence, and conflict events link to the corresponding immutable version.

## Runtime Validation and Compatibility

Complete runtime parsers validate nodes (including School fields), relationships, sources, audit events, source references, confidence and status histories, enums, arrays, actors, and strict calendar timestamps before serialization, at repository write boundaries, and after Firestore reads. Exact allowlists reject unsupported top-level, nested reference, version, and history fields. Malformed persisted records and calendar-impossible timestamps are rejected rather than blindly cast or normalized into a different date.

Fixture-backed Ashland compatibility tests show that representative legacy validation records remain readable through explicit defaults for fields introduced by the remediation, including valid leap-day timestamps. Separate live Founder validation confirmed the connected Ashland University Athletics Source and Ashland University School records as described in the status section; it did not separately revalidate live relationship records. When a pre-versioned record is first mutated through the repository, its original list-shaped histories are retained in an immutable compatibility snapshot while canonical consecutive version maps are created. Canonical entries synthesized to fill missing pre-versioned fields are compatibility reconstructions, not independently verified historical attribution; when a raw list existed, the preserved `legacyHistorySnapshot` is the authoritative pre-migration history. Existing legacy audit events without a version are read with a version-1 compatibility default; records without an audit ID receive a `legacy:` sentinel rather than fabricated history. Before a supported mutation, legacy node and relationship source usage is enrolled and active sources are revalidated, including multi-source records within the canonical four-source node and two-source relationship bounds. Legacy embedded source summaries and School compact references may be read to preserve the historical record, but canonical current displays resolve source and connected-entity facts from their collections and relationships. Older derived relationship identity keys are recomputed from the unchanged type and endpoints when read so the three inverse semantic families remain compatible. Unknown relationship labels are rejected; no broad relationship-label normalization or automatic production-data mutation is performed on page load.

## Authorization

The graph inherits the Headquarters fail-closed authorization flow. Only an authenticated user whose `users/{uid}` document has `role === "admin"` may render protected Headquarters content. Missing users, missing roles, non-admin roles, unauthenticated sessions, and lookup failures remain denied. Firestore rules remain the server-enforced boundary.

## Current Limitations and Future Integration

- Knowledge entry and editing are manual and deterministic.
- No source collection, web search, AI inference, recommendation generation, or autonomous mutation is included.
- No unsupported facts are fabricated, and no production record is mutated during page load.
- **P2 future scaling work:** The low-volume Founder workflow uses transactional registries. Registry writes serialize mutations that contend on the same workspace/type node registry or the same workspace-level relationship or source registry. These registries must be sharded before approaching Firestore's document-size ceiling.
- **P2 application-admin hardening debt:** The canonical repositories are the supported client mutation boundary. Rules bind protected registry writes to an approved admin and request-time attribution, preserve node-owner claims and immutable exact-owner entries in the workspace relationship registry, reject embedded source summaries, and validate the registry state used by canonical subject mutations. Rules cannot recompute Unicode/case-normalized node keys from display names, derive every audit label or metadata value from the mutation, or fully prove every standalone aggregate endpoint/source-usage registry delta within the platform expression budget. Direct client writes by an approved Headquarters administrator outside the supported repository therefore remain an application-admin operational trust boundary; emulator races prove atomicity through the supported repository path.
- **P2 runtime and compatibility boundary:** Firestore rules enforce mutation-critical attribution, provenance, identity, registry, endpoint, and version-link invariants. Exhaustive current record-shape validation remains at the repository/runtime boundary because duplicating every runtime allowlist in rules exceeds the evaluator budget. Historical facts absent from pre-versioned records cannot be exhaustively reconstructed and remain explicitly qualified compatibility data.
- Canonical subject mutations and their deterministic audit events are atomic through the supported repository. Missing or mismatched non-legacy audits remain integrity warnings. Explicit `legacy:` sentinels remain readable compatibility data and require a supported mutation or IAM-controlled operational remediation rather than inferred history.
- **P3 platform boundary:** Firestore rules constrain authenticated client SDK writes. Firebase Admin SDK and Console access bypass rules by platform design and remain governed through project IAM and operational access control.
- Import tooling, explicit conflict-resolution workflows, and CIO reasoning remain future work under separately approved Engineering Orders.
- Future capabilities must consume canonical records through repository/service boundaries and preserve provenance, confidence, authorization, and immutable history.
