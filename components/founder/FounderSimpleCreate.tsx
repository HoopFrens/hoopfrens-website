"use client";

import {
  createFirestoreFounderWorkflowDraftRepository,
  FounderWorkflowStatus,
  FounderWorkflowStep,
  type FounderWorkflowDraft,
} from "@/domain/founder-simple";
import {
  createFirestoreKnowledgeGraphRepository,
  isSchoolKnowledgeNode,
  KnowledgeStatus,
  type KnowledgeGraph,
} from "@/domain/knowledge";
import { createFirestoreProjectRepository } from "@/domain/project";
import {
  createFirestoreOutlinePackageRepository,
  createFirestoreProductionPackageRepository,
  createFirestoreResearchPackageRepository,
} from "@/domain/services";
import { db } from "@/lib/firebase";
import { createSchoolSpotlightDraftInput, knowledgeService } from "@/services";
import { ArrowRight, FileEdit, Loader2, Plus, School } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SchoolSpotlightJourney } from "./SchoolSpotlightJourney";

const workspaceId = "executive-workspace";

const continueLabels: Record<FounderWorkflowStep, string> = {
  [FounderWorkflowStep.Request]: "Continue request",
  [FounderWorkflowStep.Review]: "Continue information review",
  [FounderWorkflowStep.Customize]: "Continue package customization",
  [FounderWorkflowStep.Approve]: "Continue exact package review",
};

function draftLabel(draft: FounderWorkflowDraft, graph: KnowledgeGraph | null) {
  const school = graph?.nodes.find((node) => node.id === draft.schoolId);
  return school?.name || draft.schoolDraft?.officialName || "School Spotlight";
}

