import type { Project } from "../project";
import type { ExecutiveServiceResult } from "./ExecutiveServiceResult";
import type { ExecutiveServiceType } from "./ExecutiveServiceType";

export interface ExecutiveService {
  readonly type: ExecutiveServiceType;
  execute(project: Project): Promise<ExecutiveServiceResult>;
}
