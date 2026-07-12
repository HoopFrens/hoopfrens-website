import { ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import { Priority, ProjectStatus } from "@/domain/shared";

const projectTypeLabels: Record<ProjectType, string> = {
  [ProjectType.SchoolSpotlight]: "School Spotlight",
  [ProjectType.PodcastEpisode]: "Podcast Episode",
  [ProjectType.NewsStory]: "News Story",
  [ProjectType.RecruitingAnalysis]: "Recruiting Analysis",
  [ProjectType.SocialVideo]: "Social Video",
  [ProjectType.ResourceGuide]: "Resource Guide",
  [ProjectType.Partnership]: "Partnership",
  [ProjectType.WebsiteImprovement]: "Website Improvement",
  [ProjectType.Merchandise]: "Merchandise",
};

const workspaceLabels: Record<ProjectWorkspace, string> = {
  [ProjectWorkspace.ExecutiveOffice]: "Executive Office",
  [ProjectWorkspace.IntelligenceCenter]: "Intelligence Center",
  [ProjectWorkspace.ProductionStudio]: "Production Studio",
  [ProjectWorkspace.StrategyRoom]: "Strategy Room",
  [ProjectWorkspace.ProductLab]: "Product Lab",
  [ProjectWorkspace.Library]: "Library",
};

export const projectTypes = Object.values(ProjectType);
export const projectStates = Object.values(ProjectStatus);
export const projectWorkspaces = Object.values(ProjectWorkspace);
export const projectPriorities = Object.values(Priority);

export function getProjectType(project: Project) {
  return project.type || project.projectType || ProjectType.SchoolSpotlight;
}

export function getProjectState(project: Project) {
  return project.state || project.status || ProjectStatus.Draft;
}

export function formatProjectType(projectType: ProjectType | string) {
  return projectTypeLabels[projectType as ProjectType] || projectType;
}

export function formatProjectWorkspace(workspace: ProjectWorkspace | string) {
  return workspaceLabels[workspace as ProjectWorkspace] || workspace;
}

export function formatProjectState(state: ProjectStatus | string) {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function formatProjectPriority(priority: Priority | string) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function formatProjectDate(value: string | undefined, includeTime = true) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return includeTime
    ? date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString([], { dateStyle: "medium" });
}

export function normalizeWorkspaceProject(project: Project): Project {
  const type = getProjectType(project);
  const state = getProjectState(project);
  const currentWorkspace = project.currentWorkspace || ProjectWorkspace.ExecutiveOffice;

  return {
    ...project,
    type,
    projectType: type,
    state,
    status: state,
    currentWorkspace,
    workspace: formatProjectWorkspace(currentWorkspace),
    workspaceHistory: project.workspaceHistory?.length
      ? project.workspaceHistory
      : [{ workspace: currentWorkspace, enteredAt: project.createdAt, reason: "Project created" }],
    stateHistory: project.stateHistory?.length
      ? project.stateHistory
      : [{ state, enteredAt: project.createdAt, reason: "Project created" }],
    progressPercent: project.progressPercent ?? 0,
    dependencies: project.dependencies || [],
    currentBlocker: project.currentBlocker || null,
    currentStep: project.currentStep || project.remainingNextStep || "Not set",
    recommendedNextAction: project.recommendedNextAction || project.currentStep || "Not set",
    lastActivity: project.lastActivity || "Project created",
  };
}
