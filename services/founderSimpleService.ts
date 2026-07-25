import { ArtifactStatus, ArtifactType } from "@/domain/business-object";
import {
  FounderWorkflowKind,
  FounderWorkflowStatus,
  FounderWorkflowStep,
  FounderWorkflowValidationError,
  type FounderWorkflowDraft,
  type FounderWorkflowDraftCreateInput,
  type GuidedSchoolDraft,
  type SchoolSpotlightCustomization,
  type SchoolSpotlightFact,
  type SchoolSpotlightPackage,
  type SchoolSpotlightRequest,
  type SpotlightFactSnapshot,
  type SpotlightSourceEvidence,
  SpotlightBrandingPreset,
  SpotlightFactStatus,
  SpotlightLength,
  SpotlightPlatform,
  SpotlightTone,
  assertFactSelectionIsSafe,
  assertSchoolSpotlightPackageApprovable,
  validateSchoolSpotlightPackage,
} from "@/domain/founder-simple";
import {
  buildManualKnowledgeSource,
  isSchoolKnowledgeNode,
  KnowledgeCategory,
  KnowledgeConfidence,
  type KnowledgeGraph,
  type KnowledgeGraphRepository,
  type KnowledgeNode,
  type KnowledgeSchoolBundleCreateInput,
  type KnowledgeSchoolBundleResult,
  KnowledgeValidationError,
  KnowledgeNodeType,
  KnowledgeSourceReliability,
  KnowledgeStatus,
} from "@/domain/knowledge";
import type { Project, ProjectRepository } from "@/domain/project";
import { ProjectType, ProjectWorkspace } from "@/domain/project";
import {
  type OutlinePackageRepository,
  type ProductionChecklistItem,
  type ProductionPackage,
  type ProductionPackageRepository,
  type ResearchPackageRepository,
  ExecutiveServiceType,
} from "@/domain/services";
import {
  formatHoopFrensRegion,
  hoopFrensRegionForState,
  normalizeUSStateCode,
  Priority,
  ProjectStatus,
  Scope,
  usStateName,
} from "@/domain/shared";
import { OutlineService } from "./outlineService";
import { productionReadinessService } from "./productionReadinessService";
import { projectWorkflowService, createInitialProjectStateHistory } from "./projectWorkflowService";
import { ResearchService } from "./researchService";

const workspaceId = "executive-workspace";

export type FounderSchoolSubmissionField =
  | "officialName"
  | "city"
  | "state"
  | "schoolWebsite"
  | "athleticsWebsite";

export type FounderSchoolSubmissionErrorCode =
  | "missing-field"
  | "invalid-url"
  | "environment-permission"
  | "archived-school"
  | "geography-conflict"
  | "knowledge-integrity"
  | "unexpected";

export class FounderSchoolSubmissionError extends Error {
  constructor(
    readonly code: FounderSchoolSubmissionErrorCode,
    message: string,
    readonly field?: FounderSchoolSubmissionField,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FounderSchoolSubmissionError";
  }
}

export type FounderPackageReviewErrorCode =
  | "exact-version-missing"
  | "exact-version-linkage"
  | "package-persistence"
  | "review-transition";

export class FounderPackageReviewError extends Error {
  constructor(
    readonly code: FounderPackageReviewErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FounderPackageReviewError";
  }
}

function isSchoolSpotlightProductionPackage(
  value: ProductionPackage | null,
): value is SchoolSpotlightPackage {
  return Boolean(
    value
      && "packageKind" in value
      && value.packageKind === FounderWorkflowKind.SchoolSpotlight,
  );
}

function activePackageLabel(project: Project) {
  return Number.isInteger(project.activeProductionVersion)
    ? `Package version ${project.activeProductionVersion}`
    : "The active package version";
}

