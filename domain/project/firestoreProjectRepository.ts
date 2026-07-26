import {
  collection,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";
import { ArtifactType, type BusinessObject } from "../business-object";
import { executiveEventDocument } from "../event/firestoreExecutiveEventRepository";
import { createProjectHistoryEvents, createProjectUpdateEvents } from "../event/timelineEngine";
import type { EntityId } from "../shared/types";
import { sanitizeFirestoreDocument } from "../shared/firestoreConverters";
import { projectConverter } from "./firestoreConverters";
import type { ProjectMutationOptions, ProjectRepository } from "./repository";
import type { Project } from "./types";

function projectsCollection(db: Firestore, workspaceId: EntityId) {
  return query(collection(db, "internalProjects"), where("workspaceId", "==", workspaceId)).withConverter(projectConverter);
}

function projectDocument(db: Firestore, projectId: EntityId) {
  return doc(db, "internalProjects", projectId).withConverter(projectConverter);
}

const artifactCollections: Record<ArtifactType, string> = {
  [ArtifactType.ResearchPackage]: "internalResearchPackages",
  [ArtifactType.OutlinePackage]: "internalOutlinePackages",
  [ArtifactType.ProductionPackage]: "internalProductionPackages",
  [ArtifactType.ReviewPackage]: "internalReviewPackages",
  [ArtifactType.PublishingPackage]: "internalPublishingPackages",
};

function artifactDocument(db: Firestore, artifact: BusinessObject) {
  return doc(db, artifactCollections[artifact.artifactType], artifact.id);
}

function productionPackageDocument(db: Firestore, packageId: EntityId) {
  return doc(db, "internalProductionPackages", packageId);
}

type SchoolSpotlightArtifact = BusinessObject & {
  packageKind: "school-spotlight";
  active?: boolean;
  workspaceId: EntityId;
  ownerId: EntityId;
  workflowDraftId: EntityId;
  workingDraft: unknown;
  request: unknown;
  customization: unknown;
  selectedFacts: unknown;
  excludedFactIds: unknown;
  unresolvedWarnings: unknown;
  verticalVideo: unknown;
  instagramCaption: unknown;
  shotList: unknown;
  verificationSources: unknown;
  rightsConfirmed: unknown;
  productionChecklist: unknown;
  mediaChecklist: unknown;
  graphicsNeeded: unknown;
  publishingRequirements: unknown;
  qaChecklist: unknown;
};

function isSchoolSpotlightArtifact(artifact: BusinessObject): artifact is SchoolSpotlightArtifact {
  return "packageKind" in artifact && artifact.packageKind === "school-spotlight";
}

function schoolSpotlightFactsIntegrityDocument(db: Firestore, packageId: EntityId) {
  return doc(db, "internalSchoolSpotlightPackageFacts", packageId);
}

function schoolSpotlightFactPartDocument(db: Firestore, packageId: EntityId, part: 1 | 2) {
  return doc(db, `internalSchoolSpotlightPackageFacts${part === 1 ? "A" : "B"}`, `${packageId}-${part}`);
}

function schoolSpotlightContentIntegrityDocument(db: Firestore, packageId: EntityId) {
  return doc(db, "internalSchoolSpotlightPackageContent", packageId);
}

function schoolSpotlightDeliveryIntegrityDocument(db: Firestore, packageId: EntityId) {
  return doc(db, "internalSchoolSpotlightPackageDelivery", packageId);
}

function schoolSpotlightRequestIntegrityDocument(db: Firestore, packageId: EntityId) {
  return doc(db, "internalSchoolSpotlightPackageRequest", packageId);
}

function schoolSpotlightCustomizationIntegrityDocument(db: Firestore, packageId: EntityId) {
  return doc(db, "internalSchoolSpotlightPackageCustomization", packageId);
}

function schoolSpotlightFactsIntegrity(artifact: SchoolSpotlightArtifact) {
  const facts = Array.isArray(artifact.selectedFacts) ? artifact.selectedFacts : [];
  const verificationSources = Array.isArray(artifact.verificationSources) ? artifact.verificationSources : [];
  return sanitizeFirestoreDocument({
    packageId: artifact.id,
    workspaceId: artifact.workspaceId,
    ownerId: artifact.ownerId,
    selectedFactCount: facts.length,
    selectedFactIds: facts.map((fact) => fact && typeof fact === "object"
      ? (fact as Record<string, unknown>).id
      : ""),
    selectedFactPositions: facts.map((fact) => fact && typeof fact === "object"
      ? (fact as Record<string, unknown>).position
      : -1),
    verificationSourceIds: verificationSources.map((source) => source && typeof source === "object"
      ? (source as Record<string, unknown>).sourceId
      : ""),
    verificationSources,
  });
}

function schoolSpotlightFactPart(artifact: SchoolSpotlightArtifact, part: 1 | 2) {
  const facts = Array.isArray(artifact.selectedFacts) ? artifact.selectedFacts : [];
  const selectedFacts = (part === 1 ? facts.slice(0, 4) : facts.slice(4, 8)).map((fact) => {
    if (!fact || typeof fact !== "object") return fact;
    const { sources, ...snapshot } = fact as Record<string, unknown>;
    return {
      ...snapshot,
      sourceIds: Array.isArray(sources)
        ? sources.map((source) => source && typeof source === "object" ? (source as Record<string, unknown>).sourceId : "")
        : [],
    };
  });
  return sanitizeFirestoreDocument({
    packageId: artifact.id,
    workspaceId: artifact.workspaceId,
    ownerId: artifact.ownerId,
    part,
    selectedFacts,
  });
}

function schoolSpotlightContentIntegrity(artifact: SchoolSpotlightArtifact) {
  return sanitizeFirestoreDocument({
    packageId: artifact.id,
    workspaceId: artifact.workspaceId,
    ownerId: artifact.ownerId,
    workflowDraftId: artifact.workflowDraftId,
    workingDraft: artifact.workingDraft,
    verticalVideo: artifact.verticalVideo,
    instagramCaption: artifact.instagramCaption,
    shotList: artifact.shotList,
  });
}

function schoolSpotlightDeliveryIntegrity(artifact: SchoolSpotlightArtifact) {
  return sanitizeFirestoreDocument({
    packageId: artifact.id,
    workspaceId: artifact.workspaceId,
    ownerId: artifact.ownerId,
    workflowDraftId: artifact.workflowDraftId,
    excludedFactIds: artifact.excludedFactIds,
    unresolvedWarnings: artifact.unresolvedWarnings,
    rightsConfirmed: artifact.rightsConfirmed,
    productionChecklist: artifact.productionChecklist,
    mediaChecklist: artifact.mediaChecklist,
    graphicsNeeded: artifact.graphicsNeeded,
    publishingRequirements: artifact.publishingRequirements,
    qaChecklist: artifact.qaChecklist,
  });
}

function schoolSpotlightRequestIntegrity(artifact: SchoolSpotlightArtifact) {
  return sanitizeFirestoreDocument({
    packageId: artifact.id,
    workspaceId: artifact.workspaceId,
    ownerId: artifact.ownerId,
    workflowDraftId: artifact.workflowDraftId,
    request: artifact.request,
  });
}

function schoolSpotlightCustomizationIntegrity(artifact: SchoolSpotlightArtifact) {
  return sanitizeFirestoreDocument({
    packageId: artifact.id,
    workspaceId: artifact.workspaceId,
    ownerId: artifact.ownerId,
    workflowDraftId: artifact.workflowDraftId,
    customization: artifact.customization,
  });
}

function schoolSpotlightPackageRecord(artifact: SchoolSpotlightArtifact) {
  const record = { ...artifact } as Record<string, unknown>;
  for (const field of [
    "request", "customization", "selectedFacts", "excludedFactIds",
    "unresolvedWarnings", "verticalVideo", "instagramCaption", "shotList",
    "verificationSources", "productionChecklist", "mediaChecklist",
    "graphicsNeeded", "publishingRequirements", "qaChecklist", "workingDraft",
  ]) delete record[field];
  return sanitizeFirestoreDocument({
    ...record,
    factsIntegrityId: artifact.id,
    contentIntegrityId: artifact.id,
    deliveryIntegrityId: artifact.id,
    requestIntegrityId: artifact.id,
    customizationIntegrityId: artifact.id,
  });
}

function assertCurrentVersion(project: Project, options?: ProjectMutationOptions) {
  if (options?.expectedUpdatedAt && project.updatedAt !== options.expectedUpdatedAt) {
    throw new Error(`Project update conflict: ${project.id}`);
  }
  if (options?.expectedVersion !== undefined && (project.version || 0) !== options.expectedVersion) {
    throw new Error(`Project update conflict: ${project.id}`);
  }
}

function mergeHistory<T extends { enteredAt: string; reason: string }>(current: T[] = [], incoming: T[] = []) {
  const entries = new Map(current.map((entry) => [`${entry.enteredAt}:${entry.reason}:${JSON.stringify(entry)}`, entry]));
  for (const entry of incoming) entries.set(`${entry.enteredAt}:${entry.reason}:${JSON.stringify(entry)}`, entry);
  return Array.from(entries.values()).sort((first, second) => Date.parse(first.enteredAt) - Date.parse(second.enteredAt));
}

function mergeProjectUpdate(existingProject: Project, projectUpdate: Partial<Project>): Project {
  return {
    ...existingProject,
    ...projectUpdate,
    workspaceHistory: mergeHistory(existingProject.workspaceHistory, projectUpdate.workspaceHistory),
    stateHistory: mergeHistory(existingProject.stateHistory, projectUpdate.stateHistory),
    version: (existingProject.version || 0) + 1,
  };
}

function entersApproved(existingProject: Project, projectUpdate: Partial<Project>) {
  const nextState = projectUpdate.state ?? existingProject.state;
  const nextStatus = projectUpdate.status ?? existingProject.status;
  return (nextState === "approved" || nextStatus === "approved")
    && (existingProject.state !== "approved" || existingProject.status !== "approved");
}

function founderSimpleProject(project: Partial<Project>) {
  return Boolean(project.activeSchoolSpotlightPackageId
    || project.approvedSchoolSpotlightPackageId
    || project.approvedSchoolSpotlightPackageVersion
    || project.creationRequestId?.startsWith("founder-simple-"));
}

function schoolSpotlightProject(project: Partial<Project>) {
  return project.projectType === "school-spotlight" || project.type === "school-spotlight";
}

function assertNotGenericApproval(existingProject: Project, projectUpdate: Partial<Project>) {
  if (entersApproved(existingProject, projectUpdate)
    && (schoolSpotlightProject(existingProject)
      || schoolSpotlightProject(projectUpdate)
      || founderSimpleProject(existingProject)
      || founderSimpleProject(projectUpdate))) {
    throw new Error("Founder approval requires the exact active School Spotlight package version.");
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, stableValue(nested)]));
}

