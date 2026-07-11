"use client";

import {
  formatProjectDate,
  formatProjectPriority,
  formatProjectState,
  formatProjectType,
  getProjectState,
  normalizeWorkspaceProject,
} from "@/components/executive/projectWorkspaceUtils";
import { ArtifactStatus } from "@/domain/business-object";
import { createFirestoreProjectRepository, ProjectWorkspace, type Project } from "@/domain/project";
import {
  createFirestoreProductionPackageRepository,
  ProductionReadinessStatus,
  type ProductionChecklistItem,
  type ProductionPackage,
  type ProductionReadinessResult,
} from "@/domain/services";
import { Priority, ProjectStatus } from "@/domain/shared";
import { db } from "@/lib/firebase";
import { productionReadinessService } from "@/services";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const executiveWorkspaceId = "executive-workspace";

const priorityOrder: Record<Priority, number> = {
  [Priority.Critical]: 0,
  [Priority.High]: 1,
  [Priority.Medium]: 2,
  [Priority.Low]: 3,
};

type StudioPackage = {
  project: Project;
  productionPackage: ProductionPackage;
  readiness: ProductionReadinessResult;
};

type AssetRequirement = {
  id: string;
  projectId: string;
  projectTitle: string;
  kind: "Graphics" | "Media";
  label: string;
  required: boolean;
  completed: boolean;
};

function normalizeProductionPackage(productionPackage: ProductionPackage): ProductionPackage {
  return {
    ...productionPackage,
    workingDraft: productionPackage.workingDraft || "",
    productionChecklist: productionPackage.productionChecklist || [],
    mediaChecklist: productionPackage.mediaChecklist || [],
    graphicsNeeded: productionPackage.graphicsNeeded || [],
    publishingRequirements: productionPackage.publishingRequirements || [],
    qaChecklist: productionPackage.qaChecklist || [],
    nextRecommendedStep: productionPackage.nextRecommendedStep || "Open the project and confirm the next production step.",
  };
}

function isTerminalProject(project: Project) {
  const state = getProjectState(project);
  return state === ProjectStatus.Published || state === ProjectStatus.Archived;
}

