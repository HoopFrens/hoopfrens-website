"use client";

import {
  createFirestoreFounderWorkflowDraftRepository,
  FounderWorkflowStatus,
  FounderWorkflowStep,
  type FounderWorkflowDraft,
} from "@/domain/founder-simple";
import { createFirestoreKnowledgeGraphRepository, type KnowledgeGraph } from "@/domain/knowledge";
import { db } from "@/lib/firebase";
import { knowledgeService } from "@/services";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const workspaceId = "executive-workspace";

function schoolName(draft: FounderWorkflowDraft, graph: KnowledgeGraph | null) {
  return graph?.nodes.find((node) => node.id === draft.schoolId)?.name
    || draft.schoolDraft?.officialName
    || "School Spotlight";
}

export function FounderReviewQueue({ currentUserId }: { currentUserId: string }) {
  const draftRepository = useMemo(() => db ? createFirestoreFounderWorkflowDraftRepository(db) : null, []);
  const knowledgeRepository = useMemo(() => db ? createFirestoreKnowledgeGraphRepository(db) : null, []);
  const storageAvailable = Boolean(draftRepository && knowledgeRepository);
  const [drafts, setDrafts] = useState<FounderWorkflowDraft[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(storageAvailable);
  const [error, setError] = useState(storageAvailable ? "" : "Headquarters review is temporarily unavailable. Try again or contact a Headquarters administrator.");

  useEffect(() => {
    if (!draftRepository || !knowledgeRepository) {
      return;
    }
    let active = true;
    Promise.all([
      draftRepository.listByOwner(workspaceId, currentUserId),
      knowledgeService.loadGraph(knowledgeRepository, workspaceId),
    ]).then(([savedDrafts, savedGraph]) => {
      if (!active) return;
      setDrafts(savedDrafts.filter((draft) => draft.step === FounderWorkflowStep.Approve));
      setGraph(savedGraph);
    }).catch(() => {
      if (active) setError("Headquarters could not load the approval queue.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [currentUserId, draftRepository, knowledgeRepository]);

  const waitingDrafts = drafts.filter((draft) => draft.status !== FounderWorkflowStatus.Completed);
  const approvedDrafts = drafts.filter((draft) => draft.status === FounderWorkflowStatus.Completed);

  function draftCards(items: FounderWorkflowDraft[]) {
    return items.map((draft) => {
      const complete = draft.status === FounderWorkflowStatus.Completed;
      return (
        <article key={draft.id} className="border border-white/10 bg-black p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider ${complete ? "text-emerald-300" : "text-red-300"}`}>{complete ? <CheckCircle2 aria-hidden="true" size={15} /> : null}{complete ? "Approved" : "Founder Review"}</p>
              <h3 className="mt-3 text-xl font-black uppercase">{schoolName(draft, graph)} School Spotlight</h3>
              <p className="mt-2 text-sm font-bold text-zinc-500">Package version {draft.currentPackageVersion || "not set"}</p>
            </div>
            <Link href={`/executive-workspace/create?draft=${encodeURIComponent(draft.id)}`} className="inline-flex min-h-11 items-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {complete ? "Open Record" : "Review Package"} <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </article>
      );
    });
  }

  return (
    <div className="min-h-full bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Review &amp; Approve</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">Package review</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Open the exact saved version, check its information and media plan, then approve it or request changes.</p>

        {error ? <div role="alert" className="mt-5 border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{error}</div> : null}
        {loading ? <div className="mt-8 flex items-center gap-3 text-sm font-black uppercase text-zinc-400"><Loader2 aria-hidden="true" className="animate-spin text-red-500" size={20} /> Loading review items</div> : null}

        {!loading && !error ? (
          drafts.length ? (
            <div className="mt-8 grid gap-8">
              <section aria-labelledby="waiting-review-title"><div className="flex items-center justify-between gap-4"><h3 id="waiting-review-title" className="text-xl font-black uppercase">Waiting for Review</h3><span className="text-sm font-black text-red-300">{waitingDrafts.length}</span></div><div className="mt-4 grid gap-4">{waitingDrafts.length ? draftCards(waitingDrafts) : <p className="border border-white/10 bg-black p-5 text-sm font-bold text-zinc-500">Nothing is waiting for review.</p>}</div></section>
              <section aria-labelledby="approved-package-title"><div className="flex items-center justify-between gap-4"><h3 id="approved-package-title" className="text-xl font-black uppercase">Approved</h3><span className="text-sm font-black text-emerald-300">{approvedDrafts.length}</span></div><div className="mt-4 grid gap-4">{approvedDrafts.length ? draftCards(approvedDrafts) : <p className="border border-white/10 bg-black p-5 text-sm font-bold text-zinc-500">Approved packages will appear here.</p>}</div></section>
            </div>
          ) : (
            <div className="mt-8 border border-white/10 bg-black p-8 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto text-emerald-400" size={30} /><h2 className="mt-4 text-xl font-black uppercase">Nothing is waiting</h2><p className="mt-2 text-sm font-bold text-zinc-500">A package will appear here after customization is complete.</p></div>
          )
        ) : null}
      </div>
    </div>
  );
}
