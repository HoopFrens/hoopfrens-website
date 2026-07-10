import { ExecutiveServiceType, type ExecutiveService, type ExecutiveServiceResult } from "@/domain/services";
import type { Project } from "@/domain/project";
import { createDeterministicServiceResult } from "./executiveServiceHelpers";

export class PublishingService implements ExecutiveService {
  readonly type = ExecutiveServiceType.Publishing;

  execute(project: Project): Promise<ExecutiveServiceResult> {
    return Promise.resolve(createDeterministicServiceResult(project, "Prepare approved work for publishing."));
  }
}
