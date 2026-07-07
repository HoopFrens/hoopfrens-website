import type { EntityId, Project } from "@/types/workspace";
import { foundationOnly, type ServiceResult } from "./serviceResult";

export const projectService = {
  listByWorkspace(workspaceId: EntityId): ServiceResult<Project[]> {
    void workspaceId;
    return foundationOnly<Project[]>("projectService.listByWorkspace");
  },

  getById(projectId: EntityId): ServiceResult<Project> {
    void projectId;
    return foundationOnly<Project>("projectService.getById");
  },
};
