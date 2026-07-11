import { ArtifactStatus } from "@/domain/business-object";
import type { Project, ProjectRepository } from "@/domain/project";
import type { ProductionPackageRepository } from "@/domain/services";
import { projectWorkflowService } from "./projectWorkflowService";

export const projectRevisionService = {
  async request(
    projectRepository: ProjectRepository,
    productionPackageRepository: ProductionPackageRepository,
    project: Project,
    updatedAt = new Date().toISOString(),
  ) {
    const activePackage = await productionPackageRepository.getByProjectId(project.id);
    const supersededPackage = activePackage
      ? {
          ...activePackage,
          active: false,
          status: ArtifactStatus.Archived,
          supersededAt: updatedAt,
          updatedAt,
          metadata: { ...activePackage.metadata, productionComplete: false, superseded: true },
        }
      : null;

    return projectRepository.updateWithArtifacts(
      project.id,
      projectWorkflowService.createUpdate(project, "request-revision", updatedAt),
      supersededPackage ? [supersededPackage] : [],
      { expectedUpdatedAt: project.updatedAt },
    );
  },
};
