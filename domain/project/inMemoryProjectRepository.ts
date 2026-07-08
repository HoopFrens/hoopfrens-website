import type { EntityId } from "../shared/types";
import type { ProjectRepository } from "./repository";
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
  return {
    async listByWorkspace(workspaceId: EntityId) {
      return store.read().filter((project) => project.workspaceId === workspaceId);
    },
    async getById(projectId: EntityId) {
      return store.read().find((project) => project.id === projectId) || null;
    },
    async create(project: Project) {
      const projects = store.read().filter((existingProject) => existingProject.id !== project.id);
      store.write([project, ...projects]);
      return project;
    },
    async update(projectId: EntityId, projectUpdate: Partial<Project>) {
      const projects = store.read();
      const existingProject = projects.find((project) => project.id === projectId);

      if (!existingProject) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const updatedProject = {
        ...existingProject,
        ...projectUpdate,
      };

      store.write([updatedProject, ...projects.filter((project) => project.id !== projectId)]);
      return updatedProject;
    },
  };
}
