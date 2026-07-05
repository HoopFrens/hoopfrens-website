import { stories } from "@/data/stories";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

export function FeaturedStories() {
  return (
    <section id="stories" className="section-shell border-y border-white/10 bg-zinc-950/60">
      <SectionHeading eyebrow="From the Hoop Frens desk" title="Stories worth the full court." description="Original reporting, practical perspective, and the people making college basketball matter everywhere." />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {stories.map((story, index) => (
          <article key={story.title} className={index === 0 ? "group lg:col-span-2" : "group"}>
            <div className={`relative overflow-hidden rounded-3xl ${index === 0 ? "aspect-[16/9]" : "aspect-[4/5]"}`}>
              <Image src={story.image} alt="" fill className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-yellow-400"><span>{story.category}</span><span className="text-zinc-500">{story.division}</span></div>
                <h3 className="mt-3 max-w-2xl text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">{story.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">{story.excerpt}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase text-white">Read story <ArrowUpRight size={17} /></span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
