import { ArtifactStatus, ArtifactType, type BusinessObject } from "../business-object";
import type { ProjectType } from "../project";
import type { EntityId } from "../shared";
import { ExecutiveServiceType } from "./ExecutiveServiceType";

export interface ResearchPackage extends BusinessObject {
  artifactType: ArtifactType.ResearchPackage;
  status: ArtifactStatus;
  generatedByService: ExecutiveServiceType.Research;
  workspaceId: EntityId;
  ownerId: EntityId;
  projectTitle: string;
  projectType: ProjectType;
  objective: string;
  researchChecklist: string[];
  informationNeeded: string[];
  sourceChecklist: string[];
  expectedDeliverables: string[];
  recommendedNextStep: string;
}
