import { ArtifactStatus, ArtifactType } from "../business-object";
import { ExecutiveServiceType } from "../services";
import { ProjectType, ProjectWorkspace } from "../project";
import {
  FounderWorkflowKind,
  FounderWorkflowStatus,
  FounderWorkflowStep,
  type FounderWorkflowDraft,
  type SchoolSpotlightRequest,
  type SchoolSpotlightFact,
  type SchoolSpotlightPackage,
  SpotlightAudience,
  SpotlightBrandingPreset,
  SpotlightEmphasis,
  SpotlightFactStatus,
  SpotlightGoal,
  SpotlightLength,
  SpotlightMedia,
  SpotlightPlatform,
  SpotlightTone,
} from "./types";
import { KnowledgeConfidence, KnowledgeSourceReliability } from "../knowledge";

export class FounderWorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FounderWorkflowValidationError";
  }
}

function required(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new FounderWorkflowValidationError(`${label} is required.`);
  }
}

function identifier(value: unknown, label: string): asserts value is string {
  required(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) || value.length > 256) {
    throw new FounderWorkflowValidationError(`${label} is invalid.`);
  }
}

function unique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new FounderWorkflowValidationError(`${label} cannot contain duplicates.`);
  }
}

function stringList(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new FounderWorkflowValidationError(`${label} must be a list of text values.`);
  }
  unique(value, label);
}

function enumList<T extends string>(value: unknown, values: readonly T[], label: string): asserts value is T[] {
  stringList(value, label);
  if (value.some((item) => !values.includes(item as T))) {
    throw new FounderWorkflowValidationError(`${label} contains an unsupported choice.`);
  }
}

function optionalText(value: unknown, label: string) {
  if (value !== undefined && typeof value !== "string") {
    throw new FounderWorkflowValidationError(`${label} must be text.`);
  }
}

function validateRequest(request: SchoolSpotlightRequest) {
  for (const [label, value] of [
    ["Objective", request.objective],
    ["Audience", request.audience],
    ["Central emphasis", request.centralEmphasis],
    ["Call to action", request.callToAction],
  ] as const) {
    if (typeof value !== "string") throw new FounderWorkflowValidationError(`${label} must be text.`);
  }
  const platforms = request.platforms;
  enumList(platforms, Object.values(SpotlightPlatform), "Platforms");
  enumList(request.goals, Object.values(SpotlightGoal), "Spotlight goals");
  enumList(request.audiences, Object.values(SpotlightAudience), "Spotlight audiences");
  enumList(request.media, Object.values(SpotlightMedia), "Available media");
  if (request.primaryEmphasis !== undefined
    && !Object.values(SpotlightEmphasis).includes(request.primaryEmphasis)) {
    throw new FounderWorkflowValidationError("Choose a supported primary emphasis.");
  }
  for (const [label, value] of [
    ["Other Spotlight goal", request.goalOther],
    ["Additional Spotlight information", request.supplementalGoalText],
    ["Other audience", request.audienceOther],
    ["Other primary emphasis", request.emphasisOther],
    ["Specific Spotlight angle", request.specificAngle],
    ["Other available media", request.mediaOther],
    ["Available media description", request.mediaDescription],
  ] as const) optionalText(value, label);
  if (typeof request.needShotList !== "boolean") {
    throw new FounderWorkflowValidationError("The shot-list choice is invalid.");
  }
  if (request.media.includes(SpotlightMedia.NoMediaYet) && request.media.length > 1) {
    throw new FounderWorkflowValidationError("Choose No media yet by itself, or choose the media that is available.");
  }
  stringList(request.availableMedia, "Available media");
}

export function assertSchoolSpotlightRequestReady(request: SchoolSpotlightRequest) {
  if (!request.goals.length) {
    throw new FounderWorkflowValidationError("Choose what this Spotlight should accomplish.");
  }
  if (request.goals.includes(SpotlightGoal.Other) && !request.goalOther?.trim()) {
    throw new FounderWorkflowValidationError("Describe the other Spotlight goal before continuing.");
  }
  if (!request.audiences.length) {
    throw new FounderWorkflowValidationError("Choose at least one audience before continuing.");
  }
  if (request.audiences.includes(SpotlightAudience.Other) && !request.audienceOther?.trim()) {
    throw new FounderWorkflowValidationError("Describe the other audience before continuing.");
  }
  if (!request.platforms.length) {
    throw new FounderWorkflowValidationError("Choose at least one place where the Spotlight will be used.");
  }
  if (request.primaryEmphasis === SpotlightEmphasis.Other && !request.emphasisOther?.trim()) {
    throw new FounderWorkflowValidationError("Describe the other main idea before continuing.");
  }
  if (request.media.includes(SpotlightMedia.Other) && !request.mediaOther?.trim()) {
    throw new FounderWorkflowValidationError("Describe the other available media before continuing.");
  }
  return request;
}

