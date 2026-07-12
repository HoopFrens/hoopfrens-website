"use client";

import { formatProjectDate, formatProjectState, formatProjectWorkspace } from "@/components/executive/projectWorkspaceUtils";
import type { FounderDailyBrief as FounderDailyBriefModel } from "@/domain/briefing";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Loader2,
  Target,
  UserRoundCheck,
} from "lucide-react";

type FounderDailyBriefProps = {
  brief: FounderDailyBriefModel;
  loading: boolean;
  error: string;
};

const emptyStateMessage = "Headquarters is ready. Create your first project to begin building today’s brief.";

export function FounderDailyBrief({ brief, loading, error }: FounderDailyBriefProps) {
  if (loading) {
    return (
      <section className="flex min-h-48 items-center justify-center border border-white/10 bg-[#0c0c0c]" aria-label="Loading Founder Daily Brief">
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
          <Loader2 size={16} className="animate-spin text-red-500" />
          Preparing today&apos;s brief
        </div>
      </section>
    );
  }

  const latestChange = brief.sinceLastVisit[0];
  const latestCompleted = brief.recentlyCompletedWork[0];
  const firstAction = brief.recommendedFirstAction;
  const summaryItems = [
    {
      label: "Since Your Last Visit",
      value: `${brief.sinceLastVisit.length} meaningful change${brief.sinceLastVisit.length === 1 ? "" : "s"}`,
      detail: latestChange?.summary || "No meaningful project changes since your last visit.",
      icon: Clock3,
    },
    {
      label: "Today’s Priority",
      value: brief.topPriority?.project.title || "No active priority",
      detail: brief.topPriority
        ? `${formatProjectState(brief.topPriority.project.state)} · ${formatProjectWorkspace(brief.topPriority.project.currentWorkspace)}`
        : "Create an active project to establish today’s priority.",
      icon: Target,
    },
    {
      label: "Waiting on Founder",
      value: `${brief.projectsWaitingOnFounder.length} project${brief.projectsWaitingOnFounder.length === 1 ? "" : "s"}`,
      detail: brief.projectsWaitingOnFounder.length
        ? "Review, approval, clarification, or a Founder decision is required."
        : "No project is waiting on Founder action.",
      icon: UserRoundCheck,
    },
    {
      label: "Ready to Advance",
      value: `${brief.projectsReadyToAdvance.length} project${brief.projectsReadyToAdvance.length === 1 ? "" : "s"}`,
      detail: brief.projectsReadyToAdvance.length
        ? "Prerequisites are complete and no blocker is recorded."
        : "No active project is ready for its next stage.",
      icon: ArrowUpRight,
    },
    {
      label: "Recently Completed",
      value: `${brief.recentlyCompletedWork.length} completion${brief.recentlyCompletedWork.length === 1 ? "" : "s"}`,
      detail: latestCompleted?.summary || "No project work was completed in the last seven days.",
      icon: CheckCircle2,
    },
    {
      label: "Recommended First Action",
      value: firstAction ? `${firstAction.label}: ${firstAction.project.title}` : "No action queued",
      detail: firstAction?.explanation || "Create an active project to generate a recommendation.",
      icon: BriefcaseBusiness,
    },
  ];

  return (
    <section className="border border-white/10 bg-[#0c0c0c] shadow-2xl shadow-black/30" aria-labelledby="founder-daily-brief-title">
      <header className="grid gap-5 border-b border-white/10 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-end lg:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Executive Brief</p>
          <h1 id="founder-daily-brief-title" className="mt-2 text-2xl font-black tracking-normal text-white sm:text-[2rem]">
            {brief.greeting}
          </h1>
          <p className="mt-2 text-sm font-bold text-zinc-400">
            {brief.lastVisitAt ? `Since ${formatProjectDate(brief.lastVisitAt)}` : "First recorded Headquarters visit"}
          </p>
        </div>
        <div className="border-l-2 border-red-500 pl-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Founder Workload</p>
            <span className="bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-black">
              {brief.estimatedWorkload.label}
            </span>
          </div>
          <p className="mt-2 text-sm font-black text-white">
            {brief.estimatedWorkload.actionCount} Founder action{brief.estimatedWorkload.actionCount === 1 ? "" : "s"} remaining
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
            {brief.estimatedWorkload.topFocusAreas.length
              ? `Top focus: ${brief.estimatedWorkload.topFocusAreas.map((focusArea) => focusArea.title).join(" · ")}`
              : "No Founder focus area is currently open."}
          </p>
        </div>
      </header>

      {error ? <p className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-xs font-bold text-red-100">{error}</p> : null}

      {brief.empty ? (
        <div className="flex min-h-44 items-center justify-center px-6 text-center">
          <p className="max-w-2xl text-lg font-black leading-8 text-white">{emptyStateMessage}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3">
          {summaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="min-w-0 border-t border-white/10 p-5 sm:border-l sm:first:border-l-0 xl:[&:nth-child(4)]:border-l-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                  <Icon size={15} className="shrink-0 text-red-500" />
                </div>
                <p className="mt-3 text-sm font-black leading-5 text-white">{item.value}</p>
                <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">{item.detail}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
