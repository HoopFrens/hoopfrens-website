import "server-only";
import { isIP } from "node:net";
import { assembleSchoolSpotlightPackage, createSchoolSpotlightDraftInput } from "@/services/founderSimpleService";
import { SpotlightFactStatus, type FounderWorkflowDraft, type SchoolSpotlightPackage } from "@/domain/founder-simple/types";
import { KnowledgeSourceReliability, KnowledgeStatus, type KnowledgeGraph, type KnowledgeNode, KnowledgeNodeType } from "@/domain/knowledge/types";
import { type Project } from "@/domain/project";
import { type SchoolRequest } from "@/domain/content-intelligence/simple-post";
import { requireCondition, type ResearchPackage, type SourcePolicy } from "@/domain/content-intelligence/types";
import { fetchSource } from "./sources";

// Confirmation adds exact hosts only. The existing fetcher still pins public DNS on every hop.
export function schoolWebsite(value: unknown): URL {
  requireCondition(typeof value === "string" && value.length <= 2048, "school-website-required");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("school-website-required"); }
  requireCondition(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search
    && !isIP(url.hostname) && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(url.hostname)
    && !/\.(localhost|local|internal|test|invalid|example)$/.test(url.hostname), "school-website-required");
  url.hash = ""; return url;
}
export async function previewSchoolSource(request: SchoolRequest, website: unknown, signal: AbortSignal) {
  const url = schoolWebsite(website);
  const domain = url.hostname.replace(/^www\./, "");
  const source = await fetchSource(url.href, [domain], signal, 0);
  const sourcePolicy: SourcePolicy = { name: request.schoolName, domains: [domain], priorityUrls: [source.url] };
  return { sourcePolicy, sourcePreview: { title: source.title, excerpt: source.text.slice(0,600), url: source.url, contentHash: source.contentHash } };
}

// Reuse the released package assembler against a transient evidence view. No KG is persisted.
export function requestPackage(request: SchoolRequest, research: ResearchPackage, previous?: SchoolSpotlightPackage): SchoolSpotlightPackage {
  const supported = research.claims.filter(c => c.confidence === "supported" && c.review?.decision === "supported");
  requireCondition(supported.length > 0, "research-review-required");
  const sourceIds = [...new Set(supported.flatMap(c => c.evidence.map(e => e.sourceId)))].slice(0,2);
  const selected = supported.filter(c => c.evidence.some(e => sourceIds.includes(e.sourceId))).slice(0,8);
  const now = new Date().toISOString();
  const input = createSchoolSpotlightDraftInput(`draft-${request.id}`, request.ownerId);
  const graph = { nodes: [], relationships: [], auditEvents: [], sources: research.sources.filter(s => sourceIds.includes(s.id)).map(s => ({
    id:s.id, title:s.title, url:s.url, version:1, accessedAt:s.accessedAt, reliability:KnowledgeSourceReliability.Official, status:KnowledgeStatus.Active,
  })) } as unknown as KnowledgeGraph;
  const draft: FounderWorkflowDraft = { ...input, createdAt:now, updatedAt:now, createdBy:request.ownerId, updatedBy:request.ownerId, revision:1,
    facts:selected.map((c,position)=>({ id:c.id, category:"Research", label:c.field, value:c.text, status:SpotlightFactStatus.Supported, sourceIds:c.evidence.map(e=>e.sourceId).filter(id=>sourceIds.includes(id)), included:true, position })),
    customization:{...input.customization, rightsConfirmed:false, hook:`A closer look at ${request.schoolName} ${request.team.toLowerCase()}.`, shotList:["School setting", "Selected team's venue", "Training facilities", "Hoop Frens questions"]} };
  const pkg = assembleSchoolSpotlightPackage(draft,graph,{id:research.binding.schoolId,officialName:request.schoolName} as Extract<KnowledgeNode, {type: KnowledgeNodeType.School}>,
    {id:request.id,workspaceId:"executive-workspace",ownerId:request.ownerId,title:`${request.schoolName} · ${request.team}`} as Project,previous || null,now);
  // The approved object is an editorial/evidence snapshot; media permission is never inferred.
  pkg.publishingRequirements = [{id:"manual-post-review",label:"Review final graphics before manual upload",required:true,completed:false}];
  pkg.nextRecommendedStep = "Check the automatically assembled Instagram post and its suggested photos.";
  pkg.metadata = {...pkg.metadata, team:request.team, approvalScope:"editorial-evidence-only", researchPackageId:research.id, researchRevision:research.revision};
  return pkg;
}
