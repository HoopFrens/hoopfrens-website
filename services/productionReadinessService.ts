import { ArtifactStatus } from "@/domain/business-object";
import type { Project } from "@/domain/project";
import {
  ProductionReadinessStatus,
  type ProductionChecklistItem,
  type ProductionPackage,
  type ProductionReadinessResult,
} from "@/domain/services";

function incompleteRequiredItems(items: ProductionChecklistItem[]) {
  return items.filter((item) => item.required && !item.completed).map((item) => item.label);
}

export const productionReadinessService = {
  evaluate(
    project: Project,
    productionPackage: ProductionPackage | null,
    now = new Date(),
  ): ProductionReadinessResult {
    if (project.currentBlocker) {
      return {
        status: ProductionReadinessStatus.Blocked,
        reasons: [`Production is blocked by ${project.currentBlocker}.`],
        missingRequirements: [],
        checkedAt: now.toISOString(),
      };
    }

    if (!productionPackage) {
      return {
        status: ProductionReadinessStatus.NeedsProduction,
        reasons: ["A Production Package has not been generated."],
        missingRequirements: ["Production Package"],
        checkedAt: now.toISOString(),
      };
    }

    if (
      productionPackage.projectId !== project.id ||
      productionPackage.active === false ||
      !project.productionCompletedAt ||
      (project.activeProductionVersion !== undefined &&
        project.activeProductionVersion !== null &&
        project.activeProductionVersion !== productionPackage.version)
    ) {
      return {
        status: ProductionReadinessStatus.NeedsProduction,
        reasons: ["Production readiness requires the current project's active Production Package."],
        missingRequirements: ["Active Production Package"],
        checkedAt: now.toISOString(),
      };
    }

    const missingRequirements = [
      ...(!productionPackage.workingDraft.trim() ? ["Working Draft"] : []),
      ...incompleteRequiredItems(productionPackage.productionChecklist),
      ...incompleteRequiredItems(productionPackage.graphicsNeeded),
      ...incompleteRequiredItems(productionPackage.mediaChecklist),
      ...incompleteRequiredItems(productionPackage.publishingRequirements),
      ...incompleteRequiredItems(productionPackage.qaChecklist),
      ...(!productionPackage.nextRecommendedStep.trim() ? ["Next Recommended Step"] : []),
    ];
    const productionComplete = [ArtifactStatus.Ready, ArtifactStatus.Completed, ArtifactStatus.Approved].includes(
      productionPackage.status,
    );

    if (!productionComplete || missingRequirements.length > 0) {
      return {
        status: ProductionReadinessStatus.NeedsProduction,
        reasons: [
          ...(!productionComplete ? ["Production has not been marked complete."] : []),
          ...(missingRequirements.length > 0
            ? [`${missingRequirements.length} required production item${missingRequirements.length === 1 ? " remains" : "s remain"} incomplete.`]
            : []),
        ],
        missingRequirements,
        checkedAt: now.toISOString(),
      };
    }

    return {
      status: ProductionReadinessStatus.ReadyForReview,
      reasons: [
        "Production is complete.",
        "Required checklists, graphics, media, publishing fields, and QA are complete.",
      ],
      missingRequirements: [],
      checkedAt: now.toISOString(),
    };
  },
};
