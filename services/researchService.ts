import { ArtifactStatus, ArtifactType } from "@/domain/business-object";
import {
  ExecutiveServiceStatus,
  ExecutiveServiceType,
  type ExecutiveService,
  type ExecutiveServiceResult,
  type ResearchPackage,
  type ResearchPackageRepository,
} from "@/domain/services";
import type { Project, ProjectRepository } from "@/domain/project";
import { ProjectStatus } from "@/domain/shared";
import { createServiceArtifact } from "./executiveServiceHelpers";
import { projectWorkflowService } from "./projectWorkflowService";

function createResearchPackage(project: Project, createdAt: string, existingPackage: ResearchPackage | null): ResearchPackage {
  return {
    id: `research_${project.id}`,
    projectId: project.id,
    artifactType: ArtifactType.ResearchPackage,
    version: (existingPackage?.version || 0) + 1,
    status: ArtifactStatus.Completed,
    createdBy: project.ownerId,
    workspace: project.currentWorkspace,
    generatedByService: ExecutiveServiceType.Research,
    summary: `Verified research requirements and source plan for ${project.title}.`,
    metadata: {
      workspaceId: project.workspaceId,
      projectType: project.type || project.projectType,
    },
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    projectTitle: project.title,
    projectType: project.type || project.projectType,
    objective: `Establish the verified information needed to produce ${project.title}.`,
    researchChecklist: [
      "Confirm the project objective and intended audience",
      "Verify the core subject details",
      "Identify the relevant basketball program context",
      "Record information gaps for Founder review",
    ],
    informationNeeded: [
      "School and program overview",
      "Team identity and competitive level",
      "Coaching and facility information",
      "Recent performance and recruiting context",
    ],
    sourceChecklist: [
      "Official school website",
      "Official athletics website",
      "Team roster and schedule pages",
      "Admissions and financial aid pages",
      "Conference or association website",
    ],
    expectedDeliverables: [
      "Verified school profile",
      "Program facts and source notes",
      "Content angles",
      "Open questions",
    ],
    recommendedNextStep: "Create the project outline from the completed research package.",
    createdAt: existingPackage?.createdAt || createdAt,
    updatedAt: createdAt,
  };
}

export class ResearchService implements ExecutiveService {
  readonly type = ExecutiveServiceType.Research;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly researchPackageRepository: ResearchPackageRepository,
  ) {}

  async execute(project: Project): Promise<ExecutiveServiceResult> {
    const now = new Date().toISOString();
    const existingPackage = await this.researchPackageRepository.getByProjectId(project.id);
    const researchPackage = createResearchPackage(project, now, existingPackage);
    await this.researchPackageRepository.save(researchPackage);
    const updatedProject = await this.projectRepository.update(
      project.id,
      projectWorkflowService.createUpdate(project, "complete-research", now),
    );

    return {
      status: ExecutiveServiceStatus.Completed,
      artifacts: [createServiceArtifact(researchPackage, `${project.title} Research Package`)],
      recommendedNextAction: researchPackage.recommendedNextStep,
      updatedProjectState: ProjectStatus.Outline,
      updatedProject,
    };
  }
}