export async function loadExactActiveSchoolSpotlightPackage(
  repository: ProductionPackageRepository,
  project: Project,
  expectedWorkflowDraftId?: string,
): Promise<SchoolSpotlightPackage | null> {
  const packageId = project.activeSchoolSpotlightPackageId;
  const packageVersion = project.activeProductionVersion;
  if (!packageId && (packageVersion === undefined || packageVersion === null)) return null;
  if (project.productionReadinessInvalidatedAt && packageId && packageVersion === null) return null;

  const label = activePackageLabel(project);
  if (!packageId || !Number.isInteger(packageVersion) || Number(packageVersion) < 1) {
    throw new FounderPackageReviewError(
      "exact-version-linkage",
      `${label} is not linked correctly to this School Spotlight project. No new version was created. Reopen this work and contact a Headquarters administrator.`,
    );
  }

  const storedPackage = await repository.getById(packageId);
  if (!storedPackage) {
    throw new FounderPackageReviewError(
      "exact-version-missing",
      `${label} is linked to this project, but Headquarters cannot find that saved version. No new version was created. Reopen this work and contact a Headquarters administrator if it remains unavailable.`,
    );
  }

  const linkageMismatches = !isSchoolSpotlightProductionPackage(storedPackage)
    ? ["package-kind"]
    : [
        storedPackage.id === packageId ? null : "package-id",
        storedPackage.projectId === project.id ? null : "project-id",
        storedPackage.workspaceId === project.workspaceId ? null : "workspace",
        storedPackage.ownerId === project.ownerId ? null : "owner",
        storedPackage.version === packageVersion ? null : "version",
        storedPackage.active !== false ? null : "active-status",
        project.knowledgeEntityIds.includes(storedPackage.schoolId) ? null : "school",
        !project.creationRequestId
          || project.creationRequestId === storedPackage.workflowDraftId
          || project.creationRequestId === `founder-simple-${storedPackage.workflowDraftId}`
          ? null
          : "project-request",
        !expectedWorkflowDraftId || expectedWorkflowDraftId === storedPackage.workflowDraftId
          ? null
          : "workflow-draft",
      ].filter((value): value is string => Boolean(value));
  if (linkageMismatches.length) {
    throw new FounderPackageReviewError(
      "exact-version-linkage",
      `${label} does not match this School Spotlight project. No new version was created. Reopen this work and contact a Headquarters administrator.`,
      { cause: new Error(`Exact package linkage mismatch: ${linkageMismatches.join(", ")}`) },
    );
  }

  try {
    return validateSchoolSpotlightPackage(storedPackage as SchoolSpotlightPackage);
  } catch (error) {
    throw new FounderPackageReviewError(
      "exact-version-linkage",
      `${label} is incomplete and cannot be opened safely. No new version was created. Reopen this work and contact a Headquarters administrator.`,
      { cause: error },
    );
  }
}

function compactId(value: string) {
  return value.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function firebaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "").replace(/^firestore\//, "");
}

function validatedFounderWebsite(
  value: string | undefined,
  field: Extract<FounderSchoolSubmissionField, "schoolWebsite" | "athleticsWebsite">,
  label: string,
) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported protocol");
  } catch {
    throw new FounderSchoolSubmissionError(
      "invalid-url",
      `${label} is not a complete website address. Enter an address beginning with http:// or https://, then review the School again.`,
      field,
    );
  }
  return normalized;
}

function founderSchoolRepositoryError(error: unknown, officialName: string): FounderSchoolSubmissionError {
  if (error instanceof FounderSchoolSubmissionError) return error;
  if (firebaseErrorCode(error) === "permission-denied") {
    return new FounderSchoolSubmissionError(
      "environment-permission",
      "Headquarters does not have permission to save this School in the connected environment. Confirm you are signed in with an approved administrator account and that the current Headquarters Firestore rules are deployed, then choose Add School again.",
      undefined,
      { cause: error },
    );
  }
  if (error instanceof KnowledgeValidationError) {
    if (/archived node|historical knowledge identity/i.test(error.message)) {
      return new FounderSchoolSubmissionError(
        "archived-school",
        `${officialName} already has archived Headquarters information. Reopen the existing School in Knowledge Center before continuing.`,
        undefined,
        { cause: error },
      );
    }
    if (/geography relationship|State and State Node|Region and Region Node/i.test(error.message)) {
      return new FounderSchoolSubmissionError(
        "geography-conflict",
        `${officialName} has different State or Region information in Headquarters. Review the existing School in Knowledge Center before trying again.`,
        undefined,
        { cause: error },
      );
    }
    return new FounderSchoolSubmissionError(
      "knowledge-integrity",
      `${officialName} could not be saved because its canonical Headquarters information conflicts with an existing record. Review the matching School in Knowledge Center before trying again.`,
      undefined,
      { cause: error },
    );
  }
  return new FounderSchoolSubmissionError(
    "unexpected",
    "Headquarters could not save this School. Try again once. If the problem continues, ask an administrator to review the Add School console detail.",
    undefined,
    { cause: error },
  );
}

