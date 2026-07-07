import type { EntityId } from "../shared/types";
import type { Project } from "./types";

export interface ProjectRepository {
  listByWorkspace(workspaceId: EntityId): Promise<Project[]>;
  getById(projectId: EntityId): Promise<Project | null>;
  create(project: Project): Promise<Project>;
  update(projectId: EntityId, project: Partial<Project>): Promise<Project>;
}
