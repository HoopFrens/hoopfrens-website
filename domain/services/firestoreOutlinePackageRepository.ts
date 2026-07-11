import { doc, type Firestore, getDoc, setDoc } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { OutlinePackage } from "./OutlinePackage";
import type { OutlinePackageRepository } from "./OutlinePackageRepository";

const outlinePackageConverter = createFirestoreConverter<OutlinePackage>();

function outlinePackageDocument(db: Firestore, packageId: string) {
  return doc(db, "internalOutlinePackages", packageId).withConverter(outlinePackageConverter);
}

export function createFirestoreOutlinePackageRepository(db: Firestore): OutlinePackageRepository {
  return {
    async getByProjectId(projectId) {
      const snapshot = await getDoc(outlinePackageDocument(db, `outline_${projectId}`));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async save(outlinePackage) {
      await setDoc(outlinePackageDocument(db, outlinePackage.id), outlinePackage);
      return outlinePackage;
    },
  };
}
