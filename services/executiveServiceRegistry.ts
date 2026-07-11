import {
  ExecutiveServiceType,
  type ExecutiveService,
  type ExecutiveServiceResult,
  type OutlinePackageRepository,
  type ProductionPackageRepository,
  type ResearchPackageRepository,
} from "@/domain/services";
import type { Project, ProjectRepository } from "@/domain/project";
import { ProjectStatus } from "@/domain/shared";
import { OutlineService } from "./outlineService";
import { ProductionService } from "./productionService";
import { PublishingService } from "./publishingService";
import { ResearchService } from "./researchService";
import { ReviewService } from "./reviewService";

const serviceByProjectState: Partial<Record<ProjectStatus, ExecutiveServiceType>> = {
  [ProjectStatus.Draft]: ExecutiveServiceType.Research,
  [ProjectStatus.Research]: ExecutiveServiceType.Research,
  [ProjectStatus.Outline]: ExecutiveServiceType.Outline,
  [ProjectStatus.Production]: ExecutiveServiceType.Production,
  [ProjectStatus.Review]: ExecutiveServiceType.Review,
  [ProjectStatus.Approved]: ExecutiveServiceType.Publishing,
};

export class ExecutiveServiceRegistry {
  private readonly services = new Map<ExecutiveServiceType, ExecutiveService>();

  register(service: ExecutiveService) {
    this.services.set(service.type, service);
    return this;
  }

  resolve(project: Project) {
    const serviceType = serviceByProjectState[project.state || project.status];
    return serviceType ? this.services.get(serviceType) || null : null;
  }

  execute(project: Project): Promise<ExecutiveServiceResult> {
    const service = this.resolve(project);
    if (!service) throw new Error(`No executive service is registered for project state: ${project.state || project.status}`);
    return service.execute(project);
  }

  registeredServices() {
    return Array.from(this.services.keys());
  }
}

type ExecutiveServiceRegistryDependencies = {
  projectRepository: ProjectRepository;
  researchPackageRepository: ResearchPackageRepository;
  outlinePackageRepository: OutlinePackageRepository;
  productionPackageRepository: ProductionPackageRepository;
};

export function createExecutiveServiceRegistry({
  projectRepository,
  researchPackageRepository,
  outlinePackageRepository,
  productionPackageRepository,
}: ExecutiveServiceRegistryDependencies) {
  return new ExecutiveServiceRegistry()
    .register(new ResearchService(projectRepository, researchPackageRepository))
    .register(new OutlineService(projectRepository, researchPackageRepository, outlinePackageRepository))
    .register(new ProductionService(projectRepository, outlinePackageRepository, productionPackageRepository))
    .register(new ReviewService())
    .register(new PublishingService(projectRepository));
}
