"use client";

import { ExecutionStatus } from "@/domain/execution";
import {
  createFirestoreFounderVisitRepository,
  type DailyBriefAction,
  type FounderVisitRegistration,
  type FounderVisitRepository,
} from "@/domain/briefing";
import { createFirestoreExecutiveEventRepository, type ExecutiveEvent } from "@/domain/event";
import { OrchestrationStatus } from "@/domain/orchestration";
import { createFirestoreProjectRepository, type Project, ProjectType, ProjectWorkspace } from "@/domain/project";
import { createFirestoreProductionPackageRepository } from "@/domain/services";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import {
  createInitialProjectStateHistory,
  adminAuthorizationService,
  executiveCommandService,
  executionPlanningService,
  eventService,
  founderDailyBriefService,
  intentService,
  projectOrchestratorService,
  projectCommandTargetService,
  productionReadinessService,
  projectRevisionService,
  projectWorkflowService,
  createSubmissionIdempotencyTracker,
} from "@/services";
import { CompanyHealth } from "@/components/executive/CompanyHealth";
import { AccessRestricted } from "@/components/admin/AccessRestricted";
import { ExecutiveRecommendation } from "@/components/executive/ExecutiveRecommendation";
import { ExecutiveTimeline } from "@/components/executive/ExecutiveTimeline";
import { FounderDailyBrief } from "@/components/executive/FounderDailyBrief";
import { NeedsAttention } from "@/components/executive/NeedsAttention";
import { OpportunitiesRecommendations } from "@/components/executive/OpportunitiesRecommendations";
import { KnowledgeExplorer } from "@/components/executive/KnowledgeExplorer";
import { ProjectWorkspace as ProjectsWorkspace } from "@/components/executive/ProjectWorkspace";
import { projectWorkflowNotification } from "@/components/executive/projectWorkflowNotification";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Archive,
  Beaker,
  BookOpen,
  Building2,
  Clapperboard,
  DoorOpen,
  FolderKanban,
  Loader2,
  LockKeyhole,
  Map as MapIcon,
  Mic,
  Network,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

export type ExecutiveSpaceId =
  | "executive-office"
  | "projects"
  | "intelligence-center"
  | "knowledge-center"
  | "production-studio"
  | "strategy-room"
  | "product-lab"
  | "library";

type WorkspaceStatus = "checking" | "checking-role" | "authenticated" | "signed-out" | "unconfigured" | "denied";

type ExecutiveSpace = {
  id: ExecutiveSpaceId;
  label: string;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Building2;
  panels: string[];
};

export type ConversationEntry = {
  id: string;
  request: string;
  project?: Project;
  status: "success" | "blocked";
  message: string;
  nextStep: string;
  createdAt: string;
};

function createSubmissionId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function restoreConversationHistory(storedHistory: string | null): ConversationEntry[] {
  if (!storedHistory) return [];

  try {
    const parsedHistory = JSON.parse(storedHistory);
    if (!Array.isArray(parsedHistory)) return [];

    const seenProjectBriefs = new Set<string>();
    return (parsedHistory as ConversationEntry[])
      .filter((entry) => {
        if (entry.status !== "success") return false;
        if (entry.message !== "Project Briefing" || !entry.project) return true;

        if (seenProjectBriefs.has(entry.project.id)) return false;
        seenProjectBriefs.add(entry.project.id);
        return true;
      })
      .slice(0, 6);
  } catch {
    return [];
  }
}

function sortProjectsByUpdate(projects: Project[]) {
  return [...projects].sort((firstProject, secondProject) => Date.parse(secondProject.updatedAt) - Date.parse(firstProject.updatedAt));
}

type ConversationView = "headquarters" | "project-detail" | "founder-review" | "founder-approval";

const conversationStorageKey = "hoopfrens.executiveOffice.conversationHistory";
const conversationViewStorageKey = "hoopfrens.executiveOffice.conversationView";
const executiveWorkspaceId = "executive-workspace";
const pendingFounderVisitRegistrations = new Map<string, Promise<FounderVisitRegistration>>();

function recordFounderVisit(
  repository: FounderVisitRepository,
  userId: string,
  workspaceId: string,
  visitedAt: string,
) {
  const registrationKey = `${userId}:${workspaceId}`;
  const pendingRegistration = pendingFounderVisitRegistrations.get(registrationKey);
  if (pendingRegistration) return pendingRegistration;

  const registration = repository.recordVisit(userId, workspaceId, visitedAt);
  pendingFounderVisitRegistrations.set(registrationKey, registration);
  void registration.then(
    () => pendingFounderVisitRegistrations.delete(registrationKey),
    () => pendingFounderVisitRegistrations.delete(registrationKey),
  );
  return registration;
}

function normalizeProjectType(projectType: string | undefined): ProjectType {
  const supportedTypes = Object.values(ProjectType) as string[];
  return supportedTypes.includes(projectType || "") ? (projectType as ProjectType) : ProjectType.SchoolSpotlight;
}

function normalizeProjectWorkspace(workspace: ProjectWorkspace | string | undefined): ProjectWorkspace {
  const workspaceAliases: Record<string, ProjectWorkspace> = {
    "executive office": ProjectWorkspace.ExecutiveOffice,
    "executive-office": ProjectWorkspace.ExecutiveOffice,
    "intelligence center": ProjectWorkspace.IntelligenceCenter,
    "intelligence-center": ProjectWorkspace.IntelligenceCenter,
    "production studio": ProjectWorkspace.ProductionStudio,
    "production-studio": ProjectWorkspace.ProductionStudio,
    "strategy room": ProjectWorkspace.StrategyRoom,
    "strategy-room": ProjectWorkspace.StrategyRoom,
    "product lab": ProjectWorkspace.ProductLab,
    "product-lab": ProjectWorkspace.ProductLab,
    library: ProjectWorkspace.Library,
  };

  return workspaceAliases[(workspace || "").toLowerCase()] || ProjectWorkspace.ExecutiveOffice;
}

function formatProjectWorkspace(workspace: ProjectWorkspace | string | undefined) {
  const labels: Record<ProjectWorkspace, string> = {
    [ProjectWorkspace.ExecutiveOffice]: "Executive Office",
    [ProjectWorkspace.IntelligenceCenter]: "Intelligence Center",
    [ProjectWorkspace.ProductionStudio]: "Production Studio",
    [ProjectWorkspace.StrategyRoom]: "Strategy Room",
    [ProjectWorkspace.ProductLab]: "Product Lab",
    [ProjectWorkspace.Library]: "Library",
  };

  return labels[normalizeProjectWorkspace(workspace)];
}

