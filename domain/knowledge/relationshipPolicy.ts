import {
  type KnowledgeNode,
  KnowledgeNodeType,
  type KnowledgeRelationship,
  KnowledgeRelationshipType,
  KnowledgeStatus,
} from "./types";

export type KnowledgeRelationshipExclusiveEndpoint = "from" | "to" | null;

export interface KnowledgeRelationshipPolicy {
  fromNodeType: KnowledgeNodeType;
  toNodeType: KnowledgeNodeType;
  direction: "directed";
  exclusive: boolean;
  exclusiveEndpoint: KnowledgeRelationshipExclusiveEndpoint;
  allowMultipleActiveFrom: boolean;
  allowMultipleActiveTo: boolean;
  semanticFamily: string;
  canonicalDirection: "as-authored" | "reverse";
}

const directed = (
  fromNodeType: KnowledgeNodeType,
  toNodeType: KnowledgeNodeType,
  allowMultipleActiveFrom: boolean,
  allowMultipleActiveTo: boolean,
  semanticFamily: string,
  canonicalDirection: "as-authored" | "reverse" = "as-authored",
): KnowledgeRelationshipPolicy => ({
  fromNodeType,
  toNodeType,
  direction: "directed",
  exclusive: !allowMultipleActiveFrom || !allowMultipleActiveTo,
  exclusiveEndpoint: !allowMultipleActiveFrom ? "from" : !allowMultipleActiveTo ? "to" : null,
  allowMultipleActiveFrom,
  allowMultipleActiveTo,
  semanticFamily,
  canonicalDirection,
});

export const knowledgeRelationshipPolicy: Record<KnowledgeRelationshipType, KnowledgeRelationshipPolicy> = {
  [KnowledgeRelationshipType.SchoolBelongsToConference]: directed(KnowledgeNodeType.School, KnowledgeNodeType.Conference, false, true, "school-conference"),
  [KnowledgeRelationshipType.SchoolLocatedInState]: directed(KnowledgeNodeType.School, KnowledgeNodeType.State, false, true, "school-state"),
  [KnowledgeRelationshipType.SchoolLocatedInRegion]: directed(KnowledgeNodeType.School, KnowledgeNodeType.Region, false, true, "school-region"),
  [KnowledgeRelationshipType.SchoolHasCoach]: directed(KnowledgeNodeType.School, KnowledgeNodeType.Coach, true, false, "school-coach"),
  [KnowledgeRelationshipType.SchoolHasFacility]: directed(KnowledgeNodeType.School, KnowledgeNodeType.Facility, true, false, "school-facility"),
  [KnowledgeRelationshipType.ProjectAboutSchool]: directed(KnowledgeNodeType.Project, KnowledgeNodeType.School, true, true, "project-school"),
  [KnowledgeRelationshipType.ContentAboutSchool]: directed(KnowledgeNodeType.Content, KnowledgeNodeType.School, true, true, "content-school"),
  [KnowledgeRelationshipType.CoachWorksAtSchool]: directed(KnowledgeNodeType.Coach, KnowledgeNodeType.School, false, true, "school-coach", "reverse"),
  [KnowledgeRelationshipType.ConferenceGovernsSchool]: directed(KnowledgeNodeType.Conference, KnowledgeNodeType.School, true, false, "school-conference", "reverse"),
  [KnowledgeRelationshipType.PlayerConnectedToSchool]: directed(KnowledgeNodeType.Player, KnowledgeNodeType.School, true, true, "player-school"),
  [KnowledgeRelationshipType.FacilityBelongsToSchool]: directed(KnowledgeNodeType.Facility, KnowledgeNodeType.School, false, true, "school-facility", "reverse"),
};

export function relationshipPolicyFor(type: KnowledgeRelationshipType) {
  return knowledgeRelationshipPolicy[type];
}

export function validateRelationshipEndpoints(
  fromNode: KnowledgeNode,
  toNode: KnowledgeNode,
  relationshipType: KnowledgeRelationshipType,
  workspaceId = fromNode.workspaceId,
) {
  const policy = relationshipPolicyFor(relationshipType);
  if (fromNode.id === toNode.id) throw new Error("Choose two different knowledge records to connect.");
  if (fromNode.workspaceId !== workspaceId || toNode.workspaceId !== workspaceId) {
    throw new Error("Both knowledge records must belong to this workspace.");
  }
  if (fromNode.status !== KnowledgeStatus.Active || toNode.status !== KnowledgeStatus.Active) {
    throw new Error("Archived knowledge records cannot be used in an active relationship.");
  }
  if (fromNode.type !== policy.fromNodeType || toNode.type !== policy.toNodeType) {
    throw new Error(`${relationshipType} requires ${policy.fromNodeType} as the From record and ${policy.toNodeType} as the To record.`);
  }
  return policy;
}

function safeKey(value: string) {
  return encodeURIComponent(value).replace(/\./g, "%2E");
}

export function canonicalKnowledgeNodeClaimKey(workspaceId: string, nodeType: KnowledgeNodeType, canonicalName: string) {
  return `${safeKey(workspaceId)}:${nodeType}:${safeKey(canonicalName)}`;
}

/** Alias and canonical names deliberately share one claim namespace. */
export const canonicalKnowledgeAliasClaimKey = canonicalKnowledgeNodeClaimKey;

export function canonicalRelationshipEndpoints(
  relationship: Pick<KnowledgeRelationship, "fromNodeId" | "toNodeId" | "relationshipType">,
) {
  const policy = relationshipPolicyFor(relationship.relationshipType);
  return policy.canonicalDirection === "reverse"
    ? { fromNodeId: relationship.toNodeId, toNodeId: relationship.fromNodeId }
    : { fromNodeId: relationship.fromNodeId, toNodeId: relationship.toNodeId };
}

export function relationshipIdentity(relationship: Pick<KnowledgeRelationship, "workspaceId" | "fromNodeId" | "toNodeId" | "relationshipType">) {
  const policy = relationshipPolicyFor(relationship.relationshipType);
  const endpoints = canonicalRelationshipEndpoints(relationship);
  return [relationship.workspaceId, policy.semanticFamily, endpoints.fromNodeId, endpoints.toNodeId].join(":");
}

export const canonicalKnowledgeRelationshipClaimKey = relationshipIdentity;

export function exclusiveKnowledgeRelationshipClaimKey(
  relationship: Pick<KnowledgeRelationship, "workspaceId" | "fromNodeId" | "toNodeId" | "relationshipType">,
) {
  const policy = relationshipPolicyFor(relationship.relationshipType);
  if (!policy.exclusiveEndpoint) return null;
  const endpoints = canonicalRelationshipEndpoints(relationship);
  const endpointId = policy.semanticFamily === "school-conference"
    ? endpoints.fromNodeId
    : policy.semanticFamily === "school-coach" || policy.semanticFamily === "school-facility"
      ? endpoints.toNodeId
      : policy.exclusiveEndpoint === "from" ? relationship.fromNodeId : relationship.toNodeId;
  return [relationship.workspaceId, policy.semanticFamily, "exclusive", endpointId].join(":");
}
