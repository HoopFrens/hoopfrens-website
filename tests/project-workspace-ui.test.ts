import assert from "node:assert/strict";
import test from "node:test";
import { OutlinePackagePanel } from "@/components/executive/OutlinePackagePanel";
import {
  isPackageOverlayDismissKey,
  overlayFocusWrapIndex,
  PackageOverlayFrame,
  resolvePackageOverlayReturnFocus,
} from "@/components/executive/PackageOverlay";
import { ProductionPackagePanel } from "@/components/executive/ProductionPackagePanel";
import { ProjectDetailPanel } from "@/components/executive/ProjectDetailPanel";
import { ResearchPackagePanel } from "@/components/executive/ResearchPackagePanel";
import { ArtifactStatus, ArtifactType } from "@/domain/business-object";
import { ProjectType, ProjectWorkspace, type Project } from "@/domain/project";
import {
  ExecutiveServiceType,
  ProductionReadinessStatus,
  type OutlinePackage,
  type ProductionPackage,
  type ResearchPackage,
} from "@/domain/services";
import { Priority, ProjectStatus, Scope } from "@/domain/shared";
import {
  projectArtifactIntegrityService,
  projectWorkflowService,
  type ProjectArtifactIntegrityWarning,
} from "@/services";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const timestamp = "2026-07-11T18:00:00.000Z";

