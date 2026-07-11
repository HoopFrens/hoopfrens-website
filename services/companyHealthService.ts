import type { CompanyHealthItem } from "@/domain/briefing";
import { ExecutiveEventType, type ExecutiveEvent } from "@/domain/event";
import { ProjectType, type Project } from "@/domain/project";
import { Priority, ProjectStatus } from "@/domain/shared";

function getProjectState(project: Project) {
  return project.state || project.status;
}

function healthItem(
  label: string,
  status: CompanyHealthItem["status"],
  summary: string,
): CompanyHealthItem {
  return {
    label,
    status,
    summary,
    tone: status === "Green" ? "healthy" : status === "Offline" ? "offline" : "attention",
  };
}

function isOverdue(project: Project, now: Date) {
  if (!project.dueDate) return false;
  const dueAt = Date.parse(project.dueDate);
  return !Number.isNaN(dueAt) && dueAt < now.getTime();
}

function isCriticalBlocked(project: Project) {
  return project.priority === Priority.Critical && Boolean(project.currentBlocker);
}

export const companyHealthService = {
  evaluate(projects: Project[], events: ExecutiveEvent[] = [], now = new Date()): CompanyHealthItem[] {
    const activeProjects = projects.filter(
      (project) => ![ProjectStatus.Published, ProjectStatus.Archived].includes(getProjectState(project)),
    );
    const blockedProjects = activeProjects.filter((project) => Boolean(project.currentBlocker));
    const criticalBlockedProjects = blockedProjects.filter(isCriticalBlocked);
    const pendingReviews = activeProjects.filter(
      (project) =>
        getProjectState(project) === ProjectStatus.Review ||
        (getProjectState(project) === ProjectStatus.Production &&
          Boolean(project.productionCompletedAt) &&
          events.some(
            (event) =>
              event.projectId === project.id &&
              event.eventType === ExecutiveEventType.ProductionCompleted &&
              event.timestamp === project.productionCompletedAt,
          )),
    );
    const approvedProjects = activeProjects.filter((project) => getProjectState(project) === ProjectStatus.Approved);
    const websiteProjects = activeProjects.filter(
      (project) => (project.type || project.projectType) === ProjectType.WebsiteImprovement,
    );
    const websiteRisks = websiteProjects.filter((project) => project.currentBlocker || isOverdue(project, now));
    const researchProjects = activeProjects.filter((project) =>
      [ProjectStatus.Draft, ProjectStatus.Research].includes(getProjectState(project)),
    );
    const completedResearchProjectIds = new Set(
      events
        .filter((event) => event.eventType === ExecutiveEventType.ResearchCompleted)
        .map((event) => event.projectId),
    );
    const missingKnowledgeLinks = projects.filter(
      (project) => completedResearchProjectIds.has(project.id) && (project.knowledgeEntityIds?.length || 0) === 0,
    );

    const websiteHealth = websiteProjects.some(isCriticalBlocked)
      ? healthItem("Website", "Red", "Critical website work is blocked.")
      : websiteRisks.length > 0
        ? healthItem(
            "Website",
            "Yellow",
            `${websiteRisks.length} website project${websiteRisks.length === 1 ? "" : "s"} need attention.`,
          )
        : healthItem(
            "Website",
            "Green",
            websiteProjects.length > 0
              ? `${websiteProjects.length} website project${websiteProjects.length === 1 ? " is" : "s are"} progressing without blockers.`
              : "No website project requires attention.",
          );
    const projectHealth = criticalBlockedProjects.length > 0
      ? healthItem(
          "Projects",
          "Red",
          `${criticalBlockedProjects.length} critical project${criticalBlockedProjects.length === 1 ? " is" : "s are"} blocked.`,
        )
      : blockedProjects.length > 0
        ? healthItem(
            "Projects",
            "Yellow",
            `${blockedProjects.length} active project${blockedProjects.length === 1 ? " is" : "s are"} blocked.`,
          )
        : healthItem(
            "Projects",
            "Green",
            `${activeProjects.length} active project${activeProjects.length === 1 ? "" : "s"}; no critical blockers.`,
          );
    const reviewHealth = pendingReviews.some(isCriticalBlocked)
      ? healthItem("Reviews", "Red", "A critical review is blocked.")
      : pendingReviews.length > 0
        ? healthItem(
            "Reviews",
            "Yellow",
            `${pendingReviews.length} review${pendingReviews.length === 1 ? " is" : "s are"} waiting on Founder action.`,
          )
        : healthItem("Reviews", "Green", "No Founder reviews are waiting.");
    const publishingHealth = approvedProjects.some(isCriticalBlocked)
      ? healthItem("Publishing", "Red", "Critical approved work cannot advance to publishing.")
      : approvedProjects.length > 0
        ? healthItem(
            "Publishing",
            "Yellow",
            `${approvedProjects.length} approved project${approvedProjects.length === 1 ? " is" : "s are"} ready to publish.`,
          )
        : healthItem("Publishing", "Green", "No approved project is waiting to publish.");
    const researchHealth = researchProjects.some(isCriticalBlocked)
      ? healthItem("Research", "Red", "Critical research work is blocked.")
      : researchProjects.length > 0
        ? healthItem(
            "Research",
            "Yellow",
            `${researchProjects.length} project${researchProjects.length === 1 ? " requires" : "s require"} research.`,
          )
        : healthItem("Research", "Green", "No active project is waiting on research.");
    const knowledgeHealth = missingKnowledgeLinks.length > 0
      ? healthItem(
          "Knowledge",
          "Yellow",
          `${missingKnowledgeLinks.length} completed research package${missingKnowledgeLinks.length === 1 ? " needs" : "s need"} a knowledge link.`,
        )
      : healthItem("Knowledge", "Green", "Completed research is linked or no handoff is due.");

    return [
      websiteHealth,
      projectHealth,
      reviewHealth,
      publishingHealth,
      researchHealth,
      knowledgeHealth,
      healthItem("AI Systems", "Offline", "AI systems remain intentionally disabled."),
    ];
  },
};
