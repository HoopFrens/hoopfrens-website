"use client";

import { KnowledgeNodeDetail } from "@/components/executive/KnowledgeNodeDetail";
import { KnowledgeNodeForm } from "@/components/executive/KnowledgeNodeForm";
import { KnowledgeNodeList } from "@/components/executive/KnowledgeNodeList";
import { KnowledgeRelationshipForm } from "@/components/executive/KnowledgeRelationshipForm";
import { KnowledgeSourceDetail } from "@/components/executive/KnowledgeSourceDetail";
import { KnowledgeSourceForm } from "@/components/executive/KnowledgeSourceForm";
import { PackageOverlay } from "@/components/executive/PackageOverlay";
import {
  allKnowledgeFilters,
  connectedProjectIds,
  filterKnowledgeNodes,
  formatKnowledgeLabel,
  knowledgeOverview,
  type KnowledgeSortOption,
  schoolStates,
} from "@/components/executive/knowledgeExplorerUtils";
import {
  createFirestoreKnowledgeGraphRepository,
  evaluateKnowledgeIntegrity,
  knowledgeSourceDateValidationMessage,
  KnowledgeConfidence,
  type KnowledgeGraph,
  type KnowledgeNode,
  type KnowledgeNodeCreateInput,
  KnowledgeNodeType,
  type KnowledgeRelationship,
  type KnowledgeRelationshipCreateInput,
  type KnowledgeSource,
  type KnowledgeSourceCreateInput,
  KnowledgeStatus,
} from "@/domain/knowledge";
import { formatHoopFrensRegion, KnowledgeRegion } from "@/domain/shared";
import { db } from "@/lib/firebase";
import { founderKnowledgeErrorMessage, knowledgeService } from "@/services";
import { AlertTriangle, BookOpen, Database, Loader2, Network, Plus, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type KnowledgeExplorerProps = {
  currentUserId: string;
  initialNodes?: KnowledgeNode[];
  initialRelationships?: KnowledgeRelationship[];
  initialSources?: KnowledgeSource[];
  loadFromFirestore?: boolean;
};

type OverlayMode = "detail" | "create" | "edit" | "create-source" | "source-detail" | "create-relationship" | null;
const executiveWorkspaceId = "executive-workspace";

function logKnowledgeActionError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  const detail = error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: "Non-error source save failure." };
  console.error(`[Knowledge Center] ${action} failed.`, detail);
}

