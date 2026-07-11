"use client";

import { ExecutiveTimeline } from "@/components/executive/ExecutiveTimeline";
import { ProductionPackagePanel } from "@/components/executive/ProductionPackagePanel";
import type { Project } from "@/domain/project";
import type { ExecutiveEvent } from "@/domain/event";
import type { PriorityAssessment } from "@/domain/prioritization";
import {
  ProductionReadinessStatus,
  type ProductionPackage,
  type ProductionReadinessResult,
  type ResearchPackage,
} from "@/domain/services";
import { ProjectStatus } from "@/domain/shared";
import type { ProjectWorkflowAction } from "@/services";
import { Archive, BadgeCheck, BookOpenCheck, Clapperboard, ClipboardCheck, Clock3, FileStack, FlaskConical, MapPin, Play, X } from "lucide-react";
import { ResearchPackagePanel } from "@/components/executive/ResearchPackagePanel";
import {
  formatProjectDate,
  formatProjectPriority,
  formatProjectState,
  formatProjectType,
  formatProjectWorkspace,
  getProjectState,
} from "@/components/executive/projectWorkspaceUtils";

type ProjectDetailPanelProps = {
  project: Project;
  priorityAssessment: PriorityAssessment | null;
  founderPriorityRank?: number;
  ownerLabel: string;
  actionPending: ProjectWorkflowAction | null;
  actionMessage: string;
  researchPackage: ResearchPackage | null;
  researchPackageOpen: boolean;
  researchPackageLoading: boolean;
  researchPackageMessage: string;
  productionPackage: ProductionPackage | null;
  productionPackageOpen: boolean;
  productionPackageLoading: boolean;
  productionPackageMessage: string;
  productionReadiness: ProductionReadinessResult | null;
  servicePending: boolean;
  timelineEvents: ExecutiveEvent[];
  timelineLoading: boolean;
  timelineError: string;
  onAction(action: ProjectWorkflowAction): void;
  onRunResearch(): void;
  onRunOutline(): void;
  onRunProduction(): void;
  onOpenResearchPackage(): void;
  onOpenProductionPackage(): void;
  onCloseResearchPackage(): void;
  onCloseProductionPackage(): void;
  onBeginReview(): void;
  onClose(): void;
};

const actionConfiguration = [
  { action: "continue", label: "Continue", icon: Play },
  { action: "review", label: "Review", icon: ClipboardCheck },
  { action: "approve", label: "Approve", icon: BadgeCheck },
  { action: "archive", label: "Archive", icon: Archive },
] as const;

