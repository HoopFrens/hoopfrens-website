"use client";

import { ProjectDetailPanel } from "@/components/executive/ProjectDetailPanel";
import { OutlinePackagePanel } from "@/components/executive/OutlinePackagePanel";
import { PackageOverlay, type PackageOverlayMetadata } from "@/components/executive/PackageOverlay";
import { ProjectFilterSelect } from "@/components/executive/ProjectFilterSelect";
import { ProjectPrioritySummary } from "@/components/executive/ProjectPrioritySummary";
import { ProductionPackagePanel } from "@/components/executive/ProductionPackagePanel";
import { ResearchPackagePanel } from "@/components/executive/ResearchPackagePanel";
import {
  artifactForProject,
  scopeArtifactResponse,
  type ProjectScopedArtifact,
} from "@/components/executive/projectArtifactState";
import { projectWorkflowNotification } from "@/components/executive/projectWorkflowNotification";
import {
  formatProjectDate,
  formatProjectPriority,
  formatProjectState,
  formatProjectType,
  formatProjectWorkspace,
  getProjectState,
  getProjectType,
  normalizeWorkspaceProject,
  projectPriorities,
  projectStates,
  projectTypes,
  projectWorkspaces,
} from "@/components/executive/projectWorkspaceUtils";
import { createFirestoreExecutiveEventRepository, type ExecutiveEvent } from "@/domain/event";
import { createFirestoreProjectRepository, type Project } from "@/domain/project";
import type { PriorityAssessment } from "@/domain/prioritization";
import type { ProjectRecommendation } from "@/domain/recommendation";
import {
  createFirestoreOutlinePackageRepository,
  createFirestoreProductionPackageRepository,
  createFirestoreResearchPackageRepository,
  ExecutiveServiceStatus,
  ExecutiveServiceType,
  type OutlinePackage,
  type ProductionPackage,
  ProductionReadinessStatus,
  type ResearchPackage,
} from "@/domain/services";
import { Priority } from "@/domain/shared";
import { db } from "@/lib/firebase";
import {
  createExecutiveServiceRegistry,
  eventService,
  executivePrioritizationService,
  executiveRecommendationService,
  productionReadinessService,
  projectArtifactIntegrityService,
  projectRevisionService,
  projectWorkflowService,
  type ProjectWorkflowAction,
} from "@/services";
import { ArrowUpDown, FolderKanban, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ProjectWorkspaceProps = {
  currentUserId: string;
  currentUserLabel: string;
};

type SortOption = "recommendation-score" | "priority-score" | "updated" | "priority" | "progress" | "due-date" | "project-name";
type ActivePackageView = "research" | "outline" | "production" | null;

const executiveWorkspaceId = "executive-workspace";
const allFilters = "all";
const priorityRank: Record<Priority, number> = {
  [Priority.Critical]: 4,
  [Priority.High]: 3,
  [Priority.Medium]: 2,
  [Priority.Low]: 1,
};

function sortProjects(
  projects: Project[],
  sortBy: SortOption,
  assessmentByProjectId: Map<string, PriorityAssessment>,
  recommendationByProjectId: Map<string, ProjectRecommendation>,
) {
  return [...projects].sort((first, second) => {
    if (sortBy === "recommendation-score") {
      return (recommendationByProjectId.get(second.id)?.score || 0) - (recommendationByProjectId.get(first.id)?.score || 0);
    }
    if (sortBy === "priority-score") {
      return (assessmentByProjectId.get(second.id)?.priorityScore || 0) - (assessmentByProjectId.get(first.id)?.priorityScore || 0);
    }
    if (sortBy === "priority") return priorityRank[second.priority] - priorityRank[first.priority];
    if (sortBy === "progress") return second.progressPercent - first.progressPercent;
    if (sortBy === "project-name") return first.title.localeCompare(second.title);
    if (sortBy === "due-date") {
      const firstDueDate = first.dueDate ? Date.parse(first.dueDate) : Number.POSITIVE_INFINITY;
      const secondDueDate = second.dueDate ? Date.parse(second.dueDate) : Number.POSITIVE_INFINITY;
      return firstDueDate - secondDueDate;
    }

    return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
  });
}

function formatProjectOwner(project: Project, currentUserId: string, currentUserLabel: string) {
  return project.ownerId === currentUserId ? currentUserLabel : project.ownerId;
}

function formatPackageStatus(status: string | undefined) {
  if (!status) return "Unavailable";
  return status.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function packageMetadata(
  artifact: ResearchPackage | OutlinePackage | ProductionPackage | null,
  extra: PackageOverlayMetadata[] = [],
): PackageOverlayMetadata[] {
  if (!artifact) return extra;
  return [
    { label: "Version", value: `v${artifact.version}` },
    { label: "Updated", value: formatProjectDate(artifact.updatedAt) },
    { label: "Workspace", value: formatProjectWorkspace(artifact.workspace) },
    ...extra,
  ];
}

export function ProjectWorkspace({ currentUserId, currentUserLabel }: ProjectWorkspaceProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProjectIdRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState(allFilters);
  const [stateFilter, setStateFilter] = useState(allFilters);
  const [workspaceFilter, setWorkspaceFilter] = useState(allFilters);
  const [priorityFilter, setPriorityFilter] = useState(allFilters);
  const [ownerFilter, setOwnerFilter] = useState(allFilters);
  const [sortBy, setSortBy] = useState<SortOption>("recommendation-score");
  const projectRepository = useMemo(
    () => (db ? createFirestoreProjectRepository(db, currentUserId) : null),
    [currentUserId],
  );
  const eventRepository = useMemo(() => (db ? createFirestoreExecutiveEventRepository(db) : null), []);
  const researchPackageRepository = useMemo(() => (db ? createFirestoreResearchPackageRepository(db) : null), []);
  const outlinePackageRepository = useMemo(() => (db ? createFirestoreOutlinePackageRepository(db) : null), []);
  const productionPackageRepository = useMemo(() => (db ? createFirestoreProductionPackageRepository(db) : null), []);
  const executiveServiceRegistry = useMemo(
    () =>
      projectRepository && researchPackageRepository && outlinePackageRepository && productionPackageRepository
        ? createExecutiveServiceRegistry({
            projectRepository,
            researchPackageRepository,
            outlinePackageRepository,
            productionPackageRepository,
          })
        : null,
    [outlinePackageRepository, productionPackageRepository, projectRepository, researchPackageRepository],
  );
  const [loading, setLoading] = useState(Boolean(projectRepository));
  const [error, setError] = useState("");
  const [timelineEvents, setTimelineEvents] = useState<ExecutiveEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(Boolean(eventRepository));
  const [timelineError, setTimelineError] = useState("");
  const [actionPending, setActionPending] = useState<ProjectWorkflowAction | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [servicePending, setServicePending] = useState(false);
  const [activePackageView, setActivePackageView] = useState<ActivePackageView>(null);
  const packageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [researchPackageState, setResearchPackageState] = useState<ProjectScopedArtifact<ResearchPackage> | null>(null);
  const [researchPackageLoading, setResearchPackageLoading] = useState(false);
  const [researchPackageMessage, setResearchPackageMessage] = useState("");
  const [outlinePackageState, setOutlinePackageState] = useState<ProjectScopedArtifact<OutlinePackage> | null>(null);
  const [outlinePackageLoading, setOutlinePackageLoading] = useState(false);
  const [outlinePackageMessage, setOutlinePackageMessage] = useState("");
  const [productionPackageState, setProductionPackageState] = useState<ProjectScopedArtifact<ProductionPackage> | null>(null);
  const [productionPackageLoading, setProductionPackageLoading] = useState(false);
  const [productionPackageMessage, setProductionPackageMessage] = useState("");

  useEffect(() => {
    if (!projectRepository) return;

    const repository = projectRepository;
    let active = true;

    async function loadProjects() {
      try {
        const savedProjects = await repository.listByWorkspace(executiveWorkspaceId);
        const normalizedProjects = savedProjects.map(normalizeWorkspaceProject);
        if (!active) return;

        setProjects(normalizedProjects);

        if (eventRepository) {
          try {
            setTimelineError("");
            const existingEvents = await eventService.listByWorkspace(eventRepository, executiveWorkspaceId);
            const synchronizedEvents = await eventService.synchronizeProjectHistory(
              eventRepository,
              normalizedProjects,
              existingEvents,
            );
            if (active) setTimelineEvents(synchronizedEvents);
          } catch {
            if (active) setTimelineError("Headquarters could not load the project timeline.");
          } finally {
            if (active) setTimelineLoading(false);
          }
        }

        const searchParams = new URLSearchParams(window.location.search);
        const requestedProjectId = searchParams.get("projectId");
        const requestedProject = normalizedProjects.find((project) => project.id === requestedProjectId);
        if (!requestedProject) return;

        selectedProjectIdRef.current = requestedProject.id;
        setSelectedProjectId(requestedProject.id);
        setResearchPackageState(null);
        setOutlinePackageState(null);
        setProductionPackageState(null);
        const requestedView = searchParams.get("view");
        if (requestedView === "research-package") setActivePackageView("research");
        if (requestedView === "outline-package") setActivePackageView("outline");
        if (requestedView === "production-package") setActivePackageView("production");
      } catch {
        if (active) setError("Headquarters could not load saved projects.");
      } finally {
        if (active) {
          setLoading(false);
          setTimelineLoading(false);
        }
      }
    }

    void loadProjects();
    return () => {
      active = false;
    };
  }, [eventRepository, projectRepository]);

  const owners = useMemo(
    () => Array.from(new Set(projects.map((project) => project.ownerId))).sort((first, second) => first.localeCompare(second)),
    [projects],
  );
  const prioritization = useMemo(() => executivePrioritizationService.prioritize(projects), [projects]);
  const assessmentByProjectId = useMemo(
    () => new Map(prioritization.assessments.map((assessment) => [assessment.project.id, assessment])),
    [prioritization],
  );
  const founderPriorityRankByProjectId = useMemo(
    () => new Map(prioritization.topFounderPriorities.map((assessment) => [assessment.project.id, assessment.rank])),
    [prioritization],
  );
  const recommendationResult = useMemo(
    () => executiveRecommendationService.rank(projects, timelineEvents),
    [projects, timelineEvents],
  );
  const recommendationByProjectId = useMemo(
    () => new Map(recommendationResult.recommendations.map((recommendation) => [recommendation.project.id, recommendation])),
    [recommendationResult],
  );

  const visibleProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredProjects = projects.filter((project) => {
      const matchesSearch =
        !normalizedSearch ||
        project.title.toLowerCase().includes(normalizedSearch) ||
        formatProjectType(getProjectType(project)).toLowerCase().includes(normalizedSearch) ||
        formatProjectOwner(project, currentUserId, currentUserLabel).toLowerCase().includes(normalizedSearch);

      return (
        matchesSearch &&
        (typeFilter === allFilters || getProjectType(project) === typeFilter) &&
        (stateFilter === allFilters || getProjectState(project) === stateFilter) &&
        (workspaceFilter === allFilters || project.currentWorkspace === workspaceFilter) &&
        (priorityFilter === allFilters || project.priority === priorityFilter) &&
        (ownerFilter === allFilters || project.ownerId === ownerFilter)
      );
    });

    return sortProjects(filteredProjects, sortBy, assessmentByProjectId, recommendationByProjectId);
  }, [assessmentByProjectId, currentUserId, currentUserLabel, ownerFilter, priorityFilter, projects, recommendationByProjectId, searchTerm, sortBy, stateFilter, typeFilter, workspaceFilter]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const researchPackage = artifactForProject(researchPackageState, selectedProjectId);
  const outlinePackage = artifactForProject(outlinePackageState, selectedProjectId);
  const productionPackage = artifactForProject(productionPackageState, selectedProjectId);
  const selectedProjectEvents = selectedProject
    ? timelineEvents.filter((event) => event.projectId === selectedProject.id)
    : [];
  const selectedAssessment = selectedProject ? assessmentByProjectId.get(selectedProject.id) || null : null;
  const selectedProductionReadiness = useMemo(
    () => (selectedProject ? productionReadinessService.evaluate(selectedProject, productionPackage) : null),
    [productionPackage, selectedProject],
  );
  const selectedArtifactIntegrityWarning = useMemo(() => {
    if (!selectedProject) return null;
    const stateByArtifact = {
      researchPackage: researchPackageState,
      outlinePackage: outlinePackageState,
      productionPackage: productionPackageState,
    };
    const requiredArtifacts = projectArtifactIntegrityService.requiredArtifacts(selectedProject);
    const checksComplete = requiredArtifacts.every(
      (artifactType) => stateByArtifact[artifactType]?.projectId === selectedProject.id,
    );
    if (!checksComplete) return null;
    return projectArtifactIntegrityService.evaluate(selectedProject, {
      researchPackage,
      outlinePackage,
      productionPackage,
    });
  }, [outlinePackage, outlinePackageState, productionPackage, productionPackageState, researchPackage, researchPackageState, selectedProject]);
  const projectError = error || (!projectRepository ? "Projects are unavailable because Firebase is not configured." : "");

  useEffect(() => {
    if (!selectedProjectId) return;
    const projectId = selectedProjectId;
    let active = true;

    async function loadProjectArtifacts() {
      setResearchPackageLoading(true);
      setOutlinePackageLoading(true);
      setProductionPackageLoading(true);
      setResearchPackageMessage("");
      setOutlinePackageMessage("");
      setProductionPackageMessage("");

      const [researchResult, outlineResult, productionResult] = await Promise.allSettled([
        researchPackageRepository?.getByProjectId(projectId) || Promise.resolve(null),
        outlinePackageRepository?.getByProjectId(projectId) || Promise.resolve(null),
        productionPackageRepository?.getByProjectId(projectId) || Promise.resolve(null),
      ]);
      if (!active || selectedProjectIdRef.current !== projectId) return;

      if (researchResult.status === "fulfilled") {
        setResearchPackageState(
          scopeArtifactResponse(projectId, selectedProjectIdRef.current, researchResult.value) || { projectId, artifact: null },
        );
      } else {
        setResearchPackageMessage("Headquarters could not load the Research Package.");
      }
      if (outlineResult.status === "fulfilled") {
        setOutlinePackageState(
          scopeArtifactResponse(projectId, selectedProjectIdRef.current, outlineResult.value) || { projectId, artifact: null },
        );
      } else {
        setOutlinePackageMessage("Headquarters could not load the Outline Package.");
      }
      if (productionResult.status === "fulfilled") {
        setProductionPackageState(
          scopeArtifactResponse(projectId, selectedProjectIdRef.current, productionResult.value) || { projectId, artifact: null },
        );
      } else {
        setProductionPackageMessage("Headquarters could not load the Production Package.");
      }

      setResearchPackageLoading(false);
      setOutlinePackageLoading(false);
      setProductionPackageLoading(false);
    }

    void loadProjectArtifacts();

    return () => {
      active = false;
    };
  }, [outlinePackageRepository, productionPackageRepository, researchPackageRepository, selectedProjectId]);

  function selectProject(projectId: string) {
    packageTriggerRef.current = null;
    selectedProjectIdRef.current = projectId;
    setSelectedProjectId(projectId);
    setActionMessage("");
    setActivePackageView(null);
    setResearchPackageState(null);
    setResearchPackageLoading(false);
    setResearchPackageMessage("");
    setOutlinePackageState(null);
    setOutlinePackageLoading(false);
    setOutlinePackageMessage("");
    setProductionPackageState(null);
    setProductionPackageLoading(false);
    setProductionPackageMessage("");
  }

  function closeProject() {
    packageTriggerRef.current = null;
    selectedProjectIdRef.current = null;
    setSelectedProjectId(null);
    setActionMessage("");
    setActivePackageView(null);
    setResearchPackageState(null);
    setResearchPackageLoading(false);
    setResearchPackageMessage("");
    setOutlinePackageState(null);
    setOutlinePackageLoading(false);
    setOutlinePackageMessage("");
    setProductionPackageState(null);
    setProductionPackageLoading(false);
    setProductionPackageMessage("");
  }

  async function refreshTimeline(currentProjects: Project[]) {
    if (!eventRepository) return;

    try {
      setTimelineError("");
      const existingEvents = await eventService.listByWorkspace(eventRepository, executiveWorkspaceId);
      setTimelineEvents(await eventService.synchronizeProjectHistory(eventRepository, currentProjects, existingEvents));
    } catch {
      setTimelineError("Headquarters could not refresh the project timeline.");
    }
  }

  async function handleProjectAction(action: ProjectWorkflowAction) {
    if (!selectedProject || !projectRepository) return;
    if (
      action === "review" &&
      getProjectState(selectedProject) === "production" &&
      selectedProductionReadiness?.status !== ProductionReadinessStatus.ReadyForReview
    ) {
      setActionMessage("Complete the Production Package before beginning Founder Review.");
      return;
    }
    if (action === "archive" && !window.confirm(`Archive ${selectedProject.title}?`)) return;

    setActionPending(action);
    setActionMessage("");
    try {
      const updatedProject = normalizeWorkspaceProject(action === "request-revision" && productionPackageRepository
        ? await projectRevisionService.request(projectRepository, productionPackageRepository, selectedProject)
        : await projectRepository.update(
            selectedProject.id,
            projectWorkflowService.createUpdate(selectedProject, action, new Date().toISOString(), {
              productionReadiness: selectedProductionReadiness,
            }),
            { expectedUpdatedAt: selectedProject.updatedAt },
          ));
      const updatedProjects = projects.map((project) => (project.id === updatedProject.id ? updatedProject : project));
      setProjects(updatedProjects);
      await refreshTimeline(updatedProjects);
      const messages: Record<ProjectWorkflowAction, string> = {
        continue: "Project continued in Production Studio.",
        review: "Project moved to Founder Review.",
        approve: "Founder approval complete.",
        "request-revision": "Revision requested.",
        "complete-research": "Research complete. Project advanced to Outline.",
        "complete-outline": "Outline complete. Project advanced to Production.",
        "complete-production": "Production complete. Project is ready for Founder Review.",
        publish: "Project published.",
        archive: "Project archived.",
      };
      setActionMessage(messages[action]);
    } catch (error) {
      setActionMessage(projectWorkflowNotification(error, selectedProject) || "Headquarters could not update this project.");
    } finally {
      setActionPending(null);
    }
  }

  async function handleRunExecutiveService(expectedServiceType: ExecutiveServiceType) {
    if (!selectedProject || !executiveServiceRegistry) return;
    const serviceProjectId = selectedProject.id;
    const service = executiveServiceRegistry.resolve(selectedProject);
    if (!service || service.type !== expectedServiceType) {
      setActionMessage("The selected Executive Service is not available for the current project state.");
      return;
    }

    setServicePending(true);
    setActionMessage("");
    setResearchPackageMessage("");
    setOutlinePackageMessage("");
    setProductionPackageMessage("");
    try {
      const result = await executiveServiceRegistry.execute(selectedProject);
      if (result.status === ExecutiveServiceStatus.Blocked) {
        setActionMessage(result.recommendedNextAction);
        return;
      }

      const updatedProject = normalizeWorkspaceProject(result.updatedProject);
      const updatedProjects = projects.map((project) => (project.id === updatedProject.id ? updatedProject : project));
      setProjects(updatedProjects);
      await refreshTimeline(updatedProjects);
      if (selectedProjectIdRef.current !== serviceProjectId) return;

      if (expectedServiceType === ExecutiveServiceType.Research && researchPackageRepository) {
        const savedPackage = await researchPackageRepository.getByProjectId(serviceProjectId);
        const scopedPackage = scopeArtifactResponse(
          serviceProjectId,
          selectedProjectIdRef.current,
          savedPackage,
        );
        if (!scopedPackage) return;
        setResearchPackageState(scopedPackage);
        setActivePackageView("research");
        setActionMessage("Research complete. Project advanced to Outline.");
      } else if (expectedServiceType === ExecutiveServiceType.Outline && outlinePackageRepository) {
        const savedPackage = await outlinePackageRepository.getByProjectId(serviceProjectId);
        const scopedPackage = scopeArtifactResponse(
          serviceProjectId,
          selectedProjectIdRef.current,
          savedPackage,
        );
        if (!scopedPackage) return;
        setOutlinePackageState(scopedPackage);
        setActivePackageView("outline");
        setActionMessage("Outline complete. Project advanced to Production Studio.");
      } else if (expectedServiceType === ExecutiveServiceType.Production && productionPackageRepository) {
        const savedPackage = await productionPackageRepository.getByProjectId(serviceProjectId);
        const scopedPackage = scopeArtifactResponse(
          serviceProjectId,
          selectedProjectIdRef.current,
          savedPackage,
        );
        if (!scopedPackage) return;
        setProductionPackageState(scopedPackage);
        setActivePackageView("production");
        setActionMessage("Production complete. Project is ready for Founder Review.");
      }
    } catch (error) {
      if (selectedProjectIdRef.current === serviceProjectId) {
        setActionMessage(
          projectWorkflowNotification(error, selectedProject) ||
            "Headquarters could not complete the selected Executive Service.",
        );
      }
    } finally {
      setServicePending(false);
    }
  }

  function handleRunResearch() {
    return handleRunExecutiveService(ExecutiveServiceType.Research);
  }

  function handleRunOutline() {
    return handleRunExecutiveService(ExecutiveServiceType.Outline);
  }

  function handleRunProduction() {
    return handleRunExecutiveService(ExecutiveServiceType.Production);
  }

  async function handleOpenResearchPackage(trigger: HTMLButtonElement) {
    if (!selectedProject || !researchPackageRepository) return;
    const projectId = selectedProject.id;

    packageTriggerRef.current = trigger;
    setActivePackageView("research");
    setResearchPackageLoading(true);
    setResearchPackageMessage("");
    try {
      const savedPackage = await researchPackageRepository.getByProjectId(projectId);
      const scopedPackage = scopeArtifactResponse(projectId, selectedProjectIdRef.current, savedPackage);
      if (!scopedPackage) return;
      setResearchPackageState(scopedPackage);
      if (!savedPackage) setResearchPackageMessage("No research package exists for this project yet.");
    } catch {
      if (selectedProjectIdRef.current === projectId) {
        setResearchPackageMessage("Headquarters could not load the Research Package.");
      }
    } finally {
      if (selectedProjectIdRef.current === projectId) setResearchPackageLoading(false);
    }
  }

  async function handleOpenOutlinePackage(trigger: HTMLButtonElement) {
    if (!selectedProject || !outlinePackageRepository) return;
    const projectId = selectedProject.id;

    packageTriggerRef.current = trigger;
    setActivePackageView("outline");
    setOutlinePackageLoading(true);
    setOutlinePackageMessage("");
    try {
      const savedPackage = await outlinePackageRepository.getByProjectId(projectId);
      const scopedPackage = scopeArtifactResponse(projectId, selectedProjectIdRef.current, savedPackage);
      if (!scopedPackage) return;
      setOutlinePackageState(scopedPackage);
      if (!savedPackage) setOutlinePackageMessage("No Outline Package exists for this project yet.");
    } catch {
      if (selectedProjectIdRef.current === projectId) {
        setOutlinePackageMessage("Headquarters could not load the Outline Package.");
      }
    } finally {
      if (selectedProjectIdRef.current === projectId) setOutlinePackageLoading(false);
    }
  }

  async function handleOpenProductionPackage(trigger: HTMLButtonElement) {
    if (!selectedProject || !productionPackageRepository) return;
    const projectId = selectedProject.id;

    packageTriggerRef.current = trigger;
    setActivePackageView("production");
    setProductionPackageLoading(true);
    setProductionPackageMessage("");
    try {
      const savedPackage = await productionPackageRepository.getByProjectId(projectId);
      const scopedPackage = scopeArtifactResponse(projectId, selectedProjectIdRef.current, savedPackage);
      if (!scopedPackage) return;
      setProductionPackageState(scopedPackage);
      if (!savedPackage) setProductionPackageMessage("No Production Package exists for this project yet.");
    } catch {
      if (selectedProjectIdRef.current === projectId) {
        setProductionPackageMessage("Headquarters could not load the Production Package.");
      }
    } finally {
      if (selectedProjectIdRef.current === projectId) setProductionPackageLoading(false);
    }
  }

  async function handleBeginReview() {
    if (!selectedProductionReadiness || !selectedProject) return;
    if (selectedProductionReadiness.status !== ProductionReadinessStatus.ReadyForReview) {
      setProductionPackageMessage("Complete the remaining production requirements before Founder Review.");
      return;
    }

    await handleProjectAction("review");
    setActivePackageView(null);
  }

  const activePackage = activePackageView === "research"
    ? researchPackage
    : activePackageView === "outline"
      ? outlinePackage
      : activePackageView === "production"
        ? productionPackage
        : null;
  const activePackageLoading = activePackageView === "research"
    ? researchPackageLoading
    : activePackageView === "outline"
      ? outlinePackageLoading
      : productionPackageLoading;
  const activePackageMessage = activePackageView === "research"
    ? researchPackageMessage
    : activePackageView === "outline"
      ? outlinePackageMessage
      : productionPackageMessage;
  const activePackageTitle = activePackageView === "research"
    ? "Research Package"
    : activePackageView === "outline"
      ? "Outline Package"
      : "Production Package";
  const activePackageMetadata = packageMetadata(
    activePackage,
    activePackageView === "production" && selectedProductionReadiness
      ? [{ label: "Readiness", value: formatPackageStatus(selectedProductionReadiness.status) }]
      : [],
  );

  return (
    <div className="min-h-full bg-[#050505] px-4 py-4 text-white sm:px-5">
      <div className="mx-auto grid max-w-[1680px] gap-4">
        <section className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Project Workspace</p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-normal text-white">All Projects</h1>
            <p className="mt-2 text-sm font-bold text-zinc-400">Search, prioritize, and move work forward across Headquarters.</p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="border-l border-white/10 pl-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Projects</p>
              <p className="mt-1 text-lg font-black text-white">{projects.length}</p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Visible</p>
              <p className="mt-1 text-lg font-black text-white">{visibleProjects.length}</p>
            </div>
          </div>
        </section>

        <ProjectPrioritySummary prioritization={prioritization} />

        <section className="border border-white/10 bg-[#0d0d0d] p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(130px,0.7fr))_minmax(150px,0.8fr)]">
            <label className="relative block">
              <span className="sr-only">Search projects</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search title, type, or owner"
                className="h-10 w-full border border-white/10 bg-black pl-9 pr-3 text-xs font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500"
              />
            </label>
            <ProjectFilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={projectTypes.map((value) => ({ value, label: formatProjectType(value) }))} />
            <ProjectFilterSelect label="State" value={stateFilter} onChange={setStateFilter} options={projectStates.map((value) => ({ value, label: formatProjectState(value) }))} />
            <ProjectFilterSelect label="Workspace" value={workspaceFilter} onChange={setWorkspaceFilter} options={projectWorkspaces.map((value) => ({ value, label: formatProjectWorkspace(value) }))} />
            <ProjectFilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={projectPriorities.map((value) => ({ value, label: formatProjectPriority(value) }))} />
            <ProjectFilterSelect label="Owner" value={ownerFilter} onChange={setOwnerFilter} options={owners.map((value) => ({ value, label: value === currentUserId ? currentUserLabel : value }))} />
            <label className="relative block">
              <span className="sr-only">Sort projects</span>
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="h-10 w-full appearance-none border border-white/10 bg-black pl-9 pr-3 text-xs font-black text-zinc-300 outline-none transition focus:border-red-500"
              >
                <option value="recommendation-score">Recommendation Score</option>
                <option value="priority-score">Priority Score</option>
                <option value="updated">Updated</option>
                <option value="priority">Priority</option>
                <option value="progress">Progress</option>
                <option value="due-date">Due Date</option>
                <option value="project-name">Project Name</option>
              </select>
            </label>
          </div>
        </section>

        <div className={`grid min-h-0 gap-4 ${selectedProject ? "xl:grid-cols-[minmax(0,1fr)_390px]" : ""}`}>
          <section className="min-w-0 border border-white/10 bg-[#0b0b0b]">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-black uppercase text-zinc-400">
                <Loader2 className="animate-spin text-red-500" size={18} />
                Loading projects
              </div>
            ) : projectError ? (
              <div className="min-h-64 p-6 text-sm font-bold leading-6 text-red-200">{projectError}</div>
            ) : projects.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <FolderKanban size={28} className="text-red-500" />
                <h2 className="mt-4 text-xl font-black uppercase text-white">No projects yet.</h2>
                <Link href="/executive-workspace/executive-office" className="mt-5 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-red-500">
                  Create Your First Project
                </Link>
              </div>
            ) : visibleProjects.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm font-bold text-zinc-400">
                No projects match the current search and filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1740px] w-full border-collapse text-left">
                  <thead className="border-b border-white/10 bg-black">
                    <tr>
                      {[
                        "Title",
                        "Type",
                        "Current Workspace",
                        "State",
                        "Priority",
                        "Priority Score",
                        "Recommendation Score",
                        "Progress",
                        "Owner",
                        "Updated",
                        "Recommended Next Action",
                      ].map((heading) => (
                        <th key={heading} scope="col" className="px-3 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProjects.map((project) => {
                      const selected = project.id === selectedProjectId;
                      const assessment = assessmentByProjectId.get(project.id);
                      const recommendation = recommendationByProjectId.get(project.id);
                      const founderPriorityRank = founderPriorityRankByProjectId.get(project.id);
                      return (
                        <tr key={project.id} className={`border-b border-white/5 transition ${selected ? "bg-red-500/10" : "hover:bg-white/[0.03]"}`}>
                          <td className="max-w-72 px-3 py-3">
                            <button type="button" onClick={() => selectProject(project.id)} className="text-left text-sm font-black leading-5 text-white transition hover:text-red-400">
                              {project.title}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-xs font-bold text-zinc-300">{formatProjectType(getProjectType(project))}</td>
                          <td className="px-3 py-3 text-xs font-bold text-zinc-300">{formatProjectWorkspace(project.currentWorkspace)}</td>
                          <td className="px-3 py-3">
                            <span className="border border-red-500/25 bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-200">
                              {formatProjectState(getProjectState(project))}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-black text-zinc-300">{formatProjectPriority(project.priority)}</td>
                          <td className="px-3 py-3">
                            <p className="text-sm font-black text-white">{assessment?.priorityScore ?? 0}</p>
                            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-400">
                              {founderPriorityRank ? `Priority #${founderPriorityRank}` : "Active"}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-sm font-black text-white">{recommendation?.score ?? 0}</p>
                            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-400">
                              {recommendation?.actionLabel || "Archived"}
                            </p>
                          </td>
                          <td className="w-36 px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden bg-white/10">
                                <div className="h-full bg-red-500" style={{ width: `${Math.min(100, Math.max(0, project.progressPercent))}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-zinc-400">{project.progressPercent}%</span>
                            </div>
                          </td>
                          <td className="max-w-48 truncate px-3 py-3 text-xs font-bold text-zinc-300" title={formatProjectOwner(project, currentUserId, currentUserLabel)}>{formatProjectOwner(project, currentUserId, currentUserLabel)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-zinc-400">{formatProjectDate(project.updatedAt)}</td>
                          <td className="max-w-80 px-3 py-3">
                            <p className="text-xs font-bold leading-5 text-zinc-300">{recommendation?.headline || "No active recommendation"}</p>
                            <p className="mt-1 text-[10px] font-bold leading-4 text-zinc-600">
                              Why now: {recommendation?.whyNow || "The project is outside the active recommendation set."}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selectedProject ? (
            <ProjectDetailPanel
              project={selectedProject}
              priorityAssessment={selectedAssessment}
              founderPriorityRank={founderPriorityRankByProjectId.get(selectedProject.id)}
              ownerLabel={formatProjectOwner(selectedProject, currentUserId, currentUserLabel)}
              actionPending={actionPending}
              actionMessage={actionMessage}
              researchPackageLoading={researchPackageLoading}
              outlinePackageLoading={outlinePackageLoading}
              productionPackageLoading={productionPackageLoading}
              artifactIntegrityWarning={selectedArtifactIntegrityWarning}
              productionReadiness={selectedProductionReadiness}
              servicePending={servicePending}
              timelineEvents={selectedProjectEvents}
              timelineLoading={timelineLoading}
              timelineError={timelineError || (!eventRepository ? "The project timeline is unavailable." : "")}
              onAction={(action) => void handleProjectAction(action)}
              onRunResearch={() => void handleRunResearch()}
              onRunOutline={() => void handleRunOutline()}
              onRunProduction={() => void handleRunProduction()}
              onOpenResearchPackage={(trigger) => void handleOpenResearchPackage(trigger)}
              onOpenOutlinePackage={(trigger) => void handleOpenOutlinePackage(trigger)}
              onOpenProductionPackage={(trigger) => void handleOpenProductionPackage(trigger)}
              onClose={closeProject}
            />
          ) : null}
        </div>
      </div>
      {activePackageView && selectedProject ? (
        <PackageOverlay
          title={activePackageTitle}
          projectTitle={selectedProject.title}
          status={activePackageLoading ? "Loading" : formatPackageStatus(activePackage?.status)}
          metadata={activePackageMetadata}
          returnFocusRef={packageTriggerRef}
          onClose={() => setActivePackageView(null)}
        >
          {activePackageView === "research" ? (
            <ResearchPackagePanel
              researchPackage={researchPackage}
              loading={researchPackageLoading}
              message={researchPackageMessage}
            />
          ) : activePackageView === "outline" ? (
            <OutlinePackagePanel
              outlinePackage={outlinePackage}
              loading={outlinePackageLoading}
              message={outlinePackageMessage}
            />
          ) : (
            <ProductionPackagePanel
              productionPackage={productionPackage}
              readiness={selectedProductionReadiness}
              loading={productionPackageLoading}
              message={productionPackageMessage || activePackageMessage}
              onBeginReview={() => void handleBeginReview()}
            />
          )}
        </PackageOverlay>
      ) : null}
    </div>
  );
}
