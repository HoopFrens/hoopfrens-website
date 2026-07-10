"use client";

import type { ResearchPackage } from "@/domain/services";
import { BookOpenCheck, Loader2, X } from "lucide-react";
import { formatProjectDate } from "@/components/executive/projectWorkspaceUtils";
import { ResearchPackageList } from "@/components/executive/ResearchPackageList";

type ResearchPackagePanelProps = {
  researchPackage: ResearchPackage | null;
  loading: boolean;
  message: string;
  onClose(): void;
};

export function ResearchPackagePanel({ researchPackage, loading, message, onClose }: ResearchPackagePanelProps) {
  return (
    <section className="border-b border-white/10 bg-black/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck size={14} className="text-red-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">Research Package</p>
          </div>
          {researchPackage ? <p className="mt-2 text-xs font-bold text-zinc-500">Updated {formatProjectDate(researchPackage.updatedAt)}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center border border-white/10 text-zinc-500 transition hover:border-red-500 hover:text-white"
          title="Close research package"
          aria-label="Close research package"
        >
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-28 items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
          <Loader2 size={14} className="animate-spin text-red-500" />
          Loading package
        </div>
      ) : researchPackage ? (
        <div className="mt-5 grid gap-5">
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Objective</h4>
            <p className="mt-2 text-sm font-bold leading-6 text-white">{researchPackage.objective}</p>
          </div>
          <ResearchPackageList title="Checklist" items={[...researchPackage.researchChecklist, ...researchPackage.informationNeeded]} />
          <ResearchPackageList title="Sources" items={researchPackage.sourceChecklist} />
          <ResearchPackageList title="Deliverables" items={researchPackage.expectedDeliverables} />
          <div className="border-l-2 border-red-500 pl-3">
            <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Next Step</h4>
            <p className="mt-2 text-sm font-black leading-6 text-white">{researchPackage.recommendedNextStep}</p>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm font-bold leading-6 text-zinc-400">{message || "No research package exists for this project yet."}</p>
      )}
    </section>
  );
}
