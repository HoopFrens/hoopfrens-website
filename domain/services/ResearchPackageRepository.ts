import type { BusinessObjectRepository } from "../business-object";
import type { EntityId } from "../shared";
import type { ResearchPackage } from "./ResearchPackage";

export interface ResearchPackageRepository extends BusinessObjectRepository<ResearchPackage> {
  getByProjectId(projectId: EntityId): Promise<ResearchPackage | null>;
  save(researchPackage: ResearchPackage): Promise<ResearchPackage>;
}
