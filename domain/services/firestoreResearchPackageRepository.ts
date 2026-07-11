import { doc, type Firestore, getDoc, setDoc } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { ResearchPackage } from "./ResearchPackage";
import type { ResearchPackageRepository } from "./ResearchPackageRepository";

const researchPackageConverter = createFirestoreConverter<ResearchPackage>();

function researchPackageDocument(db: Firestore, packageId: string) {
  return doc(db, "internalResearchPackages", packageId).withConverter(researchPackageConverter);
}

export function createFirestoreResearchPackageRepository(db: Firestore): ResearchPackageRepository {
  return {
    async getByProjectId(projectId) {
      const snapshot = await getDoc(researchPackageDocument(db, `research_${projectId}`));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async save(researchPackage) {
      await setDoc(researchPackageDocument(db, researchPackage.id), researchPackage);
      return researchPackage;
    },
  };
}