function formatProjectType(projectType: ProjectType | string | undefined) {
  const labels: Record<ProjectType, string> = {
    [ProjectType.SchoolSpotlight]: "School Spotlight",
    [ProjectType.PodcastEpisode]: "Podcast Episode",
    [ProjectType.NewsStory]: "News Story",
    [ProjectType.RecruitingAnalysis]: "Recruiting Analysis",
    [ProjectType.SocialVideo]: "Social Video",
    [ProjectType.ResourceGuide]: "Resource Guide",
    [ProjectType.Partnership]: "Partnership",
    [ProjectType.WebsiteImprovement]: "Website Improvement",
    [ProjectType.Merchandise]: "Merchandise",
  };

  const normalizedType = normalizeProjectType(projectType);
  return labels[normalizedType];
}

function formatProjectStatus(status: ProjectStatus) {
  if (status === ProjectStatus.Draft) return "Draft";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatProjectPriority(priority: Priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getCurrentStep(project: Project, fallback: string) {
  return project.currentStep || project.remainingNextStep || fallback;
}

function formatProjectDate(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function normalizeProjectState(project: Project): Project {
  const currentStep = project.currentStep || project.remainingNextStep || "Research";
  const projectType = normalizeProjectType(project.type || project.projectType);
  const projectStatus = project.state || project.status || ProjectStatus.Draft;
  const currentWorkspace = normalizeProjectWorkspace(project.currentWorkspace || project.workspace);
  const workspaceHistory = project.workspaceHistory?.length
    ? project.workspaceHistory
    : [
        {
          workspace: currentWorkspace,
          enteredAt: project.createdAt || new Date().toISOString(),
          reason: "Project workspace restored",
        },
      ];

  return {
    ...project,
    type: projectType,
    projectType,
    state: projectStatus,
    status: projectStatus,
    currentWorkspace,
    workspace: formatProjectWorkspace(currentWorkspace),
    workspaceHistory,
    progressPercent: project.progressPercent ?? (projectStatus === ProjectStatus.Approved ? 90 : 10),
    dependencies: project.dependencies || [],
    currentBlocker: project.currentBlocker || null,
    currentStep,
    recommendedNextAction: project.recommendedNextAction || currentStep,
    lastActivity: project.lastActivity || currentStep,
    remainingNextStep: project.remainingNextStep || currentStep,
  };
}

function createWorkspaceHistoryEntry(workspace: ProjectWorkspace, reason: string, enteredAt = new Date().toISOString()) {
  return {
    workspace,
    enteredAt,
    reason,
  };
}

export const executiveSpaces: ExecutiveSpace[] = [
  {
    id: "executive-office",
    label: "Executive Office",
    href: "/executive-workspace/executive-office",
    eyebrow: "Command",
    title: "Executive Office",
    description: "A quiet operating view for company priorities, leadership focus, and open foundation work.",
    icon: Building2,
    panels: ["Today", "Priorities", "Open loops"],
  },
  {
    id: "projects",
    label: "Projects",
    href: "/executive-workspace/projects",
    eyebrow: "Portfolio",
    title: "Projects",
    description: "A cross-workspace view of active Hoop Frens projects, priorities, and next actions.",
    icon: FolderKanban,
    panels: ["Projects", "Priorities", "Activity"],
  },
  {
    id: "intelligence-center",
    label: "Intelligence Center",
    href: "/executive-workspace/intelligence-center",
    eyebrow: "Research",
    title: "Intelligence Center",
    description: "Placeholder surface for basketball knowledge, source review, and signal gathering.",
    icon: MapIcon,
    panels: ["Signals", "Sources", "Watchlist"],
  },
  {
    id: "knowledge-center",
    label: "Knowledge Center",
    href: "/executive-workspace/knowledge",
    eyebrow: "Graph",
    title: "Knowledge Center",
    description: "Explore canonical knowledge nodes, source-backed relationships, confidence, and connected projects.",
    icon: Network,
    panels: ["Knowledge Nodes", "Relationships", "Sources"],
  },
  {
    id: "production-studio",
    label: "Production Studio",
    href: "/executive-workspace/production-studio",
    eyebrow: "Media",
    title: "Production Studio",
    description: "Placeholder surface for assets, packages, publishing readiness, and creative operations.",
    icon: Clapperboard,
    panels: ["Packages", "Assets", "Queue"],
  },
  {
    id: "strategy-room",
    label: "Strategy Room",
    href: "/executive-workspace/strategy-room",
    eyebrow: "Decisions",
    title: "Strategy Room",
    description: "Placeholder surface for decisions, tradeoffs, bets, and strategic context.",
    icon: DoorOpen,
    panels: ["Decisions", "Risks", "Next calls"],
  },
  {
    id: "product-lab",
    label: "Product Lab",
    href: "/executive-workspace/product-lab",
    eyebrow: "Build",
    title: "Product Lab",
    description: "Placeholder surface for platform experiments, product architecture, and future workflows.",
    icon: Beaker,
    panels: ["Ideas", "Specs", "Experiments"],
  },
  {
    id: "library",
    label: "Library",
    href: "/executive-workspace/library",
    eyebrow: "Archive",
    title: "Library",
    description: "Placeholder surface for documents, references, reusable context, and institutional memory.",
    icon: BookOpen,
    panels: ["References", "Docs", "Saved context"],
  },
];

export function ExecutiveWorkspaceShell({ activeSpaceId }: { activeSpaceId: ExecutiveSpaceId }) {
  const [status, setStatus] = useState<WorkspaceStatus>(isFirebaseConfigured ? "checking" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const activeSpace = executiveSpaces.find((space) => space.id === activeSpaceId) || executiveSpaces[0];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!auth) return;

    let active = true;
    let authorizationAttempt = 0;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const attempt = ++authorizationAttempt;
      setUser(nextUser);
      if (!nextUser) {
        setStatus("signed-out");
        return;
      }

      if (!db) {
        setStatus("denied");
        return;
      }

      const activeDb = db;
      setStatus("checking-role");
      try {
        const authorization = await adminAuthorizationService.authorize(nextUser, async (uid) => {
          const userSnapshot = await getDoc(doc(activeDb, "users", uid));
          return { exists: userSnapshot.exists(), role: userSnapshot.data()?.role };
        });
        if (active && attempt === authorizationAttempt) {
          setStatus(authorization.allowed ? "authenticated" : "denied");
        }
      } catch {
        if (active && attempt === authorizationAttempt) setStatus("denied");
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const userLabel = useMemo(() => user?.email || "Approved admin", [user]);

  if (status === "checking" || status === "checking-role") {
    return (
      <WorkspaceFrame>
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-3 border border-white/10 bg-black px-5 py-4 text-sm font-black uppercase text-zinc-300">
            <Loader2 className="animate-spin text-red-500" size={20} />
            {status === "checking-role" ? "Checking admin access" : "Checking workspace access"}
          </div>
        </div>
      </WorkspaceFrame>
    );
  }

  if (status === "denied") {
    return (
      <WorkspaceFrame>
        <div className="flex h-full items-center justify-center px-5">
          <AccessRestricted />
        </div>
      </WorkspaceFrame>
    );
  }

  if (status === "unconfigured" || status === "signed-out") {
    return (
      <WorkspaceFrame>
        <div className="flex h-full items-center justify-center px-5">
          <div className="w-full max-w-lg border border-white/10 bg-black p-7 shadow-2xl">
            <LockKeyhole className="text-red-500" size={28} />
            <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-red-500">Internal Workspace</p>
            <h1 className="mt-3 text-3xl font-black uppercase text-white">Access required</h1>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Sign in with an approved Hoop Frens admin account to view the Executive Workspace shell.
            </p>
            <div className="mt-5 border border-white/10 bg-white/[0.03] p-4 text-sm font-bold leading-6 text-zinc-300">
              Firebase authentication is required before workspace access is evaluated.
            </div>
            <Link
              href="/admin/login"
              className="mt-6 inline-flex rounded-lg bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-500"
            >
              Go to admin login
            </Link>
          </div>
        </div>
      </WorkspaceFrame>
    );
  }

  return (
    <WorkspaceFrame>
      <div className="flex h-full flex-col bg-zinc-950 text-white lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="flex shrink-0 flex-col border-b border-white/10 bg-black lg:sticky lg:top-0 lg:h-screen lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 px-4 py-3 lg:px-5 lg:py-5">
            <p className="text-xl font-black uppercase tracking-[-0.04em]">
              Hoop<span className="text-red-500">Frens</span>
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Executive Workspace</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto p-2 lg:grid lg:overflow-visible lg:p-3" aria-label="Executive workspace navigation">
            {executiveSpaces.map((space) => {
              const Icon = space.icon;
              const active = space.id === activeSpace.id;
              return (
                <Link
                  key={space.id}
                  href={space.href}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-black uppercase transition lg:h-11 lg:text-sm ${
                    active ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  {space.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Signed in</p>
            <p className="mt-2 truncate text-xs font-bold text-zinc-300">{userLabel}</p>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-zinc-950 px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">{activeSpace.eyebrow}</p>
              <h1 className="text-lg font-black uppercase text-white">{activeSpace.title}</h1>
            </div>
            <div className="flex items-center gap-2 border border-white/10 bg-black px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
              <LockKeyhole size={14} className="text-red-500" />
              Protected Workspace
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto">
            {activeSpace.id === "executive-office" ? (
              <ExecutiveOfficeContent currentUserId={user?.uid || "founder"} />
            ) : activeSpace.id === "projects" ? (
              <ProjectsWorkspace currentUserId={user?.uid || "founder"} currentUserLabel={userLabel} />
            ) : activeSpace.id === "knowledge-center" ? (
              <KnowledgeExplorer currentUserId={user?.uid || "founder"} />
            ) : (
              <WorkspacePlaceholder activeSpace={activeSpace} />
            )}
          </main>
        </section>
      </div>
    </WorkspaceFrame>
  );
}

function ExecutiveOfficeContent({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const [conversationInput, setConversationInput] = useState("");
  const [conversationSubmitting, setConversationSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const submissionIdempotency = useRef(createSubmissionIdempotencyTracker(createSubmissionId));
  const [sessionProjects, setSessionProjects] = useState<Project[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<ExecutiveEvent[]>([]);
  const [projectLoadError, setProjectLoadError] = useState("");
  const [timelineLoadError, setTimelineLoadError] = useState("");
  const projectRepository = useMemo(
    () => (db ? createFirestoreProjectRepository(db, currentUserId) : null),
    [currentUserId],
  );
  const eventRepository = useMemo(() => (db ? createFirestoreExecutiveEventRepository(db) : null), []);
  const productionPackageRepository = useMemo(() => (db ? createFirestoreProductionPackageRepository(db) : null), []);
  const founderVisitRepository = useMemo(() => (db ? createFirestoreFounderVisitRepository(db) : null), []);
  const [projectsLoading, setProjectsLoading] = useState(Boolean(projectRepository));
  const [timelineLoading, setTimelineLoading] = useState(Boolean(eventRepository));
  const [lastVisitAt, setLastVisitAt] = useState<string | null>(null);
  const [visitLoading, setVisitLoading] = useState(Boolean(founderVisitRepository));
  const [visitError, setVisitError] = useState("");
  const [briefGeneratedAt] = useState(() => new Date());
  const [conversationView, setConversationView] = useState<ConversationView>(() => {
    if (typeof window === "undefined") return "headquarters";

    const storedView = window.sessionStorage.getItem(conversationViewStorageKey);
    return storedView === "project-detail" || storedView === "founder-review" || storedView === "founder-approval" ? storedView : "headquarters";
  });
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>(() => {
    if (typeof window === "undefined") return [];

    return restoreConversationHistory(window.sessionStorage.getItem(conversationStorageKey));
  });
  const [conversationError, setConversationError] = useState("");

  useEffect(() => {
    try {
      window.sessionStorage.setItem(conversationStorageKey, JSON.stringify(conversationHistory));
    } catch {
      // Session history is best-effort only and never persisted outside the browser session.
    }
  }, [conversationHistory]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(conversationViewStorageKey, conversationView);
    } catch {
      // View state is local to the current browser session.
    }
  }, [conversationView]);

  useEffect(() => {
    if (!projectRepository) return;

    const repository = projectRepository;
    let active = true;

    async function loadProjects() {
      let normalizedProjects: Project[] = [];
      try {
        setProjectLoadError("");
        const projects = await repository.listByWorkspace(executiveWorkspaceId);
        normalizedProjects = sortProjectsByUpdate(projects.map(normalizeProjectState));
        if (active) setSessionProjects(normalizedProjects);
      } catch {
        if (active) setProjectLoadError("Headquarters could not load saved projects.");
      } finally {
        if (active) setProjectsLoading(false);
      }

      if (!eventRepository) return;
      try {
        setTimelineLoadError("");
        const existingEvents = await eventService.listByWorkspace(eventRepository, executiveWorkspaceId);
        const synchronizedEvents = await eventService.synchronizeProjectHistory(
          eventRepository,
          normalizedProjects,
          existingEvents,
        );
        if (active) setTimelineEvents(synchronizedEvents);
      } catch {
        if (active) setTimelineLoadError("Headquarters could not load the Executive Intelligence timeline.");
      } finally {
        if (active) setTimelineLoading(false);
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [currentUserId, eventRepository, projectRepository]);

  useEffect(() => {
    if (!founderVisitRepository) return;

    const repository = founderVisitRepository;
    let active = true;

    async function recordVisit() {
      try {
        setVisitError("");
        const registration = await recordFounderVisit(repository, currentUserId, executiveWorkspaceId, new Date().toISOString());
        if (active) setLastVisitAt(registration.previousVisitAt);
      } catch {
        if (active) setVisitError("Headquarters could not load your previous visit.");
      } finally {
        if (active) setVisitLoading(false);
      }
    }

    void recordVisit();

    return () => {
      active = false;
    };
  }, [currentUserId, founderVisitRepository]);

  function createProjectTitle(entityName: string | undefined, projectType: string | undefined) {
    const subject = entityName?.trim() || "Untitled";
    const normalizedType = normalizeProjectType(projectType);
    if (normalizedType === ProjectType.SchoolSpotlight) return `${subject} School Spotlight`;
    return `${subject} ${formatProjectType(normalizedType)}`;
  }

  function requireProjectRepository() {
    if (!projectRepository) {
      throw new Error("Project repository is unavailable.");
    }

    return projectRepository;
  }

  async function listSessionProjects() {
    if (!projectRepository) return [];

    const projects = await projectRepository.listByWorkspace(executiveWorkspaceId);
    return sortProjectsByUpdate(projects.map(normalizeProjectState));
  }

  async function listTimelineEvents(projects: Project[]) {
    if (!eventRepository) return [];

    const existingEvents = await eventService.listByWorkspace(eventRepository, executiveWorkspaceId);
    return eventService.synchronizeProjectHistory(eventRepository, projects, existingEvents);
  }

  async function refreshSessionProjects() {
    const projects = await listSessionProjects();
    setSessionProjects(projects);
    try {
      setTimelineLoadError("");
      setTimelineEvents(await listTimelineEvents(projects));
    } catch {
      setTimelineLoadError("Headquarters could not refresh the Executive Intelligence timeline.");
    }
  }

  async function findContinuationProject(entityName: string | undefined) {
    const projects = await listSessionProjects();
    const contextualProjectId = conversationHistory.find((entry) => entry.project)?.project?.id || null;
    return projectCommandTargetService.resolve(projects, entityName, contextualProjectId);
  }

  function createClarificationEntry(request: string, question: string): ConversationEntry {
    return {
      id: `conversation_${Date.now()}`,
      request,
      status: "blocked",
      message: "Clarification Required",
      nextStep: question,
      createdAt: new Date().toISOString(),
    };
  }

  async function createProjectBriefingEntry(request: string, project: Project): Promise<ConversationEntry> {
    const updatedProject = await requireProjectRepository().update(
      project.id,
      projectWorkflowService.createUpdate(project, "continue"),
      { expectedUpdatedAt: project.updatedAt },
    );

    return {
      id: `conversation_${Date.now()}`,
      request,
      project: updatedProject,
      status: "success",
      message: "Project Briefing",
      nextStep: updatedProject.recommendedNextAction,
      createdAt: new Date().toISOString(),
    };
  }

  function getProjectDeliverables(project: Project) {
    return project.completedSoFar?.length ? project.completedSoFar : ["Project brief", "Research queue", "Founder review package"];
  }

  function updateLatestProject(updatedProject: Project, message: string, nextStep: string) {
    setConversationHistory((currentHistory) => {
      const [latestConversationEntry, ...remainingHistory] = currentHistory;
      const updatedEntry: ConversationEntry = {
        id: latestConversationEntry?.project?.id === updatedProject.id ? latestConversationEntry.id : `conversation_${Date.now()}`,
        request: latestConversationEntry?.project?.id === updatedProject.id ? latestConversationEntry.request : message,
        project: updatedProject,
        status: "success",
        message,
        nextStep,
        createdAt: new Date().toISOString(),
      };

      if (!latestConversationEntry || latestConversationEntry.project?.id !== updatedProject.id) {
        return [updatedEntry, ...currentHistory].slice(0, 6);
      }

      return [
        updatedEntry,
        ...remainingHistory,
      ].slice(0, 6);
    });
  }

  function createConversationTimeline(entry: ConversationEntry) {
    if (entry.message === "Project Briefing") {
      return [
        { speaker: "Founder", text: "Continue Project" },
        { speaker: "Headquarters", text: "Opening Project Brief..." },
      ];
    }

    if (entry.project) {
      return [
        { speaker: "Headquarters", text: "Project created." },
        { speaker: "Headquarters", text: `Recommendation: Begin ${entry.nextStep.toLowerCase()}.` },
      ];
    }

    if (entry.status === "blocked") {
      return [
        { speaker: "Founder", text: entry.request },
        { speaker: "Headquarters", text: entry.nextStep },
      ];
    }

    return [];
  }

  async function handleContinueProject(project: Project | undefined) {
    try {
      setConversationError("");
      let projectToContinue = project;
      if (!projectToContinue) {
        const resolution = await findContinuationProject(undefined);
        if (resolution.ok) projectToContinue = resolution.project;
        else {
          const question = projectCommandTargetService.clarification(resolution);
          setConversationHistory((currentHistory) => [createClarificationEntry("Continue Project", question), ...currentHistory].slice(0, 6));
          setConversationView("headquarters");
          return;
        }
      }

      const briefingEntry = await createProjectBriefingEntry("Continue Project", projectToContinue);
      await refreshSessionProjects();
      setConversationHistory((currentHistory) => [briefingEntry, ...currentHistory].slice(0, 6));
      setConversationView("headquarters");
    } catch {
      setConversationError("Headquarters could not continue the project in this session.");
    }
  }

  async function handleRevisionRequest(project: Project) {
    setConversationError("");
    try {
      if (!productionPackageRepository) throw new Error("Production Package repository is unavailable.");
      const updatedProject = await projectRevisionService.request(
        requireProjectRepository(),
        productionPackageRepository,
        project,
      );

      updateLatestProject(updatedProject, "Project Briefing", "Revise project brief");
      await refreshSessionProjects();
      setConversationView("headquarters");
    } catch (error) {
      showWorkflowFailure(error, project, "Headquarters could not request a revision.");
    }
  }

  function handleFounderApproval(project: Project) {
    updateLatestProject(project, "Founder Approval", "Confirm Founder approval");
    setConversationView("founder-approval");
  }

  function showWorkflowFailure(error: unknown, project: Project, fallback: string) {
    setConversationError(projectWorkflowNotification(error, project) || fallback);
    focusExecutiveConversation();
  }

  async function handleProjectReview(project: Project) {
    setConversationError("");
    try {
      if (!productionPackageRepository) throw new Error("Production Package repository is unavailable.");
      const productionPackage = await productionPackageRepository.getByProjectId(project.id);
      const productionReadiness = productionReadinessService.evaluate(project, productionPackage);
      const updatedProject = await requireProjectRepository().update(
        project.id,
        projectWorkflowService.createUpdate(project, "review", new Date().toISOString(), { productionReadiness }),
        { expectedUpdatedAt: project.updatedAt },
      );

      updateLatestProject(updatedProject, "Founder Review", "Review the package and choose approval, revision, or return.");
      await refreshSessionProjects();
      setConversationView("founder-review");
    } catch (error) {
      showWorkflowFailure(error, project, "Headquarters could not open Founder Review.");
    }
  }

  async function handleConfirmApproval(project: Project) {
    setConversationError("");
    try {
      const updatedProject = await requireProjectRepository().update(
        project.id,
        projectWorkflowService.createUpdate(project, "approve"),
        { expectedUpdatedAt: project.updatedAt },
      );

      updateLatestProject(updatedProject, "Founder Approval Complete", "Prepare next approved step");
      await refreshSessionProjects();
      setConversationView("headquarters");
    } catch (error) {
      showWorkflowFailure(error, project, "Headquarters could not complete Founder approval.");
    }
  }

  async function createWorkflowResponse(request: string, submissionId: string): Promise<ConversationEntry> {
    const intentResult = intentService.classify({
      workspaceId: executiveWorkspaceId,
      text: request,
    });

    if (!intentResult.ok) {
      return {
        id: `conversation_${Date.now()}`,
        request,
        status: "blocked",
        message: intentResult.error,
        nextStep: "Clarify request",
        createdAt: new Date().toISOString(),
      };
    }

    return executiveCommandService.execute(intentResult.data, {
      create: async (intent) => {
        const executionPlan = executionPlanningService.createPlan(intent);
        if (!executionPlan.ok) return createClarificationEntry(request, "Clarify the project request.");

        const orchestrationResult = projectOrchestratorService.orchestrate(executionPlan.data);
        const blocked =
          !orchestrationResult.ok ||
          orchestrationResult.data.status === OrchestrationStatus.Blocked ||
          executionPlan.data.status === ExecutionStatus.Blocked;
        if (blocked) {
          return createClarificationEntry(
            request,
            executionPlan.data.clarificationQuestion || "Clarify the project request.",
          );
        }

        const now = new Date().toISOString();
        const requestId = executiveCommandService.createRequestId(currentUserId, submissionId);
        const projectType = normalizeProjectType(executionPlan.data.projectType);
        const currentWorkspace = ProjectWorkspace.IntelligenceCenter;
        const project = await requireProjectRepository().create({
          id: executiveCommandService.projectIdForRequest(requestId),
          creationRequestId: requestId,
          workspaceId: executiveWorkspaceId,
          title: createProjectTitle(intent.relatedEntityName, projectType),
          type: projectType,
          projectType,
          currentWorkspace,
          workspace: formatProjectWorkspace(currentWorkspace),
          workspaceHistory: [
            createWorkspaceHistoryEntry(ProjectWorkspace.ExecutiveOffice, "Founder created project", now),
            createWorkspaceHistoryEntry(ProjectWorkspace.IntelligenceCenter, "Research queued", now),
          ],
          stateHistory: createInitialProjectStateHistory(now),
          state: ProjectStatus.Draft,
          status: ProjectStatus.Draft,
          progressPercent: 10,
          priority: executionPlan.data.priority || Priority.Medium,
          scope: Scope.Internal,
          ownerId: currentUserId,
          dependencies: [],
          currentBlocker: null,
          contributorIds: [],
          knowledgeEntityIds: [],
          assetIds: [],
          decisionIds: [],
          sourceIds: [],
          createdAt: now,
          updatedAt: now,
          completedSoFar: ["Intent classified", "Execution plan created", "Project orchestration queued"],
          currentStep: "Research",
          remainingNextStep: "Research",
          recommendedNextAction: "Begin research",
          lastActivity: "Project created",
        });

        return {
          id: `conversation_${Date.now()}`,
          request,
          project,
          status: "success",
          message: "Headquarters",
          nextStep: "Research",
          createdAt: new Date().toISOString(),
        };
      },
      continue: async (intent) => {
        const resolution = await findContinuationProject(intent.relatedEntityName);
        if (!resolution.ok) {
          return createClarificationEntry(request, projectCommandTargetService.clarification(resolution));
        }
        return projectWorkflowService.canApply(resolution.project, "continue")
          ? createProjectBriefingEntry(request, resolution.project)
          : createClarificationEntry(request, "Choose an active project that can be continued.");
      },
      review: async (intent) => {
        const resolution = await findContinuationProject(intent.relatedEntityName);
        if (!resolution.ok) {
          return createClarificationEntry(request, projectCommandTargetService.clarification(resolution));
        }
        const project = resolution.project;
        if (!productionPackageRepository) {
          return createClarificationEntry(request, "Which review-ready project should Headquarters open?");
        }
        const productionPackage = await productionPackageRepository.getByProjectId(project.id);
        const productionReadiness = productionReadinessService.evaluate(project, productionPackage);
        if (!projectWorkflowService.canApply(project, "review", { productionReadiness })) {
          return createClarificationEntry(request, "Choose a project with a completed active Production Package.");
        }
        const updatedProject = await requireProjectRepository().update(
          project.id,
          projectWorkflowService.createUpdate(project, "review", new Date().toISOString(), { productionReadiness }),
          { expectedUpdatedAt: project.updatedAt },
        );
        return {
          id: `conversation_${Date.now()}`,
          request,
          project: updatedProject,
          status: "success",
          message: "Founder Review",
          nextStep: updatedProject.recommendedNextAction,
          createdAt: new Date().toISOString(),
        };
      },
      approve: async (intent) => {
        const resolution = await findContinuationProject(intent.relatedEntityName);
        if (!resolution.ok) {
          return createClarificationEntry(request, projectCommandTargetService.clarification(resolution));
        }
        const project = resolution.project;
        if (!projectWorkflowService.canApply(project, "approve")) {
          return createClarificationEntry(request, "Which project in Founder Review should Headquarters approve?");
        }
        const updatedProject = await requireProjectRepository().update(
          project.id,
          projectWorkflowService.createUpdate(project, "approve"),
          { expectedUpdatedAt: project.updatedAt },
        );
        return {
          id: `conversation_${Date.now()}`,
          request,
          project: updatedProject,
          status: "success",
          message: "Founder Approval Complete",
          nextStep: updatedProject.recommendedNextAction,
          createdAt: new Date().toISOString(),
        };
      },
      search: async (intent) => {
        const resolution = await findContinuationProject(intent.relatedEntityName);
        return resolution.ok
          ? {
              id: `conversation_${Date.now()}`,
              request,
              project: resolution.project,
              status: "success",
              message: "Project Found",
              nextStep: resolution.project.recommendedNextAction,
              createdAt: new Date().toISOString(),
            }
          : createClarificationEntry(request, projectCommandTargetService.clarification(resolution));
      },
      navigate: async (intent) => {
        router.push(`/executive-workspace/${intent.targetRoom}`);
        return {
          id: `conversation_${Date.now()}`,
          request,
          status: "success",
          message: "Navigation",
          nextStep: `Open ${formatProjectWorkspace(intent.targetRoom as ProjectWorkspace)}`,
          createdAt: new Date().toISOString(),
        };
      },
      learn: async () => createClarificationEntry(request, "Knowledge lookup is not available in this release."),
      think: async () => createClarificationEntry(request, "Strategic brief creation is not available in this release."),
      unknown: async (intent) => createClarificationEntry(
        request,
        intent.clarificationQuestion || "What would you like Headquarters to do?",
      ),
    });
  }

  async function handleConversationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    const request = conversationInput.trim();
    if (!request) {
      setConversationError("Type a request for Headquarters first.");
      return;
    }

    const submissionId = submissionIdempotency.current.idFor(request);
    submissionInFlight.current = true;
    setConversationSubmitting(true);
    setConversationError("");
    try {
      const response = await createWorkflowResponse(request, submissionId);
      await refreshSessionProjects();
      setConversationHistory((currentHistory) => [response, ...currentHistory].slice(0, 6));
      setConversationView("headquarters");
      submissionIdempotency.current.complete(request);
      setConversationInput("");
    } catch {
      setConversationError("Headquarters could not process that request yet.");
    } finally {
      submissionInFlight.current = false;
      setConversationSubmitting(false);
    }
  }

  function focusExecutiveConversation() {
    window.requestAnimationFrame(() => {
      document.getElementById("executive-conversation")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleDailyBriefAction(action: DailyBriefAction) {
    setConversationError("");
    try {
      if (action.type === "continue") {
        await handleContinueProject(action.project);
        focusExecutiveConversation();
        return;
      }

      if (action.type === "review") {
        await handleProjectReview(action.project);
        focusExecutiveConversation();
        return;
      }

      if (action.type === "approve") {
        handleFounderApproval(action.project);
        focusExecutiveConversation();
        return;
      }

      const projectQuery = `projectId=${encodeURIComponent(action.project.id)}`;
      const viewQuery = action.type === "open-research-package" ? "&view=research-package" : "";
      router.push(`/executive-workspace/projects?${projectQuery}${viewQuery}`);
    } catch {
      setConversationError("Headquarters could not open the recommended action.");
      focusExecutiveConversation();
    }
  }

  const dailyBrief = useMemo(
    () => founderDailyBriefService.generate(sessionProjects, timelineEvents, lastVisitAt, briefGeneratedAt, currentUserId),
    [briefGeneratedAt, currentUserId, lastVisitAt, sessionProjects, timelineEvents],
  );
  const latestEntry = conversationHistory[0];
  const latestProject = latestEntry?.project;
  const conversationTimeline = latestEntry ? createConversationTimeline(latestEntry) : [];
  const suggestedPrompts = ["Spotlight Ashland University", "Continue current project", "Review pending projects"];

  return (
    <div className="min-h-full bg-[#050505] px-4 py-4 text-white sm:px-5 sm:py-4 xl:min-h-0">
      <div className="mx-auto grid min-h-full max-w-[1500px] gap-4 xl:min-h-0">
        <section className="flex items-center border-b border-white/10 pb-3">
          <div className="min-w-0">
            <p className="text-xl font-black uppercase tracking-normal text-white sm:text-2xl">
              Hoop<span className="text-red-500">Frens</span>
            </p>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Headquarters</p>
          </div>
        </section>

        <FounderDailyBrief
          brief={dailyBrief}
          loading={projectsLoading || timelineLoading || visitLoading}
          error={
            projectLoadError ||
            timelineLoadError ||
            visitError ||
            (!projectRepository || !eventRepository || !founderVisitRepository ? "Persistent Headquarters data is unavailable." : "")
          }
        />

        <ExecutiveRecommendation
          recommendation={dailyBrief.todaysRecommendation}
          action={dailyBrief.recommendedFirstAction}
          onAction={(action) => void handleDailyBriefAction(action)}
        />

        <CompanyHealth items={dailyBrief.companyHealth} />

        <NeedsAttention items={dailyBrief.needsAttention} totalCount={dailyBrief.needsAttentionCount} />

        <OpportunitiesRecommendations items={dailyBrief.opportunitiesAndRecommendations} />

        <section
          id="executive-conversation"
          className="flex min-h-[560px] max-h-[760px] flex-col scroll-mt-4 border border-white/10 bg-[#0f0f0f] shadow-2xl shadow-black/30 ring-1 ring-red-500/10"
        >
            <div className="shrink-0 border-b border-white/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Executive Conversation</p>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-400">
                Ready for your next direction.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-10 sm:px-5">
              {projectLoadError ? (
                <div className="mb-4 border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold leading-6 text-red-100">
                  {projectLoadError}
                </div>
              ) : null}

              {conversationView === "project-detail" && latestProject ? (
                <article className="border border-white/10 bg-black p-4 sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Project Detail</p>
                  <h3 className="mt-3 text-xl font-black uppercase leading-tight text-white sm:text-2xl">{latestProject.title}</h3>
                  <div className="mt-5 grid gap-3 text-sm">
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Type</p>
                      <p className="font-bold text-white">{formatProjectType(latestProject.projectType)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Status</p>
                      <p className="font-bold text-white">{formatProjectStatus(latestProject.status)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Progress</p>
                      <p className="font-bold text-white">{latestProject.progressPercent}%</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Priority</p>
                      <p className="font-bold text-white">{formatProjectPriority(latestProject.priority)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Owner</p>
                      <p className="font-bold text-white">{latestProject.ownerId}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Current Workspace</p>
                      <p className="font-bold text-white">{formatProjectWorkspace(latestProject.currentWorkspace)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Created</p>
                      <p className="font-bold text-white">{formatProjectDate(latestProject.createdAt)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Updated</p>
                      <p className="font-bold text-white">{formatProjectDate(latestProject.updatedAt)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Due Date</p>
                      <p className="font-bold text-white">{formatProjectDate(latestProject.dueDate)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Dependencies</p>
                      <p className="font-bold text-white">{latestProject.dependencies.length ? latestProject.dependencies.join(", ") : "None"}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Blocker</p>
                      <p className="font-bold text-white">{latestProject.currentBlocker || "None"}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Current Step</p>
                      <p className="font-bold text-white">{getCurrentStep(latestProject, latestEntry.nextStep)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Recommended</p>
                      <p className="font-bold text-white">{latestProject.recommendedNextAction}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Last Activity</p>
                      <p className="font-bold text-white">{latestProject.lastActivity}</p>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">Workspace History</p>
                    <div className="mt-3 grid gap-2">
                      {latestProject.workspaceHistory.map((entry, index) => (
                        <div key={`${entry.workspace}-${entry.enteredAt}-${index}`} className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 text-sm">
                          <p className="font-black text-white">{formatProjectWorkspace(entry.workspace)}</p>
                          <p className="font-bold leading-5 text-zinc-400">{entry.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-5 text-sm font-bold leading-6 text-zinc-400">
                    This brief reflects the project&apos;s latest saved state and activity.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConversationView("headquarters")}
                    className="mt-5 w-full border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                  >
                    Return to Headquarters
                  </button>
                </article>
              ) : conversationView === "founder-review" && latestProject ? (
                <article className="border border-white/10 bg-black p-4 sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Founder Review</p>
                  <h3 className="mt-3 text-xl font-black uppercase leading-tight text-white sm:text-2xl">Review Package</h3>
                  <dl className="mt-5 grid gap-3 text-sm">
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Project Name</dt>
                      <dd className="font-bold text-white">{latestProject.title}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Type</dt>
                      <dd className="font-bold text-white">{formatProjectType(latestProject.projectType)}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Status</dt>
                      <dd className="font-bold text-white">{formatProjectStatus(latestProject.status)}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Progress</dt>
                      <dd className="font-bold text-white">{latestProject.progressPercent}%</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Current Workspace</dt>
                      <dd className="font-bold text-white">{formatProjectWorkspace(latestProject.currentWorkspace)}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Deliverables</dt>
                      <dd className="font-bold text-white">{getProjectDeliverables(latestProject).join(", ")}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Current Step</dt>
                      <dd className="font-bold text-white">{getCurrentStep(latestProject, latestEntry.nextStep)}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Next Action</dt>
                      <dd className="font-bold text-white">{latestProject.recommendedNextAction}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 grid gap-2 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => handleFounderApproval(latestProject)}
                      className="bg-red-600 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-red-500"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRevisionRequest(latestProject)}
                      className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                    >
                      Request Revision
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversationView("headquarters")}
                      className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                    >
                      Return to Headquarters
                    </button>
                  </div>
                </article>
              ) : conversationView === "founder-approval" && latestProject ? (
                <article className="border border-white/10 bg-black p-4 sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Founder Approval</p>
                  <h3 className="mt-3 text-xl font-black uppercase leading-tight text-white sm:text-2xl">Approval Summary</h3>
                  <dl className="mt-5 grid gap-3 text-sm">
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Project Name</dt>
                      <dd className="font-bold text-white">{latestProject.title}</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Type</dt>
                      <dd className="font-bold text-white">{formatProjectType(latestProject.projectType)}</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Status</dt>
                      <dd className="font-bold text-white">{formatProjectStatus(latestProject.status)}</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Progress</dt>
                      <dd className="font-bold text-white">{latestProject.progressPercent}%</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Current Workspace</dt>
                      <dd className="font-bold text-white">{formatProjectWorkspace(latestProject.currentWorkspace)}</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Deliverables</dt>
                      <dd className="font-bold text-white">{getProjectDeliverables(latestProject).join(", ")}</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Impact</dt>
                      <dd className="font-bold text-white">Marks the package as founder approved for the current session.</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Next Step</dt>
                      <dd className="font-bold text-white">{latestProject.recommendedNextAction}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 grid gap-2 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => void handleConfirmApproval(latestProject)}
                      className="bg-red-600 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-red-500"
                    >
                      Confirm Approval
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversationView("headquarters")}
                      className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversationView("founder-review")}
                      className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                    >
                      Return to Review
                    </button>
                  </div>
                </article>
              ) : latestEntry ? (
                <article className="border border-white/10 bg-black p-4 sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
                    {latestEntry.project ? "Headquarters" : latestEntry.message}
                  </p>
                  {latestEntry.project ? (
                    <>
                      <h3 className="mt-3 text-xl font-black uppercase leading-tight text-white sm:text-2xl">
                        {latestEntry.message === "Project Briefing"
                          ? "Opening Project Brief..."
                          : `I've created the ${latestEntry.project.title} project.`}
                      </h3>
                      <p className="mt-4 text-sm font-bold leading-6 text-zinc-300">
                        My recommendation is to begin {latestEntry.nextStep.toLowerCase()}.
                      </p>
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">Reason</p>
                        <p className="mt-2 text-sm font-bold leading-6 text-white">Research has not yet been completed.</p>
                      </div>
                      <dl className="mt-5 grid gap-3 text-sm">
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Type</dt>
                          <dd className="font-bold text-white">{formatProjectType(latestEntry.project.projectType)}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Status</dt>
                          <dd className="font-bold text-white">{formatProjectStatus(latestEntry.project.status)}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Progress</dt>
                          <dd className="font-bold text-white">{latestEntry.project.progressPercent}%</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Priority</dt>
                          <dd className="font-bold text-white">{formatProjectPriority(latestEntry.project.priority)}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Owner</dt>
                          <dd className="font-bold text-white">{latestEntry.project.ownerId}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Workspace</dt>
                          <dd className="font-bold text-white">{formatProjectWorkspace(latestEntry.project.currentWorkspace)}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Due Date</dt>
                          <dd className="font-bold text-white">{formatProjectDate(latestEntry.project.dueDate)}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Depends On</dt>
                          <dd className="font-bold text-white">{latestEntry.project.dependencies.length ? latestEntry.project.dependencies.join(", ") : "None"}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Blocker</dt>
                          <dd className="font-bold text-white">{latestEntry.project.currentBlocker || "None"}</dd>
                        </div>
                        {latestEntry.message === "Project Briefing" ? (
                          <>
                            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                              <dt className="font-black uppercase tracking-wider text-zinc-600">Last Updated</dt>
                              <dd className="font-bold text-white">{new Date(latestEntry.project.updatedAt).toLocaleString()}</dd>
                            </div>
                            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                              <dt className="font-black uppercase tracking-wider text-zinc-600">Completed</dt>
                              <dd className="font-bold text-white">{latestEntry.project.completedSoFar?.join(", ") || "Project context restored"}</dd>
                            </div>
                            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                              <dt className="font-black uppercase tracking-wider text-zinc-600">Recommended</dt>
                              <dd className="font-bold text-white">{latestEntry.project.recommendedNextAction || latestEntry.nextStep}</dd>
                            </div>
                          </>
                        ) : null}
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">{latestEntry.message === "Project Briefing" ? "Remaining" : "Next Step"}</dt>
                          <dd className="font-bold text-white">
                            {latestEntry.message === "Project Briefing" ? getCurrentStep(latestEntry.project, latestEntry.nextStep) : latestEntry.nextStep}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Activity</dt>
                          <dd className="font-bold text-white">{latestEntry.project.lastActivity}</dd>
                        </div>
                      </dl>
                      {conversationTimeline.length ? (
                        <div className="mt-6 border-t border-white/10 pt-5">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">Activity</p>
                          <div className="mt-5 grid gap-5">
                            {conversationTimeline.map((item, index) => (
                              <div key={`${item.speaker}-${item.text}-${index}`} className="grid grid-cols-[minmax(140px,160px)_minmax(0,1fr)] gap-5">
                                <p className="pt-0.5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">{item.speaker}</p>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold leading-6 text-white">{item.text}</p>
                                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Current session</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <p className="text-sm font-black text-white">What would you like to do?</p>
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={() => void handleContinueProject(latestEntry.project)}
                            className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                          >
                            Continue Project
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (latestEntry.project) void handleProjectReview(latestEntry.project);
                            }}
                            className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                          >
                            Review Project
                          </button>
                          <button
                            type="button"
                            onClick={() => setConversationView("headquarters")}
                            className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                          >
                            Return to Headquarters
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm font-bold leading-6 text-zinc-300">{latestEntry.nextStep}</p>
                  )}
                </article>
              ) : (
                <div className="border border-white/10 bg-black/40 p-4 sm:p-5">
                  <div className="mt-5 grid gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">Suggested prompts</p>
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setConversationInput(prompt)}
                        className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleConversationSubmit} className="shrink-0 border-t border-white/10 bg-[#121212] px-4 py-5 shadow-[0_-18px_40px_rgba(0,0,0,0.28)] sm:px-5 sm:py-6">
              <div className="flex w-full items-center gap-4 border border-white/10 bg-[#181818] px-3 py-3.5 shadow-2xl shadow-black/30 transition focus-within:border-red-500/70">
                <span className="ml-2 shrink-0 text-zinc-500" aria-label="Voice commands coming later." title="Voice commands coming later.">
                  <Mic aria-hidden="true" size={18} />
                </span>
                <input
                  aria-label="Executive conversation input"
                  value={conversationInput}
                  disabled={conversationSubmitting}
                  onChange={(event) => {
                    submissionIdempotency.current.cancel();
                    setConversationInput(event.target.value);
                  }}
                  placeholder="Type a direction for the workspace..."
                  className="min-w-0 flex-1 bg-transparent py-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600"
                />
                <button
                  type="submit"
                  aria-label="Send direction"
                  disabled={conversationSubmitting}
                  className="flex size-11 shrink-0 items-center justify-center bg-red-600 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                >
                  {conversationSubmitting ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                </button>
              </div>
              {conversationError ? (
                <p className="mt-3 whitespace-pre-line text-center text-xs font-bold leading-5 text-red-400" role="status" aria-atomic="true">
                  {conversationError}
                </p>
              ) : null}
            </form>
        </section>

        <section className="border border-white/10 bg-[#0c0c0c]" aria-labelledby="executive-activity-title">
          <header className="border-b border-white/10 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">Activity Timeline</p>
            <h2 id="executive-activity-title" className="mt-2 text-lg font-black text-white">Headquarters activity, newest first</h2>
          </header>
          <div className="max-h-[680px] overflow-y-auto p-5">
            <ExecutiveTimeline
              events={timelineEvents}
              loading={timelineLoading}
              error={timelineLoadError}
              emptyMessage="No project activity has been recorded yet."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function WorkspacePlaceholder({ activeSpace }: { activeSpace: ExecutiveSpace }) {
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-5 p-6">
      <section className="border border-white/10 bg-black p-5">
        <div className="flex items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">{activeSpace.eyebrow}</p>
            <h2 className="mt-2 text-4xl font-black uppercase tracking-normal text-white">{activeSpace.title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{activeSpace.description}</p>
          </div>
          <div className="hidden border border-white/10 bg-zinc-950 p-4 text-right lg:block">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Release</p>
            <p className="mt-1 text-2xl font-black text-white">1.1</p>
          </div>
        </div>
      </section>

      <section className="grid min-h-0 grid-cols-3 gap-4">
        {activeSpace.panels.map((panel) => (
          <div key={panel} className="min-h-0 border border-white/10 bg-black p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">{panel}</h3>
              <Archive size={16} className="text-red-500" />
            </div>
            <div className="mt-6 h-px bg-white/10" />
            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Placeholder only. Production workflows, Firestore data, and AI output will be added in later approved slices.
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[80] bg-zinc-950">{children}</div>;
}
