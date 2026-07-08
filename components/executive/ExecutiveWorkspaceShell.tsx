"use client";

import { ExecutionStatus } from "@/domain/execution";
import { IntentType } from "@/domain/intent";
import { OrchestrationStatus } from "@/domain/orchestration";
import { createInMemoryProjectRepository, type Project, type ProjectRepositoryStore } from "@/domain/project";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { executionPlanningService, intentService, projectOrchestratorService } from "@/services";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Archive,
  Beaker,
  BookOpen,
  Building2,
  Clapperboard,
  DoorOpen,
  Loader2,
  LockKeyhole,
  Map,
  Mic,
  Send,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

export type ExecutiveSpaceId =
  | "executive-office"
  | "intelligence-center"
  | "production-studio"
  | "strategy-room"
  | "product-lab"
  | "library";

type WorkspaceStatus = "checking" | "authenticated" | "signed-out" | "unconfigured";

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

type ConversationEntry = {
  id: string;
  request: string;
  project?: Project;
  status: "success" | "blocked";
  message: string;
  nextStep: string;
  createdAt: string;
};

type ConversationView = "headquarters" | "project-detail" | "founder-review" | "founder-approval";

const conversationStorageKey = "hoopfrens.executiveOffice.conversationHistory";
const projectStorageKey = "hoopfrens.executiveOffice.placeholderProjects";
const conversationViewStorageKey = "hoopfrens.executiveOffice.conversationView";
const executiveWorkspaceId = "executive-workspace";

function normalizeSessionProject(project: Project): Project {
  return {
    ...project,
    workspaceId: project.workspaceId || executiveWorkspaceId,
    status: project.status || ProjectStatus.Draft,
    priority: project.priority || Priority.Medium,
    scope: project.scope || Scope.Internal,
    ownerId: project.ownerId || "founder",
    contributorIds: project.contributorIds || [],
    knowledgeEntityIds: project.knowledgeEntityIds || [],
    assetIds: project.assetIds || [],
    decisionIds: project.decisionIds || [],
    sourceIds: project.sourceIds || [],
  };
}

function createSessionProjectStore(storageKey: string): ProjectRepositoryStore {
  return {
    read() {
      if (typeof window === "undefined") return [];

      try {
        const storedProjects = window.sessionStorage.getItem(storageKey);
        return storedProjects ? (JSON.parse(storedProjects) as Project[]).map(normalizeSessionProject) : [];
      } catch {
        return [];
      }
    },
    write(projects) {
      if (typeof window === "undefined") return;

      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(projects.slice(0, 8)));
      } catch {
        // Session projects are best-effort only and never persisted outside the browser session.
      }
    },
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
    id: "intelligence-center",
    label: "Intelligence Center",
    href: "/executive-workspace/intelligence-center",
    eyebrow: "Research",
    title: "Intelligence Center",
    description: "Placeholder surface for basketball knowledge, source review, and signal gathering.",
    icon: Map,
    panels: ["Signals", "Sources", "Watchlist"],
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

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "signed-out");
    });
  }, []);

  const userLabel = useMemo(() => user?.email || "Approved admin", [user]);

  if (status === "checking") {
    return (
      <WorkspaceFrame>
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-3 border border-white/10 bg-black px-5 py-4 text-sm font-black uppercase text-zinc-300">
            <Loader2 className="animate-spin text-red-500" size={20} />
            Checking workspace access
          </div>
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
            <div className="mt-5 border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm font-bold leading-6 text-yellow-100">
              Auth TODO: reuse the existing admin role check when Firestore access is approved for this workspace.
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
        <aside className="flex shrink-0 flex-col border-b border-white/10 bg-black lg:min-h-0 lg:border-b-0 lg:border-r">
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
            <div className="flex items-center gap-2 border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-yellow-100">
              <ShieldAlert size={14} />
              Auth role TODO
            </div>
          </header>

          <main className={`min-h-0 flex-1 ${activeSpace.id === "executive-office" ? "overflow-hidden" : "overflow-auto"}`}>
            {activeSpace.id === "executive-office" ? <ExecutiveOfficeContent /> : <WorkspacePlaceholder activeSpace={activeSpace} />}
          </main>
        </section>
      </div>
    </WorkspaceFrame>
  );
}

