"use client";

import { formatKnowledgeLabel, relationshipEndpointOptions } from "@/components/executive/knowledgeExplorerUtils";
import {
  KnowledgeConfidence,
  type KnowledgeNode,
  type KnowledgeRelationshipCreateInput,
  KnowledgeRelationshipType,
  type KnowledgeSource,
  KnowledgeStatus,
  validateRelationshipEndpoints,
} from "@/domain/knowledge";
import { Loader2, Network, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

type KnowledgeRelationshipFormProps = {
  nodes: KnowledgeNode[];
  sources: KnowledgeSource[];
  pending: boolean;
  onSubmit(relationship: KnowledgeRelationshipCreateInput): Promise<void> | void;
};

function csv(value: FormDataEntryValue | null) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

const inputClassName = "mt-2 h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-red-500";
const textareaClassName = "mt-2 min-h-24 w-full border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-red-500";
const labelClassName = "text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500";

export function KnowledgeRelationshipForm({ nodes, sources, pending, onSubmit }: KnowledgeRelationshipFormProps) {
  const [relationshipType, setRelationshipType] = useState(KnowledgeRelationshipType.SchoolLocatedInState);
  const [fromNodeId, setFromNodeId] = useState("");
  const [toNodeId, setToNodeId] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const { policy, fromNodes, toNodes } = relationshipEndpointOptions(nodes, relationshipType, fromNodeId, "executive-workspace");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fromNode = nodes.find((node) => node.id === fromNodeId);
    const toNode = nodes.find((node) => node.id === toNodeId);
    if (!fromNode || !toNode) {
      setValidationMessage("Choose the required From and To knowledge records.");
      return;
    }
    try {
      validateRelationshipEndpoints(fromNode, toNode, relationshipType, "executive-workspace");
      setValidationMessage("");
    } catch (error) {
      setValidationMessage(error instanceof Error
        ? error.message
        : "The selected records cannot use this relationship type.");
      return;
    }

    const sourceIds = formData.getAll("sourceIds").map(String).map((value) => value.trim()).filter(Boolean);
    if (sourceIds.length > 2) {
      setValidationMessage("Choose no more than two canonical sources for one relationship.");
      return;
    }
    const relationship: KnowledgeRelationshipCreateInput = {
      id: `relationship-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      workspaceId: "executive-workspace",
      fromNodeId,
      toNodeId,
      relationshipType,
      description: String(formData.get("description") || "").trim() || undefined,
      confidence: String(formData.get("confidence") || KnowledgeConfidence.Unverified) as KnowledgeConfidence,
      sourceIds,
      projectIds: csv(formData.get("projectIds")),
    };
    await onSubmit(relationship);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5" data-knowledge-relationship-form="true">
      <div className="flex items-start gap-3 border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-bold leading-5 text-zinc-300">
        <Network aria-hidden="true" className="mt-0.5 shrink-0 text-red-500" size={16} />
        Relationship direction matters. Select the relationship first; Headquarters will limit both endpoints to its canonical policy.
      </div>
      <label className={labelClassName}>Relationship Type
        <select name="relationshipType" value={relationshipType} onChange={(event) => {
          setRelationshipType(event.target.value as KnowledgeRelationshipType);
          setFromNodeId("");
          setToNodeId("");
          setValidationMessage("");
        }} className={inputClassName}>
          {Object.values(KnowledgeRelationshipType).map((type) => <option key={type} value={type}>{formatKnowledgeLabel(type)}</option>)}
        </select>
      </label>
      <p className="border-l border-red-500/50 pl-3 text-xs font-bold leading-5 text-zinc-400">
        {formatKnowledgeLabel(policy.fromNodeType)} → {formatKnowledgeLabel(policy.toNodeType)} · {policy.exclusive
          ? "One canonical active claim per governed endpoint."
          : "Multiple active connections are allowed."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>From Node
          <select name="fromNodeId" required value={fromNodeId} onChange={(event) => {
            setFromNodeId(event.target.value);
            if (event.target.value === toNodeId) setToNodeId("");
            setValidationMessage("");
          }} aria-describedby={validationMessage ? "knowledge-relationship-error" : undefined} className={inputClassName}>
            <option value="" disabled>Select {formatKnowledgeLabel(policy.fromNodeType)}</option>
            {fromNodes.map((node) => <option key={node.id} value={node.id}>{node.name} · {formatKnowledgeLabel(node.type)}</option>)}
          </select>
        </label>
        <label className={labelClassName}>To Node
          <select name="toNodeId" required value={toNodeId} onChange={(event) => {
            setToNodeId(event.target.value);
            setValidationMessage("");
          }} aria-describedby={validationMessage ? "knowledge-relationship-error" : undefined} className={inputClassName}>
            <option value="" disabled>Select {formatKnowledgeLabel(policy.toNodeType)}</option>
            {toNodes.map((node) => <option key={node.id} value={node.id}>{node.name} · {formatKnowledgeLabel(node.type)}</option>)}
          </select>
        </label>
      </div>
      <label className={labelClassName}>Confidence
        <select name="confidence" defaultValue={KnowledgeConfidence.Verified} className={inputClassName}>
          {Object.values(KnowledgeConfidence).map((confidence) => <option key={confidence} value={confidence}>{formatKnowledgeLabel(confidence)}</option>)}
        </select>
      </label>
      <label className={labelClassName}>Canonical Sources <span className="normal-case tracking-normal text-zinc-700">(select one or two)</span>
        <select name="sourceIds" multiple required size={Math.min(Math.max(sources.length, 2), 6)} className="mt-2 min-h-24 w-full border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-red-500">
          {sources.filter((source) => source.status === KnowledgeStatus.Active).map((source) => <option key={source.id} value={source.id}>{source.title} · {formatKnowledgeLabel(source.reliability)}</option>)}
        </select>
      </label>
      <label className={labelClassName}>Connected Project IDs <span className="normal-case tracking-normal text-zinc-700">(comma separated)</span><input name="projectIds" className={inputClassName} /></label>
      <label className={labelClassName}>Description<textarea name="description" className={textareaClassName} /></label>
      {validationMessage ? <p id="knowledge-relationship-error" role="alert" className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{validationMessage}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : <Save aria-hidden="true" size={15} />}
        {pending ? "Saving" : "Create Relationship"}
      </button>
    </form>
  );
}