function formatArtifactStatus(status: ArtifactStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function readinessLabel(status: ProductionReadinessStatus) {
  if (status === ProductionReadinessStatus.ReadyForReview) return "Ready for Review";
  if (status === ProductionReadinessStatus.Blocked) return "Blocked";
  return "Needs Production";
}

function readinessClasses(status: ProductionReadinessStatus) {
  if (status === ProductionReadinessStatus.ReadyForReview) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === ProductionReadinessStatus.Blocked) {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function allPackageChecklistItems(productionPackage: ProductionPackage) {
  return [
    ...productionPackage.productionChecklist,
    ...productionPackage.mediaChecklist,
    ...productionPackage.graphicsNeeded,
    ...productionPackage.publishingRequirements,
    ...productionPackage.qaChecklist,
  ];
}

function requiredChecklistProgress(productionPackage: ProductionPackage) {
  const requiredItems = allPackageChecklistItems(productionPackage).filter((item) => item.required);
  const completedItems = requiredItems.filter((item) => item.completed);
  return {
    completed: completedItems.length,
    total: requiredItems.length,
    percent: requiredItems.length ? Math.round((completedItems.length / requiredItems.length) * 100) : 100,
  };
}

function buildAssetRequirements(studioPackages: StudioPackage[]): AssetRequirement[] {
  return studioPackages
    .flatMap(({ project, productionPackage }) => [
      ...productionPackage.graphicsNeeded.map((item) => createAssetRequirement(project, item, "Graphics")),
      ...productionPackage.mediaChecklist.map((item) => createAssetRequirement(project, item, "Media")),
    ])
    .sort((firstRequirement, secondRequirement) => {
      if (firstRequirement.completed !== secondRequirement.completed) return firstRequirement.completed ? 1 : -1;
      return firstRequirement.projectTitle.localeCompare(secondRequirement.projectTitle);
    });
}

function createAssetRequirement(
  project: Project,
  item: ProductionChecklistItem,
  kind: AssetRequirement["kind"],
): AssetRequirement {
  return {
    id: `${project.id}-${kind}-${item.id}`,
    projectId: project.id,
    projectTitle: project.title,
    kind,
    label: item.label,
    required: item.required,
    completed: item.completed,
  };
}

function StudioSectionHeader({
  eyebrow,
  title,
  titleId,
  count,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  titleId: string;
  count: number;
  icon: LucideIcon;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">{eyebrow}</p>
        <h3 id={titleId} className="mt-2 text-lg font-black text-white">{title}</h3>
      </div>
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs font-black tabular-nums text-zinc-300">{count}</span>
      </div>
    </header>
  );
}

function EmptyStudioState({ message }: { message: string }) {
  return (
    <div className="p-5">
      <p className="text-sm font-bold leading-6 text-zinc-400">{message}</p>
      <Link
        href="/executive-workspace/projects"
        className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-red-400 transition hover:text-red-300"
      >
        Open Projects
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function ProductionStudio({ currentUserId }: { currentUserId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [productionPackages, setProductionPackages] = useState<ProductionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const projectRepository = useMemo(
    () => (db ? createFirestoreProjectRepository(db, currentUserId) : null),
    [currentUserId],
  );
  const productionPackageRepository = useMemo(
    () => (db ? createFirestoreProductionPackageRepository(db) : null),
    [],
  );

  useEffect(() => {
    let active = true;

    async function loadStudio() {
      if (!projectRepository || !productionPackageRepository) {
        if (active) {
          setLoadError("Production Studio cannot load because Firebase is not configured.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setLoadError("");
        const savedProjects = (await projectRepository.listByWorkspace(executiveWorkspaceId)).map(normalizeWorkspaceProject);
        const packageCandidates = savedProjects.filter((project) => {
          const state = getProjectState(project);
          return (
            project.currentWorkspace === ProjectWorkspace.ProductionStudio ||
            state === ProjectStatus.Production ||
            state === ProjectStatus.Review ||
            state === ProjectStatus.Approved ||
            state === ProjectStatus.Published ||
            Boolean(project.productionCompletedAt)
          );
        });
        const savedPackages = (
          await Promise.all(
            packageCandidates.map((project) => productionPackageRepository.getByProjectId(project.id)),
          )
        )
          .filter((productionPackage): productionPackage is ProductionPackage => Boolean(productionPackage))
          .map(normalizeProductionPackage);

        if (active) {
          setProjects(savedProjects);
          setProductionPackages(savedPackages);
        }
      } catch {
        if (active) setLoadError("Production Studio could not load the latest project and package data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStudio();

    return () => {
      active = false;
    };
  }, [productionPackageRepository, projectRepository, refreshVersion]);

  const queueProjects = useMemo(
    () =>
      projects
        .filter(
          (project) => project.currentWorkspace === ProjectWorkspace.ProductionStudio && !isTerminalProject(project),
        )
        .sort((firstProject, secondProject) => {
          const priorityDifference = priorityOrder[firstProject.priority] - priorityOrder[secondProject.priority];
          if (priorityDifference !== 0) return priorityDifference;
          return Date.parse(secondProject.updatedAt) - Date.parse(firstProject.updatedAt);
        }),
    [projects],
  );

  const studioPackages = useMemo(() => {
    const projectsById = new Map(projects.map((project) => [project.id, project]));
    return productionPackages
      .map((productionPackage) => {
        const project = projectsById.get(productionPackage.projectId);
        if (!project) return null;
        return {
          project,
          productionPackage,
          readiness: productionReadinessService.evaluate(project, productionPackage),
        } satisfies StudioPackage;
      })
      .filter((studioPackage): studioPackage is StudioPackage => Boolean(studioPackage))
      .sort(
        (firstPackage, secondPackage) =>
          Date.parse(secondPackage.productionPackage.updatedAt) - Date.parse(firstPackage.productionPackage.updatedAt),
      );
  }, [productionPackages, projects]);

  const productionPackagesByProjectId = useMemo(
    () => new Map(productionPackages.map((productionPackage) => [productionPackage.projectId, productionPackage])),
    [productionPackages],
  );
  const queueReadinessByProjectId = useMemo(
    () =>
      new Map(
        queueProjects.map((project) => [
          project.id,
          productionReadinessService.evaluate(project, productionPackagesByProjectId.get(project.id) || null),
        ]),
      ),
    [productionPackagesByProjectId, queueProjects],
  );
  const assetRequirements = useMemo(() => buildAssetRequirements(studioPackages), [studioPackages]);
  const readyForReviewCount = studioPackages.filter(
    ({ readiness }) => readiness.status === ProductionReadinessStatus.ReadyForReview,
  ).length;
  const needsWorkCount = queueProjects.filter(
    (project) => queueReadinessByProjectId.get(project.id)?.status !== ProductionReadinessStatus.ReadyForReview,
  ).length;

  const metrics = [
    { label: "In Studio", value: queueProjects.length, detail: "Active production projects" },
    { label: "Packages", value: studioPackages.length, detail: "Generated production packages" },
    { label: "Ready", value: readyForReviewCount, detail: "Ready for Founder Review" },
    { label: "Needs Work", value: needsWorkCount, detail: "Missing or incomplete packages" },
  ];

  return (
    <div className="min-h-full p-4 sm:p-6">
      <section className="border border-white/10 bg-black p-5 sm:p-6" aria-labelledby="production-studio-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Production Operations</p>
            <h2 id="production-studio-title" className="mt-2 text-3xl font-black uppercase text-white sm:text-4xl">
              Production Studio
            </h2>
            <p className="mt-3 text-sm font-bold leading-6 text-zinc-400">
              Active creative work, generated packages, asset requirements, and readiness for Founder Review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshVersion((currentVersion) => currentVersion + 1)}
            disabled={loading}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 border border-white/10 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>

      {loadError ? (
        <div className="mt-4 flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-200" role="alert">
          <AlertTriangle className="mt-1 shrink-0" size={16} aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      <section className="mt-4 grid grid-cols-2 border border-white/10 bg-[#0b0b0b] lg:grid-cols-4" aria-label="Production summary">
        {metrics.map((metric) => (
          <div key={metric.label} className="border-b border-r border-white/10 p-4 last:border-r-0 lg:border-b-0 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-white">{loading ? "--" : metric.value}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">{metric.detail}</p>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="min-w-0 border border-white/10 bg-black" aria-labelledby="production-queue-title">
          <StudioSectionHeader
            eyebrow="Current Work"
            title="Production Queue"
            titleId="production-queue-title"
            count={queueProjects.length}
            icon={Clapperboard}
          />
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 p-5 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              <Loader2 className="animate-spin text-red-500" size={17} aria-hidden="true" />
              Loading production work
            </div>
          ) : queueProjects.length === 0 ? (
            <EmptyStudioState message="No active projects are currently assigned to Production Studio." />
          ) : (
            <div>
              {queueProjects.map((project) => {
                const productionPackage = productionPackagesByProjectId.get(project.id);
                const readiness = queueReadinessByProjectId.get(project.id);
                const progress = Math.max(0, Math.min(100, project.progressPercent));
                return (
                  <article key={project.id} className="border-t border-white/10 p-4 first:border-t-0 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-red-200">
                            {formatProjectState(getProjectState(project))}
                          </span>
                          <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            {formatProjectPriority(project.priority)} Priority
                          </span>
                          {project.currentBlocker ? (
                            <span className="border border-red-500/30 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-red-300">
                              Blocked
                            </span>
                          ) : null}
                          {readiness ? (
                            <span className={`border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${readinessClasses(readiness.status)}`}>
                              {readinessLabel(readiness.status)}
                            </span>
                          ) : null}
                        </div>
                        <h4 className="mt-3 break-words text-base font-black leading-6 text-white">{project.title}</h4>
                        <p className="mt-1 text-xs font-bold text-zinc-500">{formatProjectType(project.type)}</p>
                      </div>
                      <Link
                        href="/executive-workspace/projects"
                        className="inline-flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-red-400 transition hover:text-red-300"
                      >
                        View Project
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                        <span>Progress</span>
                        <span className="tabular-nums text-zinc-300">{progress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-white/10">
                        <div className="h-full bg-red-600" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="font-black uppercase tracking-[0.12em] text-zinc-600">Current Step</dt>
                        <dd className="mt-1 font-bold leading-5 text-zinc-300">{project.currentStep}</dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase tracking-[0.12em] text-zinc-600">Next Action</dt>
                        <dd className="mt-1 font-bold leading-5 text-zinc-300">{project.recommendedNextAction}</dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase tracking-[0.12em] text-zinc-600">Package</dt>
                        <dd className="mt-1 font-bold leading-5 text-zinc-300">
                          {productionPackage ? formatArtifactStatus(productionPackage.status) : "Not generated"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase tracking-[0.12em] text-zinc-600">Updated</dt>
                        <dd className="mt-1 font-bold leading-5 text-zinc-300">{formatProjectDate(project.updatedAt)}</dd>
                      </div>
                    </dl>
                    {project.currentBlocker ? (
                      <p className="mt-4 border-l-2 border-red-500 pl-3 text-xs font-bold leading-5 text-red-200">
                        {project.currentBlocker}
                      </p>
                    ) : readiness && readiness.status !== ProductionReadinessStatus.ReadyForReview ? (
                      <p className="mt-4 border-l-2 border-amber-500 pl-3 text-xs font-bold leading-5 text-amber-100">
                        {readiness.reasons[0]}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid min-w-0 content-start gap-4">
          <section className="border border-white/10 bg-black" aria-labelledby="production-packages-title">
            <StudioSectionHeader
              eyebrow="Deliverables"
              title="Production Packages"
              titleId="production-packages-title"
              count={studioPackages.length}
              icon={PackageCheck}
            />
            {loading ? (
              <div className="flex min-h-32 items-center justify-center gap-3 p-5 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                <Loader2 className="animate-spin text-red-500" size={17} aria-hidden="true" />
                Loading packages
              </div>
            ) : studioPackages.length === 0 ? (
              <EmptyStudioState message="No Production Packages have been generated yet." />
            ) : (
              <div className="max-h-[430px] overflow-y-auto">
                {studioPackages.map(({ project, productionPackage, readiness }) => {
                  const checklistProgress = requiredChecklistProgress(productionPackage);
                  return (
                    <article key={productionPackage.id} className="border-t border-white/10 p-4 first:border-t-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="break-words text-sm font-black leading-5 text-white">{project.title}</h4>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">
                            Version {productionPackage.version} · {formatArtifactStatus(productionPackage.status)}
                          </p>
                        </div>
                        <span className={`shrink-0 border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${readinessClasses(readiness.status)}`}>
                          {readinessLabel(readiness.status)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-bold leading-5 text-zinc-400">{productionPackage.summary}</p>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">
                          <span>Required Items</span>
                          <span className="tabular-nums text-zinc-400">
                            {checklistProgress.completed}/{checklistProgress.total}
                          </span>
                        </div>
                        <div className="mt-2 h-1 bg-white/10">
                          <div className="h-full bg-red-600" style={{ width: `${checklistProgress.percent}%` }} />
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-bold leading-5 text-zinc-300">{productionPackage.nextRecommendedStep}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                          {formatProjectDate(productionPackage.updatedAt)}
                        </span>
                        <Link
                          href="/executive-workspace/projects"
                          className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-400 transition hover:text-red-300"
                        >
                          View Project
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border border-white/10 bg-black" aria-labelledby="asset-requirements-title">
            <StudioSectionHeader
              eyebrow="Creative Inputs"
              title="Asset Requirements"
              titleId="asset-requirements-title"
              count={assetRequirements.length}
              icon={ImageIcon}
            />
            {loading ? (
              <div className="flex min-h-32 items-center justify-center gap-3 p-5 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                <Loader2 className="animate-spin text-red-500" size={17} aria-hidden="true" />
                Loading requirements
              </div>
            ) : assetRequirements.length === 0 ? (
              <EmptyStudioState message="No media or graphics requirements are attached to current Production Packages." />
            ) : (
              <div className="max-h-[350px] overflow-y-auto">
                {assetRequirements.map((requirement) => (
                  <article key={requirement.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] gap-3 border-t border-white/10 p-4 first:border-t-0">
                    <span className="mt-0.5 text-red-500">
                      {requirement.kind === "Graphics" ? <ImageIcon size={15} aria-hidden="true" /> : <Film size={15} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-xs font-black leading-5 text-white">{requirement.label}</p>
                      <p className="mt-1 truncate text-[10px] font-bold text-zinc-500">{requirement.projectTitle}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                        {requirement.kind} · {requirement.required ? "Required" : "Optional"}
                      </p>
                    </div>
                    <span className={requirement.completed ? "text-emerald-400" : "text-zinc-600"} title={requirement.completed ? "Complete" : "Open"}>
                      {requirement.completed ? <CheckCircle2 size={16} aria-hidden="true" /> : <CircleDashed size={16} aria-hidden="true" />}
                      <span className="sr-only">{requirement.completed ? "Complete" : "Open"}</span>
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
