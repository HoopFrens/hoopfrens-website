import { ArtifactStatus, ArtifactType, type BusinessObject } from "../business-object";
import type { ProjectType } from "../project";
import type { EntityId } from "../shared";
import { ExecutiveServiceType } from "./ExecutiveServiceType";

export interface OutlinePackage extends BusinessObject {
  artifactType: ArtifactType.OutlinePackage;
  status: ArtifactStatus;
  generatedByService: ExecutiveServiceType.Outline;
  workspaceId: EntityId;
  ownerId: EntityId;
  projectTitle: string;
  projectType: ProjectType;
  objective: string;
  audience: string;
  narrativeAngle: string;
  sections: string[];
  keyPoints: string[];
  productionRequirements: string[];
  recommendedNextStep: string;
}
