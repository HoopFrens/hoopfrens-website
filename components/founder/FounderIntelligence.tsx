"use client";

import {
  createFirestoreKnowledgeGraphRepository,
  isSchoolKnowledgeNode,
  KnowledgeConfidence,
  type KnowledgeGraph,
  type KnowledgeNode,
  KnowledgeNodeType,
  KnowledgeStatus,
} from "@/domain/knowledge";
import { formatHoopFrensRegion } from "@/domain/shared";
import { db } from "@/lib/firebase";
import { knowledgeService } from "@/services";
import { AlertTriangle, ArrowRight, CircleHelp, Loader2, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const workspaceId = "executive-workspace";
type SchoolNode = Extract<KnowledgeNode, { type: KnowledgeNodeType.School }>;

const confidenceLabels: Record<KnowledgeConfidence, string> = {
  [KnowledgeConfidence.Verified]: "Verified",
  [KnowledgeConfidence.Supported]: "Supported by a Reliable Source",
  [KnowledgeConfidence.Inferred]: "Needs Confirmation",
  [KnowledgeConfidence.Unverified]: "Needs Confirmation",
  [KnowledgeConfidence.Conflicting]: "Conflicting Information",
};

const confidencePresentation = {
  [KnowledgeConfidence.Verified]: { icon: ShieldCheck, className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  [KnowledgeConfidence.Supported]: { icon: ShieldCheck, className: "border-sky-400/30 bg-sky-400/10 text-sky-200" },
  [KnowledgeConfidence.Inferred]: { icon: CircleHelp, className: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  [KnowledgeConfidence.Unverified]: { icon: CircleHelp, className: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  [KnowledgeConfidence.Conflicting]: { icon: AlertTriangle, className: "border-red-400/30 bg-red-400/10 text-red-200" },
} satisfies Record<KnowledgeConfidence, { icon: typeof ShieldCheck; className: string }>;

export function FounderIntelligence() {
  const repository = useMemo(() => db ? createFirestoreKnowledgeGraphRepository(db) : null, []);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(Boolean(repository));
  const [error, setError] = useState(repository ? "" : "School information is temporarily unavailable. Try again or contact a Headquarters administrator.");

  useEffect(() => {
    if (!repository) return;
    let active = true;
    knowledgeService.loadGraph(repository, workspaceId).then((savedGraph) => {
      if (active) setGraph(savedGraph);
    }).catch(() => {
      if (active) setError("Headquarters could not load School information. Try again in a moment.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [repository]);

  const schools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const activeSchools = (graph?.nodes || []).filter((node): node is SchoolNode => (
      isSchoolKnowledgeNode(node) && node.status === KnowledgeStatus.Active
    ));
    return activeSchools.filter((node) => (
      !normalized || [node.name, node.city, node.state, formatHoopFrensRegion(node.region)]
        .some((value) => value.toLowerCase().includes(normalized)))
    ).sort((first, second) => first.name.localeCompare(second.name));
  }, [graph, query]);

  return (
    <div className="min-h-full bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Intelligence</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">School &amp; Basketball Intelligence</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-400">Find trusted School information, see its verification status, and begin the next Founder action without opening maintenance tools.</p>

        {error ? <div role="alert" className="mt-5 border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{error}</div> : null}

        <div className="mt-7 flex flex-col gap-4 border border-white/10 bg-[#0e0e0e] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <label className="w-full max-w-2xl text-sm font-black text-zinc-200">Search Schools
            <span className="relative block"><Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by School, city, state, or Hoop Frens region" className="mt-2 min-h-12 w-full border border-white/15 bg-black py-3 pl-11 pr-4 text-base font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40" /></span>
          </label>
          <Link href="/executive-workspace/knowledge" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-white/15 bg-black px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-300 transition hover:border-red-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Advanced Details <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>

        {loading ? <div className="mt-8 flex items-center gap-3 text-sm font-black uppercase text-zinc-400"><Loader2 aria-hidden="true" className="animate-spin text-red-500" size={20} /> Loading School information</div> : null}

        {!loading && !error ? (
          schools.length ? (
            <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="School intelligence results">
              {schools.map((school) => {
                const sources = (graph?.sources || []).filter((source) => school.sourceIds.includes(source.id) && source.status === KnowledgeStatus.Active);
                const verification = confidencePresentation[school.confidence];
                const VerificationIcon = verification.icon;
                return (
                  <article key={school.id} className="min-w-0 border border-white/10 bg-black p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><h3 className="break-words text-xl font-black uppercase text-white">{school.name}</h3><p className="mt-2 text-sm font-bold text-zinc-400">{school.city}, {school.state} · {formatHoopFrensRegion(school.region)}</p></div>
                      <span className={`inline-flex min-h-9 items-center gap-2 border px-3 text-xs font-black ${verification.className}`}><VerificationIcon aria-hidden="true" size={15} /> {confidenceLabels[school.confidence]}</span>
                    </div>
                    <dl className="mt-5 grid gap-3 text-sm">
                      <div className="border-t border-white/10 pt-3"><dt className="text-xs font-black uppercase tracking-wider text-zinc-600">Basketball</dt><dd className="mt-1 font-bold text-white">{[school.governingBody, school.division].filter(Boolean).join(" · ") || "Needs confirmation"}</dd></div>
                      <div className="border-t border-white/10 pt-3"><dt className="text-xs font-black uppercase tracking-wider text-zinc-600">Why We Trust This</dt><dd className="mt-1 font-bold leading-6 text-zinc-300">{sources.length ? sources.map((source) => source.title).join(", ") : "No verified supporting source is attached yet."}</dd></div>
                    </dl>
                    <Link href={`/executive-workspace/create?school=${encodeURIComponent(school.name)}`} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Request School Spotlight <ArrowRight aria-hidden="true" size={16} /></Link>
                  </article>
                );
              })}
            </section>
          ) : <div className="mt-6 border border-white/10 bg-black p-8 text-center"><h3 className="text-xl font-black uppercase">No matching Schools</h3><p className="mt-2 text-sm font-bold text-zinc-500">Try another search or use Add School from Create.</p></div>
        ) : null}
      </div>
    </div>
  );
}