export function FounderSimpleCreate({ currentUserId }: { currentUserId: string }) {
  const draftRepository = useMemo(() => db ? createFirestoreFounderWorkflowDraftRepository(db) : null, []);
  const knowledgeRepository = useMemo(() => db ? createFirestoreKnowledgeGraphRepository(db) : null, []);
  const projectRepository = useMemo(() => db ? createFirestoreProjectRepository(db, currentUserId) : null, [currentUserId]);
  const researchPackageRepository = useMemo(() => db ? createFirestoreResearchPackageRepository(db) : null, []);
  const outlinePackageRepository = useMemo(() => db ? createFirestoreOutlinePackageRepository(db) : null, []);
  const productionPackageRepository = useMemo(() => db ? createFirestoreProductionPackageRepository(db) : null, []);
  const storageAvailable = Boolean(draftRepository && knowledgeRepository);
  const [drafts, setDrafts] = useState<FounderWorkflowDraft[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<FounderWorkflowDraft | null>(null);
  const [loading, setLoading] = useState(storageAvailable);
  const [error, setError] = useState(storageAvailable ? "" : "Headquarters storage is temporarily unavailable. Try again or contact a Headquarters administrator.");

  useEffect(() => {
    if (!draftRepository || !knowledgeRepository) {
      return;
    }
    let active = true;
    async function loadCreateWorkspace() {
      const [savedDrafts, savedGraph] = await Promise.all([
        draftRepository!.listByOwner(workspaceId, currentUserId),
        knowledgeService.loadGraph(knowledgeRepository!, workspaceId),
      ]);
      if (!active) return;

      const search = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
      const requestedDraft = savedDrafts.find((draft) => draft.id === search.get("draft"));
      const requestedSchoolName = search.get("school")?.trim().toLocaleLowerCase();
      const requestedSchool = requestedSchoolName
        ? savedGraph.nodes.find((node) => (
            isSchoolKnowledgeNode(node)
              && node.status === KnowledgeStatus.Active
              && node.name.trim().toLocaleLowerCase() === requestedSchoolName
          ))
        : undefined;

      let nextDrafts = savedDrafts;
      let resumable = requestedDraft;
      if (!resumable && requestedSchool) {
        resumable = savedDrafts.find((draft) => (
          draft.status === FounderWorkflowStatus.Active && draft.schoolId === requestedSchool.id
        ));
        if (!resumable) {
          const id = `spotlight-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
          resumable = await draftRepository!.create({
            ...createSchoolSpotlightDraftInput(id, currentUserId),
            schoolId: requestedSchool.id,
          }, { actorId: currentUserId });
          if (!active) return;
          nextDrafts = [resumable, ...savedDrafts];
        }
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", `${window.location.pathname}?draft=${encodeURIComponent(resumable.id)}`);
        }
      }

      resumable ||= savedDrafts.find((draft) => draft.status === FounderWorkflowStatus.Active);
      setDrafts(nextDrafts);
      setGraph(savedGraph);
      if (resumable) setSelectedDraft(resumable);
    }

    void loadCreateWorkspace().catch(() => {
      if (active) setError("Headquarters could not load saved work. Try again in a moment.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [currentUserId, draftRepository, knowledgeRepository]);

  async function refreshGraph() {
    if (!knowledgeRepository) throw new Error("School information is unavailable.");
    const savedGraph = await knowledgeService.loadGraph(knowledgeRepository, workspaceId);
    setGraph(savedGraph);
    return savedGraph;
  }

  async function startSpotlight(addSchool = false) {
    if (!draftRepository) {
      setError("Headquarters could not start this request yet.");
      return;
    }
    setError("");
    try {
      const id = `spotlight-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
      const created = await draftRepository.create(createSchoolSpotlightDraftInput(id, currentUserId), { actorId: currentUserId });
      const next = addSchool ? { ...created, schoolDraft: { officialName: "", city: "", state: "" } } : created;
      const saved = addSchool
        ? await draftRepository.update(created.id, { schoolDraft: next.schoolDraft }, { actorId: currentUserId })
        : created;
      setDrafts((current) => [saved, ...current]);
      setSelectedDraft(saved);
    } catch {
      setError("Headquarters could not start this request yet. Your existing work was not changed.");
    }
  }

  function handleDraftSaved(saved: FounderWorkflowDraft) {
    setSelectedDraft(saved);
    setDrafts((current) => [saved, ...current.filter((draft) => draft.id !== saved.id)]);
  }

  if (loading) {
    return <div className="flex min-h-full items-center justify-center bg-[#050505] text-white"><Loader2 aria-label="Loading Create" className="animate-spin text-red-500" size={30} /></div>;
  }

  if (selectedDraft && graph && draftRepository && knowledgeRepository && projectRepository
    && researchPackageRepository && outlinePackageRepository && productionPackageRepository) {
    return (
      <SchoolSpotlightJourney
        key={selectedDraft.id}
        initialDraft={selectedDraft}
        initialGraph={graph}
        currentUserId={currentUserId}
        draftRepository={draftRepository}
        knowledgeRepository={knowledgeRepository}
        projectRepository={projectRepository}
        researchPackageRepository={researchPackageRepository}
        outlinePackageRepository={outlinePackageRepository}
        productionPackageRepository={productionPackageRepository}
        onDraftSaved={handleDraftSaved}
        onGraphRefresh={refreshGraph}
        onExit={() => setSelectedDraft(null)}
      />
    );
  }

  return (
    <div className="min-h-full bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Create</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">What do you want to make?</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Choose one clear outcome. Headquarters will guide the information review, customization, and approval.</p>

        {error ? <div role="alert" className="mt-5 border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{error}</div> : null}

        <section className="mt-7 grid gap-4 lg:grid-cols-2" aria-label="Create actions">
          <button type="button" onClick={() => void startSpotlight(false)} className="group min-h-48 border border-red-500/40 bg-red-600 p-6 text-left transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <FileEdit aria-hidden="true" size={28} />
            <span className="mt-8 block text-2xl font-black uppercase">Request School Spotlight</span>
            <p className="mt-2 max-w-lg text-sm font-bold leading-6 text-red-50/80">Select a School, review trusted information, customize the package, and approve one exact version.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider">Start request <ArrowRight aria-hidden="true" size={16} /></span>
          </button>
          <button type="button" onClick={() => void startSpotlight(true)} className="group min-h-48 border border-white/15 bg-[#101010] p-6 text-left transition hover:border-red-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <School aria-hidden="true" className="text-red-400" size={28} />
            <span className="mt-8 block text-2xl font-black uppercase">Add School</span>
            <p className="mt-2 max-w-lg text-sm font-bold leading-6 text-zinc-400">Search first, then add only the essential School information and one confirmed official website.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-300">Add School <Plus aria-hidden="true" size={16} /></span>
          </button>
        </section>

        {drafts.some((draft) => draft.status !== FounderWorkflowStatus.Archived) ? (
          <section className="mt-10 border-t border-white/10 pt-7" aria-labelledby="saved-work-title">
            <h2 id="saved-work-title" className="text-xl font-black uppercase">Saved work</h2>
            <div className="mt-4 grid gap-3">
              {drafts.filter((draft) => draft.status !== FounderWorkflowStatus.Archived).map((draft) => (
                <button key={draft.id} type="button" onClick={() => setSelectedDraft(draft)} className="flex min-h-16 items-center justify-between gap-4 border border-white/10 bg-black px-4 py-3 text-left transition hover:border-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  <span>
                    <span className="block text-sm font-black text-white">{draftLabel(draft, graph)}</span>
                    <span className="mt-1 block text-xs font-bold text-zinc-500">{draft.status === FounderWorkflowStatus.Completed ? "Approved package" : continueLabels[draft.step]}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="shrink-0 text-red-400" size={18} />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