function completeChecklist(prefix: string, labels: string[]): ProductionChecklistItem[] {
  return labels.map((label, index) => ({
    id: `${prefix}-${index + 1}`,
    label,
    required: true,
    completed: true,
  }));
}

export function emptySchoolSpotlightRequest(): SchoolSpotlightRequest {
  return {
    objective: "",
    goals: [],
    audience: "",
    audiences: [],
    platforms: [SpotlightPlatform.InstagramReel, SpotlightPlatform.TikTok, SpotlightPlatform.YouTubeShort],
    centralEmphasis: "",
    availableMedia: [],
    media: [],
    needShotList: false,
    callToAction: "Learn more through the School's official channels.",
  };
}

export function emptySchoolSpotlightCustomization(): SchoolSpotlightCustomization {
  return {
    tone: SpotlightTone.ClearAndConfident,
    length: SpotlightLength.Standard,
    hook: "",
    emphasis: "",
    callToAction: "",
    mediaAvailability: [],
    brandingPreset: SpotlightBrandingPreset.Headquarters,
    verticalVideoScript: "",
    instagramCaption: "",
    shotList: [],
    rightsConfirmed: false,
  };
}

export function createSchoolSpotlightDraftInput(
  id: string,
  ownerId: string,
): FounderWorkflowDraftCreateInput {
  return {
    id,
    workspaceId,
    ownerId,
    kind: FounderWorkflowKind.SchoolSpotlight,
    step: FounderWorkflowStep.Request,
    status: FounderWorkflowStatus.Active,
    request: emptySchoolSpotlightRequest(),
    facts: [],
    customization: emptySchoolSpotlightCustomization(),
  };
}

function factStatus(graph: KnowledgeGraph, sourceIds: string[], confidence: KnowledgeConfidence) {
  if (confidence === KnowledgeConfidence.Conflicting) return SpotlightFactStatus.Conflicting;
  if ([KnowledgeConfidence.Inferred, KnowledgeConfidence.Unverified].includes(confidence)) {
    return SpotlightFactStatus.NeedsConfirmation;
  }
  const sources = graph.sources.filter((source) => sourceIds.includes(source.id) && source.status === KnowledgeStatus.Active);
  if (confidence === KnowledgeConfidence.Verified
    && sources.some((source) => source.reliability === KnowledgeSourceReliability.Official)) {
    return SpotlightFactStatus.Verified;
  }
  return sources.length > 0 ? SpotlightFactStatus.Supported : SpotlightFactStatus.NeedsConfirmation;
}

function schoolFact(
  graph: KnowledgeGraph,
  school: Extract<KnowledgeNode, { type: KnowledgeNodeType.School }>,
  id: string,
  category: string,
  label: string,
  value: string | undefined,
  sourceIds = school.sourceIds,
  confidence = school.confidence,
  position = 0,
): SchoolSpotlightFact {
  const normalized = value?.trim();
  const status = normalized ? factStatus(graph, sourceIds, confidence) : SpotlightFactStatus.NotAvailable;
  return {
    id,
    category,
    label,
    ...(normalized ? { value: normalized } : {}),
    status,
    confidence,
    sourceIds: normalized ? [...sourceIds] : [],
    included: status === SpotlightFactStatus.Verified || status === SpotlightFactStatus.Supported,
    position,
  };
}

