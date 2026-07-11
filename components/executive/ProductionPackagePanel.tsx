"use client";

import {
  ProductionReadinessStatus,
  type ProductionPackage,
  type ProductionReadinessResult,
} from "@/domain/services";
import { Check, Circle, ClipboardCheck, Loader2 } from "lucide-react";

type ProductionPackagePanelProps = {
  productionPackage: ProductionPackage | null;
  readiness: ProductionReadinessResult | null;
  loading: boolean;
  message: string;
  onBeginReview(): void;
};

export function ProductionPackagePanel({
  productionPackage,
  readiness,
  loading,
  message,
  onBeginReview,
}: ProductionPackagePanelProps) {
  if (loading) {
    return (
      <div className="flex min-h-52 items-center justify-center" aria-label="Loading Production Package">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
          <Loader2 size={14} className="animate-spin text-red-500" />
          Opening Production Package
        </div>
      </div>
    );
  }

  if (!productionPackage) {
    return (
      <div>
        <p className="text-sm font-bold leading-6 text-zinc-400">{message || "No Production Package exists for this project yet."}</p>
      </div>
    );
  }

  const checklistSections = [
    { title: "Production Checklist", items: productionPackage.productionChecklist },
    { title: "Graphics", items: productionPackage.graphicsNeeded },
    { title: "Media", items: productionPackage.mediaChecklist },
    { title: "QA", items: productionPackage.qaChecklist },
    { title: "Publishing Requirements", items: productionPackage.publishingRequirements },
  ];
  const readyForReview = readiness?.status === ProductionReadinessStatus.ReadyForReview;

  return (
    <div className="grid min-w-0 gap-4" data-package-content="production">
        <p className="break-words text-sm font-bold leading-6 text-zinc-300">{productionPackage.summary}</p>
        <section className="border-b border-white/10 p-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Working Draft</h4>
          <p className="mt-3 break-words whitespace-pre-wrap text-sm font-bold leading-6 text-zinc-200">{productionPackage.workingDraft}</p>
        </section>

        {checklistSections.map((section) => (
          <section key={section.title} className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{section.title}</h4>
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                {section.items.filter((item) => item.completed).length}/{section.items.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {section.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2 text-xs font-bold leading-5 text-zinc-300">
                  {item.completed ? <Check size={14} className="mt-0.5 text-emerald-400" /> : <Circle size={12} className="mt-1 text-zinc-600" />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="p-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Next Step</h4>
          <p className="mt-2 text-sm font-black leading-6 text-white">{productionPackage.nextRecommendedStep}</p>
          {readiness?.missingRequirements.length ? (
            <p className="mt-3 text-xs font-bold leading-5 text-amber-200">
              Missing: {readiness.missingRequirements.join(", ")}
            </p>
          ) : null}
          {message ? <p className="mt-3 text-xs font-bold leading-5 text-red-200" aria-live="polite">{message}</p> : null}
          <div className="mt-4">
            <button
              type="button"
              onClick={onBeginReview}
              disabled={!readyForReview}
              className="flex h-10 items-center justify-center gap-2 bg-red-600 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <ClipboardCheck size={14} />
              Begin Review
            </button>
          </div>
        </section>
    </div>
  );
}
