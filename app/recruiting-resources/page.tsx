import { ResourceIcon } from "@/components/ResourceIcon";
import { resources } from "@/data/resources";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Recruiting Resources",
  description: "College basketball recruiting guides for players and families exploring JUCO, DII, DIII, NAIA, NCCAA, USCAA, and Division I opportunities.",
  alternates: { canonical: "/recruiting-resources" },
};

export default function RecruitingResourcesPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 px-5 pb-20 pt-40 sm:pb-28 lg:px-8">
        <div className="absolute -right-36 top-10 size-[34rem] rounded-full border-[100px] border-red-600/[.06]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="eyebrow">The Hoop Frens recruiting hub</p>
          <h1 className="mt-4 max-w-5xl text-6xl font-black uppercase leading-[0.9] tracking-[-0.065em] text-white sm:text-8xl lg:text-[7.5rem]">
            Recruiting <span className="text-red-500">Resources</span>
          </h1>
          <p className="mt-8 max-w-4xl text-lg leading-8 text-zinc-300 sm:text-xl">
            College basketball recruiting can feel confusing, especially when most conversations focus only on Division I. Hoop Frens helps players and families understand the full landscape — JUCO, NCAA DII, NCAA DIII, NAIA, NCCAA, and USCAA — so they can find the right opportunity, not just the most talked-about one.
          </p>
        </div>
      </section>

      <section className="section-shell">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource, index) => (
            <article key={resource.slug} className="group flex min-h-80 flex-col rounded-3xl border border-white/10 bg-zinc-950 p-7 transition hover:-translate-y-1 hover:border-red-500/60">
              <div className="flex items-start justify-between">
                <div className="grid size-12 place-items-center rounded-2xl bg-red-600/15 text-red-500 transition group-hover:bg-red-600 group-hover:text-white">
                  <ResourceIcon name={resource.icon} />
                </div>
                <span className="text-xs font-black tracking-[0.2em] text-zinc-700">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h2 className="mt-8 text-2xl font-black uppercase tracking-tight text-white">{resource.title}</h2>
              <p className="mt-4 flex-1 leading-7 text-zinc-400">{resource.description}</p>
              <Link href={`/recruiting-resources/${resource.slug}`} className="mt-7 inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white transition group-hover:text-yellow-400">
                Read Guide <ArrowRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
