import type { ExecutiveAttentionItem } from "@/domain/briefing";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

type NeedsAttentionProps = {
  items: ExecutiveAttentionItem[];
  totalCount: number;
};

export function NeedsAttention({ items, totalCount }: NeedsAttentionProps) {
  const recommendationCoversAttention = totalCount > items.length;

  return (
    <section className="border border-white/10 bg-[#0c0c0c]" aria-labelledby="needs-attention-title">
      <header className="flex items-end justify-between gap-4 border-b border-white/10 p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">Needs Attention</p>
          <h2 id="needs-attention-title" className="mt-2 text-lg font-black text-white">Work that cannot wait quietly</h2>
        </div>
        <span className="text-sm font-black text-white">{totalCount}</span>
      </header>
      {items.length ? (
        <div className="grid lg:grid-cols-2">
          {items.map((item) => (
            <article key={item.project.id} className="min-w-0 border-t border-white/10 p-5 lg:border-l lg:first:border-l-0">
              <div className="flex items-center justify-between gap-3">
                <span className={`${item.severity === "critical" ? "bg-red-600 text-white" : "bg-amber-300 text-black"} px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em]`}>
                  {item.label}
                </span>
                <Link
                  href={`/executive-workspace/projects?projectId=${encodeURIComponent(item.project.id)}`}
                  aria-label={`Open ${item.project.title}`}
                  className="text-zinc-500 transition hover:text-red-400"
                >
                  <ArrowUpRight size={15} />
                </Link>
              </div>
              <h3 className="mt-3 text-sm font-black leading-5 text-white">{item.project.title}</h3>
              <p className="mt-2 text-xs font-bold leading-5 text-zinc-400">{item.reason}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="p-5 text-sm font-bold leading-6 text-zinc-400">
          {recommendationCoversAttention
            ? "Today’s recommendation covers the only project requiring immediate attention."
            : "No active project requires immediate attention."}
        </p>
      )}
      {items.length && recommendationCoversAttention ? (
        <p className="border-t border-white/10 px-5 py-3 text-xs font-bold text-zinc-500">
          The highest-ranked attention item is already covered by Today&apos;s Recommendation.
        </p>
      ) : null}
    </section>
  );
}
