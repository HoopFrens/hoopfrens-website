import type { Project } from "../project";
import type { ProjectStatus } from "../shared";
import type { ExecutiveServiceArtifact } from "./ExecutiveServiceArtifact";
import type { ExecutiveServiceStatus } from "./ExecutiveServiceStatus";

export interface ExecutiveServiceResult {
  status: ExecutiveServiceStatus;
  artifacts: ExecutiveServiceArtifact[];
  recommendedNextAction: string;
  updatedProjectState: ProjectStatus;
  updatedProject: Project;
}
