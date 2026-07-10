import type { PrioritizationResult } from "@/domain/prioritization";
import { AlertTriangle, ArrowUpRight, Target, UserRoundCheck } from "lucide-react";

type ProjectPrioritySummaryProps = {
  prioritization: PrioritizationResult;
};

export function ProjectPrioritySummary({ prioritization }: ProjectPrioritySummaryProps) {
  const sections = [
    {
      label: "Founder Priorities",
      count: prioritization.topFounderPriorities.length,
      project: prioritization.topFounderPriorities[0],
      icon: Target,
    },
    {
      label: "At Risk",
      count: prioritization.projectsAtRisk.length,
      project: prioritization.projectsAtRisk[0],
      icon: AlertTriangle,
    },
    {
      label: "Waiting On Founder",
      count: prioritization.projectsWaitingOnFounder.length,
      project: prioritization.projectsWaitingOnFounder[0],
      icon: UserRoundCheck,
    },
    {
      label: "Ready To Advance",
      count: prioritization.projectsReadyToAdvance.length,
      project: prioritization.projectsReadyToAdvance[0],
      icon: ArrowUpRight,
    },
  ];

  return (
    <section className="grid border border-white/10 bg-[#0b0b0b] sm:grid-cols-2 xl:grid-cols-4" aria-label="Project priority overview">
      {sections.map(({ label, count, project, icon: Icon }) => (
        <div key={label} className="min-w-0 border-b border-white/10 p-3 last:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">{label}</p>
            <Icon size={14} className="text-red-500" />
          </div>
          <p className="mt-2 text-xl font-black text-white">{count}</p>
          <p className="mt-1 truncate text-xs font-bold text-zinc-300">{project?.project.title || "None"}</p>
          <p className="mt-1 line-clamp-2 text-[10px] font-bold leading-4 text-zinc-600">
            {project ? project.reasons.slice(0, 2).join(" ") : "No projects in this group."}
          </p>
        </div>
      ))}
    </section>
  );
}
