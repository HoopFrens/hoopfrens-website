import { resources } from "@/data/resources";
import { ArrowRight, BookOpen, ClipboardCheck, Send } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const icons = [BookOpen, Send, ClipboardCheck];

export function RecruitingResources() {
  return (
    <section id="recruiting" className="section-shell">
      <SectionHeading eyebrow="Recruiting, decoded" title="Make your next move with context." description="Clear, practical resources for families navigating a college basketball landscape that rarely explains itself." />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {resources.map((resource, index) => {
          const Icon = icons[index];
          return (
            <article key={resource.title} className="rounded-3xl border border-white/10 bg-zinc-950 p-7">
              <Icon className="text-red-500" size={30} />
              <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-yellow-400">{resource.label}</p>
              <h3 className="mt-3 text-2xl font-black uppercase text-white">{resource.title}</h3>
              <p className="mt-4 leading-7 text-zinc-400">{resource.description}</p>
              <button className="mt-7 inline-flex items-center gap-2 text-sm font-black uppercase text-white">Open resource <ArrowRight size={17} /></button>
            </article>
          );
        })}
      </div>
    </section>
  );
}