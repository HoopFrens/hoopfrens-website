import { collection, doc, type Firestore, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { ExecutiveEvent } from "./ExecutiveEvent";
import type { ExecutiveEventRepository } from "./ExecutiveEventRepository";
import { sortExecutiveEvents } from "./timelineEngine";

const maximumBatchSize = 450;
export const executiveEventConverter = createFirestoreConverter<ExecutiveEvent>();

function executiveEventsCollection(db: Firestore) {
  return collection(db, "internalExecutiveEvents").withConverter(executiveEventConverter);
}

export function executiveEventDocument(db: Firestore, eventId: string) {
  return doc(db, "internalExecutiveEvents", eventId).withConverter(executiveEventConverter);
}

export function createFirestoreExecutiveEventRepository(db: Firestore): ExecutiveEventRepository {
  return {
    async listByWorkspace(workspaceId) {
      const snapshot = await getDocs(query(executiveEventsCollection(db), where("workspaceId", "==", workspaceId)));
      return sortExecutiveEvents(snapshot.docs.map((eventSnapshot) => eventSnapshot.data()));
    },

    async listByProject(projectId) {
      const snapshot = await getDocs(query(executiveEventsCollection(db), where("projectId", "==", projectId)));
      return sortExecutiveEvents(snapshot.docs.map((eventSnapshot) => eventSnapshot.data()));
    },

    async record(event) {
      await setDoc(executiveEventDocument(db, event.id), event);
      return event;
    },

    async recordMany(events) {
      for (let index = 0; index < events.length; index += maximumBatchSize) {
        const batch = writeBatch(db);
        for (const event of events.slice(index, index + maximumBatchSize)) {
          batch.set(executiveEventDocument(db, event.id), event);
        }
        await batch.commit();
      }
      return sortExecutiveEvents(events);
    },
  };
}