export function deriveSchoolSpotlightFacts(graph: KnowledgeGraph, schoolId: string): SchoolSpotlightFact[] {
  const node = graph.nodes.find((candidate) => candidate.id === schoolId);
  if (!node || !isSchoolKnowledgeNode(node) || node.status !== KnowledgeStatus.Active) return [];
  const money = (amount: number | undefined) => amount === undefined
    ? undefined
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  const tuition = [
    node.tuition?.inState === undefined ? null : `In-state ${money(node.tuition.inState)}`,
    node.tuition?.outOfState === undefined ? null : `Out-of-state ${money(node.tuition.outOfState)}`,
  ].filter(Boolean).join(" · ") || undefined;

  return [
    schoolFact(graph, node, "official-name", "Identity", "Official Name", node.officialName, undefined, undefined, 1),
    schoolFact(graph, node, "nickname", "Identity", "Nickname", node.nickname, undefined, undefined, 2),
    schoolFact(graph, node, "location", "Location", "Location", `${node.city}, ${node.state}`, undefined, undefined, 3),
    schoolFact(graph, node, "region", "Location", "Hoop Frens Region", formatHoopFrensRegion(node.region), undefined, undefined, 4),
    schoolFact(graph, node, "division", "Basketball", "Division", node.division, undefined, undefined, 5),
    schoolFact(graph, node, "governing-body", "Basketball", "Governing Body", node.governingBody, undefined, undefined, 6),
    schoolFact(graph, node, "conference", "Basketball", "Conference", node.conference?.name, undefined, undefined, 7),
    schoolFact(graph, node, "facilities", "Basketball", "Facilities", node.facilities.map((item) => item.name).join(", ") || undefined, undefined, undefined, 8),
    schoolFact(graph, node, "coaches", "Basketball", "Coaches", node.coaches.map((item) => item.name).join(", ") || undefined, undefined, undefined, 9),
    schoolFact(graph, node, "enrollment", "School", "Enrollment", node.enrollment?.toLocaleString(), undefined, undefined, 10),
    schoolFact(graph, node, "tuition", "School", "Tuition", tuition, undefined, undefined, 11),
    schoolFact(graph, node, "school-website", "Links", "School Website", node.schoolWebsite, undefined, undefined, 12),
    schoolFact(graph, node, "athletics-website", "Links", "Athletics Website", node.athleticsWebsite, undefined, undefined, 13),
    schoolFact(graph, node, "recruiting-notes", "Recruiting", "Recruiting Notes", node.recruitingNotes.join(" ") || undefined, undefined, undefined, 14),
  ];
}

function sourceEvidence(graph: KnowledgeGraph, sourceIds: string[]): SpotlightSourceEvidence[] {
  return graph.sources.filter((source) => sourceIds.includes(source.id) && source.status === KnowledgeStatus.Active)
    .map((source) => ({
      sourceId: source.id,
      sourceVersion: source.version,
      title: source.title,
      ...(source.publisher ? { publisher: source.publisher } : {}),
      reliability: source.reliability,
      accessedAt: source.accessedAt,
    }));
}