function validateCustomization(customization: FounderWorkflowDraft["customization"]) {
  if (!Object.values(SpotlightTone).includes(customization.tone)
    || !Object.values(SpotlightLength).includes(customization.length)
    || !Object.values(SpotlightBrandingPreset).includes(customization.brandingPreset)) {
    throw new FounderWorkflowValidationError("School Spotlight customization is invalid.");
  }
  if (!Array.isArray(customization.mediaAvailability) || !Array.isArray(customization.shotList)) {
    throw new FounderWorkflowValidationError("School Spotlight media choices are invalid.");
  }
  stringList(customization.mediaAvailability, "Media availability");
  stringList(customization.shotList, "Shot list");
  for (const [label, value] of [
    ["Hook", customization.hook],
    ["Emphasis", customization.emphasis],
    ["Call to action", customization.callToAction],
    ["Vertical-video script", customization.verticalVideoScript],
    ["Instagram caption", customization.instagramCaption],
  ] as const) {
    if (typeof value !== "string") throw new FounderWorkflowValidationError(`${label} must be text.`);
  }
  if (typeof customization.rightsConfirmed !== "boolean") {
    throw new FounderWorkflowValidationError("Media rights confirmation is invalid.");
  }
}

function validateFact(fact: SchoolSpotlightFact) {
  required(fact.id, "School fact");
  required(fact.category, "School fact category");
  required(fact.label, "School fact label");
  if (fact.value !== undefined && typeof fact.value !== "string") {
    throw new FounderWorkflowValidationError(`${fact.label} must contain text.`);
  }
  if (!Object.values(SpotlightFactStatus).includes(fact.status)) {
    throw new FounderWorkflowValidationError(`${fact.label} has an invalid Verification Status.`);
  }
  if (fact.confidence !== undefined && !Object.values(KnowledgeConfidence).includes(fact.confidence)) {
    throw new FounderWorkflowValidationError(`${fact.label} has invalid verification detail.`);
  }
  stringList(fact.sourceIds, `${fact.label} sources`);
  if (typeof fact.included !== "boolean" || !Number.isInteger(fact.position) || fact.position < 0) {
    throw new FounderWorkflowValidationError(`${fact.label} has invalid review choices.`);
  }
  if (fact.founderText !== undefined && typeof fact.founderText !== "string") {
    throw new FounderWorkflowValidationError(`${fact.label} Founder wording must be text.`);
  }
}

export function validateFounderWorkflowDraft(draft: FounderWorkflowDraft) {
  identifier(draft.id, "Workflow draft");
  identifier(draft.workspaceId, "Workflow work area");
  identifier(draft.ownerId, "Workflow owner");
  identifier(draft.createdBy, "Workflow creator");
  identifier(draft.updatedBy, "Workflow editor");
  if (draft.kind !== FounderWorkflowKind.SchoolSpotlight
    || !Object.values(FounderWorkflowStep).includes(draft.step)
    || !Object.values(FounderWorkflowStatus).includes(draft.status)) {
    throw new FounderWorkflowValidationError("Workflow progress is invalid.");
  }
  if (!Number.isInteger(draft.revision) || draft.revision < 1) {
    throw new FounderWorkflowValidationError("Workflow revision is invalid.");
  }
  if (!Number.isFinite(Date.parse(draft.createdAt)) || !Number.isFinite(Date.parse(draft.updatedAt))) {
    throw new FounderWorkflowValidationError("Workflow save time is invalid.");
  }
  if (!Array.isArray(draft.facts)) throw new FounderWorkflowValidationError("School facts must be a list.");
  unique(draft.facts.map((fact) => fact.id), "School facts");
  draft.facts.forEach(validateFact);
  if (draft.schoolId !== undefined) identifier(draft.schoolId, "Selected School");
  if (draft.projectId !== undefined) identifier(draft.projectId, "School Spotlight project");
  if (draft.currentPackageId !== undefined) identifier(draft.currentPackageId, "Current package");
  if (draft.currentPackageVersion !== undefined
    && (!Number.isInteger(draft.currentPackageVersion) || draft.currentPackageVersion < 1)) {
    throw new FounderWorkflowValidationError("Current package version is invalid.");
  }
  if (draft.schoolDraft) {
    for (const value of Object.values(draft.schoolDraft)) {
      if (value !== undefined && typeof value !== "string") {
        throw new FounderWorkflowValidationError("Saved School information must be text.");
      }
    }
  }
  validateRequest(draft.request);
  validateCustomization(draft.customization);
  return draft;
}

export function factMayEnterPackage(fact: SchoolSpotlightFact) {
  if (!fact.included) return false;
  if (fact.status === SpotlightFactStatus.Verified || fact.status === SpotlightFactStatus.Supported) {
    return Boolean(fact.value?.trim() || fact.founderText?.trim());
  }
  return Boolean(fact.founderText?.trim());
}