export function ProjectDetailPanel({
  project,
  priorityAssessment,
  founderPriorityRank,
  ownerLabel,
  actionPending,
  actionMessage,
  researchPackage,
  researchPackageOpen,
  researchPackageLoading,
  researchPackageMessage,
  productionPackage,
  productionPackageOpen,
  productionPackageLoading,
  productionPackageMessage,
  productionReadiness,
  servicePending,
  timelineEvents,
  timelineLoading,
  timelineError,
  onAction,
  onRunResearch,
  onRunOutline,
  onRunProduction,
  onOpenResearchPackage,
  onOpenProductionPackage,
  onCloseResearchPackage,
  onCloseProductionPackage,
  onBeginReview,
  onClose,
}: ProjectDetailPanelProps) {
  const state = getProjectState(project);
  const terminal = state === ProjectStatus.Published || state === ProjectStatus.Archived;
  const stateHistory = project.stateHistory || [];

  function actionDisabled(action: ProjectWorkflowAction) {
    if (actionPending) return true;
    if (action === "continue") return terminal;
    if (action === "review") {
      if (state === ProjectStatus.Production) {
        return productionReadiness?.status !== ProductionReadinessStatus.ReadyForReview;
      }
      return terminal || state === ProjectStatus.Review || state === ProjectStatus.Approved;
    }
    if (action === "approve") return state !== ProjectStatus.Review;
    if (action === "archive") return state === ProjectStatus.Archived;
    return false;
  }

  return (
    <aside className="min-h-0 border border-white/10 bg-[#0d0d0d] xl:sticky xl:top-0 xl:max-h-[calc(100vh-112px)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Project Brief</p>
          <h2 className="mt-2 text-lg font-black leading-6 text-white">{project.title}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-red-200">
              {formatProjectState(state)}
            </span>
            <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
              {formatProjectPriority(project.priority)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center border border-white/10 text-zinc-400 transition hover:border-red-500 hover:text-white"
          title="Close project brief"
          aria-label="Close project brief"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-4">
          {actionConfiguration.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              disabled={actionDisabled(action)}
              className="flex h-10 items-center justify-center gap-2 border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              title={`${label} project`}
            >
              <Icon size={14} />
              {actionPending === action ? "Working" : label}
            </button>
          ))}
          {actionMessage ? <p className="col-span-2 text-xs font-bold leading-5 text-red-200" aria-live="polite">{actionMessage}</p> : null}
        </div>

        {priorityAssessment ? (
          <section className="border-b border-white/10 bg-red-500/[0.04] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">Priority Assessment</h3>
                <p className="mt-2 text-sm font-black text-white">
                  {founderPriorityRank ? `Founder Priority #${founderPriorityRank}` : "Active Project"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-white">{priorityAssessment.priorityScore}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Priority Score</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {priorityAssessment.atRisk ? <span className="border border-red-500/30 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-300">At Risk {priorityAssessment.riskScore}</span> : null}
              {priorityAssessment.waitingOnFounder ? <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-300">Waiting On Founder</span> : null}
              {priorityAssessment.readyToAdvance ? <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-300">Ready To Advance</span> : null}
            </div>
            <p className="mt-4 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Recommendation</p>
            <p className="mt-2 text-sm font-black leading-6 text-white">{priorityAssessment.recommendation}</p>
            <p className="mt-4 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Reason</p>
            <ul className="mt-2 grid gap-2">
              {priorityAssessment.reasons.map((reason) => (
                <li key={reason} className="grid grid-cols-[14px_minmax(0,1fr)] gap-2 text-xs font-bold leading-5 text-zinc-300">
                  <span className="text-red-500">+</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-b border-white/10 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Executive Services</h3>
          <div className="mt-3 grid gap-2">
            {state === ProjectStatus.Draft || state === ProjectStatus.Research ? (
              <button
                type="button"
                onClick={onRunResearch}
                disabled={servicePending}
                className="flex h-10 min-w-0 items-center justify-center gap-2 bg-red-600 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FlaskConical size={14} />
                {servicePending ? "Running Research" : "Run Research Service"}
              </button>
            ) : null}
            {state === ProjectStatus.Outline ? (
              <button
                type="button"
                onClick={onRunOutline}
                disabled={servicePending}
                className="flex h-10 min-w-0 items-center justify-center gap-2 bg-red-600 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileStack size={14} />
                {servicePending ? "Building Outline" : "Run Outline Service"}
              </button>
            ) : null}
            {state === ProjectStatus.Production ? (
              <button
                type="button"
                onClick={onRunProduction}
                disabled={servicePending}
                className="flex h-10 min-w-0 items-center justify-center gap-2 bg-red-600 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Clapperboard size={14} />
                {servicePending ? "Building Package" : "Run Production Service"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenResearchPackage}
              disabled={researchPackageLoading}
              className="flex h-10 min-w-0 items-center justify-center gap-2 border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BookOpenCheck size={14} />
              {researchPackageLoading ? "Opening Package" : "Open Research Package"}
            </button>
            <button
              type="button"
              onClick={onOpenProductionPackage}
              disabled={productionPackageLoading}
              className="flex h-10 min-w-0 items-center justify-center gap-2 border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Clapperboard size={14} />
              {productionPackageLoading ? "Opening Package" : "Open Production Package"}
            </button>
          </div>
          {researchPackageMessage && !researchPackageOpen ? (
            <p className="mt-3 text-xs font-bold leading-5 text-red-200" aria-live="polite">{researchPackageMessage}</p>
          ) : null}
          {productionPackageMessage && !productionPackageOpen ? (
            <p className="mt-3 text-xs font-bold leading-5 text-red-200" aria-live="polite">{productionPackageMessage}</p>
          ) : null}
        </section>

        {researchPackageOpen ? (
          <ResearchPackagePanel
            researchPackage={researchPackage}
            loading={researchPackageLoading}
            message={researchPackageMessage}
            onClose={onCloseResearchPackage}
          />
        ) : null}

        {productionPackageOpen ? (
          <ProductionPackagePanel
            productionPackage={productionPackage}
            readiness={productionReadiness}
            loading={productionPackageLoading}
            message={productionPackageMessage}
            onBeginReview={onBeginReview}
            onClose={onCloseProductionPackage}
          />
        ) : null}

        <section className="border-b border-white/10 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Full Project Brief</h3>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["Type", formatProjectType(project.type)],
              ["Workspace", formatProjectWorkspace(project.currentWorkspace)],
              ["State", formatProjectState(state)],
              ["Priority", formatProjectPriority(project.priority)],
              ["Progress", `${project.progressPercent}%`],
              ["Owner", ownerLabel],
              ["Created", formatProjectDate(project.createdAt)],
              ["Updated", formatProjectDate(project.updatedAt)],
              ["Due Date", formatProjectDate(project.dueDate, false)],
              ["Current Step", project.currentStep],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
                <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">{label}</dt>
                <dd className="break-words font-bold text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-b border-white/10 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Execution</h3>
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Recommended Next Action</p>
              <p className="mt-2 text-sm font-black leading-6 text-white">{project.recommendedNextAction}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Current Blocker</p>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-300">{project.currentBlocker || "None"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Dependencies</p>
              <p className="mt-2 break-words text-sm font-bold leading-6 text-zinc-300">
                {project.dependencies.length ? project.dependencies.join(", ") : "None"}
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-red-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Workspace History</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {project.workspaceHistory.map((entry, index) => (
              <div key={`${entry.workspace}-${entry.enteredAt}-${index}`} className="border-l border-red-500/40 pl-3">
                <p className="text-xs font-black text-white">{formatProjectWorkspace(entry.workspace)}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-zinc-400">{entry.reason}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">{formatProjectDate(entry.enteredAt)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-white/10 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">State History</h3>
          <div className="mt-4 grid gap-3">
            {stateHistory.map((entry, index) => (
              <div key={`${entry.state}-${entry.enteredAt}-${index}`} className="grid grid-cols-[82px_minmax(0,1fr)] gap-3">
                <p className="text-xs font-black text-red-400">{formatProjectState(entry.state)}</p>
                <div>
                  <p className="text-xs font-bold leading-5 text-zinc-300">{entry.reason}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">{formatProjectDate(entry.enteredAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-4">
          <div className="flex items-center gap-2">
            <Clock3 size={14} className="text-red-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Executive Intelligence Timeline</h3>
          </div>
          <div className="mt-4">
            <ExecutiveTimeline
              events={timelineEvents}
              loading={timelineLoading}
              error={timelineError}
              emptyMessage="No recorded project events yet."
            />
          </div>
        </section>
      </div>
    </aside>
  );
}
