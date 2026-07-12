import { ArtifactStatus, ArtifactType, type BusinessObject } from "../business-object";
import type { ProjectType } from "../project";
import type { EntityId } from "../shared";
import { ExecutiveServiceType } from "./ExecutiveServiceType";

export interface ProductionChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
}

export interface ProductionPackage extends BusinessObject {
  artifactType: ArtifactType.ProductionPackage;
  status: ArtifactStatus;
  generatedByService: ExecutiveServiceType.Production;
  workspaceId: EntityId;
  ownerId: EntityId;
  projectTitle: string;
  projectType: ProjectType;
  outlinePackageId: EntityId;
  workingDraft: string;
  productionChecklist: ProductionChecklistItem[];
  mediaChecklist: ProductionChecklistItem[];
  graphicsNeeded: ProductionChecklistItem[];
  publishingRequirements: ProductionChecklistItem[];
  qaChecklist: ProductionChecklistItem[];
  nextRecommendedStep: string;
  active?: boolean;
  supersededAt?: string;
}