export function KnowledgeExplorer({
  currentUserId,
  initialNodes = [],
  initialRelationships = [],
  initialSources = [],
  loadFromFirestore = true,
}: KnowledgeExplorerProps) {
  const [graph, setGraph] = useState<KnowledgeGraph>({
    nodes: initialNodes,
    relationships: initialRelationships,
    sources: initialSources,
    auditEvents: [],
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<KnowledgeNodeType | typeof allKnowledgeFilters>(allKnowledgeFilters);
  const [confidenceFilter, setConfidenceFilter] = useState<KnowledgeConfidence | typeof allKnowledgeFilters>(allKnowledgeFilters);
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | typeof allKnowledgeFilters>(allKnowledgeFilters);
  const [regionFilter, setRegionFilter] = useState<KnowledgeRegion | typeof allKnowledgeFilters>(allKnowledgeFilters);
  const [stateFilter, setStateFilter] = useState<string | typeof allKnowledgeFilters>(allKnowledgeFilters);
  const [sort, setSort] = useState<KnowledgeSortOption>("name");
  const [loading, setLoading] = useState(loadFromFirestore && Boolean(db));
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState(loadFromFirestore && !db ? "Persistent Knowledge Graph data is unavailable." : "");
  const [actionMessage, setActionMessage] = useState("");
  const repository = useMemo(() => (db ? createFirestoreKnowledgeGraphRepository(db) : null), []);
  const overlayTriggerRef = useRef<HTMLButtonElement | null>(null);

  async function refreshGraph() {
    if (!repository) return;
    const refreshedGraph = await knowledgeService.loadGraph(repository, executiveWorkspaceId);
    setGraph(refreshedGraph);
  }

  useEffect(() => {
    if (!loadFromFirestore || !repository) return;
    const activeRepository = repository;
    let active = true;
    async function loadKnowledgeGraph() {
      try {
        const loadedGraph = await knowledgeService.loadGraph(activeRepository, executiveWorkspaceId);
        if (!active) return;
        setGraph(loadedGraph);
        setError("");
      } catch {
        if (active) setError("Headquarters could not load the Knowledge Graph.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadKnowledgeGraph();
    return () => { active = false; };
  }, [loadFromFirestore, repository]);

  const filteredNodes = useMemo(() => filterKnowledgeNodes(graph.nodes, {
    query,
    type: typeFilter,
    confidence: confidenceFilter,
    status: statusFilter,
    region: regionFilter,
    state: stateFilter,
    sort,
  }, graph.sources), [confidenceFilter, graph.nodes, graph.sources, query, regionFilter, sort, stateFilter, statusFilter, typeFilter]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedSource = graph.sources.find((source) => source.id === selectedSourceId) || null;
  const integrityWarnings = useMemo(() => evaluateKnowledgeIntegrity(graph), [graph]);
  const overview = useMemo(() => knowledgeOverview(graph.nodes, graph.relationships), [graph.nodes, graph.relationships]);
  const states = useMemo(() => schoolStates(graph.nodes), [graph.nodes]);
  const connectedProjects = useMemo(() => {
    const projectIds = new Set<string>();
    for (const node of graph.nodes) connectedProjectIds(node, graph.nodes, graph.relationships).forEach((projectId) => projectIds.add(projectId));
    return projectIds.size;
  }, [graph.nodes, graph.relationships]);
  const activeNodes = useMemo(() => graph.nodes.filter((node) => node.status === KnowledgeStatus.Active), [graph.nodes]);
  const activeSources = useMemo(() => graph.sources.filter((source) => source.status === KnowledgeStatus.Active), [graph.sources]);
  const relationshipCreationReady = activeNodes.length >= 2 && activeSources.length >= 1;
  const summaryCards: Array<{ label: string; value: number; icon: LucideIcon; warning?: boolean }> = [
    { label: "Knowledge Nodes", value: overview.totalNodes, icon: Database },
    { label: "Relationships", value: overview.totalRelationships, icon: Network },
    { label: "Verified", value: overview.verified, icon: ShieldCheck },
    { label: "Unverified", value: overview.unverified, icon: AlertTriangle, warning: overview.unverified > 0 },
    { label: "Conflicting", value: overview.conflicting, icon: AlertTriangle, warning: overview.conflicting > 0 },
    { label: "Connected Projects", value: connectedProjects, icon: Network },
  ];

  function openNode(nodeId: string, trigger?: HTMLButtonElement | null) {
    if (trigger) overlayTriggerRef.current = trigger;
    setSelectedNodeId(nodeId);
    setOverlayMode("detail");
    setActionMessage("");
  }

  function openSource(sourceId: string, trigger?: HTMLButtonElement | null) {
    if (trigger) overlayTriggerRef.current = trigger;
    setSelectedSourceId(sourceId);
    setOverlayMode("source-detail");
    setActionMessage("");
  }

  async function saveNode(node: KnowledgeNodeCreateInput) {
    if (!repository) {
      setActionMessage("Persistent Knowledge Graph writes are unavailable.");
      return;
    }
    setActionPending(true);
    setActionMessage("");
    try {
      const savedNode = graph.nodes.some((candidate) => candidate.id === node.id)
        ? await knowledgeService.updateNode(repository, node.id, node, { actorId: currentUserId, reason: "Founder edited a canonical knowledge node." })
        : await knowledgeService.createNode(repository, node, { actorId: currentUserId, reason: "Founder created a canonical knowledge node." });
      await refreshGraph();
      setSelectedNodeId(savedNode.id);
      setOverlayMode("detail");
    } catch (saveError) {
      logKnowledgeActionError("Node save", saveError);
      setActionMessage(founderKnowledgeErrorMessage(saveError, "Knowledge node could not be saved. Confirm the required fields and try again."));
    } finally {
      setActionPending(false);
    }
  }

  async function saveSource(source: KnowledgeSourceCreateInput) {
    if (!repository) {
      setActionMessage("Persistent Knowledge Graph writes are unavailable.");
      return;
    }
    setActionPending(true);
    setActionMessage("");
    try {
      const savedSource = await knowledgeService.createSource(repository, source, { actorId: currentUserId, reason: "Founder created a verified knowledge source." });
      await refreshGraph();
      setSelectedSourceId(savedSource.id);
      setOverlayMode("source-detail");
      setActionMessage(`Source created: ${savedSource.title}`);
    } catch (saveError) {
      logKnowledgeActionError("Source save", saveError);
      setActionMessage(founderKnowledgeErrorMessage(saveError, knowledgeSourceDateValidationMessage));
    } finally {
      setActionPending(false);
    }
  }

  async function saveRelationship(relationship: KnowledgeRelationshipCreateInput) {
    if (!repository) {
      setActionMessage("Persistent Knowledge Graph writes are unavailable.");
      return;
    }
    setActionPending(true);
    setActionMessage("");
    try {
      await knowledgeService.connectNodes(repository, relationship, { actorId: currentUserId, reason: "Founder created a canonical knowledge relationship." });
      await refreshGraph();
      setSelectedNodeId(relationship.fromNodeId);
      setOverlayMode("detail");
      setActionMessage(`Relationship created: ${formatKnowledgeLabel(relationship.relationshipType)}`);
    } catch (saveError) {
      logKnowledgeActionError("Relationship save", saveError);
      setActionMessage(founderKnowledgeErrorMessage(saveError, "Knowledge relationship could not be saved. Confirm the endpoints and source, then try again."));
    } finally {
      setActionPending(false);
    }
  }

  async function archiveSelectedNode() {
    if (!repository || !selectedNode) return;
    setActionPending(true);
    setActionMessage("");
    try {
      await knowledgeService.archiveNode(repository, selectedNode.id, { actorId: currentUserId, reason: "Founder archived a canonical knowledge node." });
      await refreshGraph();
      setOverlayMode(null);
      setSelectedNodeId(null);
    } catch (archiveError) {
      logKnowledgeActionError("Node archive", archiveError);
      setActionMessage(founderKnowledgeErrorMessage(archiveError, "Knowledge node could not be archived. Archive its active relationships first, then try again."));
    } finally {
      setActionPending(false);
    }
  }

  async function archiveRelationship(relationshipId: string) {
    if (!repository) return;
    setActionPending(true);
    setActionMessage("");
    try {
      await knowledgeService.archiveRelationship(repository, relationshipId, {
        actorId: currentUserId,
        reason: "Founder archived a canonical knowledge relationship.",
      });
      await refreshGraph();
      setActionMessage(`Relationship archived: ${relationshipId}`);
    } catch (archiveError) {
      logKnowledgeActionError("Relationship archive", archiveError);
      setActionMessage(founderKnowledgeErrorMessage(archiveError, "Knowledge relationship could not be archived. Try again."));
    } finally {
      setActionPending(false);
    }
  }

  async function archiveSelectedSource() {
    if (!repository || !selectedSource) return;
    setActionPending(true);
    setActionMessage("");
    try {
      await knowledgeService.archiveSource(repository, selectedSource.id, {
        actorId: currentUserId,
        reason: "Founder archived a canonical knowledge source.",
      });
      await refreshGraph();
      setActionMessage(`Source archived: ${selectedSource.title}`);
    } catch (archiveError) {
      logKnowledgeActionError("Source archive", archiveError);
      setActionMessage(founderKnowledgeErrorMessage(archiveError, "Knowledge source could not be archived. Remove it from active claims first, then try again."));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <section className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Canonical Intelligence</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Knowledge Center</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Search source-backed knowledge, inspect graph integrity, and manage canonical records without AI or autonomous behavior.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-200"><ShieldCheck aria-hidden="true" size={14} />Deterministic · No AI</div>
            <button type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setOverlayMode("create-source"); setSelectedNodeId(null); setActionMessage(""); }} className="inline-flex min-h-10 items-center gap-2 border border-white/15 bg-black px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:border-red-500"><BookOpen aria-hidden="true" size={15} />Create Source</button>
            <button ref={overlayTriggerRef} type="button" onClick={() => { setOverlayMode("create"); setSelectedNodeId(null); setActionMessage(""); }} className="inline-flex min-h-10 items-center gap-2 bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-red-500"><Plus aria-hidden="true" size={15} />Create Node</button>
            <button type="button" disabled={!relationshipCreationReady} aria-describedby={!relationshipCreationReady ? "knowledge-relationship-requirements" : undefined} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setOverlayMode("create-relationship"); setSelectedNodeId(null); setActionMessage(""); }} className="inline-flex min-h-10 items-center gap-2 border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-zinc-600"><Network aria-hidden="true" size={15} />Create Relationship</button>
          </div>
        </div>
        {!relationshipCreationReady ? <p id="knowledge-relationship-requirements" className="mt-3 text-xs font-bold leading-5 text-zinc-500">Relationship creation requires at least two active nodes and one active source.</p> : null}

        <dl className="mt-6 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
          {summaryCards.map(({ label, value, icon: Icon, warning }) => (
            <div key={label} className="bg-black p-4"><div className="flex items-center justify-between gap-3"><dt className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{label}</dt><Icon aria-hidden="true" className={warning ? "text-amber-400" : "text-red-500"} size={15} /></div><dd className="mt-2 text-2xl font-black text-white">{value}</dd></div>
          ))}
        </dl>
        <div className="mt-4 border border-white/10 bg-black px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Recently Updated</p>
          <p className="mt-2 break-words text-sm font-bold leading-6 text-zinc-300">{overview.recentlyUpdated.length > 0 ? overview.recentlyUpdated.map((node) => node.name).join(" · ") : "No knowledge records yet."}</p>
        </div>
      </section>

      <section className="mt-6 border border-white/10 bg-black p-3 sm:p-4" aria-label="Knowledge Explorer filters">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(260px,1.3fr)_repeat(6,minmax(135px,0.55fr))]">
          <label className="relative block"><span className="sr-only">Search knowledge</span><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, aliases, tags, sources, or school facts" className="h-11 w-full border border-white/10 bg-zinc-950 pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-red-500" /></label>
          <label><span className="sr-only">Filter by node type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as KnowledgeNodeType | typeof allKnowledgeFilters)} className="h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-red-500"><option value={allKnowledgeFilters}>Type: All</option>{Object.values(KnowledgeNodeType).map((type) => <option key={type} value={type}>{formatKnowledgeLabel(type)}</option>)}</select></label>
          <label><span className="sr-only">Filter by confidence</span><select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value as KnowledgeConfidence | typeof allKnowledgeFilters)} className="h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-red-500"><option value={allKnowledgeFilters}>Confidence: All</option>{Object.values(KnowledgeConfidence).map((confidence) => <option key={confidence} value={confidence}>{formatKnowledgeLabel(confidence)}</option>)}</select></label>
          <label><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as KnowledgeStatus | typeof allKnowledgeFilters)} className="h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-red-500"><option value={allKnowledgeFilters}>Status: All</option>{Object.values(KnowledgeStatus).map((status) => <option key={status} value={status}>{formatKnowledgeLabel(status)}</option>)}</select></label>
          <label><span className="sr-only">Filter by region</span><select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value as KnowledgeRegion | typeof allKnowledgeFilters)} className="h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-red-500"><option value={allKnowledgeFilters}>Region: All</option>{Object.values(KnowledgeRegion).map((region) => <option key={region} value={region}>{formatHoopFrensRegion(region)}</option>)}</select></label>
          <label><span className="sr-only">Filter by state</span><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-red-500"><option value={allKnowledgeFilters}>State: All</option>{states.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
          <label><span className="sr-only">Sort knowledge nodes</span><select value={sort} onChange={(event) => setSort(event.target.value as KnowledgeSortOption)} className="h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-red-500"><option value="name">Sort: Name</option><option value="updated">Sort: Updated</option><option value="confidence">Sort: Confidence</option><option value="type">Sort: Type</option></select></label>
        </div>
      </section>

      {error ? <p role="alert" className="mt-5 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{error}</p> : null}
      {actionMessage ? <p role="alert" className="mt-5 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{actionMessage}</p> : null}

      {loading ? (
        <div className="mt-6 flex min-h-64 items-center justify-center border border-white/10 bg-black"><div className="flex items-center gap-3 text-sm font-black uppercase tracking-wider text-zinc-400"><Loader2 aria-hidden="true" className="animate-spin text-red-500" size={18} />Loading Knowledge Graph</div></div>
      ) : (
        <section className="mt-6" aria-labelledby="knowledge-node-list-title">
          <div className="mb-3 flex items-center justify-between gap-3"><h3 id="knowledge-node-list-title" className="text-xs font-black uppercase tracking-[0.18em] text-white">Knowledge Explorer</h3><p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{filteredNodes.length} visible</p></div>
          <KnowledgeNodeList nodes={filteredNodes} selectedNodeId={selectedNodeId} onSelect={(nodeId, trigger) => openNode(nodeId, trigger)} />
        </section>
      )}

      <section className="mt-6" aria-labelledby="knowledge-source-list-title">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 id="knowledge-source-list-title" className="text-xs font-black uppercase tracking-[0.18em] text-white">Source Records</h3><p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{graph.sources.length} total</p></div>
        {graph.sources.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {graph.sources.map((source) => (
              <button key={source.id} type="button" onClick={(event) => openSource(source.id, event.currentTarget)} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-white/10 bg-black px-4 py-4 text-left transition hover:border-white/25 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500">
                <span className="min-w-0"><span className="block break-words text-sm font-black leading-5 text-white">{source.title}</span><span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Accessed {new Date(source.accessedAt).toLocaleString()} · {formatKnowledgeLabel(source.reliability)}</span></span>
                <BookOpen aria-hidden="true" className="text-red-500" size={16} />
              </button>
            ))}
          </div>
        ) : <p className="border border-dashed border-white/15 bg-black/40 px-5 py-8 text-sm font-bold leading-6 text-zinc-500">No knowledge sources have been recorded.</p>}
      </section>

      {overlayMode === "detail" && selectedNode ? (
        <PackageOverlay eyebrow="Knowledge Graph" title={selectedNode.name} projectTitle={selectedNode.description || "Canonical Headquarters knowledge node"} status={formatKnowledgeLabel(selectedNode.status)} metadata={[{ label: "Node ID", value: selectedNode.id }, { label: "Type", value: formatKnowledgeLabel(selectedNode.type) }, { label: "Confidence", value: formatKnowledgeLabel(selectedNode.confidence) }]} returnFocusRef={overlayTriggerRef} onClose={() => setOverlayMode(null)}>
          {actionMessage ? <p role="status" className="mb-5 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{actionMessage}</p> : null}
          <KnowledgeNodeDetail node={selectedNode} nodes={graph.nodes} relationships={graph.relationships} sources={graph.sources} integrityWarnings={integrityWarnings} actionPending={actionPending} onOpenNode={(nodeId) => openNode(nodeId)} onEdit={() => setOverlayMode("edit")} onArchive={() => void archiveSelectedNode()} onArchiveRelationship={(relationshipId) => void archiveRelationship(relationshipId)} />
        </PackageOverlay>
      ) : null}

      {overlayMode === "create" || (overlayMode === "edit" && selectedNode) ? (
        <PackageOverlay eyebrow="Knowledge Graph" title={overlayMode === "edit" ? "Edit Knowledge Node" : "Create Knowledge Node"} projectTitle={overlayMode === "edit" && selectedNode ? selectedNode.name : "Manual canonical knowledge entry"} status={overlayMode === "edit" ? "Edit permitted fields" : "Manual creation"} metadata={[{ label: "AI", value: "Disabled" }]} returnFocusRef={overlayTriggerRef} onClose={() => setOverlayMode(selectedNode ? "detail" : null)}>
          <KnowledgeNodeForm node={overlayMode === "edit" ? selectedNode : null} nodes={graph.nodes} sources={graph.sources} pending={actionPending} onSubmit={saveNode} />
          {actionMessage ? <p role="alert" className="mt-5 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{actionMessage}</p> : null}
        </PackageOverlay>
      ) : null}

      {overlayMode === "create-source" ? (
        <PackageOverlay eyebrow="Knowledge Graph" title="Create Knowledge Source" projectTitle="Manual verified evidence record" status="Manual creation" metadata={[{ label: "AI", value: "Disabled" }]} returnFocusRef={overlayTriggerRef} onClose={() => setOverlayMode(null)}>
          <KnowledgeSourceForm pending={actionPending} onSubmit={saveSource} />
          {actionMessage ? <p role="alert" className="mt-5 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{actionMessage}</p> : null}
        </PackageOverlay>
      ) : null}

      {overlayMode === "source-detail" && selectedSource ? (
        <PackageOverlay eyebrow="Knowledge Graph" title={selectedSource.title} projectTitle={selectedSource.publisher || "Canonical Headquarters source"} status={formatKnowledgeLabel(selectedSource.status)} metadata={[{ label: "Source ID", value: selectedSource.id }, { label: "Reliability", value: formatKnowledgeLabel(selectedSource.reliability) }]} returnFocusRef={overlayTriggerRef} onClose={() => setOverlayMode(null)}>
          <KnowledgeSourceDetail source={selectedSource} actionPending={actionPending} onArchive={() => void archiveSelectedSource()} />
          {actionMessage ? <p role="status" className="mt-5 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{actionMessage}</p> : null}
        </PackageOverlay>
      ) : null}

      {overlayMode === "create-relationship" ? (
        <PackageOverlay eyebrow="Knowledge Graph" title="Create Knowledge Relationship" projectTitle="Manual source-backed canonical connection" status="Manual creation" metadata={[{ label: "Direction", value: "Required" }, { label: "AI", value: "Disabled" }]} returnFocusRef={overlayTriggerRef} onClose={() => setOverlayMode(null)}>
          <KnowledgeRelationshipForm nodes={activeNodes} sources={activeSources} pending={actionPending} onSubmit={saveRelationship} />
          {actionMessage ? <p role="alert" className="mt-5 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{actionMessage}</p> : null}
        </PackageOverlay>
      ) : null}
    </div>
  );
}