export function assembleSchoolSpotlightPackage(
  draft: FounderWorkflowDraft,
  graph: KnowledgeGraph,
  school: Extract<KnowledgeNode, { type: KnowledgeNodeType.School }>,
  project: Project,
  latestPackage: ProductionPackage | null,
  createdAt = new Date().toISOString(),
): SchoolSpotlightPackage {
  assertFactSelectionIsSafe(draft.facts);
  const selectedFacts: SpotlightFactSnapshot[] = draft.facts
    .filter((fact) => fact.included)
    .sort((first, second) => first.position - second.position)
    .map((fact) => ({
      id: fact.id,
      category: fact.category,
      label: fact.label,
      value: fact.founderText?.trim() || fact.value?.trim() || "",
      status: fact.status,
      founderAuthored: Boolean(fact.founderText?.trim()),
      sources: sourceEvidence(graph, fact.sourceIds),
      position: fact.position,
    }));
  const version = (latestPackage?.version || 0) + 1;
  const hook = draft.customization.hook.trim() || `Meet ${school.officialName}.`;
  const callToAction = draft.customization.callToAction.trim() || draft.request.callToAction.trim();
  const factLines = selectedFacts.map((fact) => `${fact.label}: ${fact.value}`);
  const scenes = selectedFacts.map((fact, index) => ({
    id: `scene-${index + 2}`,
    heading: fact.label,
    narration: fact.value,
    visualDirection: `Use approved ${fact.label.toLowerCase()} media or a Hoop Frens fact card.`,
  }));
  const verticalVideoScript = draft.customization.verticalVideoScript.trim() || [hook, ...factLines, callToAction].filter(Boolean).join("\n\n");
  const instagramCaption = draft.customization.instagramCaption.trim() || [hook, ...factLines, callToAction].filter(Boolean).join("\n\n");
  const shotList = draft.customization.shotList.length > 0 ? draft.customization.shotList : [
    "School or campus establishing shot",
    "Basketball facility exterior and court",
    "Approved team or program detail",
    "Hoop Frens closing card",
  ];
  const evidence = sourceEvidence(graph, [...new Set(selectedFacts.flatMap((fact) => fact.sources.map((source) => source.sourceId)))]);
  const unresolvedWarnings = draft.facts
    .filter((fact) => [SpotlightFactStatus.Conflicting, SpotlightFactStatus.NeedsConfirmation].includes(fact.status)
      && !fact.founderText?.trim())
    .map((fact) => `${fact.label} remains outside the package until supporting information is confirmed.`);
  const spotlightPackage: SchoolSpotlightPackage = {
    id: `production_${project.id}_v${version}`,
    projectId: project.id,
    artifactType: ArtifactType.ProductionPackage,
    version,
    status: ArtifactStatus.Ready,
    createdAt,
    updatedAt: createdAt,
    createdBy: project.ownerId,
    workspace: ProjectWorkspace.ProductionStudio,
    generatedByService: ExecutiveServiceType.Production,
    summary: `Review-ready School Spotlight package for ${school.officialName}.`,
    metadata: {
      workspaceId: project.workspaceId,
      projectType: ProjectType.SchoolSpotlight,
      schoolId: school.id,
      workflowDraftId: draft.id,
      productionComplete: true,
    },
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    projectTitle: project.title,
    projectType: ProjectType.SchoolSpotlight,
    outlinePackageId: `outline_${project.id}`,
    workingDraft: verticalVideoScript,
    productionChecklist: completeChecklist("spotlight-production", [
      "Selected facts are represented in the package",
      "Vertical-video structure and Instagram caption are complete",
    ]),
    mediaChecklist: completeChecklist("spotlight-media", ["Photo and video shot list is complete"]),
    graphicsNeeded: completeChecklist("spotlight-graphics", ["Hoop Frens brand treatment is selected"]),
    publishingRequirements: [{
      id: "spotlight-rights-confirmed",
      label: "Media rights are confirmed",
      required: true,
      completed: draft.customization.rightsConfirmed,
    }],
    qaChecklist: completeChecklist("spotlight-qa", [
      "Unsupported facts remain excluded or explicitly Founder-authored",
      "Source and verification package is attached",
    ]),
    nextRecommendedStep: "Review the exact package version and approve it or request changes.",
    active: true,
    packageKind: FounderWorkflowKind.SchoolSpotlight,
    workflowDraftId: draft.id,
    schoolId: school.id,
    request: draft.request,
    customization: draft.customization,
    selectedFacts,
    excludedFactIds: draft.facts.filter((fact) => !fact.included).map((fact) => fact.id),
    unresolvedWarnings,
    verticalVideo: {
      title: `${school.officialName} School Spotlight`,
      hook,
      scenes: [
        { id: "scene-1", heading: "Hook", narration: hook, visualDirection: "Open with approved School or basketball media." },
        ...scenes,
        { id: `scene-${scenes.length + 2}`, heading: "Next Step", narration: callToAction, visualDirection: "Close with an approved Hoop Frens card." },
      ],
      callToAction,
    },
    instagramCaption,
    shotList,
    verificationSources: evidence,
    rightsConfirmed: draft.customization.rightsConfirmed,
    changeSummary: latestPackage ? `Created version ${version} from Founder revisions.` : "Created the first Founder review version.",
    ...(latestPackage ? { previousPackageId: latestPackage.id } : {}),
  };
  return validateSchoolSpotlightPackage(spotlightPackage);
}

