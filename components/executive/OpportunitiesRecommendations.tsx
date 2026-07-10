import type { ExecutiveOpportunityItem } from "@/domain/briefing";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

type OpportunitiesRecommendationsProps = {
  items: ExecutiveOpportunityItem[];
};

export function OpportunitiesRecommendations({ items }: OpportunitiesRecommendationsProps) {
  return (
    <section className="border border-white/10 bg-[#0c0c0c]" aria-labelledby="opportunities-title">
      <header className="border-b border-white/10 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">Opportunities &amp; Recommendations</p>
        <h2 id="opportunities-title" className="mt-2 text-lg font-black text-white">Additional work ready to move</h2>
      </header>
      {items.length ? (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.project.id} className="min-w-0 border-t border-white/10 p-5 lg:border-l lg:first:border-l-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Score {item.recommendationScore}</p>
                  <h3 className="mt-2 text-sm font-black leading-5 text-white">{item.project.title}</h3>
                </div>
                <Link
                  href={`/executive-workspace/projects?projectId=${encodeURIComponent(item.project.id)}`}
                  aria-label={`Open ${item.project.title}`}
                  className="shrink-0 text-zinc-500 transition hover:text-red-400"
                >
                  <ArrowUpRight size={15} />
                </Link>
              </div>
              <p className="mt-3 text-xs font-black leading-5 text-red-300">{item.action}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-zinc-400">Why it matters: {item.whyItMatters}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="p-5 text-sm font-bold leading-6 text-zinc-400">No additional active project is ready to advance.</p>
      )}
    </section>
  );
}
