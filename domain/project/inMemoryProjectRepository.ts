import type { EntityId } from "../shared/types";
import type { ProjectMutationOptions, ProjectRepository } from "./repository";
import type { Project } from "./types";

export interface ProjectRepositoryStore {
  read(): Project[];
  write(projects: Project[]): void;
}

export function createVolatileProjectStore(initialProjects: Project[] = []): ProjectRepositoryStore {
  let projects = [...initialProjects];

  return {
    read() {
      return [...projects];
    },
    write(nextProjects) {
      projects = [...nextProjects];
    },
  };
}

export function createInMemoryProjectRepository(store: ProjectRepositoryStore = createVolatileProjectStore()): ProjectRepository {
  function applyUpdate(projectId: EntityId, projectUpdate: Partial<Project>, options?: ProjectMutationOptions) {
    const projects = store.read();
    const existingProject = projects.find((project) => project.id === projectId);

    if (!existingProject) throw new Error(`Project not found: ${projectId}`);
    if (options?.expectedUpdatedAt && existingProject.updatedAt !== options.expectedUpdatedAt) {
      throw new Error(`Project update conflict: ${projectId}`);
    }
    if (options?.expectedVersion !== undefined && (existingProject.version || 0) !== options.expectedVersion) {
      throw new Error(`Project update conflict: ${projectId}`);
    }

    const updatedProject = {
      ...existingProject,
      ...projectUpdate,
      version: (existingProject.version || 0) + 1,
    };

    store.write([updatedProject, ...projects.filter((project) => project.id !== projectId)]);
    return updatedProject;
  }

  return {
    async listByWorkspace(workspaceId: EntityId) {
      return store.read().filter((project) => project.workspaceId === workspaceId);
    },
    async getById(projectId: EntityId) {
      return store.read().find((project) => project.id === projectId) || null;
    },
    async create(project: Project) {
      const existingProject = store.read().find((candidate) => candidate.id === project.id);
      if (existingProject) return existingProject;
      const projects = store.read().filter((existingProject) => existingProject.id !== project.id);
      const createdProject = { ...project, version: project.version || 1 };
      store.write([createdProject, ...projects]);
      return createdProject;
    },
    async update(projectId: EntityId, projectUpdate: Partial<Project>, options?: ProjectMutationOptions) {
      return applyUpdate(projectId, projectUpdate, options);
    },
    async updateWithArtifacts(projectId, projectUpdate, _artifacts, options) {
      return applyUpdate(projectId, projectUpdate, options);
    },
  };
}
