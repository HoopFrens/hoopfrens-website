import { doc, type Firestore, getDoc, setDoc } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { EntityId } from "../shared";
import type { ResearchPackage } from "./ResearchPackage";
import type { ResearchPackageRepository } from "./ResearchPackageRepository";

const researchPackageConverter = createFirestoreConverter<ResearchPackage>();

function researchPackageDocument(db: Firestore, projectId: EntityId) {
  return doc(db, "internalResearchPackages", `research_${projectId}`).withConverter(researchPackageConverter);
}

export function createFirestoreResearchPackageRepository(db: Firestore): ResearchPackageRepository {
  return {
    async getByProjectId(projectId) {
      const snapshot = await getDoc(researchPackageDocument(db, projectId));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async save(researchPackage) {
      await setDoc(researchPackageDocument(db, researchPackage.projectId), researchPackage);
      return researchPackage;
    },
  };
}