function createProject(state: ProjectStatus): Project {
  return {
    id: `project-${state}`,
    workspaceId: "executive-workspace",
    title: "Ashland University School Spotlight",
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    state,
    status: state,
    currentWorkspace: state === ProjectStatus.Production ? ProjectWorkspace.ProductionStudio : ProjectWorkspace.ExecutiveOffice,
    workspaceHistory: [{ workspace: ProjectWorkspace.ExecutiveOffice, enteredAt: timestamp, reason: "Test" }],
    stateHistory: [{ state, enteredAt: timestamp, reason: "Test" }],
    progressPercent: 70,
    priority: Priority.High,
    ownerId: "founder",
    dependencies: [],
    currentBlocker: null,
    currentStep: state === ProjectStatus.Approved ? "Publishing" : "Research",
    recommendedNextAction: state === ProjectStatus.Approved ? "Publish the approved project" : "Begin research",
    lastActivity: "Test",
    scope: Scope.Internal,
    contributorIds: [],
    knowledgeEntityIds: [],
    assetIds: [],
    decisionIds: [],
    sourceIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createResearchPackage(projectId: string): ResearchPackage {
  return {
    id: `research-${projectId}`,
    projectId,
    artifactType: ArtifactType.ResearchPackage,
    version: 1,
    status: ArtifactStatus.Completed,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "founder",
    workspace: ProjectWorkspace.IntelligenceCenter,
    generatedByService: ExecutiveServiceType.Research,
    summary: "Research summary",
    metadata: {},
    workspaceId: "executive-workspace",
    ownerId: "founder",
    projectTitle: "Ashland University School Spotlight",
    projectType: ProjectType.SchoolSpotlight,
    objective: "Research Ashland",
    researchChecklist: ["Program history"],
    informationNeeded: [],
    sourceChecklist: ["Official athletics site"],
    expectedDeliverables: ["Verified brief"],
    recommendedNextStep: "Create outline",
  };
}

function createOutlinePackage(projectId: string): OutlinePackage {
  return {
    id: `outline-${projectId}`,
    projectId,
    artifactType: ArtifactType.OutlinePackage,
    version: 1,
    status: ArtifactStatus.Approved,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "founder",
    workspace: ProjectWorkspace.ProductionStudio,
    generatedByService: ExecutiveServiceType.Outline,
    summary: "Outline summary",
    metadata: {},
    workspaceId: "executive-workspace",
    ownerId: "founder",
    projectTitle: "Ashland University School Spotlight",
    projectType: ProjectType.SchoolSpotlight,
    objective: "Produce the spotlight",
    audience: "Hoop Frens readers",
    narrativeAngle: "Community impact",
    sections: ["Opening", "Program profile"],
    keyPoints: ["Verified history"],
    productionRequirements: ["Approved copy"],
    recommendedNextStep: "Generate Production Package",
  };
}

function createProductionPackage(projectId: string): ProductionPackage {
  return {
    id: `production-${projectId}`,
    projectId,
    artifactType: ArtifactType.ProductionPackage,
    version: 1,
    status: ArtifactStatus.Ready,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "founder",
    workspace: ProjectWorkspace.ProductionStudio,
    generatedByService: ExecutiveServiceType.Production,
    summary: "Production summary",
    metadata: {},
    workspaceId: "executive-workspace",
    ownerId: "founder",
    projectTitle: "Ashland University School Spotlight",
    projectType: ProjectType.SchoolSpotlight,
    outlinePackageId: `outline-${projectId}`,
    workingDraft: "Completed working draft",
    productionChecklist: [],
    mediaChecklist: [],
    graphicsNeeded: [],
    publishingRequirements: [],
    qaChecklist: [],
    nextRecommendedStep: "Begin Founder Review",
    active: true,
  };
}

const readyForReview = {
  status: ProductionReadinessStatus.ReadyForReview,
  reasons: [],
  missingRequirements: [],
  checkedAt: timestamp,
};
const notReadyForReview = {
  status: ProductionReadinessStatus.NeedsProduction,
  reasons: [],
  missingRequirements: ["QA Checklist"],
  checkedAt: timestamp,
};

function renderProjectDetail(
  project: Project,
  artifactIntegrityWarning: ProjectArtifactIntegrityWarning | null = null,
) {
  return renderToStaticMarkup(createElement(ProjectDetailPanel, {
    project,
    priorityAssessment: null,
    ownerLabel: "Founder",
    actionPending: null,
    actionMessage: "",
    researchPackageLoading: false,
    outlinePackageLoading: false,
    productionPackageLoading: false,
    artifactIntegrityWarning,
    productionReadiness: notReadyForReview,
    servicePending: false,
    timelineEvents: [],
    timelineLoading: false,
    timelineError: "",
    onAction() {},
    onRunResearch() {},
    onRunOutline() {},
    onRunProduction() {},
    onOpenResearchPackage() {},
    onOpenOutlinePackage() {},
    onOpenProductionPackage() {},
    onClose() {},
  }));
}

test("disabled Review guidance comes from canonical workflow availability", () => {
  assert.equal(
    projectWorkflowService.availability(createProject(ProjectStatus.Draft), "review").reason,
    "Review is unavailable. Complete Research, Outline, and Production first.",
  );

  const production = { ...createProject(ProjectStatus.Production), productionCompletedAt: timestamp };
  assert.equal(
    projectWorkflowService.availability(production, "review", { productionReadiness: notReadyForReview }).reason,
    "Review is unavailable. Complete all production-readiness requirements first.",
  );
  assert.equal(
    projectWorkflowService.availability(createProject(ProjectStatus.Approved), "review").reason,
    "Review is unavailable because this project is already approved. The next available action is Publish.",
  );
  assert.equal(projectWorkflowService.availability(production, "review", { productionReadiness: readyForReview }).allowed, true);
});

test("Project Brief renders disabled Review reason without nesting package viewers", () => {
  const project = createProject(ProjectStatus.Draft);
  const markup = renderProjectDetail(project);

  assert.match(markup, /aria-describedby="project-action-review-reason"/);
  assert.match(markup, /Review is unavailable\. Complete Research, Outline, and Production first\./);
  assert.doesNotMatch(markup, /data-package-content=/);
});

test("package viewers render in one large, scroll-safe dialog frame", () => {
  const researchMarkup = renderToStaticMarkup(createElement(PackageOverlayFrame, {
    title: "Research Package",
    projectTitle: "Ashland University School Spotlight",
    status: "Completed",
    metadata: [{ label: "Version", value: "v1" }],
    titleId: "research-title",
    onClose() {},
  }, createElement(ResearchPackagePanel, {
      researchPackage: createResearchPackage("project-approved"),
      loading: false,
      message: "",
    })));
  const outlineMarkup = renderToStaticMarkup(createElement(PackageOverlayFrame, {
    title: "Outline Package",
    projectTitle: "Ashland University School Spotlight",
    status: "Approved",
    metadata: [],
    titleId: "outline-title",
    onClose() {},
  }, createElement(OutlinePackagePanel, {
      outlinePackage: createOutlinePackage("project-approved"),
      loading: false,
      message: "",
    })));
  const productionMarkup = renderToStaticMarkup(createElement(PackageOverlayFrame, {
    title: "Production Package",
    projectTitle: "Ashland University School Spotlight",
    status: "Ready",
    metadata: [],
    titleId: "production-title",
    onClose() {},
  }, createElement(ProductionPackagePanel, {
      productionPackage: createProductionPackage("project-approved"),
      readiness: readyForReview,
      loading: false,
      message: "",
      onBeginReview() {},
    })));

  for (const markup of [researchMarkup, outlineMarkup, productionMarkup]) {
    assert.match(markup, /role="dialog"/);
    assert.match(markup, /aria-modal="true"/);
    assert.match(markup, /max-w-\[1280px\]/);
    assert.match(markup, /overflow-x-hidden overflow-y-auto/);
    assert.equal((markup.match(/aria-label="Close /g) || []).length, 1);
  }
  assert.match(researchMarkup, /data-package-content="research"/);
  assert.match(outlineMarkup, /data-package-content="outline"/);
  assert.match(productionMarkup, /data-package-content="production"/);
});

test("package overlay Escape and Tab contracts close and trap focus", () => {
  assert.equal(isPackageOverlayDismissKey("Escape"), true);
  assert.equal(isPackageOverlayDismissKey("Enter"), false);
  assert.equal(overlayFocusWrapIndex(2, 3, false), 0);
  assert.equal(overlayFocusWrapIndex(0, 3, true), 2);
  assert.equal(overlayFocusWrapIndex(1, 3, false), null);

  const trigger = { id: "trigger", isConnected: true };
  const previous = { id: "previous", isConnected: true };
  assert.equal(resolvePackageOverlayReturnFocus(trigger, previous), trigger);
  assert.equal(resolvePackageOverlayReturnFocus({ ...trigger, isConnected: false }, previous), previous);
  assert.equal(
    resolvePackageOverlayReturnFocus(
      { ...trigger, isConnected: false },
      { ...previous, isConnected: false },
    ),
    null,
  );
});

test("legacy artifact warnings identify missing project-owned packages without substitution", () => {
  const approved = createProject(ProjectStatus.Approved);
  const warning = projectArtifactIntegrityService.evaluate(approved, {
    researchPackage: null,
    outlinePackage: createOutlinePackage(approved.id),
    productionPackage: createProductionPackage(approved.id),
  });
  assert.deepEqual(warning, {
    title: "Legacy project data incomplete.",
    message: "This project reached its current state before required artifact validation was introduced.",
    missingArtifacts: ["Research Package"],
  });
  const warningMarkup = renderProjectDetail(approved, warning);
  assert.match(warningMarkup, /Legacy project data incomplete\./);
  assert.match(warningMarkup, /Missing artifacts: Research Package\./);

  assert.equal(projectArtifactIntegrityService.evaluate(approved, {
    researchPackage: createResearchPackage(approved.id),
    outlinePackage: createOutlinePackage(approved.id),
    productionPackage: createProductionPackage(approved.id),
  }), null);

  assert.deepEqual(projectArtifactIntegrityService.evaluate(approved, {
    researchPackage: createResearchPackage("another-project"),
    outlinePackage: createOutlinePackage(approved.id),
    productionPackage: createProductionPackage(approved.id),
  })?.missingArtifacts, ["Research Package"]);
});
