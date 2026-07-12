import { collection, doc, type Firestore, getDocs, query, setDoc, where } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { ProductionPackage } from "./ProductionPackage";
import type { ProductionPackageRepository } from "./ProductionPackageRepository";

const productionPackageConverter = createFirestoreConverter<ProductionPackage>();

function productionPackageDocument(db: Firestore, packageId: string) {
  return doc(db, "internalProductionPackages", packageId).withConverter(productionPackageConverter);
}

async function listByProjectId(db: Firestore, projectId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "internalProductionPackages").withConverter(productionPackageConverter),
      where("projectId", "==", projectId),
    ),
  );
  return snapshot.docs
    .map((item) => item.data())
    .sort((first, second) => second.version - first.version || Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
}

export function createFirestoreProductionPackageRepository(db: Firestore): ProductionPackageRepository {
  return {
    async getByProjectId(projectId) {
      const packages = await listByProjectId(db, projectId);
      return packages.find((productionPackage) => productionPackage.active !== false) || null;
    },

    async getLatestByProjectId(projectId) {
      return (await listByProjectId(db, projectId))[0] || null;
    },

    async save(productionPackage) {
      await setDoc(productionPackageDocument(db, productionPackage.id), productionPackage);
      return productionPackage;
    },
  };
}
