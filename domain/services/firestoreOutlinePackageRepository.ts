import { doc, type Firestore, getDoc, setDoc } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { EntityId } from "../shared";
import type { OutlinePackage } from "./OutlinePackage";
import type { OutlinePackageRepository } from "./OutlinePackageRepository";

const outlinePackageConverter = createFirestoreConverter<OutlinePackage>();

function outlinePackageDocument(db: Firestore, projectId: EntityId) {
  return doc(db, "internalOutlinePackages", `outline_${projectId}`).withConverter(outlinePackageConverter);
}

export function createFirestoreOutlinePackageRepository(db: Firestore): OutlinePackageRepository {
  return {
    async getByProjectId(projectId) {
      const snapshot = await getDoc(outlinePackageDocument(db, projectId));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async save(outlinePackage) {
      await setDoc(outlinePackageDocument(db, outlinePackage.projectId), outlinePackage);
      return outlinePackage;
    },
  };
}
