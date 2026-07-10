import type { PriorityAssessment, PrioritizationResult, RankedPriorityAssessment } from "@/domain/prioritization";
import { ProjectWorkspace, type Project } from "@/domain/project";
import { Priority, ProjectStatus } from "@/domain/shared";

const millisecondsPerDay = 86_400_000;
const maximumResultsPerGroup = 5;

const priorityWeights: Record<Priority, number> = {
  [Priority.Low]: 10,
  [Priority.Medium]: 20,
  [Priority.High]: 32,
  [Priority.Critical]: 45,
};

const stateWeights: Partial<Record<ProjectStatus, number>> = {
  [ProjectStatus.Draft]: 8,
  [ProjectStatus.Research]: 12,
  [ProjectStatus.Outline]: 18,
  [ProjectStatus.Production]: 16,
  [ProjectStatus.Review]: 24,
  [ProjectStatus.Approved]: 14,
};

const workspaceWeights: Record<ProjectWorkspace, number> = {
  [ProjectWorkspace.ExecutiveOffice]: 10,
  [ProjectWorkspace.IntelligenceCenter]: 5,
  [ProjectWorkspace.ProductionStudio]: 5,
  [ProjectWorkspace.StrategyRoom]: 7,
  [ProjectWorkspace.ProductLab]: 4,
  [ProjectWorkspace.Library]: 2,
};

const workspaceLabels: Record<ProjectWorkspace, string> = {
  [ProjectWorkspace.ExecutiveOffice]: "Executive Office",
  [ProjectWorkspace.IntelligenceCenter]: "Intelligence Center",
  [ProjectWorkspace.ProductionStudio]: "Production Studio",
  [ProjectWorkspace.StrategyRoom]: "Strategy Room",
  [ProjectWorkspace.ProductLab]: "Product Lab",
  [ProjectWorkspace.Library]: "Library",
};

const stateRecommendations: Partial<Record<ProjectStatus, string>> = {
  [ProjectStatus.Draft]: "Begin research",
  [ProjectStatus.Research]: "Complete research",
  [ProjectStatus.Outline]: "Create the project outline",
  [ProjectStatus.Production]: "Prepare the project for Founder Review",
  [ProjectStatus.Review]: "Complete Founder Review",
  [ProjectStatus.Approved]: "Prepare approved work for publishing",
};

const stateReasons: Partial<Record<ProjectStatus, string[]>> = {
  [ProjectStatus.Draft]: ["The project is still in Draft.", "Research has not started."],
  [ProjectStatus.Research]: ["Research is in progress."],
  [ProjectStatus.Outline]: ["Research is complete.", "The outline has not started."],
  [ProjectStatus.Production]: ["The outline is complete.", "Production is in progress."],
  [ProjectStatus.Review]: ["Production is complete.", "Founder review is required."],
  [ProjectStatus.Approved]: ["Founder approval is complete.", "Publishing has not started."],
};

function getProjectState(project: Project) {
  return project.state || project.status;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsedDate = Date.parse(value);
  return Number.isNaN(parsedDate) ? null : parsedDate;
}

function dayDifference(laterDate: number, earlierDate: number) {
  return Math.max(0, Math.floor((laterDate - earlierDate) / millisecondsPerDay));
}

