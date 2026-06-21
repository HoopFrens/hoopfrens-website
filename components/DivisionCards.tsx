import { divisions } from "@/data/divisions";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

export function DivisionCards() {
  return (
    <section id="divisions" className="section-shell">
      <SectionHeading centered eyebrow="Every pathway covered" title="Find your level. Follow the game." description="Six distinct college basketball ecosystems. One place built to give all of them the attention they deserve." />
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {divisions.map((division, index) => (
          <Link key={division.slug} href={`/${division.slug}`} className="group relative min-h-80 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-7 transition hover:-translate-y-1 hover:border-red-500/60">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${division.accent}`} />
            <div className="flex items-start justify-between">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-yellow-400">0{index + 1} / {division.shortName}</span>
              <ArrowUpRight className="text-zinc-600 transition group-hover:text-red-400" />
            </div>
            <h3 className="mt-12 text-3xl font-black uppercase tracking-tight text-white">{division.name}</h3>
            <p className="mt-4 leading-7 text-zinc-400">{division.description}</p>
            <div className="absolute inset-x-7 bottom-7 grid grid-cols-3 border-t border-white/10 pt-5 text-sm">
              <div><b className="block text-white">{division.schools}</b><span className="text-zinc-500">Schools</span></div>
              <div><b className="block text-white">{division.aid}</b><span className="text-zinc-500">Support</span></div>
              <div><b className="block text-white">{division.pathway}</b><span className="text-zinc-500">Pathway</span></div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