export async function addSchoolFromFounderReview(
  repository: KnowledgeGraphRepository,
  input: GuidedSchoolDraft,
  actorId: string,
): Promise<KnowledgeSchoolBundleResult> {
  const officialName = input.officialName.trim();
  const stateCode = normalizeUSStateCode(input.state);
  const stateName = usStateName(input.state);
  const region = hoopFrensRegionForState(input.state);
  const schoolWebsite = validatedFounderWebsite(input.schoolWebsite, "schoolWebsite", "School Website");
  const athleticsWebsite = validatedFounderWebsite(input.athleticsWebsite, "athleticsWebsite", "Athletics Website");
  const sourceUrl = athleticsWebsite || schoolWebsite;
  if (!officialName) {
    throw new FounderSchoolSubmissionError(
      "missing-field",
      "Add the School's official name before continuing.",
      "officialName",
    );
  }
  if (!input.city.trim()) {
    throw new FounderSchoolSubmissionError(
      "missing-field",
      "Add the School's city before continuing.",
      "city",
    );
  }
  if (!stateCode || !stateName || !region) {
    throw new FounderSchoolSubmissionError(
      "missing-field",
      "Choose the School's state from the approved list before continuing.",
      "state",
    );
  }
  if (!sourceUrl) {
    throw new FounderSchoolSubmissionError(
      "missing-field",
      "Add a School Website or Athletics Website beginning with http:// or https:// before continuing.",
      "schoolWebsite",
    );
  }
  const baseId = compactId(officialName);
  const sourceId = `source-${baseId}-${stableHash(sourceUrl)}`;
  const regionName = formatHoopFrensRegion(region);
  const bundle: KnowledgeSchoolBundleCreateInput = {
    source: buildManualKnowledgeSource({
      id: sourceId,
      workspaceId,
      title: `${officialName} Official Website`,
      url: sourceUrl,
      publisher: officialName,
      sourceType: "official",
      accessedAt: new Date().toISOString(),
      publishedAt: "",
      reliability: KnowledgeSourceReliability.Official,
      notes: "Founder confirmed this official source during guided School review.",
      projectIds: [],
    }),
    stateNode: {
      id: `state-${stateCode.toLowerCase()}`,
      workspaceId,
      type: KnowledgeNodeType.State,
      category: KnowledgeCategory.Geography,
      name: stateName,
      description: `${stateName} location used for verified Hoop Frens School information.`,
      confidence: KnowledgeConfidence.Supported,
      aliases: [],
      tags: [],
    },
    regionNode: {
      id: `region-${compactId(regionName)}`,
      workspaceId,
      type: KnowledgeNodeType.Region,
      category: KnowledgeCategory.Geography,
      name: regionName,
      description: `${regionName} location used for verified Hoop Frens School information.`,
      confidence: KnowledgeConfidence.Supported,
      aliases: [],
      tags: [],
    },
    schoolNode: {
      id: `school-${baseId}`,
      workspaceId,
      type: KnowledgeNodeType.School,
      category: KnowledgeCategory.Institution,
      name: officialName,
      description: `${officialName} in ${input.city.trim()}, ${stateName}.`,
      confidence: KnowledgeConfidence.Verified,
      aliases: [],
      tags: [stateCode.toLowerCase(), region],
      officialName,
      city: input.city.trim(),
      state: stateName,
      region,
      conference: null,
      ...(input.division?.trim() ? { division: input.division.trim() } : {}),
      ...(input.governingBody?.trim() ? { governingBody: input.governingBody.trim() } : {}),
      ...(schoolWebsite ? { schoolWebsite } : {}),
      ...(athleticsWebsite ? { athleticsWebsite } : {}),
      facilities: [],
      coaches: [],
      recruitingNotes: [],
      connectedProjectIds: [],
      connectedContentIds: [],
      lastVerifiedAt: new Date().toISOString(),
    },
    stateRelationship: {
      description: `${officialName} is located in ${stateName}.`,
      confidence: KnowledgeConfidence.Verified,
      projectIds: [],
    },
    regionRelationship: {
      description: `${officialName} is in the ${regionName} Hoop Frens region.`,
      confidence: KnowledgeConfidence.Verified,
      projectIds: [],
    },
    reasons: {
      source: `Founder confirmed the official source for ${officialName}.`,
      stateNode: `Connected ${officialName} to ${stateName}.`,
      regionNode: `Connected ${officialName} to ${regionName}.`,
      schoolNode: `Founder added ${officialName} through guided School review.`,
      stateRelationship: `Founder confirmed ${officialName}'s state.`,
      regionRelationship: `Founder confirmed ${officialName}'s Hoop Frens region.`,
    },
  };
  try {
    return await repository.createSchoolBundle(bundle, {
      actorId,
      reason: `Founder confirmed the canonical School bundle for ${officialName}.`,
    });
  } catch (error) {
    throw founderSchoolRepositoryError(error, officialName);
  }
}

