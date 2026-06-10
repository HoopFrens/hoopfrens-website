import { playerRankings, teamRankings } from "@/data/rankings";
import { SectionHeading } from "./SectionHeading";

function RankingList({ title, items }: { title: string; items: typeof teamRankings }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-8">
      <h3 className="text-xl font-black uppercase tracking-tight text-white">{title}</h3>
      <div className="mt-6 divide-y divide-white/10">
        {items.map((item) => (
          <div key={item.name} className="grid grid-cols-[3rem_1fr] items-center py-4">
            <span className={item.rank <= 3 ? "text-2xl font-black text-yellow-400" : "text-2xl font-black text-zinc-600"}>{String(item.rank).padStart(2, "0")}</span>
            <div><p className="font-bold text-white">{item.name}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-zinc-500">{item.detail}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Rankings() {
  return (
    <section id="rankings" className="section-shell">
      <SectionHeading centered eyebrow="The Hoop Frens board" title="Who is making noise right now?" description="A cross-level snapshot of teams and players earning attention. Built to start conversations, not end them." />
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <RankingList title="Teams to watch" items={teamRankings} />
        <RankingList title="Players to know" items={playerRankings} />
      </div>
    </section>
  );
}