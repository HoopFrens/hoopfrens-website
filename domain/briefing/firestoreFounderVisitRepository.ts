import { doc, type Firestore, runTransaction } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { FounderVisit } from "./FounderVisit";
import type { FounderVisitRepository } from "./FounderVisitRepository";
import { resolveFounderVisit } from "./founderVisitSession";

const founderVisitConverter = createFirestoreConverter<FounderVisit>();

function founderVisitDocument(db: Firestore, userId: string) {
  return doc(db, "internalFounderVisits", userId).withConverter(founderVisitConverter);
}

export function createFirestoreFounderVisitRepository(db: Firestore): FounderVisitRepository {
  return {
    recordVisit(userId, workspaceId, visitedAt) {
      return runTransaction(db, async (transaction) => {
        const documentReference = founderVisitDocument(db, userId);
        const snapshot = await transaction.get(documentReference);
        const registration = resolveFounderVisit(snapshot.exists() ? snapshot.data() : null, userId, workspaceId, visitedAt);
        transaction.set(documentReference, registration.visit);
        return registration;
      });
    },
  };
}
