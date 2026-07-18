"use client";

import { formatProjectDate, formatProjectWorkspace } from "@/components/executive/projectWorkspaceUtils";
import { executiveEventLabels, groupExecutiveEvents, type ExecutiveEvent } from "@/domain/event";
import { ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

type ExecutiveTimelineProps = {
  events: ExecutiveEvent[];
  emptyMessage: string;
  compact?: boolean;
  loading?: boolean;
  error?: string;
};

const subscribeToClientMount = () => () => undefined;

function formatTimelineTime(timestamp: string, groupLabel: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  if (groupLabel === "Earlier") return formatProjectDate(timestamp);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ExecutiveTimeline({
  events,
  emptyMessage,
  compact = false,
  loading = false,
  error = "",
}: ExecutiveTimelineProps) {
  const isClient = useSyncExternalStore(subscribeToClientMount, () => true, () => false);
  const localNow = useMemo(() => (isClient ? new Date() : null), [isClient]);
  const groups = useMemo(() => (localNow ? groupExecutiveEvents(events, localNow) : []), [events, localNow]);

  if (loading || !localNow) {
    return (
      <div className="flex min-h-24 items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">
        <Loader2 size={14} className="animate-spin text-red-500" />
        Loading timeline
      </div>
    );
  }

  if (error) return <p className="text-xs font-bold leading-5 text-red-200">{error}</p>;
  if (!groups.length) return <p className="text-xs font-bold leading-5 text-zinc-500">{emptyMessage}</p>;

  return (
    <div className={compact ? "grid gap-4" : "grid gap-6"}>
      {groups.map((group) => (
        <section key={group.label}>
          <div className="flex items-center gap-3">
            <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">{group.label}</h4>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className={compact ? "mt-3 grid gap-3" : "mt-4 grid gap-5"}>
            {group.events.map((event) => (
              <article key={event.id} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3">
                <span className="mt-1.5 size-1.5 bg-red-500" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-red-400">
                        {executiveEventLabels[event.eventType]}
                      </p>
                      <Link
                        href={event.projectHref}
                        className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-black leading-5 text-white transition hover:text-red-300"
                      >
                        <span>{event.project.title}</span>
                        <ArrowUpRight size={12} className="shrink-0" />
                      </Link>
                    </div>
                    <p className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-600">
                      {formatTimelineTime(event.timestamp, group.label)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5 text-zinc-400">{event.summary}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                    {formatProjectWorkspace(event.relatedWorkspace)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
