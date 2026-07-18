"use client";

import {
  formatKnowledgeSourceDateTimeLocal,
  isContentKnowledgeNode,
  isProjectKnowledgeNode,
  isSchoolKnowledgeNode,
  normalizeKnowledgeDateTimeInput,
  KnowledgeCategory,
  KnowledgeConfidence,
  type KnowledgeNode,
  type KnowledgeNodeCreateInput,
  KnowledgeNodeType,
  type KnowledgeSource,
  KnowledgeStatus,
} from "@/domain/knowledge";
import {
  formatHoopFrensRegion,
  hoopFrensRegionFromName,
  KnowledgeRegion,
} from "@/domain/shared";
import { Loader2, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

type KnowledgeNodeFormProps = {
  node?: KnowledgeNode | null;
  nodes: KnowledgeNode[];
  sources: KnowledgeSource[];
  pending: boolean;
  onSubmit(node: KnowledgeNodeCreateInput): Promise<void> | void;
};

function csv(value: FormDataEntryValue | null) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function parseOptionalNonNegativeNumber(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function knowledgeCategoryForNodeType(type: KnowledgeNodeType): KnowledgeCategory {
  switch (type) {
    case KnowledgeNodeType.School:
      return KnowledgeCategory.Institution;
    case KnowledgeNodeType.Coach:
    case KnowledgeNodeType.Player:
      return KnowledgeCategory.Person;
    case KnowledgeNodeType.Region:
    case KnowledgeNodeType.State:
      return KnowledgeCategory.Geography;
    case KnowledgeNodeType.Conference:
    case KnowledgeNodeType.Facility:
    case KnowledgeNodeType.Organization:
      return KnowledgeCategory.Organization;
    case KnowledgeNodeType.Project:
      return KnowledgeCategory.Work;
    case KnowledgeNodeType.Content:
      return KnowledgeCategory.Content;
    default: {
      const exhaustiveType: never = type;
      return exhaustiveType;
    }
  }
}

const inputClassName = "mt-2 h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-red-500 disabled:cursor-not-allowed disabled:text-zinc-600";
const textareaClassName = "mt-2 min-h-24 w-full border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-red-500";
const labelClassName = "text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500";

export function KnowledgeNodeForm({ node, nodes, sources, pending, onSubmit }: KnowledgeNodeFormProps) {
  const [nodeType, setNodeType] = useState(node?.type || KnowledgeNodeType.School);
  const school = node && isSchoolKnowledgeNode(node) ? node : null;
  const project = node && isProjectKnowledgeNode(node) ? node : null;
  const content = node && isContentKnowledgeNode(node) ? node : null;
  const [selectedStateNodeId, setSelectedStateNodeId] = useState(school?.stateNodeId || "");
  const [selectedRegionNodeId, setSelectedRegionNodeId] = useState(school?.regionNodeId || "");
  const selectedStateNode = nodes.find((candidate) => candidate.id === selectedStateNodeId && candidate.type === KnowledgeNodeType.State) || null;
  const selectedRegionNode = nodes.find((candidate) => candidate.id === selectedRegionNodeId && candidate.type === KnowledgeNodeType.Region) || null;
  const derivedRegion = selectedRegionNode ? hoopFrensRegionFromName(selectedRegionNode.name) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const sourceIds = formData.getAll("sourceIds").map(String).map((value) => value.trim()).filter(Boolean);
    const type = node?.type || nodeType;
    const base = {
      id: node?.id || `${type}-${slug(name)}-${globalThis.crypto?.randomUUID?.().slice(0, 8) || Date.now()}`,
      workspaceId: node?.workspaceId || "executive-workspace",
      type,
      category: node?.category || knowledgeCategoryForNodeType(type),
      name,
      description: String(formData.get("description") || "").trim(),
      confidence: String(formData.get("confidence") || KnowledgeConfidence.Unverified) as KnowledgeConfidence,
      sourceIds,
      aliases: csv(formData.get("aliases")),
      tags: csv(formData.get("tags")),
    };

    let nextNode: KnowledgeNodeCreateInput;
    if (type === KnowledgeNodeType.School) {
      const stateNodeId = selectedStateNodeId;
      const regionNodeId = selectedRegionNodeId;
      const lastVerifiedAtInput = String(formData.get("lastVerifiedAt") || "").trim();
      nextNode = {
        ...base,
        type: KnowledgeNodeType.School,
        category: KnowledgeCategory.Institution,
        officialName: String(formData.get("officialName") || name).trim(),
        nickname: String(formData.get("nickname") || "").trim() || undefined,
        city: String(formData.get("city") || "").trim(),
        state: selectedStateNode?.name || "",
        stateNodeId,
        region: derivedRegion || ("" as KnowledgeRegion),
        regionNodeId,
        conference: null,
        division: String(formData.get("division") || "").trim(),
        governingBody: String(formData.get("governingBody") || "").trim(),
        schoolWebsite: String(formData.get("schoolWebsite") || "").trim(),
        athleticsWebsite: String(formData.get("athleticsWebsite") || "").trim(),
        enrollment: parseOptionalNonNegativeNumber(formData.get("enrollment")),
        tuition: parseOptionalNonNegativeNumber(formData.get("tuitionInState")) !== undefined || parseOptionalNonNegativeNumber(formData.get("tuitionOutOfState")) !== undefined
          ? {
              inState: parseOptionalNonNegativeNumber(formData.get("tuitionInState")),
              outOfState: parseOptionalNonNegativeNumber(formData.get("tuitionOutOfState")),
              currency: "USD",
              academicYear: String(formData.get("tuitionAcademicYear") || "").trim() || undefined,
            }
          : undefined,
        publicOrPrivate: (String(formData.get("publicOrPrivate") || "") || undefined) as "public" | "private" | undefined,
        facilities: [],
        coaches: [],
        recruitingNotes: csv(formData.get("recruitingNotes")),
        connectedProjectIds: [],
        connectedContentIds: [],
        // Preserve an invalid value for domain validation so the parent can
        // surface its Founder-safe message instead of throwing in the form.
        lastVerifiedAt: lastVerifiedAtInput
          ? normalizeKnowledgeDateTimeInput(lastVerifiedAtInput) || lastVerifiedAtInput
          : undefined,
      };
    } else if (type === KnowledgeNodeType.Project) {
      nextNode = { ...base, type, category: KnowledgeCategory.Work, projectId: String(formData.get("projectId") || "").trim() };
    } else if (type === KnowledgeNodeType.Content) {
      nextNode = {
        ...base,
        type,
        category: KnowledgeCategory.Content,
        contentId: String(formData.get("contentId") || "").trim(),
        contentUrl: String(formData.get("contentUrl") || "").trim() || undefined,
      };
    } else {
      nextNode = { ...base, type, category: knowledgeCategoryForNodeType(type) };
    }
    await onSubmit(nextNode);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-6" data-knowledge-node-form="true">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>Node Type
          <select name="type" value={nodeType} disabled={Boolean(node)} onChange={(event) => setNodeType(event.target.value as KnowledgeNodeType)} className={inputClassName}>
            {Object.values(KnowledgeNodeType).map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className={labelClassName}>Confidence
          <select name="confidence" defaultValue={node?.confidence || KnowledgeConfidence.Unverified} className={inputClassName}>
            {Object.values(KnowledgeConfidence).map((confidence) => <option key={confidence} value={confidence}>{confidence}</option>)}
          </select>
        </label>
      </div>
      <label className={labelClassName}>Canonical Name
        <input name="name" required defaultValue={node?.name || ""} className={inputClassName} />
      </label>
      <label className={labelClassName}>Description
        <textarea name="description" defaultValue={node?.description || ""} className={textareaClassName} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>Aliases <span className="normal-case tracking-normal text-zinc-700">(comma separated)</span>
          <input name="aliases" defaultValue={node?.aliases.join(", ") || ""} className={inputClassName} />
        </label>
        <label className={labelClassName}>Tags <span className="normal-case tracking-normal text-zinc-700">(comma separated)</span>
          <input name="tags" defaultValue={node?.tags.join(", ") || ""} className={inputClassName} />
        </label>
      </div>
      <label className={labelClassName}>Canonical Sources <span className="normal-case tracking-normal text-zinc-700">(select one or more)</span>
        <select name="sourceIds" multiple size={Math.min(Math.max(sources.length, 2), 6)} defaultValue={node?.sourceIds || []} className="mt-2 min-h-24 w-full border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-red-500">
          {sources.filter((source) => source.status === KnowledgeStatus.Active).map((source) => <option key={source.id} value={source.id}>{source.title} · {source.reliability}</option>)}
        </select>
      </label>

      {nodeType === KnowledgeNodeType.School ? (
        <fieldset className="grid gap-4 border border-white/10 p-4 sm:p-5">
          <legend className="px-2 text-xs font-black uppercase tracking-[0.18em] text-red-400">School Intelligence</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClassName}>Official Name<input name="officialName" required defaultValue={school?.officialName || node?.name || ""} className={inputClassName} /></label>
            <label className={labelClassName}>Nickname<input name="nickname" defaultValue={school?.nickname || ""} className={inputClassName} /></label>
            <label className={labelClassName}>City<input name="city" required defaultValue={school?.city || ""} className={inputClassName} /></label>
            <label className={labelClassName}>State Node
              <select name="stateNodeId" required value={selectedStateNodeId} onChange={(event) => setSelectedStateNodeId(event.target.value)} className={inputClassName}>
                <option value="" disabled>Select State node</option>
                {nodes.filter((candidate) => candidate.type === KnowledgeNodeType.State && candidate.status === KnowledgeStatus.Active).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
            </label>
            <label className={labelClassName}>State<input value={selectedStateNode?.name || "Select a State node"} readOnly disabled className={inputClassName} /></label>
            <label className={labelClassName}>Region Node
              <select name="regionNodeId" required value={selectedRegionNodeId} onChange={(event) => setSelectedRegionNodeId(event.target.value)} className={inputClassName}>
                <option value="" disabled>Select Region node</option>
                {nodes.filter((candidate) => candidate.type === KnowledgeNodeType.Region && candidate.status === KnowledgeStatus.Active && hoopFrensRegionFromName(candidate.name)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
            </label>
            <label className={labelClassName}>Region
              <select aria-label="Derived Region" value={derivedRegion || ""} disabled className={inputClassName}>
                <option value="">Select a Region node</option>
                {Object.values(KnowledgeRegion).map((region) => <option key={region} value={region}>{formatHoopFrensRegion(region)}</option>)}
              </select>
            </label>
            <label className={labelClassName}>Division<input name="division" required defaultValue={school?.division || ""} className={inputClassName} /></label>
            <label className={labelClassName}>Governing Body<input name="governingBody" required defaultValue={school?.governingBody || ""} className={inputClassName} /></label>
            <label className={labelClassName}>School Website<input name="schoolWebsite" type="url" required defaultValue={school?.schoolWebsite || ""} className={inputClassName} /></label>
            <label className={labelClassName}>Athletics Website<input name="athleticsWebsite" type="url" required defaultValue={school?.athleticsWebsite || ""} className={inputClassName} /></label>
            <label className={labelClassName}>Enrollment<input name="enrollment" type="number" min="0" defaultValue={school?.enrollment ?? ""} className={inputClassName} /></label>
            <label className={labelClassName}>Public or Private
              <select name="publicOrPrivate" defaultValue={school?.publicOrPrivate || ""} className={inputClassName}><option value="">Not recorded</option><option value="public">Public</option><option value="private">Private</option></select>
            </label>
            <label className={labelClassName}>In-state Tuition<input name="tuitionInState" type="number" min="0" defaultValue={school?.tuition?.inState ?? ""} className={inputClassName} /></label>
            <label className={labelClassName}>Out-of-state Tuition<input name="tuitionOutOfState" type="number" min="0" defaultValue={school?.tuition?.outOfState ?? ""} className={inputClassName} /></label>
            <label className={labelClassName}>Tuition Academic Year<input name="tuitionAcademicYear" defaultValue={school?.tuition?.academicYear || ""} className={inputClassName} /></label>
            <label className={labelClassName}>Last Verified At<input name="lastVerifiedAt" type="datetime-local" defaultValue={school?.lastVerifiedAt ? formatKnowledgeSourceDateTimeLocal(school.lastVerifiedAt) : ""} className={inputClassName} /></label>
          </div>
          <label className={labelClassName}>Recruiting Notes<input name="recruitingNotes" defaultValue={school?.recruitingNotes.join(", ") || ""} className={inputClassName} /></label>
          <p className="border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-bold leading-5 text-zinc-400">
            Conference, Coach, Facility, Project, and Content facts are connected after save through canonical relationships.
          </p>
        </fieldset>
      ) : null}

      {nodeType === KnowledgeNodeType.Project ? <label className={labelClassName}>Project ID<input name="projectId" required defaultValue={project?.projectId || ""} className={inputClassName} /></label> : null}
      {nodeType === KnowledgeNodeType.Content ? <div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Content ID<input name="contentId" required defaultValue={content?.contentId || ""} className={inputClassName} /></label><label className={labelClassName}>Content URL<input name="contentUrl" type="url" defaultValue={content?.contentUrl || ""} className={inputClassName} /></label></div> : null}

      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : <Save aria-hidden="true" size={15} />}
        {pending ? "Saving" : node ? "Save Node" : "Create Node"}
      </button>
    </form>
  );
}