export function assertFactSelectionIsSafe(facts: SchoolSpotlightFact[]) {
  const invalid = facts.find((fact) => fact.included && !factMayEnterPackage(fact));
  if (invalid) {
    throw new FounderWorkflowValidationError(
      `${invalid.label} needs verified information or explicit Founder wording before it can be included.`,
    );
  }
}

export function validateSchoolSpotlightPackage(spotlightPackage: SchoolSpotlightPackage) {
  identifier(spotlightPackage.id, "School Spotlight package");
  identifier(spotlightPackage.projectId, "School Spotlight project");
  identifier(spotlightPackage.workspaceId, "School Spotlight work area");
  identifier(spotlightPackage.ownerId, "School Spotlight owner");
  identifier(spotlightPackage.createdBy, "School Spotlight creator");
  identifier(spotlightPackage.schoolId, "School Spotlight School");
  identifier(spotlightPackage.workflowDraftId, "School Spotlight draft");
  if (spotlightPackage.packageKind !== FounderWorkflowKind.SchoolSpotlight
    || spotlightPackage.artifactType !== ArtifactType.ProductionPackage
    || spotlightPackage.generatedByService !== ExecutiveServiceType.Production
    || spotlightPackage.status !== ArtifactStatus.Ready
    || spotlightPackage.projectType !== ProjectType.SchoolSpotlight
    || spotlightPackage.workspace !== ProjectWorkspace.ProductionStudio) {
    throw new FounderWorkflowValidationError("School Spotlight package type or status is invalid.");
  }
  if (!Number.isInteger(spotlightPackage.version) || spotlightPackage.version < 1) {
    throw new FounderWorkflowValidationError("School Spotlight package version is invalid.");
  }
  if (spotlightPackage.id !== `production_${spotlightPackage.projectId}_v${spotlightPackage.version}`
    || spotlightPackage.outlinePackageId !== `outline_${spotlightPackage.projectId}`) {
    throw new FounderWorkflowValidationError("School Spotlight package identity is invalid.");
  }
  if (spotlightPackage.createdBy !== spotlightPackage.ownerId) {
    throw new FounderWorkflowValidationError("School Spotlight package ownership is invalid.");
  }
  if (!Number.isFinite(Date.parse(spotlightPackage.createdAt))
    || !Number.isFinite(Date.parse(spotlightPackage.updatedAt))) {
    throw new FounderWorkflowValidationError("School Spotlight package time is invalid.");
  }
  if (!spotlightPackage.selectedFacts.length || spotlightPackage.selectedFacts.length > 8) {
    throw new FounderWorkflowValidationError("Choose between one and eight supported facts before review.");
  }
  const factIds = spotlightPackage.selectedFacts.map((fact) => fact.id);
  unique(factIds, "Included School Spotlight facts");
  unique(spotlightPackage.selectedFacts.map((fact) => String(fact.position)), "Included School Spotlight positions");
  if (spotlightPackage.verificationSources.length > 2) {
    throw new FounderWorkflowValidationError("School Spotlight verification sources exceed the supported limit.");
  }
  unique(spotlightPackage.verificationSources.map((source) => source.sourceId), "School Spotlight verification sources");
  for (const source of spotlightPackage.verificationSources) {
    identifier(source.sourceId, "Verification source");
    if (!Number.isInteger(source.sourceVersion) || source.sourceVersion < 1
      || !Object.values(KnowledgeSourceReliability).includes(source.reliability)
      || !Number.isFinite(Date.parse(source.accessedAt))) {
      throw new FounderWorkflowValidationError("School Spotlight verification source is invalid.");
    }
    required(source.title, "Verification source title");
    optionalText(source.publisher, "Verification source publisher");
  }
  const verificationSourceIds = new Set(spotlightPackage.verificationSources.map((source) => source.sourceId));
  for (const fact of spotlightPackage.selectedFacts) {
    identifier(fact.id, "Included School Spotlight fact");
    required(fact.category, "Included School Spotlight fact category");
    required(fact.label, "Included School Spotlight fact label");
    required(fact.value, "Included School Spotlight fact wording");
    if (!Object.values(SpotlightFactStatus).includes(fact.status)
      || typeof fact.founderAuthored !== "boolean"
      || !Number.isInteger(fact.position)
      || fact.position < 0
      || fact.sources.length > 2) {
      throw new FounderWorkflowValidationError("Included School Spotlight fact is invalid.");
    }
    unique(fact.sources.map((source) => source.sourceId), `${fact.label} verification sources`);
    for (const source of fact.sources) {
      if (!verificationSourceIds.has(source.sourceId)) {
        throw new FounderWorkflowValidationError(`${fact.label} references an unrelated verification source.`);
      }
      const canonical = spotlightPackage.verificationSources.find((candidate) => candidate.sourceId === source.sourceId);
      if (!canonical
        || canonical.sourceVersion !== source.sourceVersion
        || canonical.title !== source.title
        || canonical.publisher !== source.publisher
        || canonical.reliability !== source.reliability
        || canonical.accessedAt !== source.accessedAt) {
        throw new FounderWorkflowValidationError(`${fact.label} verification detail does not match the package source.`);
      }
    }
  }
  if (!spotlightPackage.workingDraft.trim()
    || !spotlightPackage.verticalVideo.hook.trim()
    || !spotlightPackage.instagramCaption.trim()) {
    throw new FounderWorkflowValidationError("Complete the content package before Founder Review.");
  }
  if (!spotlightPackage.verticalVideo.title.trim()
    || !spotlightPackage.verticalVideo.callToAction.trim()
    || spotlightPackage.verticalVideo.scenes.length < 2
    || spotlightPackage.verticalVideo.scenes.length > 10
    || spotlightPackage.verticalVideo.scenes.length !== spotlightPackage.selectedFacts.length + 2) {
    throw new FounderWorkflowValidationError("School Spotlight vertical-video content is invalid.");
  }
  unique(spotlightPackage.verticalVideo.scenes.map((scene) => scene.id), "Vertical-video scenes");
  for (const scene of spotlightPackage.verticalVideo.scenes) {
    identifier(scene.id, "Vertical-video scene");
    required(scene.heading, "Vertical-video scene heading");
    required(scene.narration, "Vertical-video narration");
    required(scene.visualDirection, "Vertical-video visual direction");
  }
  for (const [label, values, maximum] of [
    ["Excluded facts", spotlightPackage.excludedFactIds, 8],
    ["Unresolved warnings", spotlightPackage.unresolvedWarnings, 8],
    ["Shot list", spotlightPackage.shotList, 4],
  ] as const) {
    stringList(values, label);
    if (values.length > maximum) throw new FounderWorkflowValidationError(`${label} exceeds the supported limit.`);
  }
  const checklistGroups = [
    spotlightPackage.productionChecklist,
    spotlightPackage.mediaChecklist,
    spotlightPackage.graphicsNeeded,
    spotlightPackage.publishingRequirements,
    spotlightPackage.qaChecklist,
  ];
  for (const checklist of checklistGroups) {
    if (!Array.isArray(checklist) || checklist.length > 2) {
      throw new FounderWorkflowValidationError("School Spotlight checklist is invalid.");
    }
    unique(checklist.map((item) => item.id), "School Spotlight checklist items");
    for (const item of checklist) {
      identifier(item.id, "School Spotlight checklist item");
      required(item.label, "School Spotlight checklist label");
      if (typeof item.required !== "boolean" || typeof item.completed !== "boolean") {
        throw new FounderWorkflowValidationError("School Spotlight checklist status is invalid.");
      }
    }
  }
  validateRequest(spotlightPackage.request);
  validateCustomization(spotlightPackage.customization);
  required(spotlightPackage.projectTitle, "School Spotlight project title");
  required(spotlightPackage.summary, "School Spotlight summary");
  required(spotlightPackage.nextRecommendedStep, "School Spotlight next step");
  required(spotlightPackage.changeSummary, "School Spotlight change summary");
  if (typeof spotlightPackage.active !== "boolean" || typeof spotlightPackage.rightsConfirmed !== "boolean") {
    throw new FounderWorkflowValidationError("School Spotlight lifecycle information is invalid.");
  }
  if (spotlightPackage.version === 1 && spotlightPackage.previousPackageId !== undefined) {
    throw new FounderWorkflowValidationError("The first School Spotlight package cannot name a previous version.");
  }
  if (spotlightPackage.version > 1) {
    identifier(spotlightPackage.previousPackageId, "Previous School Spotlight package");
  }
  if (spotlightPackage.metadata.workspaceId !== spotlightPackage.workspaceId
    || spotlightPackage.metadata.projectType !== ProjectType.SchoolSpotlight
    || spotlightPackage.metadata.schoolId !== spotlightPackage.schoolId
    || spotlightPackage.metadata.workflowDraftId !== spotlightPackage.workflowDraftId
    || spotlightPackage.metadata.productionComplete !== true) {
    throw new FounderWorkflowValidationError("School Spotlight package metadata is invalid.");
  }
  return spotlightPackage;
}

export function assertSchoolSpotlightPackageApprovable(spotlightPackage: SchoolSpotlightPackage) {
  validateSchoolSpotlightPackage(spotlightPackage);
  if (!spotlightPackage.rightsConfirmed) {
    throw new FounderWorkflowValidationError("Confirm media rights before approving this package.");
  }
  return spotlightPackage;
}
