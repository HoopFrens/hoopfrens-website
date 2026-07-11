import type { RankedPriorityAssessment } from "@/domain/prioritization";

type DailyBriefProjectGroupProps = {
  title: string;
  assessments: RankedPriorityAssessment[];
  emptyMessage: string;
  showRiskReasons?: boolean;
};

export function DailyBriefProjectGroup({ title, assessments, emptyMessage, showRiskReasons = false }: DailyBriefProjectGroupProps) {
  return (
    <section className="min-w-0 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{title}</h3>
        <span className="text-xs font-black text-white">{assessments.length}</span>
      </div>
      <div className="mt-3 grid gap-3">
        {assessments.length ? (
          assessments.map((assessment) => (
            <div key={assessment.project.id} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
              <p className="text-xs font-black text-red-500">#{assessment.rank}</p>
              <div>
                <p className="text-xs font-black leading-5 text-white">{assessment.project.title}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  Priority Score {assessment.priorityScore}
                </p>
                <p className="mt-1 text-[10px] font-bold leading-4 text-zinc-600">
                  Reason: {(showRiskReasons ? assessment.riskReasons : assessment.reasons.slice(0, 3)).join(" ")}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs font-bold leading-5 text-zinc-500">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