export async function createOrResumeSchoolSpotlightProject(
  repository: ProjectRepository,
  draft: FounderWorkflowDraft,
  school: Extract<KnowledgeNode, { type: KnowledgeNodeType.School }>,
  actorId: string,
) {
  const projects = await repository.listByWorkspace(draft.workspaceId);
  const creationRequestId = `founder-simple-${draft.id}`;
  const exactDraftProject = projects.find((project) => (
    (project.type || project.projectType) === ProjectType.SchoolSpotlight
    && (project.creationRequestId === creationRequestId || project.creationRequestId === draft.id)
    && ![ProjectStatus.Published, ProjectStatus.Archived].includes(project.state || project.status)
  ));
  if (exactDraftProject) {
    if (!exactDraftProject.knowledgeEntityIds.includes(school.id)) {
      throw new FounderWorkflowValidationError(
        "This Spotlight request is already connected to another School. Return to Create and start a new Spotlight to choose a different School.",
      );
    }
    return exactDraftProject;
  }

  const resumableStates = [
    ProjectStatus.Draft,
    ProjectStatus.Research,
    ProjectStatus.Outline,
    ProjectStatus.Production,
  ];
  const existing = projects.find((project) => (
    (project.type || project.projectType) === ProjectType.SchoolSpotlight
    && !project.creationRequestId
    && project.knowledgeEntityIds.includes(school.id)
    && resumableStates.includes(project.state || project.status)
  ));
  if (existing) return existing;
  const now = new Date().toISOString();
  return repository.create({
    id: `project-${draft.id}`,
    creationRequestId,
    workspaceId: draft.workspaceId,
    title: `${school.officialName} School Spotlight`,
    type: ProjectType.SchoolSpotlight,
    projectType: ProjectType.SchoolSpotlight,
    currentWorkspace: ProjectWorkspace.IntelligenceCenter,
    workspace: "Intelligence Center",
    workspaceHistory: [
      { workspace: ProjectWorkspace.ExecutiveOffice, enteredAt: now, reason: "Founder requested a School Spotlight" },
      { workspace: ProjectWorkspace.IntelligenceCenter, enteredAt: now, reason: "Information review opened" },
    ],
    stateHistory: createInitialProjectStateHistory(now),
    state: ProjectStatus.Draft,
    status: ProjectStatus.Draft,
    progressPercent: 10,
    priority: Priority.Medium,
    scope: Scope.Internal,
    ownerId: actorId,
    dependencies: [],
    currentBlocker: null,
    contributorIds: [],
    knowledgeEntityIds: [school.id],
    assetIds: [],
    decisionIds: [],
    sourceIds: [...school.sourceIds],
    createdAt: now,
    updatedAt: now,
    completedSoFar: ["School selected", "Spotlight request saved"],
    currentStep: "Review School information",
    remainingNextStep: "Review School information",
    recommendedNextAction: "Choose the verified facts to include",
    lastActivity: "School Spotlight requested",
  });
}

type PrepareForReviewInput = {
  projectRepository: ProjectRepository;
  researchPackageRepository: ResearchPackageRepository;
  outlinePackageRepository: OutlinePackageRepository;
  productionPackageRepository: ProductionPackageRepository;
  project: Project;
  spotlightPackage: SchoolSpotlightPackage;
};

