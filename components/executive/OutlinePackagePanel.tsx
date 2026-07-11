"use client";

import type { OutlinePackage } from "@/domain/services";
import { FileStack, Loader2 } from "lucide-react";

type OutlinePackagePanelProps = {
  outlinePackage: OutlinePackage | null;
  loading: boolean;
  message: string;
};

function OutlineList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="min-w-0 border border-white/10 bg-black/30 p-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{title}</h3>
      {items.length ? (
        <ul className="mt-3 grid gap-2">
          {items.map((item) => <li key={item} className="break-words text-sm font-bold leading-6 text-zinc-200">{item}</li>)}
        </ul>
      ) : <p className="mt-3 text-sm font-bold text-zinc-500">No items recorded.</p>}
    </section>
  );
}

export function OutlinePackagePanel({ outlinePackage, loading, message }: OutlinePackagePanelProps) {
  if (loading) {
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500" aria-label="Loading Outline Package">
        <Loader2 size={16} className="animate-spin text-red-500" />
        Loading package
      </div>
    );
  }
  if (!outlinePackage) return <p className="text-sm font-bold leading-6 text-zinc-400">{message || "No Outline Package exists for this project yet."}</p>;

  return (
    <div className="grid min-w-0 gap-5" data-package-content="outline">
      <section className="border-l-2 border-red-500 pl-4">
        <div className="flex items-center gap-2"><FileStack size={15} className="text-red-500" /><h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Narrative Direction</h3></div>
        <p className="mt-3 break-words text-base font-black leading-7 text-white">{outlinePackage.narrativeAngle}</p>
        <p className="mt-3 break-words text-sm font-bold leading-6 text-zinc-300">{outlinePackage.objective}</p>
        <p className="mt-2 text-xs font-bold text-zinc-500">Audience: {outlinePackage.audience}</p>
      </section>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <OutlineList title="Sections" items={outlinePackage.sections} />
        <OutlineList title="Key Points" items={outlinePackage.keyPoints} />
        <OutlineList title="Production Requirements" items={outlinePackage.productionRequirements} />
        <section className="border border-red-500/25 bg-red-500/[0.05] p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Next Step</h3>
          <p className="mt-3 break-words text-sm font-black leading-6 text-white">{outlinePackage.recommendedNextStep}</p>
        </section>
      </div>
    </div>
  );
}
