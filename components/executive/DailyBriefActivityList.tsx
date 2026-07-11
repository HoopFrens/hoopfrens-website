import { ExecutiveTimeline } from "@/components/executive/ExecutiveTimeline";
import type { ExecutiveEvent } from "@/domain/event";

type DailyBriefActivityListProps = {
  title: string;
  events: ExecutiveEvent[];
  emptyMessage: string;
};

export function DailyBriefActivityList({ title, events, emptyMessage }: DailyBriefActivityListProps) {
  return (
    <section className="min-w-0 border-t border-white/10 pt-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{title}</h3>
      <div className="mt-3"><ExecutiveTimeline events={events} emptyMessage={emptyMessage} compact /></div>
    </section>
  );
}
