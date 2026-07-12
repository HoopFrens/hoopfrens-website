import type { FounderVisit, FounderVisitRegistration } from "./FounderVisit";

export const founderVisitSessionGapMs = 30 * 60 * 1000;

export function resolveFounderVisit(
  existingVisit: FounderVisit | null,
  userId: string,
  workspaceId: string,
  visitedAt: string,
  sessionGapMs = founderVisitSessionGapMs,
): FounderVisitRegistration {
  if (!existingVisit) {
    return {
      previousVisitAt: null,
      isNewSession: true,
      visit: {
        id: userId,
        userId,
        workspaceId,
        lastVisitAt: null,
        currentVisitStartedAt: visitedAt,
        lastSeenAt: visitedAt,
        createdAt: visitedAt,
        updatedAt: visitedAt,
      },
    };
  }

  const visitedTime = Date.parse(visitedAt);
  const lastSeenTime = Date.parse(existingVisit.lastSeenAt);
  const isNewSession = Number.isNaN(lastSeenTime) || visitedTime - lastSeenTime > sessionGapMs;
  const previousVisitAt = isNewSession ? existingVisit.currentVisitStartedAt : existingVisit.lastVisitAt;

  return {
    previousVisitAt,
    isNewSession,
    visit: {
      ...existingVisit,
      workspaceId,
      lastVisitAt: previousVisitAt,
      currentVisitStartedAt: isNewSession ? visitedAt : existingVisit.currentVisitStartedAt,
      lastSeenAt: visitedAt,
      updatedAt: visitedAt,
    },
  };
}
