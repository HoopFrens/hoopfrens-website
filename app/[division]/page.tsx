import { NewsletterSignup } from "@/components/NewsletterSignup";
import { divisions, getDivision } from "@/data/divisions";
import { stories } from "@/data/stories";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ division: string }> };

export function generateStaticParams() { return divisions.map(({ slug }) => ({ division: slug })); }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { division: slug } = await params;
  const division = getDivision(slug);
  if (!division) return {};
  return { title: division.name, description: division.description, alternates: { canonical: `/${division.slug}` } };
}

export default async function DivisionPage({ params }: PageProps) {
  const { division: slug } = await params;
  const division = getDivision(slug);
  if (!division) notFound();

  return (
    <>
      <section className="relative overflow-hidden px-5 pb-24 pt-40 sm:pb-32 lg:px-8">
        <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${division.accent}`} />
        <div className="absolute right-[-8rem] top-20 size-[32rem] rounded-full border-[90px] border-white/[.025]" />
        <div className="relative mx-auto max-w-7xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold uppercase text-zinc-500 hover:text-white"><ArrowLeft size={17} /> All coverage</Link>
          <p className="eyebrow mt-16">Hoop Frens / {division.shortName}</p>
          <h1 className="mt-4 max-w-5xl text-6xl font-black uppercase leading-[.9] tracking-[-0.065em] text-white sm:text-8xl lg:text-[8rem]">{division.name}</h1>
          <p className="mt-7 max-w-2xl text-2xl font-bold text-yellow-400">{division.tagline}</p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">{division.longDescription}</p>
          <div className="mt-12 grid max-w-3xl grid-cols-3 gap-3">
            {[{ label: "Schools", value: division.schools }, { label: "Financial support", value: division.aid }, { label: "Program type", value: division.pathway }].map((stat) => <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><b className="block text-xl text-white sm:text-2xl">{stat.value}</b><span className="mt-1 block text-xs uppercase text-zinc-500">{stat.label}</span></div>)}
          </div>
        </div>
      </section>
      <section className="section-shell border-y border-white/10 bg-zinc-950/60">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="eyebrow">Latest coverage</p><h2 className="mt-3 text-4xl font-black uppercase tracking-tight text-white">Stories from the {division.shortName} game.</h2></div>
          <div className="divide-y divide-white/10 border-t border-white/10">
            {stories.map((story) => <article key={story.title} className="py-6"><p className="text-xs font-black uppercase tracking-wider text-red-400">{story.category}</p><h3 className="mt-2 text-2xl font-black uppercase text-white">{story.title}</h3><p className="mt-2 leading-7 text-zinc-400">{story.excerpt}</p></article>)}
          </div>
        </div>
      </section>
      <section className="section-shell"><div className="rounded-3xl border border-red-500/30 bg-red-950/20 p-8 sm:flex sm:items-center sm:justify-between sm:p-12"><div><p className="eyebrow">Know a story?</p><h2 className="mt-3 text-3xl font-black uppercase text-white">Help us find the next {division.shortName} spotlight.</h2></div><Link href="/submit" className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-4 text-sm font-black uppercase text-white sm:mt-0">Submit a nomination <ArrowRight size={18} /></Link></div></section>
      <NewsletterSignup />
    </>
  );
}