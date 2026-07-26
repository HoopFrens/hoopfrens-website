"use client";

import {
  FounderWorkflowStatus,
  FounderWorkflowStep,
  FounderWorkflowValidationError,
  type FounderWorkflowDraft,
  type FounderWorkflowDraftRepository,
  type FounderWorkflowDraftUpdate,
  type GuidedSchoolDraft,
  type SchoolSpotlightFact,
  type SchoolSpotlightPackage,
  SpotlightBrandingPreset,
  SpotlightFactStatus,
  SpotlightLength,
  SpotlightTone,
  assertFactSelectionIsSafe,
  reconcileFounderWorkflowDraft,
} from "@/domain/founder-simple";
import {
  isSchoolKnowledgeNode,
  type KnowledgeGraph,
  type KnowledgeGraphRepository,
  type KnowledgeNode,
  KnowledgeNodeType,
  KnowledgeSourceReliability,
  KnowledgeStatus,
} from "@/domain/knowledge";
import type { Project, ProjectRepository } from "@/domain/project";
import type {
  OutlinePackageRepository,
  ProductionPackageRepository,
  ResearchPackageRepository,
} from "@/domain/services";
import { hoopFrensStateOptions, ProjectStatus } from "@/domain/shared";
import {
  addSchoolFromFounderReview,
  approveExactSchoolSpotlightPackage,
  assembleSchoolSpotlightPackage,
  createOrResumeSchoolSpotlightProject,
  deriveSchoolSpotlightFacts,
  FounderPackageReviewError,
  FounderSchoolSubmissionError,
  loadExactActiveSchoolSpotlightPackage,
  prepareSchoolSpotlightForReview,
  projectWorkflowService,
} from "@/services";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileCheck2, Loader2, Plus, Save, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GuidedWorkflowShell } from "./GuidedWorkflowShell";
import {
  brandingLabels,
  factStatusLabels,
  lengthLabels,
  platformLabels,
  toneLabels,
} from "./founderSimpleLabels";
import {
  firstUnresolvedSpotlightRequestField,
  spotlightRequestFocusId,
  StructuredSpotlightRequestFields,
  type SpotlightRequestFocusTarget,
} from "./StructuredSpotlightRequestFields";

type SchoolNode = Extract<KnowledgeNode, { type: KnowledgeNodeType.School }>;

type SchoolSpotlightJourneyProps = {
  initialDraft: FounderWorkflowDraft;
  initialGraph: KnowledgeGraph;
  currentUserId: string;
  draftRepository: FounderWorkflowDraftRepository;
  knowledgeRepository: KnowledgeGraphRepository;
  projectRepository: ProjectRepository;
  researchPackageRepository: ResearchPackageRepository;
  outlinePackageRepository: OutlinePackageRepository;
  productionPackageRepository: ProductionPackageRepository;
  onDraftSaved(draft: FounderWorkflowDraft): void;
  onGraphRefresh(): Promise<KnowledgeGraph>;
  onExit(): void;
};

const inputClassName = "mt-2 min-h-12 w-full border border-white/15 bg-black px-4 py-3 text-base font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40";
const labelClassName = "text-sm font-black text-zinc-200";
const secondaryButtonClassName = "inline-flex min-h-11 items-center justify-center gap-2 border border-white/15 bg-black px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-200 transition hover:border-red-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";
const primaryButtonClassName = "inline-flex min-h-11 items-center justify-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:bg-zinc-700";

const sourceQualityLabels: Record<KnowledgeSourceReliability, string> = {
  [KnowledgeSourceReliability.Official]: "Official source",
  [KnowledgeSourceReliability.High]: "High-reliability source",
  [KnowledgeSourceReliability.Medium]: "Supporting source",
  [KnowledgeSourceReliability.Low]: "Limited source",
  [KnowledgeSourceReliability.Unverified]: "Not independently verified",
};

export function founderDraftUsingExistingSchool(
  draft: FounderWorkflowDraft,
  schoolId: string,
): FounderWorkflowDraft {
  return {
    ...draft,
    schoolId,
    schoolDraft: undefined,
    status: FounderWorkflowStatus.Archived,
  };
}

export function UseExistingSchoolAction({
  pending,
  onUseExisting,
}: {
  pending: boolean;
  onUseExisting(): void;
}) {
  return (
    <button type="button" onClick={onUseExisting} disabled={pending} className={`${primaryButtonClassName} mt-4`}>
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Check aria-hidden="true" size={16} />}
      Use Existing School
    </button>
  );
}

function draftUpdate(draft: FounderWorkflowDraft): FounderWorkflowDraftUpdate {
  return {
    step: draft.step,
    status: draft.status,
    schoolDraft: draft.schoolDraft,
    schoolId: draft.schoolId,
    projectId: draft.projectId,
    request: draft.request,
    facts: draft.facts,
    customization: draft.customization,
    currentPackageId: draft.currentPackageId,
    currentPackageVersion: draft.currentPackageVersion,
  };
}

function draftFingerprint(draft: FounderWorkflowDraft) {
  return JSON.stringify(draftUpdate(draft));
}

function validOfficialWebsite(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function exactFounderReviewPackage(
  draft: FounderWorkflowDraft,
  project: Project | null,
  spotlightPackage: SchoolSpotlightPackage | null,
): SchoolSpotlightPackage | null {
  if (!project || !spotlightPackage) return null;
  const projectState = project.state || project.status;
  const projectRequestMatches = !project.creationRequestId
    || project.creationRequestId === draft.id
    || project.creationRequestId === `founder-simple-${draft.id}`;
  const approvedBindingMatches = projectState !== ProjectStatus.Approved
    || (project.approvedSchoolSpotlightPackageId === spotlightPackage.id
      && project.approvedSchoolSpotlightPackageVersion === spotlightPackage.version);
  return [ProjectStatus.Review, ProjectStatus.Approved].includes(projectState)
    && project.activeSchoolSpotlightPackageId === spotlightPackage.id
    && project.activeProductionVersion === spotlightPackage.version
    && project.id === spotlightPackage.projectId
    && project.workspaceId === spotlightPackage.workspaceId
    && project.ownerId === spotlightPackage.ownerId
    && project.knowledgeEntityIds.includes(spotlightPackage.schoolId)
    && draft.schoolId === spotlightPackage.schoolId
    && draft.id === spotlightPackage.workflowDraftId
    && spotlightPackage.active !== false
    && projectRequestMatches
    && approvedBindingMatches
    ? spotlightPackage
    : null;
}

function schoolFromGraph(graph: KnowledgeGraph, schoolId?: string): SchoolNode | null {
  const school = graph.nodes.find((node) => node.id === schoolId);
  return school && isSchoolKnowledgeNode(school) && school.status === KnowledgeStatus.Active ? school : null;
}

function errorMessage(error: unknown, fallback: string) {
  if ((error instanceof FounderWorkflowValidationError
      || error instanceof FounderSchoolSubmissionError
      || error instanceof FounderPackageReviewError)
    && error.message.trim()) return error.message;
  return fallback;
}

function logSchoolSubmissionFailure(error: unknown) {
  if (error instanceof FounderSchoolSubmissionError) {
    const cause = error.cause;
    const detail = {
      code: error.code,
      field: error.field || null,
      cause: cause instanceof Error
        ? {
            name: cause.name,
            message: cause.message,
            code: "code" in cause ? String((cause as Error & { code?: unknown }).code || "") : "",
          }
        : null,
    };
    console.error("[Headquarters Add School]", JSON.stringify(detail));
    return;
  }
  console.error("[Headquarters Add School]", {
    code: error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "unknown")
      : "unknown",
  });
}

