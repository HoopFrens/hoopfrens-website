"use client";

import { ExecutiveTimeline } from "@/components/executive/ExecutiveTimeline";
import {
  formatProjectDate,
  formatProjectPriority,
  formatProjectState,
  formatProjectType,
  formatProjectWorkspace,
  getProjectState,
  normalizeWorkspaceProject,
} from "@/components/executive/projectWorkspaceUtils";
import { ArtifactType } from "@/domain/business-object";
import { createFirestoreExecutiveEventRepository, type ExecutiveEvent } from "@/domain/event";
import type { RankedPriorityAssessment } from "@/domain/prioritization";
import { createFirestoreProjectRepository, ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import type { ProjectRecommendation } from "@/domain/recommendation";
import {
  createFirestoreOutlinePackageRepository,
  createFirestoreProductionPackageRepository,
  createFirestoreResearchPackageRepository,
  ExecutiveServiceType,
  type OutlinePackage,
  type ProductionPackage,
  type ResearchPackage,
} from "@/domain/services";
import { ProjectStatus } from "@/domain/shared";
import { db } from "@/lib/firebase";
import { executivePrioritizationService, executiveRecommendationService } from "@/services";
import {
  AlertTriangle,
  ArrowUpRight,
  Beaker,
  BookOpen,
  Boxes,
  CheckCircle2,
  CircleDot,
  FileStack,
  FlaskConical,
  FolderKanban,
  Gauge,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  Scale,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export type OperationalRoomId = "intelligence-center" | "strategy-room" | "product-lab" | "library";

type WorkspaceArtifact = ResearchPackage | OutlinePackage | ProductionPackage;

type WorkspaceSnapshot = {
  projects: Project[];
  events: ExecutiveEvent[];
  researchPackages: ResearchPackage[];
  outlinePackages: OutlinePackage[];
  productionPackages: ProductionPackage[];
};

type RoomDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const executiveWorkspaceId = "executive-workspace";
const emptySnapshot: WorkspaceSnapshot = {
  projects: [],
  events: [],
  researchPackages: [],
  outlinePackages: [],
  productionPackages: [],
};

const roomDefinitions: Record<OperationalRoomId, RoomDefinition> = {
  "intelligence-center": {
    eyebrow: "Research Intelligence",
    title: "Intelligence Center",
    description: "Research work, source coverage, priority signals, and the latest project activity.",
    icon: MapIcon,
  },
  "strategy-room": {
    eyebrow: "Executive Decisions",
    title: "Strategy Room",
    description: "Priority order, risk, Founder attention, and deterministic recommendations across the portfolio.",
    icon: Scale,
  },
  "product-lab": {
    eyebrow: "Product Operations",
    title: "Product Lab",
    description: "Product initiatives, dependencies, blockers, and the service capabilities available to advance work.",
    icon: Beaker,
  },
  library: {
    eyebrow: "Institutional Memory",
    title: "Library",
    description: "Generated artifacts, project records, and the preserved activity history of Headquarters.",
    icon: BookOpen,
  },
};

const productProjectTypes = new Set<ProjectType>([
  ProjectType.WebsiteImprovement,
  ProjectType.Merchandise,
  ProjectType.Partnership,
]);

function projectHref(projectId: string) {
  return `/executive-workspace/projects?projectId=${encodeURIComponent(projectId)}`;
}

function sortProjectsByUpdate(projects: Project[]) {
  return [...projects].sort((firstProject, secondProject) => Date.parse(secondProject.updatedAt) - Date.parse(firstProject.updatedAt));
}

function artifactLabel(artifact: WorkspaceArtifact) {
  if (artifact.artifactType === ArtifactType.ResearchPackage) return "Research Package";
  if (artifact.artifactType === ArtifactType.OutlinePackage) return "Outline Package";
  return "Production Package";
}

function formatArtifactStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function serviceLabel(serviceType: ExecutiveServiceType) {
  return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
}

function RoomHeader({ definition, loading, onRefresh }: { definition: RoomDefinition; loading: boolean; onRefresh(): void }) {
  const Icon = definition.icon;
  return (
    <section className="border border-white/10 bg-black p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-red-500">
            <Icon size={16} aria-hidden="true" />
            <p className="text-[10px] font-black uppercase tracking-[0.24em]">{definition.eyebrow}</p>
          </div>
          <h2 className="mt-3 text-3xl font-black uppercase text-white sm:text-4xl">{definition.title}</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-400">{definition.description}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 border border-white/10 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={14} aria-hidden="true" />
          Refresh
        </button>
      </div>
    </section>
  );
}

function MetricStrip({ metrics, loading }: { metrics: Array<{ label: string; value: number; detail: string }>; loading: boolean }) {
  return (
    <section className="mt-4 grid grid-cols-2 border border-white/10 bg-[#0b0b0b] lg:grid-cols-4" aria-label="Workspace summary">
      {metrics.map((metric) => (
        <div key={metric.label} className="border-b border-r border-white/10 p-4 last:border-r-0 lg:border-b-0 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{metric.label}</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">{loading ? "--" : metric.value}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">{metric.detail}</p>
        </div>
      ))}
    </section>
  );
}

function RoomPanel({
  id,
  eyebrow,
  title,
  count,
  icon: Icon,
  children,
  className = "",
}: {
  id: string;
  eyebrow: string;
  title: string;
  count?: number;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 border border-white/10 bg-black ${className}`} aria-labelledby={id}>
      <header className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">{eyebrow}</p>
          <h3 id={id} className="mt-2 text-lg font-black text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <Icon size={16} aria-hidden="true" />
          {typeof count === "number" ? <span className="text-xs font-black tabular-nums text-zinc-300">{count}</span> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-3 p-5 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
      <Loader2 className="animate-spin text-red-500" size={17} aria-hidden="true" />
      {label}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="p-5 text-sm font-bold leading-6 text-zinc-400">{message}</p>;
}

function ProjectRow({ project, contextLabel, context }: { project: Project; contextLabel: string; context: string }) {
  return (
    <article className="border-t border-white/10 p-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-200">
              {formatProjectState(getProjectState(project))}
            </span>
            <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
              {formatProjectPriority(project.priority)}
            </span>
          </div>
          <h4 className="mt-3 break-words text-sm font-black leading-5 text-white">{project.title}</h4>
          <p className="mt-1 text-[10px] font-bold text-zinc-500">
            {formatProjectType(project.type)} · {formatProjectWorkspace(project.currentWorkspace)}
          </p>
        </div>
        <Link
          href={projectHref(project.id)}
          className="inline-flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-400 transition hover:text-red-300"
        >
          Open
          <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-3 border-t border-white/10 pt-3">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">{contextLabel}</p>
        <p className="mt-1 text-xs font-bold leading-5 text-zinc-300">{context}</p>
      </div>
    </article>
  );
}

function ArtifactRow({ artifact }: { artifact: WorkspaceArtifact }) {
  return (
    <article className="border-t border-white/10 p-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-red-400">{artifactLabel(artifact)}</p>
          <h4 className="mt-2 break-words text-sm font-black leading-5 text-white">{artifact.projectTitle}</h4>
        </div>
        <span className="shrink-0 border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
          {formatArtifactStatus(artifact.status)}
        </span>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-zinc-400">{artifact.summary}</p>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
          Version {artifact.version} · {formatProjectDate(artifact.updatedAt)}
        </span>
        <Link
          href={projectHref(artifact.projectId)}
          className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-400 transition hover:text-red-300"
        >
          View Project
          <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function RecommendationRow({ recommendation }: { recommendation: ProjectRecommendation }) {
  return (
    <article className="border-t border-white/10 p-4 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-red-400">{recommendation.actionLabel}</p>
          <h4 className="mt-2 break-words text-sm font-black leading-5 text-white">{recommendation.project.title}</h4>
        </div>
        <span className="text-lg font-black tabular-nums text-white">{recommendation.score}</span>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-zinc-300">{recommendation.reason[0]}</p>
      <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">Why now: {recommendation.whyNow}</p>
      <Link
        href={projectHref(recommendation.project.id)}
        className="mt-3 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-400 transition hover:text-red-300"
      >
        Open Project
        <ArrowUpRight size={12} aria-hidden="true" />
      </Link>
    </article>
  );
}

function PriorityRow({ assessment }: { assessment: RankedPriorityAssessment }) {
  return (
    <article className="border-t border-white/10 p-4 first:border-t-0">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3">
        <span className="text-2xl font-black tabular-nums text-red-500">{assessment.rank}</span>
        <div className="min-w-0">
          <h4 className="break-words text-sm font-black leading-5 text-white">{assessment.project.title}</h4>
          <p className="mt-1 text-xs font-bold leading-5 text-zinc-400">{assessment.recommendation}</p>
        </div>
        <span className="text-lg font-black tabular-nums text-white">{assessment.priorityScore}</span>
      </div>
      <p className="mt-3 border-t border-white/10 pt-3 text-xs font-bold leading-5 text-zinc-500">{assessment.reasons[0]}</p>
    </article>
  );
}

function IntelligenceRoom({ snapshot, loading }: { snapshot: WorkspaceSnapshot; loading: boolean }) {
  const researchProjects = snapshot.projects.filter((project) => {
    const state = getProjectState(project);
    return project.currentWorkspace === ProjectWorkspace.IntelligenceCenter || state === ProjectStatus.Draft || state === ProjectStatus.Research;
  });
  const sourceCount = snapshot.researchPackages.reduce(
    (total, researchPackage) => total + (researchPackage.sourceChecklist || []).length,
    0,
  );
  const recommendations = executiveRecommendationService.rank(snapshot.projects, snapshot.events).recommendations.slice(0, 4);
  const metrics = [
    { label: "Tracked", value: snapshot.projects.length, detail: "Projects in Headquarters" },
    { label: "Research Queue", value: researchProjects.length, detail: "Projects needing intelligence" },
    { label: "Packages", value: snapshot.researchPackages.length, detail: "Generated research packages" },
    { label: "Sources", value: sourceCount, detail: "Source checklist items" },
  ];

  return (
    <>
      <MetricStrip metrics={metrics} loading={loading} />
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RoomPanel id="research-queue-title" eyebrow="Active Research" title="Research Queue" count={researchProjects.length} icon={FlaskConical}>
          {loading ? (
            <LoadingState label="Loading research queue" />
          ) : researchProjects.length ? (
            researchProjects.map((project) => (
              <ProjectRow key={project.id} project={project} contextLabel="Next Intelligence Step" context={project.recommendedNextAction} />
            ))
          ) : (
            <EmptyState message="No projects are currently waiting on research." />
          )}
        </RoomPanel>

        <RoomPanel id="research-package-title" eyebrow="Knowledge Artifacts" title="Research Packages" count={snapshot.researchPackages.length} icon={FileStack}>
          {loading ? (
            <LoadingState label="Loading research packages" />
          ) : snapshot.researchPackages.length ? (
            snapshot.researchPackages.map((researchPackage) => <ArtifactRow key={researchPackage.id} artifact={researchPackage} />)
          ) : (
            <EmptyState message="No Research Packages have been generated yet." />
          )}
        </RoomPanel>

        <RoomPanel id="intelligence-signals-title" eyebrow="Executive Signals" title="Priority Signals" count={recommendations.length} icon={Lightbulb}>
          {loading ? (
            <LoadingState label="Calculating signals" />
          ) : recommendations.length ? (
            recommendations.map((recommendation) => <RecommendationRow key={recommendation.project.id} recommendation={recommendation} />)
          ) : (
            <EmptyState message="No active project signals are available." />
          )}
        </RoomPanel>

        <RoomPanel id="intelligence-activity-title" eyebrow="Recorded Change" title="Recent Project Activity" count={snapshot.events.length} icon={CircleDot}>
          <div className="max-h-[430px] overflow-y-auto p-4">
            <ExecutiveTimeline
              events={snapshot.events.slice(0, 8)}
              loading={loading}
              error=""
              emptyMessage="No project activity has been recorded yet."
            />
          </div>
        </RoomPanel>
      </div>
    </>
  );
}

function StrategyRoom({ snapshot, loading }: { snapshot: WorkspaceSnapshot; loading: boolean }) {
  const prioritization = executivePrioritizationService.prioritize(snapshot.projects);
  const recommendations = executiveRecommendationService.rank(snapshot.projects, snapshot.events).recommendations.slice(0, 5);
  const attentionAssessments = prioritization.assessments.filter(
    (assessment) => assessment.waitingOnFounder || assessment.blocked || assessment.atRisk,
  );
  const activeProjectCount = snapshot.projects.filter(
    (project) => ![ProjectStatus.Published, ProjectStatus.Archived].includes(getProjectState(project)),
  ).length;
  const metrics = [
    { label: "Active", value: activeProjectCount, detail: "Projects under consideration" },
    { label: "Waiting On You", value: prioritization.projectsWaitingOnFounder.length, detail: "Founder actions required" },
    { label: "At Risk", value: prioritization.projectsAtRisk.length, detail: "Projects needing intervention" },
    { label: "Ready", value: prioritization.projectsReadyToAdvance.length, detail: "Projects ready to advance" },
  ];

  return (
    <>
      <MetricStrip metrics={metrics} loading={loading} />
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RoomPanel id="strategy-priorities-title" eyebrow="Portfolio Order" title="Founder Priorities" count={prioritization.topFounderPriorities.length} icon={Gauge}>
          {loading ? (
            <LoadingState label="Ranking priorities" />
          ) : prioritization.topFounderPriorities.length ? (
            prioritization.topFounderPriorities.map((assessment) => <PriorityRow key={assessment.project.id} assessment={assessment} />)
          ) : (
            <EmptyState message="No active projects are available to prioritize." />
          )}
        </RoomPanel>

        <RoomPanel id="strategy-recommendations-title" eyebrow="Next Best Action" title="Recommendations" count={recommendations.length} icon={Lightbulb}>
          {loading ? (
            <LoadingState label="Calculating recommendations" />
          ) : recommendations.length ? (
            recommendations.map((recommendation) => <RecommendationRow key={recommendation.project.id} recommendation={recommendation} />)
          ) : (
            <EmptyState message="No current recommendations are available." />
          )}
        </RoomPanel>

        <RoomPanel
          id="strategy-attention-title"
          eyebrow="Decision Context"
          title="Risks, Blockers & Founder Attention"
          count={attentionAssessments.length}
          icon={ShieldAlert}
          className="xl:col-span-2"
        >
          {loading ? (
            <LoadingState label="Loading decision context" />
          ) : attentionAssessments.length ? (
            <div className="grid md:grid-cols-2">
              {attentionAssessments.map((assessment) => (
                <ProjectRow
                  key={assessment.project.id}
                  project={assessment.project}
                  contextLabel="Why It Needs Attention"
                  context={assessment.riskReasons[0] || assessment.reasons[0]}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No blockers, at-risk projects, or Founder decisions currently require attention." />
          )}
        </RoomPanel>
      </div>
    </>
  );
}

function ProductLabRoom({ snapshot, loading }: { snapshot: WorkspaceSnapshot; loading: boolean }) {
  const labProjects = snapshot.projects.filter(
    (project) => project.currentWorkspace === ProjectWorkspace.ProductLab || productProjectTypes.has(project.type),
  );
  const dependencyProjects = snapshot.projects.filter((project) => project.dependencies.length > 0 || Boolean(project.currentBlocker));
  const serviceRows = [
    {
      type: ExecutiveServiceType.Research,
      active: snapshot.projects.filter((project) => [ProjectStatus.Draft, ProjectStatus.Research].includes(getProjectState(project))).length,
      artifacts: snapshot.researchPackages.length,
    },
    {
      type: ExecutiveServiceType.Outline,
      active: snapshot.projects.filter((project) => getProjectState(project) === ProjectStatus.Outline).length,
      artifacts: snapshot.outlinePackages.length,
    },
    {
      type: ExecutiveServiceType.Production,
      active: snapshot.projects.filter((project) => getProjectState(project) === ProjectStatus.Production).length,
      artifacts: snapshot.productionPackages.length,
    },
    {
      type: ExecutiveServiceType.Review,
      active: snapshot.projects.filter((project) => getProjectState(project) === ProjectStatus.Review).length,
      artifacts: snapshot.events.filter((event) => event.summary.toLowerCase().includes("review")).length,
    },
    {
      type: ExecutiveServiceType.Publishing,
      active: snapshot.projects.filter((project) => getProjectState(project) === ProjectStatus.Approved).length,
      artifacts: snapshot.events.filter((event) => event.summary.toLowerCase().includes("publish")).length,
    },
  ];
  const metrics = [
    { label: "Initiatives", value: labProjects.length, detail: "Product-oriented projects" },
    { label: "Services", value: serviceRows.length, detail: "Deterministic services available" },
    { label: "Dependencies", value: snapshot.projects.reduce((total, project) => total + project.dependencies.length, 0), detail: "Declared project dependencies" },
    { label: "Blocked", value: snapshot.projects.filter((project) => Boolean(project.currentBlocker)).length, detail: "Projects with blockers" },
  ];

  return (
    <>
      <MetricStrip metrics={metrics} loading={loading} />
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RoomPanel id="product-initiatives-title" eyebrow="Build Queue" title="Product Initiatives" count={labProjects.length} icon={Beaker}>
          {loading ? (
            <LoadingState label="Loading product initiatives" />
          ) : labProjects.length ? (
            labProjects.map((project) => (
              <ProjectRow key={project.id} project={project} contextLabel="Current Build Step" context={project.currentStep} />
            ))
          ) : (
            <EmptyState message="No Website Improvement, Merchandise, Partnership, or Product Lab projects are active." />
          )}
        </RoomPanel>

        <RoomPanel id="product-services-title" eyebrow="Operating System" title="Executive Service Coverage" count={serviceRows.length} icon={Workflow}>
          {loading ? (
            <LoadingState label="Loading service coverage" />
          ) : (
            serviceRows.map((service) => (
              <article key={service.type} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t border-white/10 p-4 first:border-t-0">
                <div>
                  <p className="text-sm font-black text-white">{serviceLabel(service.type)} Service</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400">Available</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black tabular-nums text-white">{service.active}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">Active</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black tabular-nums text-white">{service.artifacts}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">Records</p>
                </div>
              </article>
            ))
          )}
        </RoomPanel>

        <RoomPanel id="product-dependencies-title" eyebrow="Delivery Constraints" title="Dependencies & Blockers" count={dependencyProjects.length} icon={Boxes}>
          {loading ? (
            <LoadingState label="Loading constraints" />
          ) : dependencyProjects.length ? (
            dependencyProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                contextLabel={project.currentBlocker ? "Current Blocker" : "Dependencies"}
                context={project.currentBlocker || project.dependencies.join(", ")}
              />
            ))
          ) : (
            <EmptyState message="No project dependencies or blockers are currently recorded." />
          )}
        </RoomPanel>

        <RoomPanel id="product-context-title" eyebrow="Portfolio Context" title="Recently Updated Work" count={snapshot.projects.length} icon={FolderKanban}>
          {loading ? (
            <LoadingState label="Loading portfolio context" />
          ) : snapshot.projects.length ? (
            sortProjectsByUpdate(snapshot.projects)
              .slice(0, 5)
              .map((project) => (
                <ProjectRow key={project.id} project={project} contextLabel="Last Activity" context={project.lastActivity} />
              ))
          ) : (
            <EmptyState message="No project records are available." />
          )}
        </RoomPanel>
      </div>
    </>
  );
}

function LibraryRoom({ snapshot, loading }: { snapshot: WorkspaceSnapshot; loading: boolean }) {
  const artifacts: WorkspaceArtifact[] = [
    ...snapshot.researchPackages,
    ...snapshot.outlinePackages,
    ...snapshot.productionPackages,
  ].sort((firstArtifact, secondArtifact) => Date.parse(secondArtifact.updatedAt) - Date.parse(firstArtifact.updatedAt));
  const projectRecords = sortProjectsByUpdate(snapshot.projects);
  const metrics = [
    { label: "Artifacts", value: artifacts.length, detail: "Generated business objects" },
    { label: "Research", value: snapshot.researchPackages.length, detail: "Research Packages" },
    { label: "Outlines", value: snapshot.outlinePackages.length, detail: "Outline Packages" },
    { label: "Production", value: snapshot.productionPackages.length, detail: "Production Packages" },
  ];

  return (
    <>
      <MetricStrip metrics={metrics} loading={loading} />
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RoomPanel id="library-artifacts-title" eyebrow="Business Objects" title="Artifact Index" count={artifacts.length} icon={FileStack}>
          {loading ? (
            <LoadingState label="Loading artifacts" />
          ) : artifacts.length ? (
            artifacts.map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} />)
          ) : (
            <EmptyState message="No Research, Outline, or Production Packages have been generated yet." />
          )}
        </RoomPanel>

        <RoomPanel id="library-records-title" eyebrow="Canonical Records" title="Project Records" count={projectRecords.length} icon={FolderKanban}>
          {loading ? (
            <LoadingState label="Loading project records" />
          ) : projectRecords.length ? (
            projectRecords.map((project) => (
              <ProjectRow key={project.id} project={project} contextLabel="Last Activity" context={`${project.lastActivity} · ${formatProjectDate(project.updatedAt)}`} />
            ))
          ) : (
            <EmptyState message="No project records are available in Headquarters." />
          )}
        </RoomPanel>

        <RoomPanel
          id="library-activity-title"
          eyebrow="Preserved History"
          title="Activity Archive"
          count={snapshot.events.length}
          icon={CheckCircle2}
          className="xl:col-span-2"
        >
          <div className="max-h-[520px] overflow-y-auto p-4">
            <ExecutiveTimeline
              events={snapshot.events}
              loading={loading}
              error=""
              emptyMessage="No Headquarters activity has been recorded yet."
            />
          </div>
        </RoomPanel>
      </div>
    </>
  );
}

export function OperationalWorkspaceRoom({ roomId, currentUserId }: { roomId: OperationalRoomId; currentUserId: string }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const projectRepository = useMemo(
    () => (db ? createFirestoreProjectRepository(db, currentUserId) : null),
    [currentUserId],
  );
  const eventRepository = useMemo(() => (db ? createFirestoreExecutiveEventRepository(db) : null), []);
  const researchPackageRepository = useMemo(() => (db ? createFirestoreResearchPackageRepository(db) : null), []);
  const outlinePackageRepository = useMemo(() => (db ? createFirestoreOutlinePackageRepository(db) : null), []);
  const productionPackageRepository = useMemo(() => (db ? createFirestoreProductionPackageRepository(db) : null), []);
  const definition = roomDefinitions[roomId];

  useEffect(() => {
    let active = true;

    async function loadWorkspaceRoom() {
      if (
        !projectRepository ||
        !eventRepository ||
        !researchPackageRepository ||
        !outlinePackageRepository ||
        !productionPackageRepository
      ) {
        if (active) {
          setLoadError(`${definition.title} cannot load because Firebase is not configured.`);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setLoadError("");
        const projects = (await projectRepository.listByWorkspace(executiveWorkspaceId)).map(normalizeWorkspaceProject);
        const [events, packageSets] = await Promise.all([
          eventRepository.listByWorkspace(executiveWorkspaceId),
          Promise.all(
            projects.map(async (project) => ({
              research: await researchPackageRepository.getByProjectId(project.id),
              outline: await outlinePackageRepository.getByProjectId(project.id),
              production: await productionPackageRepository.getByProjectId(project.id),
            })),
          ),
        ]);

        if (active) {
          setSnapshot({
            projects,
            events,
            researchPackages: packageSets
              .map((packageSet) => packageSet.research)
              .filter((researchPackage): researchPackage is ResearchPackage => Boolean(researchPackage)),
            outlinePackages: packageSets
              .map((packageSet) => packageSet.outline)
              .filter((outlinePackage): outlinePackage is OutlinePackage => Boolean(outlinePackage)),
            productionPackages: packageSets
              .map((packageSet) => packageSet.production)
              .filter((productionPackage): productionPackage is ProductionPackage => Boolean(productionPackage)),
          });
        }
      } catch {
        if (active) setLoadError(`${definition.title} could not load the latest Headquarters data.`);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWorkspaceRoom();

    return () => {
      active = false;
    };
  }, [
    definition.title,
    eventRepository,
    outlinePackageRepository,
    productionPackageRepository,
    projectRepository,
    refreshVersion,
    researchPackageRepository,
  ]);

  return (
    <div className="min-h-full p-4 sm:p-6">
      <RoomHeader
        definition={definition}
        loading={loading}
        onRefresh={() => setRefreshVersion((currentVersion) => currentVersion + 1)}
      />

      {loadError ? (
        <div className="mt-4 flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-200" role="alert">
          <AlertTriangle className="mt-1 shrink-0" size={16} aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {roomId === "intelligence-center" ? (
        <IntelligenceRoom snapshot={snapshot} loading={loading} />
      ) : roomId === "strategy-room" ? (
        <StrategyRoom snapshot={snapshot} loading={loading} />
      ) : roomId === "product-lab" ? (
        <ProductLabRoom snapshot={snapshot} loading={loading} />
      ) : (
        <LibraryRoom snapshot={snapshot} loading={loading} />
      )}
    </div>
  );
}
