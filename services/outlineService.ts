import { ArtifactStatus, ArtifactType } from "@/domain/business-object";
import type { Project, ProjectRepository } from "@/domain/project";
import {
  ExecutiveServiceStatus,
  ExecutiveServiceType,
  type ExecutiveService,
  type ExecutiveServiceResult,
  type OutlinePackage,
  type OutlinePackageRepository,
  type ResearchPackageRepository,
} from "@/domain/services";
import { ProjectStatus } from "@/domain/shared";
import { createBlockedServiceResult, createServiceArtifact } from "./executiveServiceHelpers";
import { projectWorkflowService } from "./projectWorkflowService";

function createOutlinePackage(
  project: Project,
  researchPackageId: string,
  createdAt: string,
  existingPackage: OutlinePackage | null,
): OutlinePackage {
  return {
    id: `outline_${project.id}`,
    projectId: project.id,
    artifactType: ArtifactType.OutlinePackage,
    version: (existingPackage?.version || 0) + 1,
    status: ArtifactStatus.Approved,
    createdAt: existingPackage?.createdAt || createdAt,
    updatedAt: createdAt,
    createdBy: project.ownerId,
    workspace: project.currentWorkspace,
    generatedByService: ExecutiveServiceType.Outline,
    summary: `Approved editorial structure for ${project.title}.`,
    metadata: {
      workspaceId: project.workspaceId,
      projectType: project.type || project.projectType,
      researchPackageId,
    },
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    projectTitle: project.title,
    projectType: project.type || project.projectType,
    objective: `Turn the completed research into a clear ${project.type || project.projectType} narrative.`,
    audience: "Basketball players, families, coaches, and fans evaluating pathways beyond the usual spotlight.",
    narrativeAngle: `Explain why ${project.title} matters and what the audience should understand next.`,
    sections: [
      "Opening and project context",
      "Program identity and verified facts",
      "Basketball pathway and opportunity",
      "Key takeaways",
      "Next action",
    ],
    keyPoints: [
      "Lead with the project objective",
      "Use only verified research-package information",
      "Keep the basketball pathway clear",
      "Close with a useful next step",
    ],
    productionRequirements: [
      "Working draft",
      "Supporting media checklist",
      "Graphics requirements",
      "Publishing requirements",
      "Quality-assurance checklist",
    ],
    recommendedNextStep: "Generate the Production Package in Production Studio.",
  };
}

export class OutlineService implements ExecutiveService {
  readonly type = ExecutiveServiceType.Outline;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly researchPackageRepository: ResearchPackageRepository,
    private readonly outlinePackageRepository: OutlinePackageRepository,
  ) {}

  async execute(project: Project): Promise<ExecutiveServiceResult> {
    const researchPackage = await this.researchPackageRepository.getByProjectId(project.id);
    if (!researchPackage) {
      return createBlockedServiceResult(project, "Complete the Research Package before generating an outline.");
    }

    const now = new Date().toISOString();
    const existingPackage = await this.outlinePackageRepository.getByProjectId(project.id);
    const outlinePackage = createOutlinePackage(project, researchPackage.id, now, existingPackage);
    const updatedProject = await this.projectRepository.updateWithArtifacts(
      project.id,
      projectWorkflowService.createUpdate(project, "complete-outline", now),
      [outlinePackage],
      { expectedUpdatedAt: project.updatedAt },
    );

    return {
      status: ExecutiveServiceStatus.Completed,
      artifacts: [createServiceArtifact(outlinePackage, `${project.title} Outline Package`)],
      recommendedNextAction: outlinePackage.recommendedNextStep,
      updatedProjectState: ProjectStatus.Production,
      updatedProject,
    };
  }
}
