import {
  collection,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  writeBatch,
} from "firebase/firestore";
import { executiveEventDocument } from "../event/firestoreExecutiveEventRepository";
import { createProjectHistoryEvents, createProjectUpdateEvents } from "../event/timelineEngine";
import type { EntityId } from "../shared/types";
import { projectConverter } from "./firestoreConverters";
import type { ProjectRepository } from "./repository";
import type { Project } from "./types";

function projectsCollection(db: Firestore, workspaceId: EntityId) {
  return query(collection(db, "internalProjects"), where("workspaceId", "==", workspaceId)).withConverter(projectConverter);
}

function projectDocument(db: Firestore, projectId: EntityId) {
  return doc(db, "internalProjects", projectId).withConverter(projectConverter);
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
      const batch = writeBatch(db);
      batch.set(projectDocument(db, project.id), project);
      for (const event of createProjectHistoryEvents(project, actorId || project.ownerId)) {
        batch.set(executiveEventDocument(db, event.id), event);
      }
      await batch.commit();
      return project;
    },

    async update(projectId: EntityId, projectUpdate: Partial<Project>) {
      return runTransaction(db, async (transaction) => {
        const documentReference = projectDocument(db, projectId);
        const snapshot = await transaction.get(documentReference);
        if (!snapshot.exists()) throw new Error(`Project not found: ${projectId}`);

        const existingProject = snapshot.data();
        const updatedProject = { ...existingProject, ...projectUpdate };
        transaction.set(documentReference, updatedProject);
        for (const event of createProjectUpdateEvents(existingProject, updatedProject, actorId || existingProject.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return updatedProject;
      });
    },
  };
}
