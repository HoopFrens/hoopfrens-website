import {
  collection,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { ArtifactType, type BusinessObject } from "../business-object";
import { executiveEventDocument } from "../event/firestoreExecutiveEventRepository";
import { createProjectHistoryEvents, createProjectUpdateEvents } from "../event/timelineEngine";
import type { EntityId } from "../shared/types";
import { projectConverter } from "./firestoreConverters";
import type { ProjectMutationOptions, ProjectRepository } from "./repository";
import type { Project } from "./types";

function projectsCollection(db: Firestore, workspaceId: EntityId) {
  return query(collection(db, "internalProjects"), where("workspaceId", "==", workspaceId)).withConverter(projectConverter);
}

function projectDocument(db: Firestore, projectId: EntityId) {
  return doc(db, "internalProjects", projectId).withConverter(projectConverter);
}

const artifactCollections: Record<ArtifactType, string> = {
  [ArtifactType.ResearchPackage]: "internalResearchPackages",
  [ArtifactType.OutlinePackage]: "internalOutlinePackages",
  [ArtifactType.ProductionPackage]: "internalProductionPackages",
  [ArtifactType.ReviewPackage]: "internalReviewPackages",
  [ArtifactType.PublishingPackage]: "internalPublishingPackages",
};

function artifactDocument(db: Firestore, artifact: BusinessObject) {
  return doc(db, artifactCollections[artifact.artifactType], artifact.id);
}

function assertCurrentVersion(project: Project, options?: ProjectMutationOptions) {
  if (options?.expectedUpdatedAt && project.updatedAt !== options.expectedUpdatedAt) {
    throw new Error(`Project update conflict: ${project.id}`);
  }
  if (options?.expectedVersion !== undefined && (project.version || 0) !== options.expectedVersion) {
    throw new Error(`Project update conflict: ${project.id}`);
  }
}

function mergeHistory<T extends { enteredAt: string; reason: string }>(current: T[] = [], incoming: T[] = []) {
  const entries = new Map(current.map((entry) => [`${entry.enteredAt}:${entry.reason}:${JSON.stringify(entry)}`, entry]));
  for (const entry of incoming) entries.set(`${entry.enteredAt}:${entry.reason}:${JSON.stringify(entry)}`, entry);
  return Array.from(entries.values()).sort((first, second) => Date.parse(first.enteredAt) - Date.parse(second.enteredAt));
}

function mergeProjectUpdate(existingProject: Project, projectUpdate: Partial<Project>): Project {
  return {
    ...existingProject,
    ...projectUpdate,
    workspaceHistory: mergeHistory(existingProject.workspaceHistory, projectUpdate.workspaceHistory),
    stateHistory: mergeHistory(existingProject.stateHistory, projectUpdate.stateHistory),
    version: (existingProject.version || 0) + 1,
  };
}

export function createFirestoreProjectRepository(db: Firestore, actorId?: EntityId): ProjectRepository {
  return {
    async listByWorkspace(workspaceId: EntityId) {
      const snapshot = await getDocs(projectsCollection(db, workspaceId));
      return snapshot.docs.map((projectSnapshot) => projectSnapshot.data());
    },

    async getById(projectId: EntityId) {
      const snapshot = await getDoc(projectDocument(db, projectId));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async create(project: Project) {
      return runTransaction(db, async (transaction) => {
        const reference = projectDocument(db, project.id);
        const existingSnapshot = await transaction.get(reference);
        if (existingSnapshot.exists()) return existingSnapshot.data();

        const createdProject = { ...project, version: project.version || 1 };
        transaction.set(reference, createdProject);
        for (const event of createProjectHistoryEvents(createdProject, actorId || project.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return createdProject;
      });
    },

    async update(projectId: EntityId, projectUpdate: Partial<Project>, options?: ProjectMutationOptions) {
      return runTransaction(db, async (transaction) => {
        const documentReference = projectDocument(db, projectId);
        const snapshot = await transaction.get(documentReference);
        if (!snapshot.exists()) throw new Error(`Project not found: ${projectId}`);

        const existingProject = snapshot.data();
        assertCurrentVersion(existingProject, options);
        const updatedProject = mergeProjectUpdate(existingProject, projectUpdate);
        transaction.set(documentReference, updatedProject);
        for (const event of createProjectUpdateEvents(existingProject, updatedProject, actorId || existingProject.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return updatedProject;
      });
    },

    async updateWithArtifacts(projectId, projectUpdate, artifacts, options) {
      return runTransaction(db, async (transaction) => {
        const documentReference = projectDocument(db, projectId);
        const snapshot = await transaction.get(documentReference);
        if (!snapshot.exists()) throw new Error(`Project not found: ${projectId}`);

        const existingProject = snapshot.data();
        assertCurrentVersion(existingProject, options);
        const updatedProject = mergeProjectUpdate(existingProject, projectUpdate);
        transaction.set(documentReference, updatedProject);
        for (const artifact of artifacts) transaction.set(artifactDocument(db, artifact), artifact);
        for (const event of createProjectUpdateEvents(existingProject, updatedProject, actorId || existingProject.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return updatedProject;
      });
    },
  };
}
