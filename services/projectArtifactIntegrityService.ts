import type { Project } from "@/domain/project";
import type { OutlinePackage, ProductionPackage, ResearchPackage } from "@/domain/services";
import { ProjectStatus } from "@/domain/shared";

export type ProjectArtifactSnapshot = {
  researchPackage: ResearchPackage | null;
  outlinePackage: OutlinePackage | null;
  productionPackage: ProductionPackage | null;
};

export type ProjectArtifactIntegrityWarning = {
  title: "Legacy project data incomplete.";
  message: "This project reached its current state before required artifact validation was introduced.";
  missingArtifacts: string[];
};

const lifecycleOrder: Record<ProjectStatus, number> = {
  [ProjectStatus.Draft]: 0,
  [ProjectStatus.Research]: 1,
  [ProjectStatus.Outline]: 2,
  [ProjectStatus.Production]: 3,
  [ProjectStatus.Review]: 4,
  [ProjectStatus.Approved]: 5,
  [ProjectStatus.Published]: 6,
  [ProjectStatus.Archived]: 7,
};

function belongsToProject(artifact: { projectId: string } | null, project: Project) {
  return artifact?.projectId === project.id;
}

export const projectArtifactIntegrityService = {
  requiredArtifacts(project: Project) {
    const state = project.state || project.status;
    const order = lifecycleOrder[state];
    const required: Array<keyof ProjectArtifactSnapshot> = [];

    if (order >= lifecycleOrder[ProjectStatus.Outline]) required.push("researchPackage");
    if (order >= lifecycleOrder[ProjectStatus.Production]) required.push("outlinePackage");
    if (order >= lifecycleOrder[ProjectStatus.Review] || (state === ProjectStatus.Production && project.productionCompletedAt)) {
      required.push("productionPackage");
    }
    return required;
  },

  evaluate(project: Project, artifacts: ProjectArtifactSnapshot): ProjectArtifactIntegrityWarning | null {
    const labels: Record<keyof ProjectArtifactSnapshot, string> = {
      researchPackage: "Research Package",
      outlinePackage: "Outline Package",
      productionPackage: "Production Package",
    };
    const missingArtifacts = this.requiredArtifacts(project)
      .filter((artifactType) => !belongsToProject(artifacts[artifactType], project))
      .map((artifactType) => labels[artifactType]);

    if (!missingArtifacts.length) return null;
    return {
      title: "Legacy project data incomplete.",
      message: "This project reached its current state before required artifact validation was introduced.",
      missingArtifacts,
    };
  },
};