function logExactPackageReviewFailure(error: unknown) {
  const cause = error instanceof FounderPackageReviewError ? error.cause : error;
  console.error("[Headquarters Exact Package Review]", JSON.stringify({
    code: error instanceof FounderPackageReviewError ? error.code : "unexpected",
    error: error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) },
    cause: cause instanceof Error
      ? {
          name: cause.name,
          message: cause.message,
          code: "code" in cause ? String((cause as Error & { code?: unknown }).code || "") : "",
        }
      : null,
  }));
}

function draftDefaultsForCustomization(draft: FounderWorkflowDraft, school: SchoolNode) {
  const selected = draft.facts.filter((fact) => fact.included)
    .sort((first, second) => first.position - second.position)
    .map((fact) => `${fact.label}: ${fact.founderText?.trim() || fact.value || ""}`);
  const hook = draft.customization.hook.trim() || `Meet ${school.officialName}.`;
  const callToAction = draft.customization.callToAction.trim() || draft.request.callToAction.trim();
  return {
    ...draft.customization,
    hook,
    emphasis: draft.customization.emphasis || draft.request.centralEmphasis,
    callToAction,
    mediaAvailability: draft.customization.mediaAvailability.length
      ? draft.customization.mediaAvailability
      : draft.request.availableMedia,
    verticalVideoScript: draft.customization.verticalVideoScript || [hook, ...selected, callToAction].filter(Boolean).join("\n\n"),
    instagramCaption: draft.customization.instagramCaption || [hook, ...selected, callToAction].filter(Boolean).join("\n\n"),
    shotList: draft.customization.shotList.length ? draft.customization.shotList : [
      "School or campus establishing shot",
      "Basketball facility exterior and court",
      "Approved team or program detail",
      "Hoop Frens closing card",
    ],
  };
}

