import type { Project } from "../project";
import type { ProductionPackage } from "../services";
import { ProjectStatus } from "../shared";
import {
  FounderWorkflowKind,
  FounderWorkflowStatus,
  FounderWorkflowStep,
  type FounderWorkflowDraft,
  type FounderWorkflowDraftUpdate,
  type SchoolSpotlightPackage,
} from "./types";

function isSchoolSpotlightPackage(value: ProductionPackage | null): value is SchoolSpotlightPackage {
  return Boolean(value && "packageKind" in value && value.packageKind === FounderWorkflowKind.SchoolSpotlight);
}

function exactPackageBelongsToDraft(
  draft: FounderWorkflowDraft,
  project: Project,
  productionPackage: ProductionPackage | null,
): productionPackage is SchoolSpotlightPackage {
  return Boolean(
    isSchoolSpotlightPackage(productionPackage)
      && productionPackage.workflowDraftId === draft.id
      && productionPackage.projectId === project.id
      && draft.projectId === project.id,
  );
}

/**
 * Derives only the Founder-draft repair that is justified by an exact canonical
 * project/package binding. It never advances the canonical project lifecycle.
 */
export function reconcileFounderWorkflowDraft(
  draft: FounderWorkflowDraft,
  project: Project,
  productionPackage: ProductionPackage | null,
): FounderWorkflowDraftUpdate | null {
  if (!exactPackageBelongsToDraft(draft, project, productionPackage)) return null;

  const projectState = project.state || project.status;
  const isExactActivePackage = project.activeSchoolSpotlightPackageId === productionPackage.id
    && project.activeProductionVersion === productionPackage.version;

  if (projectState === ProjectStatus.Approved) {
    const isExactApprovedPackage = project.approvedSchoolSpotlightPackageId === productionPackage.id
      && project.approvedSchoolSpotlightPackageVersion === productionPackage.version;
    if (!isExactActivePackage || !isExactApprovedPackage) return null;

    if (draft.status === FounderWorkflowStatus.Completed
      && draft.step === FounderWorkflowStep.Approve
      && draft.currentPackageId === productionPackage.id
      && draft.currentPackageVersion === productionPackage.version) return null;

    return {
      status: FounderWorkflowStatus.Completed,
      step: FounderWorkflowStep.Approve,
      currentPackageId: productionPackage.id,
      currentPackageVersion: productionPackage.version,
    };
  }

  if (projectState !== ProjectStatus.Review || !isExactActivePackage) return null;
  if (draft.step === FounderWorkflowStep.Approve
    && draft.currentPackageId === productionPackage.id
    && draft.currentPackageVersion === productionPackage.version) return null;

  return {
    status: FounderWorkflowStatus.Active,
    step: FounderWorkflowStep.Approve,
    currentPackageId: productionPackage.id,
    currentPackageVersion: productionPackage.version,
  };
}
