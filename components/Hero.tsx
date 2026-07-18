import { featuredGames } from "@/data/games";
import { ArrowUpRight, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { GameTicker } from "./GameTicker";

const tabs = ["Home", "Scores", "Rankings", "Recruiting", "Video", "Spotlights"];

const divisions = [
  { label: "All Levels", href: "#stories" },
  { label: "JUCO", href: "/juco" },
  { label: "NAIA", href: "/naia" },
  { label: "DII", href: "/d2" },
  { label: "DIII", href: "/d3" },
];

const featureTiles = [
  {
    label: "Recruiting",
    title: "The overlooked guards turning June showcases into real offers",
    image: "/assets/player_spotlight.png",
  },
  {
    label: "Coaching",
    title: "Small-college staffs building cultures that travel",
    image: "/assets/coach_spotlight.png",
  },
  {
    label: "Media",
    title: "Watch the latest Hoop Frens conversations",
    image: "/assets/podcast.png",
    video: true,
  },
];

export function Hero() {
  return (
    <section className="bg-white pt-20 text-zinc-950">
      <GameTicker games={featuredGames} />

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-9 lg:px-8 lg:pb-24">
        <div className="flex flex-wrap items-center gap-3">
          {divisions.map((division, index) => (
            <Link
              href={division.href}
              key={division.label}
              className={`rounded-full px-5 py-2 text-xs font-black uppercase ${index === 0 ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
            >
              {division.label}
            </Link>
          ))}
        </div>

        <div className="mt-8 border-b border-zinc-200">
          <div className="flex flex-col gap-6 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-red-600">Everybody Hoops. Everyone&apos;s Welcome.</p>
              <h1 className="mt-3 text-5xl font-black leading-none text-zinc-950 sm:text-6xl lg:text-7xl">Men&apos;s Basketball</h1>
            </div>
            <nav className="flex gap-8 overflow-x-auto text-xs font-black uppercase text-zinc-500" aria-label="Landing page sections">
              {tabs.map((tab, index) => (
                <Link key={tab} href={index === 0 ? "/" : `#${tab.toLowerCase()}`} className={`shrink-0 border-b-2 pb-4 ${index === 0 ? "border-red-600 text-zinc-950" : "border-transparent hover:text-zinc-950"}`}>
                  {tab}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-8 grid gap-2 lg:grid-cols-2">
          <Link href="#stories" className="group relative min-h-[28rem] overflow-hidden bg-zinc-950 sm:min-h-[34rem]">
            <Image src="/assets/featured_story.png" alt="Basketball player on court" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.32)_58%,rgba(0,0,0,.08)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-widest text-red-300">Featured Story</p>
              <h2 className="mt-3 max-w-2xl text-4xl font-black uppercase leading-none text-white sm:text-5xl">
                Every level has a headline waiting to happen
              </h2>
              <p className="mt-4 max-w-xl text-base font-bold leading-7 text-zinc-200">
                Basketball media for players, coaches, programs, and communities beyond the usual spotlight.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase text-white">
                Explore stories <ArrowUpRight size={18} />
              </span>
            </div>
          </Link>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="#divisions" className="group relative min-h-56 overflow-hidden bg-zinc-950 sm:col-span-2 sm:min-h-64">
              <Image src="/assets/hero_basketball.png" alt="Basketball action under arena lights" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.18)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-xs font-black uppercase tracking-widest text-red-300">All Divisions</p>
                <h2 className="mt-2 max-w-2xl text-3xl font-black uppercase leading-none text-white">Find the programs making noise outside the main broadcast</h2>
              </div>
            </Link>
            {featureTiles.map((tile) => (
              <Link key={tile.title} href={tile.video ? "#media" : "#stories"} className="group relative min-h-64 overflow-hidden bg-zinc-950">
                <Image src={tile.image} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.12)_100%)]" />
                {tile.video ? (
                  <span className="absolute left-5 top-5 grid size-12 place-items-center rounded-full bg-red-600 text-white">
                    <Play size={19} fill="currentColor" />
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-red-300">{tile.label}</p>
                  <h3 className="mt-2 text-xl font-black uppercase leading-tight text-white">{tile.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
