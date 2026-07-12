import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { ProductionPackage } from "../services/ProductionPackage";
import type { Asset } from "./types";

export const assetConverter = createFirestoreConverter<Asset>();
export const productionPackageConverter = createFirestoreConverter<ProductionPackage>();
