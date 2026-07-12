import type { EntityId } from "../shared";
import type { BusinessObject } from "./BusinessObject";

export interface BusinessObjectRepository<TBusinessObject extends BusinessObject> {
  getByProjectId(projectId: EntityId): Promise<TBusinessObject | null>;
  save(businessObject: TBusinessObject): Promise<TBusinessObject>;
}
