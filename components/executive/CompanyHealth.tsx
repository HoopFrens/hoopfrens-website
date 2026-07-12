import type { CompanyHealthItem } from "@/domain/briefing";

type CompanyHealthProps = {
  items: CompanyHealthItem[];
};

const statusClasses: Record<CompanyHealthItem["status"], string> = {
  Green: "bg-emerald-400 text-black",
  Yellow: "bg-amber-300 text-black",
  Red: "bg-red-600 text-white",
  Offline: "bg-zinc-700 text-zinc-100",
};

export function CompanyHealth({ items }: CompanyHealthProps) {
  return (
    <section className="border border-white/10 bg-[#0c0c0c]" aria-labelledby="company-health-title">
      <header className="border-b border-white/10 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">Company Health</p>
        <h2 id="company-health-title" className="mt-2 text-lg font-black text-white">Live operating status</h2>
      </header>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {items.map((item) => (
          <article key={item.label} className="min-w-0 border-t border-white/10 p-4 sm:border-l sm:first:border-l-0 2xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">{item.label}</h3>
              <span className={`${statusClasses[item.status]} px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em]`}>
                {item.status}
              </span>
            </div>
            <p className="mt-3 text-xs font-bold leading-5 text-zinc-300">{item.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
