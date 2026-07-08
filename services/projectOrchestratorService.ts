import { type ExecutionPlan, ExecutionStatus } from "@/domain/execution";
import {
  type OrchestrationRequest,
  type OrchestrationResult,
  OrchestrationStatus,
  type OrchestrationStep,
} from "@/domain/orchestration";
import type { ServiceResult } from "./serviceResult";

type OrchestrationPathway = {
  recommendedNextAction: string;
  steps: Array<Omit<OrchestrationStep, "id" | "order">>;
};

const orchestrationPathways: Record<string, OrchestrationPathway> = {
  "create-project": {
    recommendedNextAction: "Prepare the project creation pathway.",
    steps: [
      {
        label: "Queue project creation",
        pathway: "Project Engine",
      },
      {
        label: "Prepare founder review checkpoint",
        pathway: "Conversation Engine",
      },
    ],
  },
  "resume-project": {
    recommendedNextAction: "Prepare the project resume pathway.",
    steps: [
      {
        label: "Queue project context lookup",
        pathway: "Project Engine",
      },
      {
        label: "Prepare continuation checkpoint",
        pathway: "Conversation Engine",
      },
    ],
  },
  "review-package": {
    recommendedNextAction: "Prepare the review pathway.",
    steps: [
      {
        label: "Queue package review",
        pathway: "Project Engine",
      },
      {
        label: "Prepare decision checkpoint",
        pathway: "Decision System",
      },
    ],
  },
  "approve-work": {
    recommendedNextAction: "Prepare the approval pathway.",
    steps: [
      {
        label: "Queue approval confirmation",
        pathway: "Decision System",
      },
      {
        label: "Prepare approval record placeholder",
        pathway: "Project Engine",
      },
    ],
  },
  "return-knowledge": {
    recommendedNextAction: "Prepare the knowledge response pathway.",
    steps: [
      {
        label: "Queue knowledge retrieval",
        pathway: "Knowledge System",
      },
      {
        label: "Prepare intelligence room handoff",
        pathway: "Intelligence Center",
      },
    ],
  },
  "create-strategic-brief": {
    recommendedNextAction: "Prepare the strategic brief pathway.",
    steps: [
      {
        label: "Queue strategic framing",
        pathway: "Strategy Room",
      },
      {
        label: "Prepare decision context placeholder",
        pathway: "Decision System",
      },
    ],
  },
  "search-existing-objects": {
    recommendedNextAction: "Prepare the existing-object search pathway.",
    steps: [
      {
        label: "Queue object search",
        pathway: "Knowledge System",
      },
      {
        label: "Prepare cross-object result placeholder",
        pathway: "Project Engine",
      },
    ],
  },
  "route-room": {
    recommendedNextAction: "Prepare the room route pathway.",
    steps: [
      {
        label: "Queue room routing",
        pathway: "Conversation Engine",
      },
    ],
  },
};

function createRequestId(plan: ExecutionPlan) {
  return `orchestration_request_${plan.id}`;
}

function createResultId(plan: ExecutionPlan) {
  return `orchestration_result_${plan.id}`;
}

function createRequest(plan: ExecutionPlan): OrchestrationRequest {
  return {
    id: createRequestId(plan),
    executionPlan: plan,
    requestedBy: "system",
    createdAt: new Date().toISOString(),
  };
}

function buildCompletedSteps(planType: string, steps: OrchestrationPathway["steps"]): OrchestrationStep[] {
  return steps.map((step, index) => ({
    ...step,
    id: `${planType}-orchestration-step-${index + 1}`,
    order: index + 1,
  }));
}

function createBlockedResult(plan: ExecutionPlan, requestId: string, reason: string): OrchestrationResult {
  return {
    id: createResultId(plan),
    requestId,
    status: OrchestrationStatus.Blocked,
    completedSteps: [],
    blockedReason: reason,
    recommendedNextAction: plan.clarificationQuestion || "Clarify the execution plan before orchestration.",
    createdAt: new Date().toISOString(),
  };
}

function orchestrateRequest(request: OrchestrationRequest): OrchestrationResult {
  const plan = request.executionPlan;

  if (plan.status === ExecutionStatus.Blocked || plan.clarificationRequired || plan.planType === "blocked-clarification") {
    return createBlockedResult(plan, request.id, "Execution plan is blocked pending founder clarification.");
  }

  const pathway = orchestrationPathways[plan.planType];
  if (!pathway) {
    return createBlockedResult(plan, request.id, `No deterministic orchestration pathway exists for plan type: ${plan.planType}.`);
  }

  return {
    id: createResultId(plan),
    requestId: request.id,
    status: OrchestrationStatus.Pending,
    completedSteps: buildCompletedSteps(plan.planType, pathway.steps),
    recommendedNextAction: pathway.recommendedNextAction,
    createdAt: new Date().toISOString(),
  };
}

export const projectOrchestratorService = {
  orchestrate(executionPlan: ExecutionPlan): ServiceResult<OrchestrationResult> {
    const request = createRequest(executionPlan);

    return {
      ok: true,
      data: orchestrateRequest(request),
    };
  },
};
