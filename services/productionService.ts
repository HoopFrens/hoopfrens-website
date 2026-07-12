import { ArtifactStatus, ArtifactType } from "@/domain/business-object";
import { ProjectWorkspace, type Project, type ProjectRepository } from "@/domain/project";
import {
  ExecutiveServiceStatus,
  ExecutiveServiceType,
  type ExecutiveService,
  type ExecutiveServiceResult,
  type OutlinePackageRepository,
  type ProductionChecklistItem,
  type ProductionPackage,
  type ProductionPackageRepository,
} from "@/domain/services";
import { ProjectStatus } from "@/domain/shared";
import { createBlockedServiceResult, createServiceArtifact } from "./executiveServiceHelpers";
import { projectWorkflowService } from "./projectWorkflowService";

function checklist(prefix: string, labels: string[]): ProductionChecklistItem[] {
  return labels.map((label, index) => ({
    id: `${prefix}-${index + 1}`,
    label,
    required: true,
    completed: true,
  }));
}

function createProductionPackage(
  project: Project,
  outlinePackageId: string,
  createdAt: string,
  latestPackage: ProductionPackage | null,
): ProductionPackage {
  return {
    id: `production_${project.id}_v${(latestPackage?.version || 0) + 1}`,
    projectId: project.id,
    artifactType: ArtifactType.ProductionPackage,
    version: (latestPackage?.version || 0) + 1,
    status: ArtifactStatus.Ready,
    createdAt,
    updatedAt: createdAt,
    createdBy: project.ownerId,
    workspace: ProjectWorkspace.ProductionStudio,
    generatedByService: ExecutiveServiceType.Production,
    summary: `Review-ready Production Package for ${project.title}.`,
    metadata: {
      workspaceId: project.workspaceId,
      projectType: project.type || project.projectType,
      outlinePackageId,
      productionComplete: true,
    },
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    projectTitle: project.title,
    projectType: project.type || project.projectType,
    outlinePackageId,
    workingDraft: [
      project.title,
      "",
      `Opening: Introduce the purpose and basketball context of ${project.title}.`,
      "",
      "Core story: Present the verified program facts, pathway, and opportunity in the approved outline order.",
      "",
      "Close: Summarize the key takeaway and direct the audience to the next useful action.",
    ].join("\n"),
    productionChecklist: checklist("production", [
      "Working draft follows the approved outline",
      "Verified facts are represented accurately",
      "Audience and project objective remain clear",
    ]),
    mediaChecklist: checklist("media", [
      "Confirm available school and program media",
      "Identify required captions and credits",
    ]),
    graphicsNeeded: checklist("graphics", [
      "Feature graphic with project title",
      "Program identity graphic or approved mark",
    ]),
    publishingRequirements: checklist("publishing", [
      "Final title and summary",
      "Approved media credits",
      "Destination and publishing owner",
    ]),
    qaChecklist: checklist("qa", [
      "Check names, facts, and basketball terminology",
      "Confirm links and source references",
      "Review formatting and accessibility",
    ]),
    nextRecommendedStep: "Begin Founder Review.",
    active: true,
  };
}

export class ProductionService implements ExecutiveService {
  readonly type = ExecutiveServiceType.Production;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly outlinePackageRepository: OutlinePackageRepository,
    private readonly productionPackageRepository: ProductionPackageRepository,
  ) {}

  async execute(project: Project): Promise<ExecutiveServiceResult> {
    const outlinePackage = await this.outlinePackageRepository.getByProjectId(project.id);
    if (!outlinePackage || outlinePackage.status !== ArtifactStatus.Approved) {
      return createBlockedServiceResult(project, "An approved Outline Package is required before production can begin.");
    }

    const now = new Date().toISOString();
    const latestPackage = await this.productionPackageRepository.getLatestByProjectId(project.id);
    const productionPackage = createProductionPackage(project, outlinePackage.id, now, latestPackage);
    const supersededPackage = latestPackage && latestPackage.active !== false
      ? { ...latestPackage, active: false, supersededAt: now, updatedAt: now }
      : null;
    const updatedProject = await this.projectRepository.updateWithArtifacts(
      project.id,
      {
        ...projectWorkflowService.createUpdate(project, "complete-production", now),
        activeProductionVersion: productionPackage.version,
      },
      supersededPackage ? [supersededPackage, productionPackage] : [productionPackage],
      { expectedUpdatedAt: project.updatedAt },
    );

    return {
      status: ExecutiveServiceStatus.Completed,
      artifacts: [createServiceArtifact(productionPackage, `${project.title} Production Package`)],
      recommendedNextAction: productionPackage.nextRecommendedStep,
      updatedProjectState: ProjectStatus.Production,
      updatedProject,
    };
  }
}
