import {
  connectedContentIds,
  connectedProjectIds,
  connectionsForNode,
  formatKnowledgeLabel,
} from "@/components/executive/knowledgeExplorerUtils";
import {
  isSchoolKnowledgeNode,
  type KnowledgeIntegrityWarning,
  type KnowledgeNode,
  KnowledgeNodeType,
  type KnowledgeRelationship,
  KnowledgeRelationshipType,
  type KnowledgeSource,
  KnowledgeStatus,
} from "@/domain/knowledge";
import { AlertTriangle, ArrowUpRight, Archive, BookOpen, Link2, Pencil } from "lucide-react";
import Link from "next/link";
import { formatHoopFrensRegion } from "@/domain/shared";

type KnowledgeNodeDetailProps = {
  node: KnowledgeNode;
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  sources: KnowledgeSource[];
  integrityWarnings: KnowledgeIntegrityWarning[];
  actionPending: boolean;
  onOpenNode(nodeId: string): void;
  onEdit(): void;
  onArchive(): void;
  onArchiveRelationship(relationshipId: string): void;
};

function formatMoney(value: number | undefined, currency: string) {
  if (value === undefined) return "Not recorded";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function KnowledgeNodeDetail({
  node,
  nodes,
  relationships,
  sources,
  integrityWarnings,
  actionPending,
  onOpenNode,
  onEdit,
  onArchive,
  onArchiveRelationship,
}: KnowledgeNodeDetailProps) {
  const connections = connectionsForNode(node.id, nodes, relationships);
  const activeConnections = connections.filter(
    ({ relationship }) => relationship.status === KnowledgeStatus.Active,
  );
  const activeConferenceNames = connections
    .filter(({ relationship, connectedNode }) => (
      relationship.status === KnowledgeStatus.Active
      && connectedNode.status === KnowledgeStatus.Active
      && connectedNode.type === KnowledgeNodeType.Conference
      && (
        relationship.relationshipType === KnowledgeRelationshipType.SchoolBelongsToConference
        || relationship.relationshipType === KnowledgeRelationshipType.ConferenceGovernsSchool
      )
    ))
    .map(({ connectedNode }) => connectedNode.name);
  const projectIds = connectedProjectIds(node, nodes, relationships);
  const contentIds = connectedContentIds(node, nodes, relationships);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const nodeWarnings = integrityWarnings.filter(
    (warning) => warning.nodeId === node.id
      || connections.some((connection) => connection.relationship.id === warning.relationshipId),
  );

  return (
    <div className="grid gap-6" data-knowledge-node-detail="true">
      <section className="border border-white/10 bg-black p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">
              {formatKnowledgeLabel(node.category)} · {formatKnowledgeLabel(node.type)}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{node.name}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{node.description || "No description has been recorded."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:border-red-500">
              <Pencil aria-hidden="true" size={14} /> Edit
            </button>
            {node.status === KnowledgeStatus.Active ? (
              <button type="button" disabled={actionPending || activeConnections.length > 0} aria-describedby={activeConnections.length > 0 ? "knowledge-node-archive-requirements" : undefined} onClick={onArchive} className="inline-flex items-center gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-200 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
                <Archive aria-hidden="true" size={14} /> Archive
              </button>
            ) : null}
          </div>
        </div>
        {node.status === KnowledgeStatus.Active && activeConnections.length > 0 ? (
          <p id="knowledge-node-archive-requirements" className="mt-4 border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs font-bold leading-5 text-amber-100">
            Archive the active relationships first: {activeConnections.map(({ relationship }) => relationship.id).join(", ")}.
          </p>
        ) : null}
        <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Confidence", formatKnowledgeLabel(node.confidence)],
            ["Status", formatKnowledgeLabel(node.status)],
            ["Created", new Date(node.createdAt).toLocaleString()],
            ["Updated", new Date(node.updatedAt).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="border border-white/10 bg-white/[0.03] p-3">
              <dt className="font-black uppercase tracking-wider text-zinc-600">{label}</dt>
              <dd className="mt-1 font-black text-white">{value}</dd>
            </div>
          ))}
        </dl>
        {node.aliases.length > 0 || node.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {[...node.aliases.map((alias) => `Alias: ${alias}`), ...node.tags.map((tag) => `#${tag}`)].map((label) => (
              <span key={label} className="border border-white/10 px-2.5 py-1 text-[10px] font-black text-zinc-400">{label}</span>
            ))}
          </div>
        ) : null}
      </section>

      {nodeWarnings.length > 0 ? (
        <section className="border border-amber-500/30 bg-amber-500/10 p-5" aria-labelledby="knowledge-integrity-title">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="text-amber-300" size={17} />
            <h3 id="knowledge-integrity-title" className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Integrity Warnings</h3>
          </div>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-100/80">
            {nodeWarnings.map((warning) => <li key={warning.id}>{warning.message}</li>)}
          </ul>
        </section>
      ) : null}

      {isSchoolKnowledgeNode(node) ? (
        <section className="border border-white/10 bg-black p-5 sm:p-6" aria-labelledby="school-intelligence-title">
          <h3 id="school-intelligence-title" className="text-xs font-black uppercase tracking-[0.18em] text-white">School Intelligence</h3>
          <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Official Name", node.officialName],
              ["Nickname", node.nickname || "Not recorded"],
              ["Location", `${node.city}, ${node.state}`],
              ["Region", formatHoopFrensRegion(node.region)],
              ["Conference", activeConferenceNames.length > 0 ? activeConferenceNames.join(" · ") : "Not connected"],
              ["Division", node.division],
              ["Governing Body", node.governingBody],
              ["Enrollment", node.enrollment?.toLocaleString() || "Not recorded"],
              ["Public or Private", node.publicOrPrivate ? formatKnowledgeLabel(node.publicOrPrivate) : "Not recorded"],
              ["In-state Tuition", node.tuition ? formatMoney(node.tuition.inState, node.tuition.currency) : "Not recorded"],
              ["Out-of-state Tuition", node.tuition ? formatMoney(node.tuition.outOfState, node.tuition.currency) : "Not recorded"],
              ["Last Verified", node.lastVerifiedAt ? new Date(node.lastVerifiedAt).toLocaleString() : "Not verified"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{label}</dt>
                <dd className="mt-1 font-bold text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={node.schoolWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-400 hover:text-red-300">School website <ArrowUpRight aria-hidden="true" size={14} /></a>
            <a href={node.athleticsWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-400 hover:text-red-300">Athletics <ArrowUpRight aria-hidden="true" size={14} /></a>
          </div>
          {node.recruitingNotes.length > 0 ? (
            <div className="mt-6">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Recruiting Notes</h4>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-zinc-300">{node.recruitingNotes.map((note) => <li key={note} className="border-l border-red-500/50 pl-3">{note}</li>)}</ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="border border-white/10 bg-black p-5 sm:p-6" aria-labelledby="knowledge-relationships-title">
        <div className="flex items-center gap-2"><Link2 aria-hidden="true" className="text-red-500" size={16} /><h3 id="knowledge-relationships-title" className="text-xs font-black uppercase tracking-[0.18em] text-white">Relationship View</h3></div>
        {connections.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {connections.map(({ relationship, connectedNode, direction }) => (
              <article key={relationship.id} className="border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => onOpenNode(connectedNode.id)} className="text-left text-sm font-black text-white hover:text-red-300">{connectedNode.name}</button>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${relationship.confidence === "conflicting" ? "text-amber-300" : "text-zinc-500"}`}>{formatKnowledgeLabel(relationship.confidence)}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-zinc-400">{direction === "outgoing" ? "Outgoing" : "Incoming"} · {formatKnowledgeLabel(relationship.relationshipType)}</p>
                {relationship.description ? <p className="mt-2 text-xs leading-5 text-zinc-500">{relationship.description}</p> : null}
                <p className="mt-2 text-xs text-zinc-600">
                  {relationship.sourceIds.map((sourceId) => {
                    const source = sourceById.get(sourceId);
                    if (!source) return `Missing source ${sourceId}`;
                    return `${source.title}${source.status === KnowledgeStatus.Archived ? " (Archived)" : ""}`;
                  }).join(" · ")} · {formatKnowledgeLabel(relationship.status)}
                </p>
                {relationship.status === KnowledgeStatus.Active ? (
                  <button type="button" disabled={actionPending} onClick={() => onArchiveRelationship(relationship.id)} className="mt-3 inline-flex items-center gap-2 border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
                    <Archive aria-hidden="true" size={13} /> Archive relationship
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : <p className="mt-4 text-sm leading-6 text-zinc-500">No relationships have been recorded for this node.</p>}
      </section>

      <section className="border border-white/10 bg-black p-5 sm:p-6" aria-labelledby="knowledge-sources-title">
        <div className="flex items-center gap-2"><BookOpen aria-hidden="true" className="text-red-500" size={16} /><h3 id="knowledge-sources-title" className="text-xs font-black uppercase tracking-[0.18em] text-white">Sources</h3></div>
        {node.sourceIds.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {node.sourceIds.map((sourceId) => {
              const source = sourceById.get(sourceId);
              return (
                <article key={sourceId} className="border-l border-white/15 pl-4">
                  <p className="text-sm font-black text-white">{source?.title || `Missing source ${sourceId}`}</p>
                  {source ? <p className="mt-1 text-xs text-zinc-500">{formatKnowledgeLabel(source.sourceType)} · {formatKnowledgeLabel(source.reliability)} reliability{source.publisher ? ` · ${source.publisher}` : ""}</p> : null}
                  {source?.notes ? <p className="mt-2 text-xs leading-5 text-zinc-400">{source.notes}</p> : null}
                  {source?.url ? <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-red-400 hover:text-red-300">Open source <ArrowUpRight aria-hidden="true" size={13} /></a> : null}
                </article>
              );
            })}
          </div>
        ) : <p className="mt-4 text-sm leading-6 text-zinc-500">No sources are attached. This node must remain explicitly unverified.</p>}
      </section>

      <section className="border border-white/10 bg-black p-5 sm:p-6" aria-labelledby="knowledge-history-title">
        <h3 id="knowledge-history-title" className="text-xs font-black uppercase tracking-[0.18em] text-white">Canonical History</h3>
        <div className="mt-4 grid gap-3">
          {[...node.versionHistory].reverse().map((version) => (
            <article key={version.version} className="border-l border-white/15 pl-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-white">Version {version.version} · {formatKnowledgeLabel(version.confidence)}</p>
                <time dateTime={version.changedAt} className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{new Date(version.changedAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-xs font-bold leading-5 text-zinc-400">{version.reason}</p>
              <p className="mt-1 text-[10px] font-bold text-zinc-600">Actor {version.changedBy} · {version.sourceIds.length} canonical source{version.sourceIds.length === 1 ? "" : "s"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-white/10 bg-black p-5"><h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">Connected Projects</h3>{projectIds.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{projectIds.map((projectId) => <Link key={projectId} href={`/executive-workspace/projects?projectId=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/20">Open connected project <ArrowUpRight aria-hidden="true" size={13} /></Link>)}</div> : <p className="mt-3 text-sm text-zinc-500">No connected projects.</p>}</div>
        <div className="border border-white/10 bg-black p-5"><h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">Connected Content</h3>{contentIds.length > 0 ? <ul className="mt-4 grid gap-2 text-sm font-bold text-zinc-300">{contentIds.map((contentId) => <li key={contentId} className="border-l border-red-500/40 pl-3">{contentId}</li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">No connected content.</p>}</div>
      </section>
    </div>
  );
}
