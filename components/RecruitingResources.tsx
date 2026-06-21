import { ArrowRight, Route } from "lucide-react";
import Link from "next/link";

export function RecruitingResources() {
  return (
    <section id="recruiting" className="section-shell">
      <div className="relative overflow-hidden rounded-[2rem] border border-red-500/30 bg-zinc-950 px-7 py-14 sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:px-16">
        <div className="absolute -right-28 -top-32 size-96 rounded-full border-[70px] border-red-600/10" />
        <div className="relative max-w-3xl">
          <div className="grid size-12 place-items-center rounded-2xl bg-red-600 text-white">
            <Route size={25} />
          </div>
          <p className="eyebrow mt-8">Recruiting, decoded</p>
          <h2 className="mt-3 text-4xl font-black uppercase tracking-[-0.04em] text-white sm:text-6xl">
            Your Recruiting Journey Starts Here
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
            Hoop Frens helps players and families understand every pathway in college basketball — from JUCO to DIII, NAIA, NCCAA, USCAA, and beyond.
          </p>
        </div>
        <Link href="/recruiting-resources" className="relative mt-9 inline-flex shrink-0 items-center gap-2 rounded-full bg-red-600 px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-red-500 lg:mt-0">
          Explore Recruiting Resources <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
