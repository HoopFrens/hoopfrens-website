import { coaches } from "@/data/coaches";
import { players } from "@/data/players";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

export function Spotlights() {
  const spotlights = [...players, ...coaches];
  return (
    <section className="section-shell border-y border-white/10 bg-red-950/10">
      <SectionHeading centered eyebrow="People of the game" title="The spotlight belongs everywhere." />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {spotlights.map((person) => (
          <article key={person.name} className="grid overflow-hidden rounded-3xl border border-white/10 bg-black sm:grid-cols-[.9fr_1.1fr]">
            <div className="relative min-h-72"><Image src={person.image} alt={person.name} fill className="object-cover" /></div>
            <div className="flex flex-col justify-center p-7">
              <p className="eyebrow">{person.division} spotlight</p>
              <h3 className="mt-4 text-3xl font-black uppercase text-white">{person.name}</h3>
              <p className="mt-1 font-bold text-zinc-400">{person.role} · {person.program}</p>
              <blockquote className="mt-7 border-l-2 border-red-500 pl-4 text-lg font-semibold italic text-zinc-200">&ldquo;{person.quote}&rdquo;</blockquote>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-10 text-center"><Link href="/submit" className="rounded-full border border-white/20 px-6 py-3 text-sm font-black uppercase text-white hover:border-yellow-400 hover:text-yellow-400">Nominate someone</Link></div>
    </section>
  );
}
