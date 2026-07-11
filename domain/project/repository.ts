import type { BusinessObject } from "../business-object";
import type { EntityId } from "../shared/types";
import type { Project } from "./types";

export interface ProjectMutationOptions {
  expectedUpdatedAt?: string;
  expectedVersion?: number;
}

export interface ProjectRepository {
  listByWorkspace(workspaceId: EntityId): Promise<Project[]>;
  getById(projectId: EntityId): Promise<Project | null>;
  create(project: Project): Promise<Project>;
  update(projectId: EntityId, project: Partial<Project>, options?: ProjectMutationOptions): Promise<Project>;
  updateWithArtifacts(
    projectId: EntityId,
    project: Partial<Project>,
    artifacts: BusinessObject[],
    options?: ProjectMutationOptions,
  ): Promise<Project>;
}
