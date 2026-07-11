"use client";

import type { ResearchPackage } from "@/domain/services";
import { Loader2 } from "lucide-react";
import { ResearchPackageList } from "@/components/executive/ResearchPackageList";

type ResearchPackagePanelProps = {
  researchPackage: ResearchPackage | null;
  loading: boolean;
  message: string;
};

export function ResearchPackagePanel({ researchPackage, loading, message }: ResearchPackagePanelProps) {
  return loading ? (
        <div className="flex min-h-28 items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
          <Loader2 size={14} className="animate-spin text-red-500" />
          Loading package
        </div>
      ) : researchPackage ? (
        <div className="grid min-w-0 gap-5" data-package-content="research">
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Objective</h4>
            <p className="mt-2 break-words text-sm font-bold leading-6 text-white">{researchPackage.objective}</p>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ResearchPackageList title="Checklist" items={[...researchPackage.researchChecklist, ...researchPackage.informationNeeded]} />
            <ResearchPackageList title="Sources" items={researchPackage.sourceChecklist} />
            <ResearchPackageList title="Deliverables" items={researchPackage.expectedDeliverables} />
          </div>
          <div className="border-l-2 border-red-500 pl-3">
            <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Next Step</h4>
            <p className="mt-2 break-words text-sm font-black leading-6 text-white">{researchPackage.recommendedNextStep}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm font-bold leading-6 text-zinc-400">{message || "No research package exists for this project yet."}</p>
  );
}
