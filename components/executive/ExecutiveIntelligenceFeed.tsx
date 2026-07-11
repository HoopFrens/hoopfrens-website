"use client";

import type { Project } from "@/domain/project";
import { executivePrioritizationService } from "@/services";
import { AlertTriangle, ArrowRight, Check, Clock3, Radio, Target, UserRoundCheck } from "lucide-react";
import type { ConversationEntry } from "@/components/executive/ExecutiveWorkspaceShell";

type ExecutiveIntelligenceFeedProps = {
  conversations: ConversationEntry[];
  projects: Project[];
};

function formatTime(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : "Current session";
}

export function ExecutiveIntelligenceFeed({ conversations, projects }: ExecutiveIntelligenceFeedProps) {
  const prioritization = executivePrioritizationService.prioritize(projects);
  const assessmentByProjectId = new Map(prioritization.assessments.map((assessment) => [assessment.project.id, assessment]));
  const sortedProjects = [...projects].sort((firstProject, secondProject) => Date.parse(secondProject.updatedAt) - Date.parse(firstProject.updatedAt));
  const latestConversation = conversations[0];
  const topPriority = prioritization.topFounderPriorities[0];
  const timelineItems = sortedProjects.length
    ? sortedProjects.slice(0, 4).map((project) => ({
        label: project.lastActivity || "Project updated",
        summary: `${project.title} · ${assessmentByProjectId.get(project.id)?.recommendation || project.recommendedNextAction}`,
        timestamp: project.updatedAt,
      }))
    : [
        {
          label: "Session opened",
          summary: "No new changes yet.",
          timestamp: undefined,
        },
      ];
  const recommendedNextAction = topPriority?.recommendation || latestConversation?.nextStep || "Start a school spotlight.";

  return (
    <section className="grid min-h-0 gap-3 xl:max-h-[calc(100vh-132px)] xl:overflow-y-auto xl:pr-1">
      <article className="border border-white/10 bg-[#101010] p-3.5 shadow-2xl shadow-black/35 sm:p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Executive Brief</p>
        <h1 className="mt-2 text-lg font-black uppercase leading-none tracking-normal text-white sm:text-xl">Good morning, Antwone.</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-zinc-400">
          {prioritization.assessments.length
            ? `${prioritization.assessments.length} active project${prioritization.assessments.length === 1 ? " is" : "s are"} prioritized.`
            : "No active projects require prioritization."}
        </p>
      </article>

      <article className="border border-white/10 bg-[#111111] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Founder Priorities</p>
          <Target size={15} className="text-red-500" />
        </div>
        <div className="mt-4 grid gap-3">
          {prioritization.topFounderPriorities.length ? (
            prioritization.topFounderPriorities.map((assessment) => (
              <div key={assessment.project.id} className="grid grid-cols-[30px_minmax(0,1fr)_36px] gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                <p className="text-lg font-black text-red-500">#{assessment.rank}</p>
                <div>
                  <p className="text-xs font-black leading-5 text-white">{assessment.project.title}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-zinc-300">{assessment.recommendation}</p>
                  <p className="mt-1 text-[10px] font-bold leading-4 text-zinc-500">
                    <span className="text-zinc-400">Reason: </span>
                    {assessment.reasons.slice(0, 3).join(" ")}
                  </p>
                </div>
                <p className="text-right text-sm font-black text-white">{assessment.priorityScore}</p>
              </div>
            ))
          ) : (
            <p className="text-sm font-bold text-zinc-400">Create your first project.</p>
          )}
        </div>
      </article>

      <article className="border border-white/10 bg-[#111111] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Since Your Last Visit</p>
          <Clock3 size={15} className="text-red-500" />
        </div>
        <div className="mt-4 grid gap-3">
          {timelineItems.map((item, index) => (
            <div key={`${item.label}-${item.timestamp || index}`} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
              <div className="mt-1 flex size-5 items-center justify-center border border-red-500/40 text-[9px] font-black text-red-500">{index + 1}</div>
              <div className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white">{item.label}</p>
                <p className="mt-1 text-sm font-bold leading-5 text-zinc-300">{item.summary}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{formatTime(item.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="border border-white/10 bg-[#111111] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Projects At Risk</p>
          <AlertTriangle size={15} className="text-red-500" />
        </div>
        <div className="mt-4 grid gap-3">
          {prioritization.projectsAtRisk.length ? (
            prioritization.projectsAtRisk.map((assessment) => (
              <div key={assessment.project.id} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-black leading-5 text-white">{assessment.project.title}</p>
                  <span className="border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-200">
                    Risk {assessment.riskScore}
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold leading-5 text-zinc-400">{assessment.riskReasons.join(" ")}</p>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center border border-red-500/30 bg-red-500/10 text-red-500">
                <Check size={14} />
              </span>
              <p className="text-sm font-black text-white">No critical issues.</p>
            </div>
          )}
        </div>
      </article>

      <article className="border border-white/10 bg-[#111111] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Waiting On Founder</p>
          <UserRoundCheck size={15} className="text-red-500" />
        </div>
        <div className="mt-4 grid gap-3">
          {prioritization.projectsWaitingOnFounder.length ? (
            prioritization.projectsWaitingOnFounder.map((assessment) => (
              <div key={assessment.project.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-black text-red-500">#{assessment.rank}</p>
                <div>
                  <p className="text-xs font-black text-white">{assessment.project.title}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-zinc-400">{assessment.recommendation}</p>
                  <p className="mt-1 text-[10px] font-bold leading-4 text-zinc-600">Reason: {assessment.reasons.slice(0, 3).join(" ")}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm font-bold text-zinc-400">No projects are waiting on Founder action.</p>
          )}
        </div>
      </article>

      <article className="border border-white/10 bg-[#111111] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Ready To Advance</p>
          <Radio size={15} className="text-red-500" />
        </div>
        <div className="mt-4 grid gap-3">
          {prioritization.projectsReadyToAdvance.length ? (
            prioritization.projectsReadyToAdvance.map((assessment) => (
              <div key={assessment.project.id} className="grid grid-cols-[28px_minmax(0,1fr)_36px] gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-black text-red-500">#{assessment.rank}</p>
                <div>
                  <p className="text-xs font-black text-white">{assessment.project.title}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-zinc-300">{assessment.recommendation}</p>
                  <p className="mt-1 text-[10px] font-bold leading-4 text-zinc-600">Reason: {assessment.reasons.slice(0, 3).join(" ")}</p>
                </div>
                <p className="text-right text-sm font-black text-white">{assessment.priorityScore}</p>
              </div>
            ))
          ) : (
            <p className="text-sm font-bold text-zinc-400">No projects are ready to advance.</p>
          )}
        </div>
      </article>

      <article className="border border-red-500/40 bg-red-500/10 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-300">Recommended Next Action</p>
          <Target size={15} className="text-red-300" />
        </div>
        <p className="mt-3 text-sm font-black leading-6 text-white">{topPriority?.project.title || "Headquarters"}</p>
        <p className="mt-2 text-xl font-black leading-6 text-white">{recommendedNextAction}</p>
        <p className="mt-3 text-xs font-bold leading-5 text-red-100">
          <span className="font-black">Reason: </span>
          {topPriority ? topPriority.reasons.slice(0, 4).join(" ") : "No active project is currently prioritized."}
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-red-100">
          <span>Open in conversation</span>
          <ArrowRight size={14} />
        </div>
      </article>
    </section>
  );
}
