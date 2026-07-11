import type { Project } from "@/domain/project";
import { ProjectStatus } from "@/domain/shared";

export type ProjectCommandTargetResult =
  | { ok: true; project: Project; match: "reference" | "context" }
  | { ok: false; reason: "missing-reference" | "invalid-reference" | "ambiguous-reference" | "not-found" };

export function normalizeProjectReference(value: string) {
  return value
    .toLowerCase()
    .replace(/school spotlight/g, "")
    .replace(/university/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function activeProjects(projects: Project[]) {
  return projects.filter((project) => {
    const state = project.state || project.status;
    return state !== ProjectStatus.Published && state !== ProjectStatus.Archived;
  });
}

export const projectCommandTargetService = {
  resolve(
    projects: Project[],
    projectReference?: string,
    currentProjectId?: string | null,
  ): ProjectCommandTargetResult {
    const active = activeProjects(projects);

    if (projectReference !== undefined) {
      const normalizedReference = normalizeProjectReference(projectReference);
      if (!normalizedReference) return { ok: false, reason: "invalid-reference" };

      const exactMatches = active.filter(
        (project) => normalizeProjectReference(project.title) === normalizedReference,
      );
      if (exactMatches.length === 1) return { ok: true, project: exactMatches[0], match: "reference" };
      if (exactMatches.length > 1) return { ok: false, reason: "ambiguous-reference" };

      const partialMatches = active.filter((project) =>
        normalizeProjectReference(project.title).includes(normalizedReference),
      );
      if (partialMatches.length === 1) return { ok: true, project: partialMatches[0], match: "reference" };
      if (partialMatches.length > 1) return { ok: false, reason: "ambiguous-reference" };
      return { ok: false, reason: "not-found" };
    }

    if (currentProjectId) {
      const contextualProject = active.find((project) => project.id === currentProjectId);
      if (contextualProject) return { ok: true, project: contextualProject, match: "context" };
    }

    if (active.length === 1) return { ok: true, project: active[0], match: "context" };
    return { ok: false, reason: "missing-reference" };
  },

  clarification(result: Extract<ProjectCommandTargetResult, { ok: false }>) {
    if (result.reason === "ambiguous-reference") {
      return "More than one project matches. Enter the full project name.";
    }
    if (result.reason === "not-found") {
      return "No project matches that name. Enter a valid project name.";
    }
    return "Enter a project name or select one project before continuing.";
  },
};
