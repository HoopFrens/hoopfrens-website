import type { Priority, ProjectStatus, Region, Scope } from "../shared/enums";
import type { EntityId, ISODateString } from "../shared/types";

export interface Project {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  summary?: string;
  status: ProjectStatus;
  priority: Priority;
  region?: Region;
  scope: Scope;
  ownerId: EntityId;
  contributorIds: EntityId[];
  knowledgeEntityIds: EntityId[];
  assetIds: EntityId[];
  decisionIds: EntityId[];
  sourceIds: EntityId[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
