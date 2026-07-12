import { ExecutiveServiceType, type ExecutiveService, type ExecutiveServiceResult } from "@/domain/services";
import type { Project, ProjectRepository } from "@/domain/project";
import { ExecutiveServiceStatus } from "@/domain/services";
import { ProjectStatus } from "@/domain/shared";
import { projectWorkflowService } from "./projectWorkflowService";

export class PublishingService implements ExecutiveService {
  readonly type = ExecutiveServiceType.Publishing;

  constructor(private readonly projectRepository: ProjectRepository) {}

  async execute(project: Project): Promise<ExecutiveServiceResult> {
    const now = new Date().toISOString();
    const updatedProject = await this.projectRepository.update(
      project.id,
      projectWorkflowService.createUpdate(project, "publish", now),
      { expectedUpdatedAt: project.updatedAt },
    );
    return {
      status: ExecutiveServiceStatus.Completed,
      artifacts: [],
      recommendedNextAction: updatedProject.recommendedNextAction,
      updatedProjectState: ProjectStatus.Published,
      updatedProject,
    };
  }
}
