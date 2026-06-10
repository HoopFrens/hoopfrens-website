import { ArrowDownRight, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative flex min-h-[92vh] items-end overflow-hidden pt-20">
      <Image src="/assets/hero_basketball.png" alt="Basketball player competing under arena lights" fill priority className="object-cover object-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.96)_0%,rgba(0,0,0,.72)_48%,rgba(0,0,0,.25)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#050505_0%,transparent_45%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-20 pt-32 lg:px-8 lg:pb-28">
        <div className="max-w-4xl">
          <p className="eyebrow">We talk hoops. Everyone&apos;s welcome.</p>
          <h1 className="mt-5 text-6xl font-black uppercase leading-[0.87] tracking-[-0.075em] text-white sm:text-8xl lg:text-[8.5rem]">
            Every level.<br /><span className="text-red-500">Every story.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
            Basketball media for the players, coaches, programs, and communities beyond the usual spotlight.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="#stories" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-red-500">
              Explore stories <ArrowDownRight size={18} />
            </Link>
            <Link href="#media" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition hover:border-yellow-400 hover:text-yellow-400">
              Watch Hoop Frens <Play size={16} fill="currentColor" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}