function structurallyEqual(left: unknown, right: unknown) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function createFirestoreProjectRepository(db: Firestore, actorId?: EntityId): ProjectRepository {
  return {
    async listByWorkspace(workspaceId: EntityId) {
      const snapshot = await getDocs(projectsCollection(db, workspaceId));
      return snapshot.docs.map((projectSnapshot) => projectSnapshot.data());
    },

    async getById(projectId: EntityId) {
      const snapshot = await getDoc(projectDocument(db, projectId));
      return snapshot.exists() ? snapshot.data() : null;
    },

    async create(project: Project) {
      return runTransaction(db, async (transaction) => {
        const reference = projectDocument(db, project.id);
        const existingSnapshot = await transaction.get(reference);
        if (existingSnapshot.exists()) return existingSnapshot.data();

        const createdProject = { ...project, version: project.version || 1 };
        transaction.set(reference, createdProject);
        for (const event of createProjectHistoryEvents(createdProject, actorId || project.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return createdProject;
      });
    },

    async update(projectId: EntityId, projectUpdate: Partial<Project>, options?: ProjectMutationOptions) {
      return runTransaction(db, async (transaction) => {
        const documentReference = projectDocument(db, projectId);
        const snapshot = await transaction.get(documentReference);
        if (!snapshot.exists()) throw new Error(`Project not found: ${projectId}`);

        const existingProject = snapshot.data();
        assertCurrentVersion(existingProject, options);
        assertNotGenericApproval(existingProject, projectUpdate);
        const updatedProject = mergeProjectUpdate(existingProject, projectUpdate);
        transaction.set(documentReference, updatedProject);
        for (const event of createProjectUpdateEvents(existingProject, updatedProject, actorId || existingProject.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return updatedProject;
      });
    },

    async updateWithArtifacts(projectId, projectUpdate, artifacts, options) {
      const normalizedSpotlightPackages = new Set<string>();
      for (const artifact of artifacts.filter(isSchoolSpotlightArtifact)) {
        if (artifact.active !== false) {
          await setDoc(
            schoolSpotlightFactsIntegrityDocument(db, artifact.id),
            schoolSpotlightFactsIntegrity(artifact),
          );
          await Promise.all([
            setDoc(schoolSpotlightFactPartDocument(db, artifact.id, 1), schoolSpotlightFactPart(artifact, 1)),
            setDoc(schoolSpotlightFactPartDocument(db, artifact.id, 2), schoolSpotlightFactPart(artifact, 2)),
            setDoc(schoolSpotlightContentIntegrityDocument(db, artifact.id), schoolSpotlightContentIntegrity(artifact)),
            setDoc(schoolSpotlightDeliveryIntegrityDocument(db, artifact.id), schoolSpotlightDeliveryIntegrity(artifact)),
            setDoc(schoolSpotlightRequestIntegrityDocument(db, artifact.id), schoolSpotlightRequestIntegrity(artifact)),
            setDoc(
              schoolSpotlightCustomizationIntegrityDocument(db, artifact.id),
              schoolSpotlightCustomizationIntegrity(artifact),
            ),
          ]);
          await setDoc(artifactDocument(db, artifact), {
            ...schoolSpotlightPackageRecord(artifact),
            status: "staged",
            active: false,
          });
          normalizedSpotlightPackages.add(artifact.id);
          continue;
        }
        const [factsSnapshot, firstFactsSnapshot, secondFactsSnapshot, contentSnapshot, deliverySnapshot, requestSnapshot, customizationSnapshot] = await Promise.all([
          getDoc(schoolSpotlightFactsIntegrityDocument(db, artifact.id)),
          getDoc(schoolSpotlightFactPartDocument(db, artifact.id, 1)),
          getDoc(schoolSpotlightFactPartDocument(db, artifact.id, 2)),
          getDoc(schoolSpotlightContentIntegrityDocument(db, artifact.id)),
          getDoc(schoolSpotlightDeliveryIntegrityDocument(db, artifact.id)),
          getDoc(schoolSpotlightRequestIntegrityDocument(db, artifact.id)),
          getDoc(schoolSpotlightCustomizationIntegrityDocument(db, artifact.id)),
        ]);
        if (factsSnapshot.exists() && firstFactsSnapshot.exists() && secondFactsSnapshot.exists()
          && contentSnapshot.exists() && deliverySnapshot.exists()
          && requestSnapshot.exists() && customizationSnapshot.exists()) {
          normalizedSpotlightPackages.add(artifact.id);
        }
      }
      return runTransaction(db, async (transaction) => {
        const documentReference = projectDocument(db, projectId);
        const snapshot = await transaction.get(documentReference);
        if (!snapshot.exists()) throw new Error(`Project not found: ${projectId}`);

        const existingProject = snapshot.data();
        assertCurrentVersion(existingProject, options);
        assertNotGenericApproval(existingProject, projectUpdate);
        const updatedProject = mergeProjectUpdate(existingProject, projectUpdate);
        transaction.set(documentReference, updatedProject);
        for (const artifact of artifacts) {
          if (!isSchoolSpotlightArtifact(artifact)) {
            transaction.set(artifactDocument(db, artifact), sanitizeFirestoreDocument(artifact));
            continue;
          }
          transaction.set(
            artifactDocument(db, artifact),
            normalizedSpotlightPackages.has(artifact.id)
              ? schoolSpotlightPackageRecord(artifact)
              : sanitizeFirestoreDocument(artifact),
          );
        }
        for (const event of createProjectUpdateEvents(existingProject, updatedProject, actorId || existingProject.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return updatedProject;
      });
    },

    async approveWithProductionPackage(projectId, packageId, packageVersion, projectUpdate, options) {
      return runTransaction(db, async (transaction) => {
        const documentReference = projectDocument(db, projectId);
        const packageReference = productionPackageDocument(db, packageId);
        const [projectSnapshot, packageSnapshot] = await Promise.all([
          transaction.get(documentReference),
          transaction.get(packageReference),
        ]);
        if (!projectSnapshot.exists()) throw new Error(`Project not found: ${projectId}`);
        if (!packageSnapshot.exists()) throw new Error("The reviewed School Spotlight package could not be found.");

        const existingProject = projectSnapshot.data();
        const storedPackage = packageSnapshot.data();
        assertCurrentVersion(existingProject, options);
        const workflowDraftId = typeof storedPackage.workflowDraftId === "string"
          ? storedPackage.workflowDraftId
          : "";
        const schoolId = typeof storedPackage.schoolId === "string" ? storedPackage.schoolId : "";
        const contentIntegrityId = typeof storedPackage.contentIntegrityId === "string"
          ? storedPackage.contentIntegrityId
          : "";
        const deliveryIntegrityId = typeof storedPackage.deliveryIntegrityId === "string"
          ? storedPackage.deliveryIntegrityId
          : "";
        const requestIntegrityId = typeof storedPackage.requestIntegrityId === "string"
          ? storedPackage.requestIntegrityId
          : "";
        const customizationIntegrityId = typeof storedPackage.customizationIntegrityId === "string"
          ? storedPackage.customizationIntegrityId
          : "";
        const [draftSnapshot, contentSnapshot, deliverySnapshot, requestSnapshot, customizationSnapshot, schoolSnapshot] = await Promise.all([
          transaction.get(doc(db, "internalFounderWorkflowDrafts", workflowDraftId)),
          transaction.get(schoolSpotlightContentIntegrityDocument(db, contentIntegrityId)),
          transaction.get(schoolSpotlightDeliveryIntegrityDocument(db, deliveryIntegrityId)),
          transaction.get(schoolSpotlightRequestIntegrityDocument(db, requestIntegrityId)),
          transaction.get(schoolSpotlightCustomizationIntegrityDocument(db, customizationIntegrityId)),
          transaction.get(doc(db, "internalKnowledgeNodes", schoolId)),
        ]);
        const storedDraft = draftSnapshot.exists() ? draftSnapshot.data() : null;
        const storedContent = contentSnapshot.exists() ? contentSnapshot.data() : null;
        const storedDelivery = deliverySnapshot.exists() ? deliverySnapshot.data() : null;
        const storedRequest = requestSnapshot.exists() ? requestSnapshot.data() : null;
        const storedCustomization = customizationSnapshot.exists() ? customizationSnapshot.data() : null;
        const storedSchool = schoolSnapshot.exists() ? schoolSnapshot.data() : null;
        const projectRequestMatches = !existingProject.creationRequestId
          || existingProject.creationRequestId === workflowDraftId
          || existingProject.creationRequestId === `founder-simple-${workflowDraftId}`;
        if (existingProject.activeProductionVersion !== packageVersion
          || existingProject.activeSchoolSpotlightPackageId !== packageId
          || existingProject.state !== "review"
          || existingProject.status !== "review"
          || projectUpdate.state !== "approved"
          || projectUpdate.status !== "approved"
          || projectUpdate.approvedSchoolSpotlightPackageId !== packageId
          || projectUpdate.approvedSchoolSpotlightPackageVersion !== packageVersion
          || Boolean(actorId && actorId !== existingProject.ownerId)
          || storedPackage.id !== packageId
          || storedPackage.projectId !== projectId
          || storedPackage.workspaceId !== existingProject.workspaceId
          || storedPackage.ownerId !== existingProject.ownerId
          || storedPackage.version !== packageVersion
          || storedPackage.packageKind !== "school-spotlight"
          || storedPackage.artifactType !== "production-package"
          || storedPackage.status !== "ready"
          || storedPackage.active === false
          || storedPackage.rightsConfirmed !== true
          || storedPackage.contentIntegrityId !== packageId
          || storedPackage.deliveryIntegrityId !== packageId
          || storedPackage.factsIntegrityId !== packageId
          || storedPackage.requestIntegrityId !== packageId
          || storedPackage.customizationIntegrityId !== packageId
          || !existingProject.knowledgeEntityIds.includes(schoolId)
          || !projectRequestMatches
          || !storedDraft
          || storedDraft.id !== workflowDraftId
          || storedDraft.workspaceId !== existingProject.workspaceId
          || storedDraft.ownerId !== existingProject.ownerId
          || storedDraft.projectId !== projectId
          || storedDraft.schoolId !== schoolId
          || storedDraft.currentPackageId !== packageId
          || storedDraft.currentPackageVersion !== packageVersion
          || storedDraft.step !== "approve"
          || storedDraft.status !== "active"
          || !storedContent
          || storedContent.packageId !== packageId
          || storedContent.workspaceId !== existingProject.workspaceId
          || storedContent.ownerId !== existingProject.ownerId
          || storedContent.workflowDraftId !== workflowDraftId
          || !storedDelivery
          || storedDelivery.packageId !== packageId
          || storedDelivery.workspaceId !== existingProject.workspaceId
          || storedDelivery.ownerId !== existingProject.ownerId
          || storedDelivery.workflowDraftId !== workflowDraftId
          || storedDelivery.rightsConfirmed !== true
          || !storedRequest
          || storedRequest.packageId !== packageId
          || storedRequest.workspaceId !== existingProject.workspaceId
          || storedRequest.ownerId !== existingProject.ownerId
          || storedRequest.workflowDraftId !== workflowDraftId
          || !storedCustomization
          || storedCustomization.packageId !== packageId
          || storedCustomization.workspaceId !== existingProject.workspaceId
          || storedCustomization.ownerId !== existingProject.ownerId
          || storedCustomization.workflowDraftId !== workflowDraftId
          || !structurallyEqual(storedRequest.request, storedDraft.request)
          || !structurallyEqual(storedCustomization.customization, storedDraft.customization)
          || !storedSchool
          || storedSchool.id !== schoolId
          || storedSchool.workspaceId !== existingProject.workspaceId
          || storedSchool.type !== "school"
          || storedSchool.status !== "active") {
          throw new Error("Founder approval requires the exact active School Spotlight package version.");
        }

        const updatedProject = mergeProjectUpdate(existingProject, projectUpdate);
        transaction.set(documentReference, updatedProject);
        for (const event of createProjectUpdateEvents(existingProject, updatedProject, actorId || existingProject.ownerId)) {
          transaction.set(executiveEventDocument(db, event.id), event);
        }
        return updatedProject;
      });
    },
  };
}
