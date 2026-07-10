import { ExecutiveServiceType, type ExecutiveService, type ExecutiveServiceResult } from "@/domain/services";
import type { Project } from "@/domain/project";
import { createDeterministicServiceResult } from "./executiveServiceHelpers";

export class ReviewService implements ExecutiveService {
  readonly type = ExecutiveServiceType.Review;

  execute(project: Project): Promise<ExecutiveServiceResult> {
    return Promise.resolve(createDeterministicServiceResult(project, "Complete Founder Review and decide whether to approve or revise."));
  }
}