function getDueAssessment(project: Project, currentTime: number) {
  const dueDate = parseDate(project.dueDate);
  if (dueDate === null) return { status: "none" as const, score: 0, risk: 0, reason: "" };

  const daysUntilDue = Math.ceil((dueDate - currentTime) / millisecondsPerDay);
  if (daysUntilDue < 0) {
    const overdueDays = Math.max(1, Math.abs(daysUntilDue));
    return {
      status: "overdue" as const,
      score: 25,
      risk: 30,
      reason: `Due date is ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue.`,
    };
  }

  if (daysUntilDue <= 2) {
    return {
      status: "due-soon" as const,
      score: 20,
      risk: 15,
      reason: daysUntilDue === 0 ? "Due today." : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`,
    };
  }

  if (daysUntilDue <= 7) return { status: "due-soon" as const, score: 12, risk: 15, reason: `Due in ${daysUntilDue} days.` };
  if (daysUntilDue <= 14) return { status: "scheduled" as const, score: 6, risk: 0, reason: `Due in ${daysUntilDue} days.` };
  return { status: "scheduled" as const, score: 0, risk: 0, reason: "" };
}

function waitingOnFounder(project: Project) {
  if (getProjectState(project) === ProjectStatus.Review) return true;

  const founderContext = `${project.currentBlocker || ""} ${project.currentStep || ""} ${project.recommendedNextAction || ""}`.toLowerCase();
  if (project.currentBlocker?.toLowerCase().includes("founder")) return true;
  if (founderContext.includes("clarification")) return true;

  return founderContext.includes("founder") && ["review", "approval", "decision", "input", "response"].some((keyword) => founderContext.includes(keyword));
}

function progressWeight(progressPercent: number) {
  if (progressPercent < 25) return 6;
  if (progressPercent < 60) return 4;
  if (progressPercent < 90) return 2;
  return 1;
}

function staleWeight(daysSinceLastActivity: number | null) {
  if (daysSinceLastActivity === null) return 0;
  if (daysSinceLastActivity >= 30) return 15;
  if (daysSinceLastActivity >= 14) return 10;
  if (daysSinceLastActivity >= 7) return 5;
  return 0;
}

function rank(assessments: PriorityAssessment[], compare: (first: PriorityAssessment, second: PriorityAssessment) => number) {
  return [...assessments]
    .sort(compare)
    .slice(0, maximumResultsPerGroup)
    .map((assessment, index): RankedPriorityAssessment => ({ ...assessment, rank: index + 1 }));
}

function comparePriorities(first: PriorityAssessment, second: PriorityAssessment) {
  const scoreDifference = second.priorityScore - first.priorityScore;
  if (scoreDifference !== 0) return scoreDifference;

  const riskDifference = second.riskScore - first.riskScore;
  if (riskDifference !== 0) return riskDifference;

  const firstDueDate = parseDate(first.project.dueDate) ?? Number.POSITIVE_INFINITY;
  const secondDueDate = parseDate(second.project.dueDate) ?? Number.POSITIVE_INFINITY;
  if (firstDueDate !== secondDueDate) return firstDueDate - secondDueDate;
  return first.project.title.localeCompare(second.project.title);
}

function compareRisk(first: PriorityAssessment, second: PriorityAssessment) {
  const riskDifference = second.riskScore - first.riskScore;
  return riskDifference !== 0 ? riskDifference : comparePriorities(first, second);
}

export const executivePrioritizationService = {
  assess(project: Project, now = new Date()): PriorityAssessment {
    const state = getProjectState(project);
    const currentTime = now.getTime();
    const updatedAt = parseDate(project.updatedAt);
    const daysSinceLastActivity = updatedAt === null ? null : dayDifference(currentTime, updatedAt);
    const blocked = Boolean(project.currentBlocker);
    const founderWaiting = waitingOnFounder(project);
    const due = getDueAssessment(project, currentTime);
    const staleScore = staleWeight(daysSinceLastActivity);
    const highPriorityDraft = state === ProjectStatus.Draft && [Priority.High, Priority.Critical].includes(project.priority);
    const missingNextAction = !project.recommendedNextAction && !project.currentStep;
    const readyToAdvance = !blocked && !founderWaiting && !missingNextAction;
    const riskReasons = [
      ...(blocked ? [`Blocked by: ${project.currentBlocker}.`] : []),
      ...(due.risk > 0 && due.reason ? [due.reason] : []),
      ...(staleScore >= 10 && daysSinceLastActivity !== null ? [`No project activity for ${daysSinceLastActivity} days.`] : []),
      ...(highPriorityDraft ? ["A high-priority project remains in Draft."] : []),
      ...(missingNextAction ? ["No next action is defined."] : []),
      ...(founderWaiting ? ["Waiting on Founder action."] : []),
    ];
    const riskScore = Math.min(
      100,
      (blocked ? 40 : 0) + due.risk + (staleScore >= 10 ? 20 : 0) + (highPriorityDraft ? 12 : 0) + (missingNextAction ? 18 : 0) + (founderWaiting ? 10 : 0),
    );
    const priorityScore = Math.min(
      100,
      priorityWeights[project.priority] +
        (stateWeights[state] || 0) +
        due.score +
        (blocked ? 20 : 0) +
        (founderWaiting ? 18 : 0) +
        (workspaceWeights[project.currentWorkspace] || 0) +
        staleScore +
        progressWeight(project.progressPercent),
    );
    const reasons = [
      ...(state === ProjectStatus.Production && project.lastActivity.toLowerCase().includes("production complete")
        ? ["Production is complete.", "Founder review has not started."]
        : stateReasons[state] || [`Project is in ${state}.`]),
    ];

    reasons.push(blocked ? `Blocked by: ${project.currentBlocker}.` : "No blockers.");
    if (founderWaiting) reasons.push("Waiting on Founder review, approval, or decision.");
    if (readyToAdvance) reasons.push("Ready to advance.");
    if ([Priority.High, Priority.Critical].includes(project.priority)) reasons.push(`Marked ${project.priority} priority.`);
    if (due.reason) reasons.push(due.reason);
    if (daysSinceLastActivity !== null && daysSinceLastActivity >= 7) reasons.push(`No project activity for ${daysSinceLastActivity} days.`);
    reasons.push(`Progress is ${project.progressPercent}%.`);
    reasons.push(`Current workspace: ${workspaceLabels[project.currentWorkspace] || project.currentWorkspace}.`);

    return {
      project,
      priorityScore,
      riskScore,
      reasons,
      riskReasons,
      recommendation: project.recommendedNextAction || stateRecommendations[state] || "Continue the project",
      blocked,
      waitingOnFounder: founderWaiting,
      readyToAdvance,
      atRisk: riskScore > 0,
      dueStatus: due.status,
      daysSinceLastActivity,
    };
  },

  prioritize(projects: Project[], now = new Date()): PrioritizationResult {
    const assessments = projects
      .filter((project) => ![ProjectStatus.Published, ProjectStatus.Archived].includes(getProjectState(project)))
      .map((project) => this.assess(project, now));

    return {
      assessments,
      topFounderPriorities: rank(assessments, comparePriorities),
      projectsAtRisk: rank(assessments.filter((assessment) => assessment.atRisk), compareRisk),
      projectsWaitingOnFounder: rank(assessments.filter((assessment) => assessment.waitingOnFounder), comparePriorities),
      projectsReadyToAdvance: rank(assessments.filter((assessment) => assessment.readyToAdvance), comparePriorities),
    };
  },
};
