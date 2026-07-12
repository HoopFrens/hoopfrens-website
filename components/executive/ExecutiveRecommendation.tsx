"use client";

import { formatProjectState, formatProjectWorkspace } from "@/components/executive/projectWorkspaceUtils";
import type { DailyBriefAction } from "@/domain/briefing";
import type { ProjectRecommendation } from "@/domain/recommendation";
import { ArrowRight } from "lucide-react";

type ExecutiveRecommendationProps = {
  recommendation: ProjectRecommendation | null;
  action: DailyBriefAction | null;
  onAction(action: DailyBriefAction): void;
};

export function ExecutiveRecommendation({ recommendation, action, onAction }: ExecutiveRecommendationProps) {
  return (
    <section className="border border-red-500/30 bg-red-500/[0.07]" aria-labelledby="executive-recommendation-title">
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)_auto] lg:items-center lg:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300">Today&apos;s Recommendation</p>
          <h2 id="executive-recommendation-title" className="mt-2 text-xl font-black leading-8 text-white">
            {recommendation?.headline || "No active recommendation"}
          </h2>
          {recommendation ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="bg-red-600 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">Score {recommendation.score}</span>
                <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                  {formatProjectState(recommendation.project.state)} · {formatProjectWorkspace(recommendation.project.currentWorkspace)}
                </span>
                <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300">
                  Effort {recommendation.estimatedEffort}
                </span>
              </div>
              <p className="mt-4 text-xs font-bold leading-5 text-red-50">{recommendation.reason.join(" ")}</p>
            </>
          ) : (
            <p className="mt-3 text-xs font-bold leading-5 text-zinc-500">Create an active project to generate the next recommended action.</p>
          )}
        </div>

        {recommendation ? (
          <dl className="grid gap-4 border-l border-white/10 pl-5">
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Why now</dt>
              <dd className="mt-2 text-xs font-bold leading-5 text-white">{recommendation.whyNow}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">What happens if delayed</dt>
              <dd className="mt-2 text-xs font-bold leading-5 text-zinc-300">{recommendation.delayImpact}</dd>
            </div>
          </dl>
        ) : null}

        {action ? (
          <button
            type="button"
            onClick={() => onAction(action)}
            className="flex h-11 shrink-0 items-center justify-center gap-2 bg-red-600 px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-red-500"
          >
            {action.label}
            <ArrowRight size={15} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
