import { ExecutiveEventType, groupExecutiveEvents, sortExecutiveEvents, type ExecutiveEvent } from "@/domain/event";

const completedEventTypes = new Set([
  ExecutiveEventType.ResearchCompleted,
  ExecutiveEventType.OutlineCompleted,
  ExecutiveEventType.ApprovalCompleted,
  ExecutiveEventType.PublishingCompleted,
]);

function after(events: ExecutiveEvent[], cutoff: string | null) {
  const cutoffTime = cutoff ? Date.parse(cutoff) : 0;
  const normalizedCutoff = Number.isNaN(cutoffTime) ? 0 : cutoffTime;
  return sortExecutiveEvents(events.filter((event) => Date.parse(event.timestamp) > normalizedCutoff));
}

export const executiveTimelineService = {
  sort: sortExecutiveEvents,
  group: groupExecutiveEvents,
  since(events: ExecutiveEvent[], cutoff: string | null) {
    return after(events, cutoff);
  },
  completedSince(events: ExecutiveEvent[], cutoff: string) {
    return after(events, cutoff).filter((event) => completedEventTypes.has(event.eventType));
  },
};
