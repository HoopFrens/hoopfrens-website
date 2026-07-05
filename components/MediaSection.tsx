import { Play } from "lucide-react";
import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const episodes = [
  "The truth about JUCO recruiting",
  "Why DII coaches need complete guards",
  "Building a winning NAIA culture",
  "NCAA vs. NAIA eligibility explained",
];

export function MediaSection() {
  return (
    <section id="media" className="section-shell border-y border-white/10 bg-zinc-950/60">
      <SectionHeading eyebrow="Hoop Frens media" title="Hear the game differently." description="Conversations with the people who recruit, develop, compete, and build the culture." />
      <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
        <div className="group relative min-h-[420px] overflow-hidden rounded-3xl">
          <Image src="/assets/podcast.png" alt="Hoop Frens podcast studio" fill className="object-cover transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-7">
            <div><p className="eyebrow">Featured episode</p><h3 className="mt-2 max-w-xl text-3xl font-black uppercase text-white sm:text-4xl">The truth about JUCO recruiting: what nobody tells you</h3></div>
            <button aria-label="Play featured episode" className="grid size-14 shrink-0 place-items-center rounded-full bg-red-600 text-white"><Play size={20} fill="currentColor" /></button>
          </div>
        </div>
        <div className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-black px-6">
          {episodes.map((episode, index) => (
            <button key={episode} className="flex w-full items-center gap-4 py-6 text-left">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 text-red-500"><Play size={14} fill="currentColor" /></span>
              <span><span className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Episode {42 - index}</span><span className="mt-1 block font-bold text-white">{episode}</span></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
