import { ResourceIcon } from "@/components/ResourceIcon";
import { getResource, resources } from "@/data/resources";
import { ArrowLeft, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return resources.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resource = getResource((await params).slug);
  if (!resource) return {};
  return {
    title: resource.title,
    description: resource.description,
    alternates: { canonical: `/recruiting-resources/${resource.slug}` },
  };
}

export default async function ResourceGuidePage({ params }: PageProps) {
  const resource = getResource((await params).slug);
  if (!resource) notFound();

  return (
    <section className="px-5 pb-28 pt-36 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <Link href="/recruiting-resources" className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-500 transition hover:text-white">
          <ArrowLeft size={17} /> All recruiting resources
        </Link>
        <div className="mt-12 grid size-16 place-items-center rounded-2xl bg-red-600 text-white">
          <ResourceIcon name={resource.icon} size={32} />
        </div>
        <p className="eyebrow mt-9">Hoop Frens recruiting guide</p>
        <h1 className="mt-4 text-5xl font-black uppercase leading-[0.92] tracking-[-0.05em] text-white sm:text-7xl">{resource.title}</h1>
        <p className="mt-7 text-xl leading-9 text-zinc-300">{resource.description}</p>

        <div className="mt-12 rounded-3xl border border-white/10 bg-zinc-950 p-7 sm:p-10">
          <h2 className="text-2xl font-black uppercase text-white">What this guide covers</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {resource.takeaways.map((takeaway) => (
              <div key={takeaway} className="flex gap-3 rounded-2xl border border-white/10 bg-black p-5">
                <Check className="mt-0.5 shrink-0 text-yellow-400" size={20} />
                <p className="font-semibold leading-6 text-zinc-300">{takeaway}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 border-l-2 border-red-500 pl-6">
          <p className="text-lg leading-8 text-zinc-400">
            Recruiting decisions should account for basketball fit, academics, finances, campus life, and long-term development. Use this guide to organize better conversations, then verify current rules directly with each school and governing association.
          </p>
        </div>
      </article>
    </section>
  );
}