export function SchoolSpotlightJourney({
  initialDraft,
  initialGraph,
  currentUserId,
  draftRepository,
  knowledgeRepository,
  projectRepository,
  researchPackageRepository,
  outlinePackageRepository,
  productionPackageRepository,
  onDraftSaved,
  onGraphRefresh,
  onExit,
}: SchoolSpotlightJourneyProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [graph, setGraph] = useState(initialGraph);
  const [project, setProject] = useState<Project | null>(null);
  const [spotlightPackage, setSpotlightPackage] = useState<SchoolSpotlightPackage | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolReviewReady, setSchoolReviewReady] = useState(false);
  const [matchingSchool, setMatchingSchool] = useState<SchoolNode | null>(null);
  const [schoolAdded, setSchoolAdded] = useState(
    initialDraft.status === FounderWorkflowStatus.Archived
      && Boolean(initialDraft.schoolId)
      && !initialDraft.projectId,
  );
  const errorRef = useRef<HTMLDivElement>(null);
  const requestFocusTargetRef = useRef<SpotlightRequestFocusTarget | null>(null);
  const lastSavedFingerprint = useRef(draftFingerprint(initialDraft));
  const lastSavedRevision = useRef(initialDraft.revision);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  const school = schoolFromGraph(graph, draft.schoolId);
  const exactReviewPackage = exactFounderReviewPackage(draft, project, spotlightPackage);
  const summaryPackageVersion = draft.step === FounderWorkflowStep.Approve
    ? exactReviewPackage?.version
    : draft.currentPackageVersion;
  const requestReady = Boolean(
    school
      && !firstUnresolvedSpotlightRequestField(draft.request),
  );
  const activeSchools = useMemo(() => graph.nodes.filter((node): node is SchoolNode => (
    isSchoolKnowledgeNode(node) && node.status === KnowledgeStatus.Active
  )), [graph.nodes]);
  const schoolResults = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();
    if (!query) return activeSchools.slice(0, 8);
    return activeSchools.filter((candidate) => [candidate.name, candidate.city, candidate.state]
      .some((value) => value.toLowerCase().includes(query))).slice(0, 8);
  }, [activeSchools, schoolSearch]);

  useEffect(() => {
    let active = true;
    async function loadProjectContext() {
      if (!initialDraft.projectId) return;
      const savedProject = await projectRepository.getById(initialDraft.projectId);
      if (!active || !savedProject) return;
      setProject(savedProject);
      const exactActivePackage = await loadExactActiveSchoolSpotlightPackage(
        productionPackageRepository,
        savedProject,
        initialDraft.id,
      );
      if (!active) return;
      if (!exactActivePackage) {
        if (initialDraft.step === FounderWorkflowStep.Approve) {
          setError("Headquarters could not find the exact package version linked to this review. Your saved work was not changed. Return to Customize and choose Review Exact Version again.");
        }
        return;
      }
      setSpotlightPackage(exactActivePackage);
      const repair = reconcileFounderWorkflowDraft(initialDraft, savedProject, exactActivePackage);
      if (repair) {
        const saved = await persistDraft({ ...initialDraft, ...repair });
        if (!active) return;
        setDraft(saved);
        setNotice((savedProject.state || savedProject.status) === ProjectStatus.Approved
          ? `Package version ${exactActivePackage.version} is approved. Nothing was published or scheduled.`
          : `Package version ${exactActivePackage.version} is ready for exact review.`);
      }
    }
    void loadProjectContext().catch((loadError) => {
      logExactPackageReviewFailure(loadError);
      if (active) {
        setError(errorMessage(
          loadError,
          "Headquarters could not reopen the current project package. Reopen this work and try again.",
        ));
      }
    });
    return () => { active = false; };
    // The repositories and initial draft are stable for this keyed journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft.projectId, productionPackageRepository, projectRepository]);

  async function persistDraft(snapshot: FounderWorkflowDraft) {
    setSaveStatus("saving");
    const save = async () => draftRepository.update(
      snapshot.id,
      draftUpdate(snapshot),
      { actorId: currentUserId },
      { expectedRevision: lastSavedRevision.current },
    );
    const pending = saveQueue.current.then(save, save);
    saveQueue.current = pending.then(() => undefined, () => undefined);
    try {
      const saved = await pending;
      lastSavedFingerprint.current = draftFingerprint(saved);
      lastSavedRevision.current = saved.revision;
      setDraft((current) => draftFingerprint(current) === draftFingerprint(snapshot)
        ? saved
        : { ...current, revision: saved.revision, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy });
      setSaveStatus("saved");
      onDraftSaved(saved);
      return saved;
    } catch (saveError) {
      setSaveStatus("error");
      setError(errorMessage(saveError, "Headquarters could not save your progress. Your current screen remains open."));
      throw saveError;
    }
  }

  useEffect(() => {
    const fingerprint = draftFingerprint(draft);
    if (fingerprint === lastSavedFingerprint.current) return;
    const timeout = window.setTimeout(() => {
      void persistDraft(draft).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timeout);
    // Repository and actor are stable for the life of this keyed journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    if (!error || requestFocusTargetRef.current) return;
    errorRef.current?.focus();
  }, [error]);

  function updateDraft(update: FounderWorkflowDraftUpdate) {
    setError("");
    setNotice("");
    setDraft((current) => ({ ...current, ...update }));
  }

  async function saveAndReplace(next: FounderWorkflowDraft) {
    const saved = await persistDraft(next);
    setDraft(saved);
    return saved;
  }

  async function handleAddSchool() {
    if (!draft.schoolDraft) return;
    setActionPending(true);
    setError("");
    let recordedSchool: SchoolNode | null = null;
    try {
      const result = await addSchoolFromFounderReview(knowledgeRepository, draft.schoolDraft, currentUserId);
      if (!result.created) {
        setMatchingSchool(result.school);
        setError(`${result.school.name} already exists in Headquarters. Use the existing School instead of creating another.`);
        return;
      }
      const created = result.school;
      recordedSchool = created;
      const refreshed = await onGraphRefresh();
      setGraph(refreshed);
      const next = {
        ...draft,
        schoolId: created.id,
        schoolDraft: undefined,
        status: FounderWorkflowStatus.Archived,
      };
      await saveAndReplace(next);
      setSchoolReviewReady(false);
      setMatchingSchool(null);
      setSchoolAdded(true);
      setNotice(`${created.name} was added successfully.`);
    } catch (addError) {
      if (recordedSchool) {
        setError(`${recordedSchool.name} was added, but Headquarters could not sync your saved screen. Choose Add School again or reopen this work to continue.`);
      } else {
        setMatchingSchool(null);
        logSchoolSubmissionFailure(addError);
        setError(errorMessage(addError, "School could not be added. Try again once. If the problem continues, ask an administrator to review the Add School console detail."));
      }
    } finally {
      setActionPending(false);
    }
  }

  async function handleUseExistingSchool() {
    if (!matchingSchool) return;
    setActionPending(true);
    setError("");
    try {
      const refreshed = await onGraphRefresh();
      setGraph(refreshed);
      const existing = schoolFromGraph(refreshed, matchingSchool.id);
      if (!existing) {
        throw new FounderSchoolSubmissionError(
          "knowledge-integrity",
          `${matchingSchool.name} is no longer available. Reopen Add School and try again.`,
        );
      }
      const next = founderDraftUsingExistingSchool(draft, existing.id);
      await saveAndReplace(next);
      setSchoolReviewReady(false);
      setMatchingSchool(null);
      setSchoolAdded(true);
      setNotice(`${existing.name} is now selected. No duplicate School was created.`);
    } catch (useError) {
      setError(errorMessage(
        useError,
        `${matchingSchool.name} could not be selected. Reopen Add School and try again.`,
      ));
    } finally {
      setActionPending(false);
    }
  }

  async function handleRequestContinue() {
    if (!school) {
      setError("Choose an existing School or add one before continuing.");
      return;
    }
    const unresolved = firstUnresolvedSpotlightRequestField(draft.request);
    if (unresolved) {
      const messages: Record<SpotlightRequestFocusTarget, string> = {
        goal: "Choose at least one Spotlight goal before continuing.",
        "goal-other": "Describe the other Spotlight goal before continuing.",
        audience: "Choose at least one audience before continuing.",
        "audience-other": "Describe the other audience before continuing.",
        platform: "Choose at least one place where the Spotlight will be used before continuing.",
        "emphasis-other": "Describe the other main idea before continuing.",
        "media-other": "Describe the other available media before continuing.",
      };
      requestFocusTargetRef.current = unresolved;
      setError(messages[unresolved]);
      window.requestAnimationFrame(() => {
        if (requestFocusTargetRef.current !== unresolved) return;
        document.getElementById(spotlightRequestFocusId(unresolved))?.focus();
        requestFocusTargetRef.current = null;
      });
      return;
    }
    setActionPending(true);
    setError("");
    try {
      const savedProject = await createOrResumeSchoolSpotlightProject(projectRepository, draft, school, currentUserId);
      const refreshed = await onGraphRefresh();
      setGraph(refreshed);
      const facts = deriveSchoolSpotlightFacts(refreshed, school.id);
      const next = { ...draft, projectId: savedProject.id, facts, step: FounderWorkflowStep.Review };
      const saved = await saveAndReplace(next);
      setProject(savedProject);
      onDraftSaved(saved);
    } catch (requestError) {
      setError(errorMessage(requestError, "Headquarters could not open the information review yet."));
    } finally {
      setActionPending(false);
    }
  }

  async function handleBuildSpotlightAfterSchool() {
    setActionPending(true);
    setError("");
    try {
      await saveAndReplace({ ...draft, status: FounderWorkflowStatus.Active });
      setSchoolAdded(false);
      setNotice("The School is selected. Define the Spotlight outcome when you are ready.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Headquarters could not start the Spotlight request yet."));
    } finally {
      setActionPending(false);
    }
  }

  function updateFact(factId: string, update: Partial<SchoolSpotlightFact>) {
    updateDraft({ facts: draft.facts.map((fact) => fact.id === factId ? { ...fact, ...update } : fact) });
  }

  async function handleReviewContinue() {
    if (!school) return;
    try {
      assertFactSelectionIsSafe(draft.facts);
      if (!draft.facts.some((fact) => fact.included)) {
        setError("Choose at least one supported fact before customizing the package.");
        return;
      }
      const next = {
        ...draft,
        customization: draftDefaultsForCustomization(draft, school),
        step: FounderWorkflowStep.Customize,
      };
      await saveAndReplace(next);
    } catch (reviewError) {
      setError(errorMessage(reviewError, "Review the selected information before continuing."));
    }
  }

  async function handleOpenExactReview() {
    if (!school || !draft.projectId) {
      setError("Complete the request and information review before assembling the package.");
      return;
    }
    if (!draft.customization.rightsConfirmed) {
      setError("Confirm the media rights plan before opening Founder Review.");
      return;
    }
    setActionPending(true);
    setError("");
    let recordedProject: Project | null = null;
    let recordedPackage: SchoolSpotlightPackage | null = null;
    try {
      const currentProject = await projectRepository.getById(draft.projectId);
      if (!currentProject) throw new Error("The School Spotlight project could not be found.");
      const exactActivePackage = await loadExactActiveSchoolSpotlightPackage(
        productionPackageRepository,
        currentProject,
        draft.id,
      );
      const latestPackage = exactActivePackage
        || await productionPackageRepository.getLatestByProjectId(currentProject.id);
      const repair = reconcileFounderWorkflowDraft(draft, currentProject, exactActivePackage);
      if (repair && exactActivePackage) {
        await saveAndReplace({ ...draft, ...repair });
        setProject(currentProject);
        setSpotlightPackage(exactActivePackage);
        setNotice((currentProject.state || currentProject.status) === ProjectStatus.Approved
          ? `Package version ${exactActivePackage.version} is approved. Nothing was published or scheduled.`
          : `Package version ${exactActivePackage.version} is ready for exact review.`);
        return;
      }
      const candidate = exactActivePackage
        || assembleSchoolSpotlightPackage(draft, graph, school, currentProject, latestPackage);
      const reviewedProject = await prepareSchoolSpotlightForReview({
        projectRepository,
        researchPackageRepository,
        outlinePackageRepository,
        productionPackageRepository,
        project: currentProject,
        spotlightPackage: candidate,
      });
      recordedProject = reviewedProject;
      const exactReviewPackage = await loadExactActiveSchoolSpotlightPackage(
        productionPackageRepository,
        reviewedProject,
        draft.id,
      );
      if (!exactReviewPackage) {
        throw new FounderPackageReviewError(
          "exact-version-missing",
          "The new package was not linked to this project, so Headquarters did not open it. Your current work remains saved. Choose Review Exact Version to try again.",
        );
      }
      recordedPackage = exactReviewPackage;
      const next = {
        ...draft,
        step: FounderWorkflowStep.Approve,
        currentPackageId: exactReviewPackage.id,
        currentPackageVersion: exactReviewPackage.version,
      };
      await saveAndReplace(next);
      setProject(reviewedProject);
      setSpotlightPackage(exactReviewPackage);
    } catch (packageError) {
      logExactPackageReviewFailure(packageError);
      if (recordedProject && recordedPackage) {
        setProject(recordedProject);
        setSpotlightPackage(recordedPackage);
        setError(`Package version ${recordedPackage.version} is ready for exact review, but Headquarters could not sync your saved screen. Choose Review Exact Version again or reopen this work to continue.`);
      } else {
        setError(errorMessage(
          packageError,
          "Headquarters could not save or locate the exact package version. Your current work remains saved. Choose Review Exact Version to try again.",
        ));
      }
    } finally {
      setActionPending(false);
    }
  }

  async function handleRequestChanges(targetStep: FounderWorkflowStep) {
    if (!project) return;
    setActionPending(true);
    setError("");
    try {
      const latestProject = await projectRepository.getById(project.id);
      if (!latestProject) throw new Error("The current project could not be found.");
      const revisedProject = (latestProject.state || latestProject.status) === ProjectStatus.Review
        ? await projectRepository.update(
            latestProject.id,
            projectWorkflowService.createUpdate(latestProject, "request-revision"),
            { expectedUpdatedAt: latestProject.updatedAt },
          )
        : latestProject;
      const next = { ...draft, step: targetStep, status: FounderWorkflowStatus.Active };
      await saveAndReplace(next);
      setProject(revisedProject);
      setNotice(targetStep === FounderWorkflowStep.Review
        ? "Information review reopened. The current package status will not change until a new version is ready."
        : "Changes requested. Update the package and create a new version when ready.");
    } catch (revisionError) {
      setError(errorMessage(revisionError, "Headquarters could not reopen this package for changes."));
    } finally {
      setActionPending(false);
    }
  }

  async function handleApprove() {
    if (!project || !exactReviewPackage) return;
    setActionPending(true);
    setError("");
    let recordedApproval: Project | null = null;
    try {
      const latestProject = await projectRepository.getById(project.id);
      if (!latestProject) throw new Error("The current project could not be found.");
      const repair = reconcileFounderWorkflowDraft(draft, latestProject, exactReviewPackage);
      if (repair && (latestProject.state || latestProject.status) === ProjectStatus.Approved) {
        await saveAndReplace({ ...draft, ...repair });
        setProject(latestProject);
        setNotice(`Package version ${exactReviewPackage.version} is approved. Nothing was published or scheduled.`);
        return;
      }
      const approved = await approveExactSchoolSpotlightPackage(projectRepository, latestProject, exactReviewPackage);
      recordedApproval = approved;
      const next = { ...draft, status: FounderWorkflowStatus.Completed, step: FounderWorkflowStep.Approve };
      await saveAndReplace(next);
      setProject(approved);
      setNotice(`Package version ${exactReviewPackage.version} is approved. Nothing was published or scheduled.`);
    } catch (approvalError) {
      if (recordedApproval) {
        setProject(recordedApproval);
        setError(`Package version ${exactReviewPackage.version} was approved, but Headquarters could not sync your saved screen. Choose Approve Package again or reopen this work to continue.`);
      } else {
        setError(errorMessage(approvalError, "Headquarters could not approve this exact package version."));
      }
    } finally {
      setActionPending(false);
    }
  }

  const summary = (
    <dl className="grid gap-3">
      <div><dt className="text-xs font-black uppercase tracking-wider text-zinc-600">School</dt><dd className="mt-1 font-bold text-white">{school?.name || draft.schoolDraft?.officialName || "Not selected"}</dd></div>
      <div><dt className="text-xs font-black uppercase tracking-wider text-zinc-600">Objective</dt><dd className="mt-1 font-bold text-white">{draft.request.objective || "Not set"}</dd></div>
      <div><dt className="text-xs font-black uppercase tracking-wider text-zinc-600">Platforms</dt><dd className="mt-1 font-bold text-white">{draft.request.platforms.map((platform) => platformLabels[platform]).join(", ") || "Not selected"}</dd></div>
      <div><dt className="text-xs font-black uppercase tracking-wider text-zinc-600">Included Information</dt><dd className="mt-1 font-bold text-white">{draft.facts.filter((fact) => fact.included).length} selected</dd></div>
      {summaryPackageVersion ? <div><dt className="text-xs font-black uppercase tracking-wider text-zinc-600">Package</dt><dd className="mt-1 font-bold text-white">Version {summaryPackageVersion}</dd></div> : null}
    </dl>
  );

  const commonMessages = (
    <>
      {error ? (
        <div ref={errorRef} role="alert" tabIndex={-1} className="mb-5 border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold leading-6 text-amber-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
          <div><AlertTriangle aria-hidden="true" className="mr-2 inline" size={18} /><span className="sr-only">Action needed: </span>{error}</div>
          {matchingSchool ? (
            <UseExistingSchoolAction
              pending={actionPending}
              onUseExisting={() => void handleUseExistingSchool()}
            />
          ) : null}
        </div>
      ) : null}
      {notice ? <div role="status" className="mb-5 border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold leading-6 text-emerald-100"><Check aria-hidden="true" className="mr-2 inline" size={18} />{notice}</div> : null}
    </>
  );

  const actions = schoolAdded ? (
    <>
      <button type="button" onClick={onExit} className={secondaryButtonClassName}>Done</button>
      <button type="button" onClick={() => void handleBuildSpotlightAfterSchool()} disabled={actionPending} className={primaryButtonClassName}>{actionPending ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <ArrowRight aria-hidden="true" size={16} />} Build a School Spotlight</button>
    </>
  ) : draft.step === FounderWorkflowStep.Request ? (
    <>
      <button type="button" onClick={onExit} className={secondaryButtonClassName}><ArrowLeft aria-hidden="true" size={16} /> Back to Create</button>
      <button type="button" onClick={() => void handleRequestContinue()} disabled={actionPending} aria-describedby={!requestReady ? "spotlight-request-requirements" : undefined} className={primaryButtonClassName}>{actionPending ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <ArrowRight aria-hidden="true" size={16} />} Review Information</button>
    </>
  ) : draft.step === FounderWorkflowStep.Review ? (
    <>
      <button type="button" onClick={() => updateDraft({ step: FounderWorkflowStep.Request })} className={secondaryButtonClassName}><ArrowLeft aria-hidden="true" size={16} /> Request</button>
      <button type="button" onClick={() => void persistDraft(draft)} className={secondaryButtonClassName}><Save aria-hidden="true" size={16} /> Save for Later</button>
      <button type="button" onClick={() => void handleReviewContinue()} disabled={actionPending} className={primaryButtonClassName}>Customize Package <ArrowRight aria-hidden="true" size={16} /></button>
    </>
  ) : draft.step === FounderWorkflowStep.Customize ? (
    <>
      <button type="button" onClick={() => updateDraft({ step: FounderWorkflowStep.Review })} className={secondaryButtonClassName}><ArrowLeft aria-hidden="true" size={16} /> Information Review</button>
      <button type="button" onClick={() => void persistDraft(draft)} className={secondaryButtonClassName}><Save aria-hidden="true" size={16} /> Save for Later</button>
      <button type="button" onClick={() => void handleOpenExactReview()} disabled={actionPending || !draft.customization.rightsConfirmed} aria-describedby={!draft.customization.rightsConfirmed ? "rights-required-reason" : undefined} className={primaryButtonClassName}>{actionPending ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <FileCheck2 aria-hidden="true" size={16} />} Review Exact Version</button>
    </>
  ) : draft.status === FounderWorkflowStatus.Completed ? (
    <button type="button" onClick={onExit} className={primaryButtonClassName}>Return to Create <ArrowRight aria-hidden="true" size={16} /></button>
  ) : (
    <>
      <button type="button" onClick={() => void handleRequestChanges(FounderWorkflowStep.Review)} disabled={actionPending} className={secondaryButtonClassName}>Return to Information Review</button>
      <button type="button" onClick={() => void persistDraft(draft)} className={secondaryButtonClassName}><Save aria-hidden="true" size={16} /> Save for Later</button>
      <button type="button" onClick={() => void handleRequestChanges(FounderWorkflowStep.Customize)} disabled={actionPending} className={secondaryButtonClassName}>Request Changes</button>
      <button type="button" onClick={() => void handleApprove()} disabled={actionPending || !exactReviewPackage} aria-describedby={!exactReviewPackage ? "package-unavailable-reason" : undefined} className={primaryButtonClassName}>{actionPending ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <ShieldCheck aria-hidden="true" size={16} />} Approve Package</button>
    </>
  );

  return (
    <GuidedWorkflowShell
      eyebrow="School Spotlight"
      title={school ? school.name : "School Spotlight Request"}
      step={draft.step}
      saveStatus={saveStatus}
      summary={summary}
      actions={actions}
    >
      {commonMessages}
      {draft.step === FounderWorkflowStep.Request ? (
        <RequestStep
          draft={draft}
          school={school}
          schoolResults={schoolResults}
          schoolSearch={schoolSearch}
          schoolReviewReady={schoolReviewReady}
          schoolAdded={schoolAdded}
          actionPending={actionPending}
          onSearch={setSchoolSearch}
          onSelectSchool={(schoolId) => {
            setMatchingSchool(null);
            updateDraft({ schoolId: schoolId || undefined, schoolDraft: undefined });
          }}
          onStartAddSchool={() => {
            setMatchingSchool(null);
            updateDraft({
              schoolDraft: draft.schoolDraft || { officialName: "", city: "", state: "" },
              schoolId: undefined,
            });
          }}
          onSchoolDraft={(schoolDraft) => {
            setSchoolReviewReady(false);
            setMatchingSchool(null);
            updateDraft({ schoolDraft });
          }}
          onReviewSchool={() => setSchoolReviewReady(true)}
          onAddSchool={() => void handleAddSchool()}
          onRequest={(request) => updateDraft({ request })}
        />
      ) : draft.step === FounderWorkflowStep.Review ? (
        <FactReviewStep draft={draft} graph={graph} onFact={updateFact} />
      ) : draft.step === FounderWorkflowStep.Customize ? (
        <CustomizeStep draft={draft} onCustomization={(customization) => updateDraft({ customization })} />
      ) : (
        <ApprovalStep draft={draft} project={project} spotlightPackage={exactReviewPackage} />
      )}
    </GuidedWorkflowShell>
  );
}

type RequestStepProps = {
  draft: FounderWorkflowDraft;
  school: SchoolNode | null;
  schoolResults: SchoolNode[];
  schoolSearch: string;
  schoolReviewReady: boolean;
  schoolAdded: boolean;
  actionPending: boolean;
  onSearch(value: string): void;
  onSelectSchool(schoolId: string): void;
  onStartAddSchool(): void;
  onSchoolDraft(schoolDraft: GuidedSchoolDraft): void;
  onReviewSchool(): void;
  onAddSchool(): void;
  onRequest(request: FounderWorkflowDraft["request"]): void;
};

function RequestStep({
  draft,
  school,
  schoolResults,
  schoolSearch,
  schoolReviewReady,
  schoolAdded,
  actionPending,
  onSearch,
  onSelectSchool,
  onStartAddSchool,
  onSchoolDraft,
  onReviewSchool,
  onAddSchool,
  onRequest,
}: RequestStepProps) {
  const schoolDraft = draft.schoolDraft;
  const schoolReadyForReview = Boolean(
    schoolDraft?.officialName.trim()
      && schoolDraft.city.trim()
      && schoolDraft.state
      && (validOfficialWebsite(schoolDraft.schoolWebsite) || validOfficialWebsite(schoolDraft.athleticsWebsite)),
  );
  return (
    <div className="grid gap-8">
      <section aria-labelledby="choose-school-title">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">1. Choose School</p>
        <h2 id="choose-school-title" className="mt-2 text-2xl font-black uppercase">Start with the School</h2>
        {schoolAdded && school ? (
          <div className="mt-4 border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-300">School Added</p>
            <h3 className="mt-2 text-xl font-black uppercase text-white">{school.name}</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-emerald-100/80">The verified School information is saved. Choose Done, or continue into a School Spotlight request.</p>
          </div>
        ) : school ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-emerald-400/30 bg-emerald-400/10 p-4">
            <div><p className="font-black text-white">{school.name}</p><p className="mt-1 text-sm font-bold text-emerald-100/80">{school.city}, {school.state}</p></div>
            <button type="button" onClick={() => onSelectSchool("")} className={secondaryButtonClassName}>Choose another</button>
          </div>
        ) : schoolDraft ? (
          <div className="mt-5 grid gap-4 border border-white/10 bg-black p-4 sm:p-5">
            <div>
              <h3 className="text-lg font-black uppercase">Add School</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Only confirmed information is saved after your review. This form autosaves separately while incomplete.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClassName}>Official Name<input required value={schoolDraft.officialName} onChange={(event) => onSchoolDraft({ ...schoolDraft, officialName: event.target.value })} className={inputClassName} /></label>
              <label className={labelClassName}>City<input required value={schoolDraft.city} onChange={(event) => onSchoolDraft({ ...schoolDraft, city: event.target.value })} className={inputClassName} /></label>
              <label className={labelClassName}>State
                <select required value={schoolDraft.state} onChange={(event) => onSchoolDraft({ ...schoolDraft, state: event.target.value })} className={inputClassName}>
                  <option value="">Select a state</option>
                  {hoopFrensStateOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                </select>
              </label>
              <label className={labelClassName}>Known Governing Body <span className="font-normal text-zinc-500">(optional)</span><input value={schoolDraft.governingBody || ""} onChange={(event) => onSchoolDraft({ ...schoolDraft, governingBody: event.target.value || undefined })} className={inputClassName} /></label>
              <label className={labelClassName}>Known Division <span className="font-normal text-zinc-500">(optional)</span><input value={schoolDraft.division || ""} onChange={(event) => onSchoolDraft({ ...schoolDraft, division: event.target.value || undefined })} className={inputClassName} /></label>
              <label className={labelClassName}>School Website <span className="font-normal text-zinc-500">(one website required)</span><input type="url" value={schoolDraft.schoolWebsite || ""} onChange={(event) => onSchoolDraft({ ...schoolDraft, schoolWebsite: event.target.value || undefined })} className={inputClassName} /></label>
              <label className={labelClassName}>Athletics Website <span className="font-normal text-zinc-500">(one website required)</span><input type="url" value={schoolDraft.athleticsWebsite || ""} onChange={(event) => onSchoolDraft({ ...schoolDraft, athleticsWebsite: event.target.value || undefined })} className={inputClassName} /></label>
            </div>
            {schoolReviewReady ? (
              <div className="border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-red-300">Review Before Saving</p>
                <p className="mt-2 text-sm font-bold leading-6 text-white">Add {schoolDraft.officialName || "this School"} in {schoolDraft.city || "the selected city"}, {hoopFrensStateOptions.find((item) => item.code === schoolDraft.state)?.name || "the selected state"} using the official website you supplied.</p>
                <p className="mt-2 text-xs font-bold leading-5 text-zinc-300">Headquarters will derive the Hoop Frens region and connect the School to its State and Region after you confirm.</p>
                <button type="button" onClick={onAddSchool} disabled={actionPending} className={`${primaryButtonClassName} mt-4`}>{actionPending ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Plus aria-hidden="true" size={16} />} Add School</button>
              </div>
            ) : (
              <div>
                <button type="button" onClick={onReviewSchool} disabled={!schoolReadyForReview} aria-describedby={!schoolReadyForReview ? "review-school-requirements" : undefined} className={primaryButtonClassName}>Review School <ArrowRight aria-hidden="true" size={16} /></button>
                {!schoolReadyForReview ? <p id="review-school-requirements" className="mt-3 text-sm font-bold leading-6 text-amber-200">Review is available after you add the official name, city, state, and at least one complete official website address.</p> : null}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            <label className={labelClassName}>Search Schools
              <span className="relative block"><Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} /><input value={schoolSearch} onChange={(event) => onSearch(event.target.value)} placeholder="Search by School, city, or state" className={`${inputClassName} pl-11`} /></span>
            </label>
            <div className="grid gap-2" aria-live="polite">
              {schoolResults.map((candidate) => <button key={candidate.id} type="button" onClick={() => onSelectSchool(candidate.id)} className="flex min-h-14 items-center justify-between border border-white/10 bg-black px-4 py-3 text-left transition hover:border-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><span><span className="block font-black text-white">{candidate.name}</span><span className="mt-1 block text-xs font-bold text-zinc-500">{candidate.city}, {candidate.state}</span></span><ArrowRight aria-hidden="true" className="text-red-400" size={17} /></button>)}
              {schoolSearch.trim() && schoolResults.length === 0 ? <p className="border border-white/10 bg-black p-4 text-sm font-bold text-zinc-400">No matching School found.</p> : null}
            </div>
            <button type="button" onClick={onStartAddSchool} className={secondaryButtonClassName}><Plus aria-hidden="true" size={16} /> Add a School</button>
          </div>
        )}
      </section>

      {school && !schoolAdded ? (
        <section className="border-t border-white/10 pt-7" aria-labelledby="spotlight-request-title">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">2. Define Outcome</p>
          <h2 id="spotlight-request-title" className="mt-2 text-2xl font-black uppercase">Request the Spotlight</h2>
          <div id="spotlight-request-requirements" className="mt-5">
            <StructuredSpotlightRequestFields request={draft.request} onRequest={onRequest} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FactReviewStep({ draft, graph, onFact }: { draft: FounderWorkflowDraft; graph: KnowledgeGraph; onFact(id: string, update: Partial<SchoolSpotlightFact>): void }) {
  const sourceById = new Map(graph.sources.map((source) => [source.id, source]));
  const groups = Object.values(SpotlightFactStatus);

  function openFounderEditor(fact: SchoolSpotlightFact) {
    onFact(fact.id, { founderText: "", included: false });
    window.requestAnimationFrame(() => document.getElementById(`fact-${fact.id}-founder-text`)?.focus());
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Information Review</p>
      <h2 className="mt-2 text-2xl font-black uppercase">Choose what the package may use</h2>
      <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-zinc-400">Supported information starts included. Missing or disputed information stays out unless you add explicit Founder wording.</p>
      <div className="mt-7 grid gap-7">
        {groups.map((status) => {
          const facts = draft.facts.filter((fact) => fact.status === status);
          if (!facts.length) return null;
          return (
            <section key={status} aria-labelledby={`fact-group-${status}`}>
              <h3 id={`fact-group-${status}`} className="text-sm font-black uppercase tracking-wider text-white">{factStatusLabels[status]}</h3>
              <div className="mt-3 grid gap-3">
                {facts.map((fact) => {
                  const sources = fact.sourceIds.flatMap((sourceId) => sourceById.get(sourceId) ? [sourceById.get(sourceId)!] : []);
                  const canInclude = [SpotlightFactStatus.Verified, SpotlightFactStatus.Supported].includes(fact.status) || Boolean(fact.founderText?.trim());
                  return (
                    <article key={fact.id} className="border border-white/10 bg-black p-4 sm:p-5" aria-label={`${fact.label}: ${factStatusLabels[fact.status]}`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-zinc-500">{fact.label}</p><p className="mt-2 break-words text-base font-black text-white">{fact.value || "Not available from verified sources."}</p></div>
                        <label className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-white/15 px-3 text-xs font-black uppercase"><input aria-label={`Include ${fact.label}`} type="checkbox" checked={fact.included} disabled={!canInclude} aria-describedby={!canInclude ? `fact-${fact.id}-include-reason` : undefined} onChange={(event) => onFact(fact.id, { included: event.target.checked })} className="h-4 w-4 accent-red-600" /> Include</label>
                      </div>
                      {!canInclude ? <p id={`fact-${fact.id}-include-reason`} className="mt-3 text-sm font-bold text-amber-200">Add explicit Founder wording before including this information.</p> : null}
                      {fact.founderText !== undefined ? <label className={`${labelClassName} mt-4 block`}>{fact.status === SpotlightFactStatus.NotAvailable ? "Add Information" : "Founder Correction"}<textarea id={`fact-${fact.id}-founder-text`} value={fact.founderText} onChange={(event) => onFact(fact.id, { founderText: event.target.value })} aria-describedby={`fact-${fact.id}-founder-help`} className={`${inputClassName} min-h-24`} /><span id={`fact-${fact.id}-founder-help`} className="mt-2 block text-xs font-bold leading-5 text-zinc-500">Enter the wording, then choose Include to add it to the package.</span></label> : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" aria-label={`Exclude ${fact.label}`} onClick={() => onFact(fact.id, { included: false })} className={secondaryButtonClassName}>Exclude</button>
                        <button type="button" aria-label={`${fact.status === SpotlightFactStatus.NotAvailable ? "Add information for" : "Correct"} ${fact.label}`} onClick={() => openFounderEditor(fact)} className={secondaryButtonClassName}>{fact.status === SpotlightFactStatus.NotAvailable ? "Add Information" : "Correct"}</button>
                      </div>
                      <details className="mt-4 border-t border-white/10 pt-3">
                        <summary className="cursor-pointer text-sm font-black text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Why We Trust This</summary>
                        <div className="mt-3 text-sm leading-6 text-zinc-400">
                          {sources.length ? sources.map((source) => <p key={source.id}>{source.title}{source.publisher ? ` · ${source.publisher}` : ""} · accessed {new Date(source.accessedAt).toLocaleDateString()}</p>) : <p>No verified supporting source is attached yet.</p>}
                          {fact.founderText?.trim() ? <p className="mt-2 text-amber-200">The edited wording is explicitly Founder-authored and will remain labeled that way in the package.</p> : null}
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CustomizeStep({ draft, onCustomization }: { draft: FounderWorkflowDraft; onCustomization(customization: FounderWorkflowDraft["customization"]): void }) {
  const customization = draft.customization;
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Package Studio</p>
      <h2 className="mt-2 text-2xl font-black uppercase">Customize the deliverables</h2>
      <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-zinc-400">Headquarters assembled a consistent starting point from your selected information. Edit every block before review.</p>
      <div className="mt-7 grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className={labelClassName}>Tone<select value={customization.tone} onChange={(event) => onCustomization({ ...customization, tone: event.target.value as SpotlightTone })} className={inputClassName}>{Object.values(SpotlightTone).map((tone) => <option key={tone} value={tone}>{toneLabels[tone]}</option>)}</select></label>
          <label className={labelClassName}>Length<select value={customization.length} onChange={(event) => onCustomization({ ...customization, length: event.target.value as SpotlightLength })} className={inputClassName}>{Object.values(SpotlightLength).map((length) => <option key={length} value={length}>{lengthLabels[length]}</option>)}</select></label>
          <label className={labelClassName}>Hoop Frens Branding<select value={customization.brandingPreset} onChange={(event) => onCustomization({ ...customization, brandingPreset: event.target.value as SpotlightBrandingPreset })} className={inputClassName}>{Object.values(SpotlightBrandingPreset).map((preset) => <option key={preset} value={preset}>{brandingLabels[preset]}</option>)}</select></label>
        </div>
        <label className={labelClassName}>Hook<input value={customization.hook} onChange={(event) => onCustomization({ ...customization, hook: event.target.value })} className={inputClassName} /></label>
        <label className={labelClassName}>Primary Emphasis<input value={customization.emphasis} onChange={(event) => onCustomization({ ...customization, emphasis: event.target.value })} className={inputClassName} /></label>
        <label className={labelClassName}>Call to Action<input value={customization.callToAction} onChange={(event) => onCustomization({ ...customization, callToAction: event.target.value })} className={inputClassName} /></label>
        <label className={labelClassName}>Available Media <span className="font-normal text-zinc-500">(comma separated)</span><input value={customization.mediaAvailability.join(", ")} onChange={(event) => onCustomization({ ...customization, mediaAvailability: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className={inputClassName} /></label>

        <section className="border border-white/10 bg-black p-4 sm:p-5" aria-labelledby="vertical-video-title">
          <h3 id="vertical-video-title" className="text-lg font-black uppercase">Vertical-Video Package</h3>
          <p className="mt-2 text-sm text-zinc-400">One editable structure usable for Instagram Reel, TikTok, and YouTube Short.</p>
          <label className={`${labelClassName} mt-4 block`}>Script and Scene Wording<textarea value={customization.verticalVideoScript} onChange={(event) => onCustomization({ ...customization, verticalVideoScript: event.target.value })} className={`${inputClassName} min-h-64 font-normal leading-7`} /></label>
        </section>
        <section className="border border-white/10 bg-black p-4 sm:p-5" aria-labelledby="caption-title">
          <h3 id="caption-title" className="text-lg font-black uppercase">Instagram Caption</h3>
          <label className={`${labelClassName} mt-4 block`}>Caption<textarea value={customization.instagramCaption} onChange={(event) => onCustomization({ ...customization, instagramCaption: event.target.value })} className={`${inputClassName} min-h-48 font-normal leading-7`} /></label>
        </section>
        <section className="border border-white/10 bg-black p-4 sm:p-5" aria-labelledby="shot-list-title">
          <h3 id="shot-list-title" className="text-lg font-black uppercase">Photo and Video Shot List</h3>
          <label className={`${labelClassName} mt-4 block`}>One shot per line<textarea value={customization.shotList.join("\n")} onChange={(event) => onCustomization({ ...customization, shotList: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} className={`${inputClassName} min-h-44 font-normal leading-7`} /></label>
        </section>
        <label className="flex min-h-14 items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-white"><input type="checkbox" checked={customization.rightsConfirmed} onChange={(event) => onCustomization({ ...customization, rightsConfirmed: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-red-600" /><span>I confirm the package uses approved media or a shot plan that will be cleared before publishing.</span></label>
        {!customization.rightsConfirmed ? <p id="rights-required-reason" className="text-sm font-bold text-amber-200">Founder Review is unavailable until the media rights plan is confirmed.</p> : null}
      </div>
    </div>
  );
}

function ApprovalStep({ draft, project, spotlightPackage }: { draft: FounderWorkflowDraft; project: Project | null; spotlightPackage: SchoolSpotlightPackage | null }) {
  if (!spotlightPackage) return <div id="package-unavailable-reason" className="border border-amber-400/30 bg-amber-400/10 p-5 text-sm font-bold text-amber-100">Approve Package is unavailable while the exact package version is loading. Save for later and reopen if this message remains.</div>;
  const approved = draft.status === FounderWorkflowStatus.Completed || (project?.state || project?.status) === ProjectStatus.Approved;
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Founder Review</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-black uppercase">Review Exact Version</h2><span className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-red-200">Version {spotlightPackage.version}</span></div>
      {approved ? <div className="mt-5 border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">This exact package version is approved. No content was published or scheduled.</div> : null}
      <div className="mt-7 grid gap-5">
        <section className="border border-white/10 bg-black p-4 sm:p-5"><h3 className="text-lg font-black uppercase">Changes</h3><p className="mt-3 text-sm leading-6 text-zinc-300">{spotlightPackage.changeSummary}</p></section>
        <section className="border border-white/10 bg-black p-4 sm:p-5"><h3 className="text-lg font-black uppercase">Selected Information</h3><dl className="mt-4 grid gap-3">{spotlightPackage.selectedFacts.map((fact) => <div key={fact.id} className="border-t border-white/10 pt-3"><dt className="text-xs font-black uppercase tracking-wider text-zinc-500">{fact.label}</dt><dd className="mt-1 text-sm font-bold leading-6 text-white">{fact.value}{fact.founderAuthored ? <span className="ml-2 text-xs text-amber-200">Founder-authored</span> : null}</dd></div>)}</dl></section>
        <section className="border border-white/10 bg-black p-4 sm:p-5"><h3 className="text-lg font-black uppercase">Vertical-Video Package</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{spotlightPackage.workingDraft}</p></section>
        <section className="border border-white/10 bg-black p-4 sm:p-5"><h3 className="text-lg font-black uppercase">Instagram Caption</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{spotlightPackage.instagramCaption}</p></section>
        <section className="border border-white/10 bg-black p-4 sm:p-5"><h3 className="text-lg font-black uppercase">Call to Action</h3><p className="mt-3 text-sm font-bold leading-6 text-zinc-300">{spotlightPackage.verticalVideo.callToAction}</p></section>
        <section className="border border-white/10 bg-black p-4 sm:p-5"><h3 className="text-lg font-black uppercase">Required Media</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{spotlightPackage.shotList.map((shot) => <li key={shot} className="border-l border-red-500/50 pl-3">{shot}</li>)}</ul><p className="mt-4 text-sm font-bold text-emerald-200">Rights plan confirmed: {spotlightPackage.rightsConfirmed ? "Yes" : "No"}</p></section>
        <section className="border border-white/10 bg-black p-4 sm:p-5">
          <h3 className="text-lg font-black uppercase">Source and Verification Package</h3>
          <p className="mt-2 text-sm font-bold text-red-300">Why We Trust This</p>
          <div className="mt-4 grid gap-4">
            {spotlightPackage.selectedFacts.map((fact) => (
              <article key={`verification-${fact.id}`} className="border border-white/10 bg-white/[0.02] p-4">
                <h4 className="font-black text-white">{fact.label}</h4>
                <p className="mt-1 text-sm font-bold leading-6 text-zinc-300">{fact.value}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-wider text-zinc-500">Verification Status</p>
                <p className={`mt-1 text-sm font-bold ${fact.founderAuthored ? "text-amber-200" : "text-emerald-200"}`}>{fact.founderAuthored ? "Founder-authored wording" : factStatusLabels[fact.status]}</p>
                {fact.founderAuthored && fact.sources.length ? <p className="mt-2 text-xs font-bold leading-5 text-amber-100/70">The original source context was reviewed, but it is not presented as verification for the edited wording.</p> : null}
                {fact.sources.length ? (
                  <ul className="mt-3 grid gap-3">
                    {fact.sources.map((source) => (
                      <li key={`${fact.id}-${source.sourceId}-${source.sourceVersion}`} className="border-l border-red-500/50 pl-3 text-sm leading-6 text-zinc-300">
                        <span className="block font-black text-white">{source.title}{source.publisher ? ` · ${source.publisher}` : ""}</span>
                        <span className="block text-xs font-bold text-zinc-500">{sourceQualityLabels[source.reliability]} · accessed {new Date(source.accessedAt).toLocaleDateString()}</span>
                        <details className="mt-2"><summary className="cursor-pointer text-xs font-black text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Advanced Details</summary><p className="mt-2 text-xs text-zinc-600">Evidence snapshot version {source.sourceVersion}</p></details>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm font-bold text-amber-200">{fact.founderAuthored ? "This wording is explicitly Founder-authored." : "No verified supporting source is attached."}</p>}
              </article>
            ))}
          </div>
        </section>
        <section className={spotlightPackage.unresolvedWarnings.length ? "border border-amber-400/30 bg-amber-400/10 p-4 sm:p-5" : "border border-white/10 bg-black p-4 sm:p-5"}><h3 className={`text-lg font-black uppercase ${spotlightPackage.unresolvedWarnings.length ? "text-amber-100" : "text-white"}`}>Information Still Outside the Package</h3>{spotlightPackage.unresolvedWarnings.length ? <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-100/80">{spotlightPackage.unresolvedWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-3 text-sm font-bold text-emerald-200">No unresolved information warnings.</p>}</section>
      </div>
    </div>
  );
}
