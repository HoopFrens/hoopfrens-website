import { doc, type Firestore, getDoc, setDoc } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { EntityId } from "../shared";
import type { ProductionPackage } from "./ProductionPackage";
import type { ProductionPackageRepository } from "./ProductionPackageRepository";

const productionPackageConverter = createFirestoreConverter<ProductionPackage>();

function productionPackageDocument(db: Firestore, projectId: EntityId) {
  return doc(db, "internalProductionPackages", `production_${projectId}`).withConverter(productionPackageConverter);
}

export function createFirestoreProductionPackageRepository(db: Firestore): ProductionPackageRepository {
  return {
    async getByProjectId(projectId) {
      const snapshot = await getDoc(productionPackageDocument(db, projectId));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async save(productionPackage) {
      await setDoc(productionPackageDocument(db, productionPackage.projectId), productionPackage);
      return productionPackage;
    },
  };
}