export async function prepareSchoolSpotlightForReview(input: PrepareForReviewInput) {
  let project = input.project;
  const projectRequestMatches = !project.creationRequestId
    || project.creationRequestId === input.spotlightPackage.workflowDraftId
    || project.creationRequestId === `founder-simple-${input.spotlightPackage.workflowDraftId}`;
  const linkageMatches = input.spotlightPackage.projectId === project.id
    && input.spotlightPackage.workspaceId === project.workspaceId
    && input.spotlightPackage.ownerId === project.ownerId
    && project.knowledgeEntityIds.includes(input.spotlightPackage.schoolId)
    && projectRequestMatches;
  if (!linkageMatches) {
    throw new FounderPackageReviewError(
      "exact-version-linkage",
      "This Spotlight package does not match the selected School and saved request. No new version was created. Return to Create and reopen the correct Spotlight.",
    );
  }
  if ([ProjectStatus.Draft, ProjectStatus.Research].includes(project.state || project.status)) {
    project = (await new ResearchService(input.projectRepository, input.researchPackageRepository).execute(project)).updatedProject!;
  }
  if ((project.state || project.status) === ProjectStatus.Outline) {
    project = (await new OutlineService(
      input.projectRepository,
      input.researchPackageRepository,
      input.outlinePackageRepository,
    ).execute(project)).updatedProject!;
  }
  if ((project.state || project.status) !== ProjectStatus.Production) {
    throw new Error("Complete the current project step before opening Founder Review.");
  }
  const existingActivePackage = await loadExactActiveSchoolSpotlightPackage(
    input.productionPackageRepository,
    project,
    input.spotlightPackage.workflowDraftId,
  );
  const revisionRequiresNewVersion = Boolean(project.productionReadinessInvalidatedAt);
  if (existingActivePackage && !revisionRequiresNewVersion) {
    const readiness = productionReadinessService.evaluate(project, existingActivePackage);
    try {
      return await input.projectRepository.update(
        project.id,
        projectWorkflowService.createUpdate(
          project,
          "review",
          new Date().toISOString(),
          { productionReadiness: readiness },
        ),
        { expectedUpdatedAt: project.updatedAt },
      );
    } catch (error) {
      throw new FounderPackageReviewError(
        "review-transition",
        `Package version ${existingActivePackage.version} is saved. Choose Review Exact Version again to safely continue with this same version.`,
        { cause: error },
      );
    }
  }
  const productionCompletedAt = new Date().toISOString();
  const previous = await input.productionPackageRepository.getLatestByProjectId(project.id);
  if (isSchoolSpotlightProductionPackage(previous)
    && previous.active !== false
    && previous.id !== existingActivePackage?.id
    && !(revisionRequiresNewVersion && previous.id === project.activeSchoolSpotlightPackageId)) {
    throw new FounderPackageReviewError(
      "exact-version-linkage",
      "Headquarters found an active School Spotlight package that is not linked correctly to this project. No new version was created. Reopen this work and contact a Headquarters administrator.",
    );
  }
  const superseded = previous && previous.active !== false
    ? { ...previous, active: false, supersededAt: productionCompletedAt, updatedAt: productionCompletedAt }
    : null;
  try {
    project = await input.projectRepository.updateWithArtifacts(
      project.id,
      {
        ...projectWorkflowService.createUpdate(project, "complete-production", productionCompletedAt),
        activeProductionVersion: input.spotlightPackage.version,
        activeSchoolSpotlightPackageId: input.spotlightPackage.id,
      },
      superseded ? [superseded, input.spotlightPackage] : [input.spotlightPackage],
      { expectedUpdatedAt: project.updatedAt },
    );
  } catch (error) {
    throw new FounderPackageReviewError(
      "package-persistence",
      `Package version ${input.spotlightPackage.version} could not be saved. Your current work remains saved. Choose Review Exact Version to try again.`,
      { cause: error },
    );
  }
  const readiness = productionReadinessService.evaluate(project, input.spotlightPackage);
  try {
    project = await input.projectRepository.update(
      project.id,
      projectWorkflowService.createUpdate(project, "review", new Date().toISOString(), { productionReadiness: readiness }),
      { expectedUpdatedAt: project.updatedAt },
    );
  } catch (error) {
    throw new FounderPackageReviewError(
      "review-transition",
      `Package version ${input.spotlightPackage.version} is saved. Choose Review Exact Version again to safely continue with this same version.`,
      { cause: error },
    );
  }
  return project;
}

export async function approveExactSchoolSpotlightPackage(
  repository: ProjectRepository,
  project: Project,
  spotlightPackage: SchoolSpotlightPackage,
) {
  assertSchoolSpotlightPackageApprovable(spotlightPackage);
  if ((project.state || project.status) !== ProjectStatus.Review
    || project.activeProductionVersion !== spotlightPackage.version
    || project.activeSchoolSpotlightPackageId !== spotlightPackage.id) {
    throw new Error("Approve the exact package version currently shown in Founder Review.");
  }
  return repository.approveWithProductionPackage(
    project.id,
    spotlightPackage.id,
    spotlightPackage.version,
    {
      ...projectWorkflowService.createUpdate(project, "approve"),
      approvedSchoolSpotlightPackageId: spotlightPackage.id,
      approvedSchoolSpotlightPackageVersion: spotlightPackage.version,
    },
    { expectedUpdatedAt: project.updatedAt },
  );
}

export const founderSimpleService = {
  createSchoolSpotlightDraftInput,
  deriveSchoolSpotlightFacts,
  assembleSchoolSpotlightPackage,
  addSchoolFromFounderReview,
  createOrResumeSchoolSpotlightProject,
  loadExactActiveSchoolSpotlightPackage,
  prepareSchoolSpotlightForReview,
  approveExactSchoolSpotlightPackage,
};
