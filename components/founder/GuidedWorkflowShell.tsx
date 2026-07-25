"use client";

import { FounderWorkflowStep } from "@/domain/founder-simple";
import { Check, Cloud, CloudAlert, Loader2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

type SaveStatus = "saved" | "saving" | "error";

type GuidedWorkflowShellProps = {
  title: string;
  eyebrow: string;
  step: FounderWorkflowStep;
  saveStatus: SaveStatus;
  summary: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
};

const steps = [
  { id: FounderWorkflowStep.Request, label: "Request" },
  { id: FounderWorkflowStep.Review, label: "Review" },
  { id: FounderWorkflowStep.Customize, label: "Customize" },
  { id: FounderWorkflowStep.Approve, label: "Approve" },
] as const;

function saveStatusContent(status: SaveStatus) {
  if (status === "saving") return { icon: Loader2, label: "Saving", className: "animate-spin text-zinc-400" };
  if (status === "error") return { icon: CloudAlert, label: "Save needs attention", className: "text-amber-300" };
  return { icon: Cloud, label: "Saved", className: "text-emerald-300" };
}

export function GuidedWorkflowShell({
  title,
  eyebrow,
  step,
  saveStatus,
  summary,
  children,
  actions,
}: GuidedWorkflowShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const activeIndex = steps.findIndex((item) => item.id === step);
  const activeStepLabel = steps[activeIndex]?.label || "Current";
  const saveState = saveStatusContent(saveStatus);
  const SaveIcon = saveState.icon;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="min-h-full bg-[#050505] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="border-b border-white/10 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">{eyebrow}</p>
              <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black uppercase tracking-tight outline-none sm:text-4xl">
                {title}<span className="sr-only"> — {activeStepLabel} step</span>
              </h2>
            </div>
            <p role={saveStatus === "error" ? "alert" : undefined} aria-live={saveStatus === "error" ? "assertive" : "off"} className="inline-flex min-h-11 items-center gap-2 border border-white/10 bg-black px-4 text-xs font-black uppercase tracking-wider text-zinc-300">
              <SaveIcon aria-hidden="true" size={16} className={saveState.className} />
              {saveState.label}
            </p>
          </div>

          <ol aria-label="Workflow progress" className="mt-6 grid gap-2 sm:grid-cols-4">
            {steps.map((item, index) => {
              const active = item.id === step;
              const complete = index < activeIndex;
              return (
                <li key={item.id} aria-current={active ? "step" : undefined} className={`flex min-h-12 items-center gap-3 border px-3 text-sm font-black ${active ? "border-red-500 bg-red-500/10 text-white" : "border-white/10 bg-black text-zinc-500"}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${complete ? "border-emerald-400 text-emerald-300" : active ? "border-red-400 text-red-300" : "border-zinc-700"}`}>
                    {complete ? <Check aria-label="Complete" size={14} /> : index + 1}
                  </span>
                  {item.label}
                </li>
              );
            })}
          </ol>
        </header>

        <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="min-w-0 border border-white/10 bg-[#0e0e0e] p-4 sm:p-6" aria-busy={saveStatus === "saving"}>
            {children}
          </section>
          <aside className="border border-white/10 bg-black p-4 sm:p-5 lg:sticky lg:top-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Current Summary</p>
            <div className="mt-4 text-sm leading-6 text-zinc-300">{summary}</div>
          </aside>
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-[#050505]/95 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
        </footer>
      </div>
    </div>
  );
}
