import type { Project } from "@/domain/project";
import { ProjectStatus } from "@/domain/shared";
import { ProductionReadinessStatus, type ProductionReadinessResult } from "@/domain/services";

const allowedTransitions: Record<ProjectStatus, readonly ProjectStatus[]> = {
  [ProjectStatus.Draft]: [ProjectStatus.Research],
  [ProjectStatus.Research]: [ProjectStatus.Outline],
  [ProjectStatus.Outline]: [ProjectStatus.Production],
  [ProjectStatus.Production]: [ProjectStatus.Review],
  [ProjectStatus.Review]: [ProjectStatus.Approved, ProjectStatus.Production],
  [ProjectStatus.Approved]: [ProjectStatus.Published],
  [ProjectStatus.Published]: [ProjectStatus.Archived],
  [ProjectStatus.Archived]: [],
};

function currentState(project: Project) {
  return project.state || project.status;
}

export interface LifecycleTransitionContext {
  productionReadiness?: ProductionReadinessResult | null;
}

export const projectLifecyclePolicy = {
  canTransition(from: ProjectStatus, to: ProjectStatus, context: LifecycleTransitionContext = {}) {
    if (!allowedTransitions[from].includes(to)) return false;
    if (from === ProjectStatus.Production && to === ProjectStatus.Review) {
      return context.productionReadiness?.status === ProductionReadinessStatus.ReadyForReview;
    }
    return true;
  },

  assertTransition(from: ProjectStatus, to: ProjectStatus, context: LifecycleTransitionContext = {}) {
    if (!this.canTransition(from, to, context)) {
      throw new Error(`Invalid project lifecycle transition: ${from} -> ${to}`);
    }
  },

  canProjectTransition(project: Project, to: ProjectStatus, context: LifecycleTransitionContext = {}) {
    if (currentState(project) === ProjectStatus.Production && to === ProjectStatus.Review && !project.productionCompletedAt) {
      return false;
    }
    return this.canTransition(currentState(project), to, context);
  },
};
