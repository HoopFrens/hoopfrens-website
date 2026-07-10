import type { BusinessObject } from "@/domain/business-object";
import type { ExecutiveServiceArtifact, ExecutiveServiceResult } from "@/domain/services";
import { ExecutiveServiceStatus } from "@/domain/services";
import type { Project } from "@/domain/project";

export function createServiceArtifact(artifact: BusinessObject, title: string): ExecutiveServiceArtifact {
  return {
    ...artifact,
    title,
    referenceId: artifact.id,
  };
}

export function createBlockedServiceResult(project: Project, recommendedNextAction: string): ExecutiveServiceResult {
  return {
    status: ExecutiveServiceStatus.Blocked,
    artifacts: [],
    recommendedNextAction,
    updatedProjectState: project.state || project.status,
    updatedProject: project,
  };
}

export function createDeterministicServiceResult(project: Project, recommendedNextAction: string): ExecutiveServiceResult {
  return {
    status: ExecutiveServiceStatus.Completed,
    artifacts: [],
    recommendedNextAction,
    updatedProjectState: project.state || project.status,
    updatedProject: {
      ...project,
      recommendedNextAction,
    },
  };
}
