import { collection, doc, type DocumentData, type Firestore, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { ProductionPackage } from "./ProductionPackage";
import type { ProductionPackageRepository } from "./ProductionPackageRepository";

const productionPackageConverter = createFirestoreConverter<ProductionPackage>();

function productionPackageDocument(db: Firestore, packageId: string) {
  return doc(db, "internalProductionPackages", packageId).withConverter(productionPackageConverter);
}

function factsIntegrityDocument(db: Firestore, packageId: string) {
  return doc(db, "internalSchoolSpotlightPackageFacts", packageId);
}

function factPartDocument(db: Firestore, packageId: string, part: 1 | 2) {
  return doc(db, `internalSchoolSpotlightPackageFacts${part === 1 ? "A" : "B"}`, `${packageId}-${part}`);
}

function contentIntegrityDocument(db: Firestore, packageId: string) {
  return doc(db, "internalSchoolSpotlightPackageContent", packageId);
}

function deliveryIntegrityDocument(db: Firestore, packageId: string) {
  return doc(db, "internalSchoolSpotlightPackageDelivery", packageId);
}

function requestIntegrityDocument(db: Firestore, packageId: string) {
  return doc(db, "internalSchoolSpotlightPackageRequest", packageId);
}

function customizationIntegrityDocument(db: Firestore, packageId: string) {
  return doc(db, "internalSchoolSpotlightPackageCustomization", packageId);
}

function withoutFields(data: DocumentData, fields: string[]) {
  const result = { ...data };
  for (const field of fields) delete result[field];
  return result;
}

async function hydratePackage(db: Firestore, stored: ProductionPackage & DocumentData): Promise<ProductionPackage> {
  if (stored.packageKind !== "school-spotlight"
    || stored.factsIntegrityId !== stored.id
    || stored.contentIntegrityId !== stored.id
    || stored.deliveryIntegrityId !== stored.id
    || stored.requestIntegrityId !== stored.id
    || stored.customizationIntegrityId !== stored.id) {
    return stored;
  }
  const [factsSnapshot, firstFactsSnapshot, secondFactsSnapshot, contentSnapshot, deliverySnapshot, requestSnapshot, customizationSnapshot] = await Promise.all([
    getDoc(factsIntegrityDocument(db, stored.id)),
    getDoc(factPartDocument(db, stored.id, 1)),
    getDoc(factPartDocument(db, stored.id, 2)),
    getDoc(contentIntegrityDocument(db, stored.id)),
    getDoc(deliveryIntegrityDocument(db, stored.id)),
    getDoc(requestIntegrityDocument(db, stored.id)),
    getDoc(customizationIntegrityDocument(db, stored.id)),
  ]);
  if (!factsSnapshot.exists() || !firstFactsSnapshot.exists() || !secondFactsSnapshot.exists()
    || !contentSnapshot.exists() || !deliverySnapshot.exists()
    || !requestSnapshot.exists() || !customizationSnapshot.exists()) {
    throw new Error("The saved School Spotlight package is incomplete and cannot be opened safely.");
  }
  const header = withoutFields(stored, [
    "factsIntegrityId", "contentIntegrityId", "deliveryIntegrityId",
    "requestIntegrityId", "customizationIntegrityId",
  ]);
  const facts = withoutFields(factsSnapshot.data(), [
    "packageId", "workspaceId", "ownerId", "selectedFactCount",
  ]);
  const verificationSources = Array.isArray(facts.verificationSources) ? facts.verificationSources : [];
  const storedFacts = [
    ...(firstFactsSnapshot.data().selectedFacts || []),
    ...(secondFactsSnapshot.data().selectedFacts || []),
  ];
  const selectedFacts = Array.isArray(storedFacts)
    ? storedFacts.map((fact: Record<string, unknown>) => {
        const { sourceIds, ...snapshot } = fact;
        return {
          ...snapshot,
          sources: Array.isArray(sourceIds)
            ? sourceIds.map((sourceId) => verificationSources.find((source: Record<string, unknown>) => source.sourceId === sourceId))
                .filter(Boolean)
            : [],
        };
      })
    : [];
  const content = withoutFields(contentSnapshot.data(), ["packageId", "workspaceId", "ownerId"]);
  const delivery = withoutFields(deliverySnapshot.data(), [
    "packageId", "workspaceId", "ownerId", "workflowDraftId",
  ]);
  const request = withoutFields(requestSnapshot.data(), [
    "packageId", "workspaceId", "ownerId", "workflowDraftId",
  ]);
  const customization = withoutFields(customizationSnapshot.data(), [
    "packageId", "workspaceId", "ownerId", "workflowDraftId",
  ]);
  const factFields = withoutFields(facts, [
    "verificationSourceIds", "selectedFactIds", "selectedFactPositions",
  ]);
  return {
    ...header,
    ...factFields,
    selectedFacts,
    ...content,
    ...delivery,
    ...request,
    ...customization,
  } as unknown as ProductionPackage;
}

async function listByProjectId(db: Firestore, projectId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "internalProductionPackages").withConverter(productionPackageConverter),
      where("projectId", "==", projectId),
    ),
  );
  return (await Promise.all(snapshot.docs
    .filter((item) => (item.data() as DocumentData).status !== "staged")
    .map((item) => hydratePackage(db, item.data()))))
    .sort((first, second) => second.version - first.version || Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
}

export function createFirestoreProductionPackageRepository(db: Firestore): ProductionPackageRepository {
  return {
    async getById(packageId) {
      const snapshot = await getDoc(productionPackageDocument(db, packageId));
      if (!snapshot.exists() || (snapshot.data() as DocumentData).status === "staged") return null;
      return hydratePackage(db, snapshot.data());
    },

    async getByProjectId(projectId) {
      const packages = await listByProjectId(db, projectId);
      return packages.find((productionPackage) => productionPackage.active !== false) || null;
    },

    async getLatestByProjectId(projectId) {
      return (await listByProjectId(db, projectId))[0] || null;
    },

    async save(productionPackage) {
      if ("packageKind" in productionPackage && productionPackage.packageKind === "school-spotlight") {
        throw new Error("School Spotlight packages must be saved with their exact project version.");
      }
      await setDoc(productionPackageDocument(db, productionPackage.id), productionPackage);
      return productionPackage;
    },
  };
}
