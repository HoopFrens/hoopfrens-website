import type { BusinessObjectRepository } from "../business-object";
import type { ProductionPackage } from "./ProductionPackage";

export interface ProductionPackageRepository extends BusinessObjectRepository<ProductionPackage> {
  getById(packageId: string): Promise<ProductionPackage | null>;
  getLatestByProjectId(projectId: string): Promise<ProductionPackage | null>;
}