function ExecutiveOfficeContent() {
  const [conversationInput, setConversationInput] = useState("");
  const projectRepository = useMemo(() => createInMemoryProjectRepository(createSessionProjectStore(projectStorageKey)), []);
  const [conversationView, setConversationView] = useState<ConversationView>(() => {
    if (typeof window === "undefined") return "headquarters";

    const storedView = window.sessionStorage.getItem(conversationViewStorageKey);
    return storedView === "project-detail" || storedView === "founder-review" || storedView === "founder-approval" ? storedView : "headquarters";
  });
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const storedHistory = window.sessionStorage.getItem(conversationStorageKey);
      return storedHistory ? (JSON.parse(storedHistory) as ConversationEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [conversationError, setConversationError] = useState("");

  const intelligenceItems = [
    "Release 0 foundation is committed locally and waiting on executive review.",
    "The workspace shell remains internal, protected, and placeholder-only.",
    "Business objects are separated into domain folders for future implementation.",
    "Admin role enforcement is marked until Firestore access is approved.",
    "AI, voice, and workflow automation are intentionally inactive.",
  ];

  const focusItems = [
    "Approve the headquarters visual direction.",
    "Confirm the internal workspace route structure.",
    "Select the next architecture slice.",
  ];

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

  function createProjectTitle(entityName: string | undefined, projectType: string | undefined) {
    const subject = entityName?.trim() || "Untitled";
    if (projectType === "spotlight") return `${subject} School Spotlight`;
    return subject;
  }

  function normalizeProjectMatch(value: string) {
    return value.toLowerCase().replace(/school spotlight/g, "").replace(/university/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function formatProjectStatus(status: ProjectStatus) {
    if (status === ProjectStatus.Draft) return "Draft";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  async function listSessionProjects() {
    const projects = await projectRepository.listByWorkspace(executiveWorkspaceId);
    return projects.sort((firstProject, secondProject) => Date.parse(secondProject.updatedAt) - Date.parse(firstProject.updatedAt));
  }

  async function findContinuationProject(entityName: string | undefined) {
    const projects = await listSessionProjects();
    if (projects.length === 0) return null;
    if (!entityName) return projects.length === 1 ? projects[0] : null;

    const searchValue = normalizeProjectMatch(entityName);
    return projects.find((project) => normalizeProjectMatch(project.title).includes(searchValue)) || null;
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
    const updatedProject = await projectRepository.update(project.id, {
      updatedAt: new Date().toISOString(),
    });

    return {
      id: `conversation_${Date.now()}`,
      request,
      project: updatedProject,
      status: "success",
      message: "Project Briefing",
      nextStep: "Begin the research pass for the school spotlight.",
      createdAt: new Date().toISOString(),
    };
  }

  function getProjectDeliverables(project: Project) {
    return project.completedSoFar?.length ? project.completedSoFar : ["Project brief", "Research queue", "Founder review package"];
  }

  function updateLatestProject(updatedProject: Project, message: string, nextStep: string) {
    setConversationHistory((currentHistory) => {
      const [latestConversationEntry, ...remainingHistory] = currentHistory;
      if (!latestConversationEntry) return currentHistory;

      return [
        {
          ...latestConversationEntry,
          project: updatedProject,
          message,
          nextStep,
          createdAt: new Date().toISOString(),
        },
        ...remainingHistory,
      ].slice(0, 6);
    });
  }

  async function handleRevisionRequest(project: Project) {
    const revisionNote = "Founder revision requested";
    const completedSoFar = project.completedSoFar?.includes(revisionNote)
      ? project.completedSoFar
      : [...(project.completedSoFar || []), revisionNote];
    const updatedProject = await projectRepository.update(project.id, {
      status: ProjectStatus.Draft,
      updatedAt: new Date().toISOString(),
      completedSoFar,
      remainingNextStep: "Revise project brief",
    });

    updateLatestProject(updatedProject, "Project Briefing", "Revise project brief");
    setConversationView("headquarters");
  }

  function handleFounderApproval(project: Project) {
    updateLatestProject(project, "Founder Approval", "Approval placeholder");
    setConversationView("founder-approval");
  }

  async function handleConfirmApproval(project: Project) {
    const approvalNote = "Founder approval complete";
    const completedSoFar = project.completedSoFar?.includes(approvalNote)
      ? project.completedSoFar
      : [...(project.completedSoFar || []), approvalNote];
    const updatedProject = await projectRepository.update(project.id, {
      status: ProjectStatus.Approved,
      updatedAt: new Date().toISOString(),
      completedSoFar,
      remainingNextStep: "Prepare next approved step",
    });

    updateLatestProject(updatedProject, "Founder Approval Complete", "Prepare next approved step");
    setConversationView("headquarters");
  }

  async function createWorkflowResponse(request: string): Promise<ConversationEntry> {
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

    if (intentResult.data.intentType === IntentType.Continue) {
      const project = await findContinuationProject(intentResult.data.relatedEntityName);

      if (project) return createProjectBriefingEntry(request, project);

      if ((await listSessionProjects()).length > 1) {
        return createClarificationEntry(request, "Which project should Headquarters continue?");
      }

      return createClarificationEntry(request, "Which project should Headquarters continue?");
    }

    const executionPlan = executionPlanningService.createPlan(intentResult.data);
    if (!executionPlan.ok) {
      return {
        id: `conversation_${Date.now()}`,
        request,
        status: "blocked",
        message: executionPlan.error,
        nextStep: "Clarify request",
        createdAt: new Date().toISOString(),
      };
    }

    const orchestrationResult = projectOrchestratorService.orchestrate(executionPlan.data);
    const blocked =
      !orchestrationResult.ok ||
      orchestrationResult.data.status === OrchestrationStatus.Blocked ||
      executionPlan.data.status === ExecutionStatus.Blocked;

    if (blocked) {
      return {
        id: `conversation_${Date.now()}`,
        request,
        status: "blocked",
        message: orchestrationResult.ok ? orchestrationResult.data.blockedReason || "Headquarters needs clarification." : orchestrationResult.error,
        nextStep: executionPlan.data.clarificationQuestion || "Clarify request",
        createdAt: new Date().toISOString(),
      };
    }

    const now = new Date().toISOString();
    const project = await projectRepository.create({
      id: `project_${Date.now()}`,
      workspaceId: executiveWorkspaceId,
      title: createProjectTitle(intentResult.data.relatedEntityName, executionPlan.data.projectType),
      projectType: executionPlan.data.projectType || executionPlan.data.planType,
      workspace: "Production Studio",
      status: ProjectStatus.Draft,
      priority: executionPlan.data.priority || Priority.Medium,
      scope: Scope.Internal,
      ownerId: "founder",
      contributorIds: [],
      knowledgeEntityIds: [],
      assetIds: [],
      decisionIds: [],
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
      completedSoFar: ["Intent classified", "Execution plan created", "Project orchestration queued"],
      remainingNextStep: "Research",
    });

    return {
      id: `conversation_${Date.now()}`,
      request,
      project,
      status: "success",
      message: "Project Created",
      nextStep: "Research",
      createdAt: new Date().toISOString(),
    };
  }

  async function handleConversationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = conversationInput.trim();
    if (!request) {
      setConversationError("Type a request for Headquarters first.");
      return;
    }

    setConversationError("");
    try {
      const response = await createWorkflowResponse(request);
      setConversationHistory((currentHistory) => [response, ...currentHistory].slice(0, 6));
      setConversationView("headquarters");
      setConversationInput("");
    } catch {
      setConversationError("Headquarters could not process that request yet.");
    }
  }

  const latestEntry = conversationHistory[0];
  const latestProject = latestEntry?.project;

  return (
    <div className="h-full overflow-auto bg-[#050505] px-4 py-4 text-white sm:px-6 sm:py-5 xl:overflow-hidden">
      <div className="mx-auto grid h-full max-w-7xl gap-4 xl:grid-rows-[86px_minmax(0,1fr)]">
        <section className="flex items-center justify-between gap-5 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <p className="text-2xl font-black uppercase tracking-normal text-white sm:text-3xl">
              Hoop<span className="text-red-500">Frens</span>
            </p>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Headquarters</p>
          </div>
          <div className="hidden max-w-sm border-l border-red-600/70 pl-5 text-right md:block">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Company Status</p>
            <p className="mt-2 text-sm font-black text-white">Everything is operating normally.</p>
          </div>
        </section>

        <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(150px,0.65fr)_minmax(0,1.35fr)]">
            <section className="border border-white/10 bg-[#101010] p-5 shadow-2xl shadow-black/35 sm:p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Good morning, Antwone.</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-normal text-white sm:text-5xl xl:text-6xl">
                Headquarters is steady.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-zinc-400">
                The office is clear, quiet, and ready for the next executive call.
              </p>
            </section>

            <section className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <article className="min-h-0 border border-white/10 bg-[#111111] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">What should leadership know?</p>
                    <h2 className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-red-500">Executive Intelligence</h2>
                  </div>
                  <span className="border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Placeholder</span>
                </div>
                <div className="mt-5 grid gap-2 xl:gap-2.5">
                  {intelligenceItems.map((item, index) => (
                    <div key={item} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 border-t border-white/10 pt-2.5 first:border-t-0 first:pt-0">
                      <p className="text-xs font-black text-zinc-600">{String(index + 1).padStart(2, "0")}</p>
                      <p className="text-sm font-bold leading-5 text-zinc-200">{item}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="min-h-0 border border-white/10 bg-[#151515] p-5 sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">What matters today?</p>
                <h2 className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-red-500">Today&apos;s Focus</h2>
                <div className="mt-6 grid gap-4">
                  {focusItems.map((item, index) => (
                    <div key={item} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                      <div className="flex size-8 items-center justify-center border border-white/15 text-xs font-black text-white">{index + 1}</div>
                      <p className="text-base font-black leading-6 text-white">{item}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </div>

          <section className="flex min-h-0 flex-col border border-white/10 bg-[#0f0f0f] shadow-2xl shadow-black/30">
            <div className="border-b border-white/10 p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">What should Hoop Frens do next?</p>
              <h2 className="mt-4 text-3xl font-black uppercase leading-tight tracking-normal text-white sm:text-4xl xl:text-5xl">
                What would you like Hoop Frens to accomplish today?
              </h2>
            </div>

            <div className="min-h-0 flex-1 px-5 pt-5 sm:px-6">
              {conversationView === "project-detail" && latestProject ? (
                <article className="border border-white/10 bg-black p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Project Detail</p>
                  <h3 className="mt-3 text-2xl font-black uppercase leading-tight text-white">{latestProject.title}</h3>
                  <div className="mt-5 grid gap-3 text-sm">
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Status</p>
                      <p className="font-bold text-white">{formatProjectStatus(latestProject.status)}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Workspace</p>
                      <p className="font-bold text-white">{latestProject.workspace || "Production Studio"}</p>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <p className="font-black uppercase tracking-wider text-zinc-600">Next Step</p>
                      <p className="font-bold text-white">{latestProject.remainingNextStep || latestEntry.nextStep}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm font-bold leading-6 text-zinc-400">
                    Placeholder project detail. Research, assets, decisions, and production work remain inactive until later approved slices.
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
                <article className="border border-white/10 bg-black p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Founder Review</p>
                  <h3 className="mt-3 text-2xl font-black uppercase leading-tight text-white">Review Package</h3>
                  <dl className="mt-5 grid gap-3 text-sm">
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Project Name</dt>
                      <dd className="font-bold text-white">{latestProject.title}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Status</dt>
                      <dd className="font-bold text-white">{formatProjectStatus(latestProject.status)}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Workspace</dt>
                      <dd className="font-bold text-white">{latestProject.workspace || "Production Studio"}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Deliverables</dt>
                      <dd className="font-bold text-white">{getProjectDeliverables(latestProject).join(", ")}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Current Step</dt>
                      <dd className="font-bold text-white">{latestProject.remainingNextStep || latestEntry.nextStep}</dd>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Next Action</dt>
                      <dd className="font-bold text-white">Review the package and choose approval, revision, or return.</dd>
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
                <article className="border border-white/10 bg-black p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Founder Approval</p>
                  <h3 className="mt-3 text-2xl font-black uppercase leading-tight text-white">Approval Summary</h3>
                  <dl className="mt-5 grid gap-3 text-sm">
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Project Name</dt>
                      <dd className="font-bold text-white">{latestProject.title}</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Status</dt>
                      <dd className="font-bold text-white">{formatProjectStatus(latestProject.status)}</dd>
                    </div>
                    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                      <dt className="font-black uppercase tracking-wider text-zinc-600">Workspace</dt>
                      <dd className="font-bold text-white">{latestProject.workspace || "Production Studio"}</dd>
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
                      <dd className="font-bold text-white">Return to Headquarters with approved project status.</dd>
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
                <article className="border border-white/10 bg-black p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">{latestEntry.message}</p>
                  {latestEntry.project ? (
                    <>
                      <h3 className="mt-3 text-2xl font-black uppercase leading-tight text-white">{latestEntry.project.title}</h3>
                      <dl className="mt-5 grid gap-3 text-sm">
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Status</dt>
                          <dd className="font-bold text-white">{formatProjectStatus(latestEntry.project.status)}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">Workspace</dt>
                          <dd className="font-bold text-white">{latestEntry.project.workspace || "Production Studio"}</dd>
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
                          </>
                        ) : null}
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-t border-white/10 pt-3">
                          <dt className="font-black uppercase tracking-wider text-zinc-600">{latestEntry.message === "Project Briefing" ? "Remaining" : "Next Step"}</dt>
                          <dd className="font-bold text-white">
                            {latestEntry.message === "Project Briefing" ? latestEntry.project.remainingNextStep || latestEntry.nextStep : latestEntry.nextStep}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <p className="text-sm font-black text-white">What would you like to do?</p>
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={() => setConversationView("project-detail")}
                            className="border border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-500 hover:text-white"
                          >
                            Continue Project
                          </button>
                          <button
                            type="button"
                            onClick={() => setConversationView("founder-review")}
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
                <div className="border border-white/10 bg-black/40 p-5">
                  <p className="text-sm font-bold leading-6 text-zinc-500">
                    Type “Spotlight Ashland University” to run the first Headquarters workflow with placeholder data.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleConversationSubmit} className="flex flex-col justify-end gap-5 p-5 sm:p-6">
              <button
                type="button"
                aria-label="Microphone placeholder"
                className="mx-auto flex size-24 items-center justify-center rounded-full border border-white/15 bg-black text-white shadow-2xl shadow-black/60 transition hover:border-red-500 hover:text-red-500"
              >
                <Mic size={34} />
              </button>
              <div className="flex items-center gap-3 border border-white/10 bg-[#181818] p-2">
                <input
                  aria-label="Executive conversation placeholder"
                  value={conversationInput}
                  onChange={(event) => setConversationInput(event.target.value)}
                  placeholder="Type a direction for the workspace..."
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600"
                />
                <button
                  type="submit"
                  aria-label="Send placeholder"
                  className="flex size-11 shrink-0 items-center justify-center bg-red-600 text-white transition hover:bg-red-500"
                >
                  <Send size={17} />
                </button>
              </div>
              {conversationError ? <p className="text-center text-xs font-bold leading-5 text-red-400">{conversationError}</p> : null}
              <p className="text-center text-xs font-bold leading-5 text-zinc-600">Microphone remains a visual placeholder. Text runs in this browser session only.</p>
            </form>
          </section>
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
