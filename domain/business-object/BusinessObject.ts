import type { ProjectWorkspace } from "../project";
import type { ExecutiveServiceType } from "../services/ExecutiveServiceType";
import type { EntityId, ISODateString } from "../shared";
import type { ArtifactStatus } from "./ArtifactStatus";
import type { ArtifactType } from "./ArtifactType";

export type BusinessObjectMetadataValue = string | number | boolean | null | string[] | number[] | boolean[];
export type BusinessObjectMetadata = Record<string, BusinessObjectMetadataValue>;

export interface BusinessObject {
  id: EntityId;
  projectId: EntityId;
  artifactType: ArtifactType;
  version: number;
  status: ArtifactStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: EntityId;
  workspace: ProjectWorkspace;
  generatedByService: ExecutiveServiceType;
  summary: string;
  metadata: BusinessObjectMetadata;
}
