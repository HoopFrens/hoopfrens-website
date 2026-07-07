import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { ProductionPackage } from "../shared/types";
import type { Asset } from "./types";

export const assetConverter = createFirestoreConverter<Asset>();
export const productionPackageConverter = createFirestoreConverter<ProductionPackage>();
