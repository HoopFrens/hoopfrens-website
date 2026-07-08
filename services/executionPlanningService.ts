import { type ExecutionPlan, ExecutionStatus, type ExecutionStep } from "@/domain/execution";
import { IntentType, type IntentResult } from "@/domain/intent";
import { Priority, Scope } from "@/domain/shared";
import type { ServiceResult } from "./serviceResult";

type PlanTemplate = {
  planType: string;
  priority: Priority;
  requiredSystems: string[];
  requiredDeliverables: string[];
  founderReviewRequired: boolean;
  founderApprovalRequired: boolean;
  status: ExecutionStatus;
  steps: Array<Omit<ExecutionStep, "id" | "order">>;
};

const planTemplates: Record<IntentType, PlanTemplate> = {
  [IntentType.Create]: {
    planType: "create-project",
    priority: Priority.High,
    requiredSystems: ["Project Engine", "Production Studio", "Conversation Engine"],
    requiredDeliverables: ["Project draft", "Founder review point"],
    founderReviewRequired: true,
    founderApprovalRequired: false,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Frame the project",
        description: "Turn the source intent into a project-ready brief.",
        requiredSystem: "Project Engine",
      },
      {
        label: "Prepare workspace context",
        description: "Route the work to the correct internal room for future execution.",
        requiredSystem: "Conversation Engine",
      },
    ],
  },
  [IntentType.Continue]: {
    planType: "resume-project",
    priority: Priority.Medium,
    requiredSystems: ["Project Engine", "Conversation Engine"],
    requiredDeliverables: ["Resumed project context"],
    founderReviewRequired: false,
    founderApprovalRequired: false,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Locate the project context",
        description: "Identify the named project or conversation thread.",
        requiredSystem: "Project Engine",
      },
      {
        label: "Resume the operating thread",
        description: "Prepare the next continuation point for the founder.",
        requiredSystem: "Conversation Engine",
      },
    ],
  },
  [IntentType.Review]: {
    planType: "review-package",
    priority: Priority.High,
    requiredSystems: ["Project Engine", "Decision System"],
    requiredDeliverables: ["Review package", "Review notes"],
    founderReviewRequired: true,
    founderApprovalRequired: false,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Collect review materials",
        description: "Prepare the requested work for founder review.",
        requiredSystem: "Project Engine",
      },
      {
        label: "Create review checkpoint",
        description: "Mark the review decision point for future tracking.",
        requiredSystem: "Decision System",
      },
    ],
  },
  [IntentType.Approve]: {
    planType: "approve-work",
    priority: Priority.Critical,
    requiredSystems: ["Decision System", "Project Engine"],
    requiredDeliverables: ["Approval record"],
    founderReviewRequired: true,
    founderApprovalRequired: true,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Confirm approval target",
        description: "Verify what work is being approved before any future action.",
        requiredSystem: "Decision System",
      },
      {
        label: "Prepare approval state",
        description: "Prepare the work item for a future approval record.",
        requiredSystem: "Project Engine",
      },
    ],
  },
  [IntentType.Learn]: {
    planType: "return-knowledge",
    priority: Priority.Medium,
    requiredSystems: ["Knowledge System", "Intelligence Center"],
    requiredDeliverables: ["Knowledge summary placeholder"],
    founderReviewRequired: false,
    founderApprovalRequired: false,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Identify knowledge target",
        description: "Use the intent entity as the subject of a future knowledge response.",
        requiredSystem: "Knowledge System",
      },
      {
        label: "Prepare intelligence route",
        description: "Route the request to the Intelligence Center.",
        requiredSystem: "Intelligence Center",
      },
    ],
  },
  [IntentType.Think]: {
    planType: "create-strategic-brief",
    priority: Priority.High,
    requiredSystems: ["Strategy Room", "Decision System", "Conversation Engine"],
    requiredDeliverables: ["Strategic brief placeholder"],
    founderReviewRequired: true,
    founderApprovalRequired: false,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Frame the strategic question",
        description: "Convert the intent into a strategic brief prompt.",
        requiredSystem: "Strategy Room",
      },
      {
        label: "Prepare decision context",
        description: "Set up future decision tracking for the strategic brief.",
        requiredSystem: "Decision System",
      },
    ],
  },
  [IntentType.Search]: {
    planType: "search-existing-objects",
    priority: Priority.Medium,
    requiredSystems: ["Knowledge System", "Project Engine", "People & Organizations"],
    requiredDeliverables: ["Search request placeholder"],
    founderReviewRequired: false,
    founderApprovalRequired: false,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Normalize search target",
        description: "Prepare the requested search phrase for future object lookup.",
        requiredSystem: "Knowledge System",
      },
      {
        label: "Route to object search",
        description: "Route search across known business object groups.",
        requiredSystem: "Project Engine",
      },
    ],
  },
  [IntentType.Navigate]: {
    planType: "route-room",
    priority: Priority.Low,
    requiredSystems: ["Conversation Engine"],
    requiredDeliverables: ["Workspace route"],
    founderReviewRequired: false,
    founderApprovalRequired: false,
    status: ExecutionStatus.Ready,
    steps: [
      {
        label: "Resolve target room",
        description: "Use the intent route to move to the requested workspace room.",
        requiredSystem: "Conversation Engine",
      },
    ],
  },
  [IntentType.Unknown]: {
    planType: "blocked-clarification",
    priority: Priority.Low,
    requiredSystems: ["Conversation Engine"],
    requiredDeliverables: ["Clarification question"],
    founderReviewRequired: true,
    founderApprovalRequired: false,
    status: ExecutionStatus.Blocked,
    steps: [
      {
        label: "Ask for clarification",
        description: "Pause execution until the founder clarifies the request.",
        requiredSystem: "Conversation Engine",
      },
    ],
  },
};

function createPlanId(intent: IntentResult) {
  const base = intent.intentType.replace(/[^a-z0-9-]/gi, "-");
  const normalizedInput = intent.normalizedInput.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `plan_${base}_${normalizedInput || "unknown"}`;
}

function buildSteps(planType: string, steps: PlanTemplate["steps"]): ExecutionStep[] {
  return steps.map((step, index) => ({
    ...step,
    id: `${planType}-step-${index + 1}`,
    order: index + 1,
  }));
}

function createExecutionPlan(sourceIntent: IntentResult): ExecutionPlan {
  const template = planTemplates[sourceIntent.intentType];
  const clarificationRequired = sourceIntent.intentType === IntentType.Unknown || sourceIntent.clarificationRequired;

  return {
    id: createPlanId(sourceIntent),
    sourceIntent,
    planType: template.planType,
    targetWorkspace: sourceIntent.targetWorkspace,
    targetRoom: sourceIntent.targetRoom,
    projectType: sourceIntent.suggestedProjectType,
    priority: template.priority,
    scope: Scope.Internal,
    requiredSystems: template.requiredSystems,
    requiredSteps: buildSteps(template.planType, template.steps),
    requiredDeliverables: template.requiredDeliverables,
    founderReviewRequired: template.founderReviewRequired,
    founderApprovalRequired: template.founderApprovalRequired,
    clarificationRequired,
    clarificationQuestion: sourceIntent.clarificationQuestion,
    status: clarificationRequired ? ExecutionStatus.Blocked : template.status,
    createdAt: new Date().toISOString(),
  };
}

export const executionPlanningService = {
  createPlan(intentResult: IntentResult): ServiceResult<ExecutionPlan> {
    return {
      ok: true,
      data: createExecutionPlan(intentResult),
    };
  },
};
