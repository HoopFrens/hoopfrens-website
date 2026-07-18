import {
  isContentKnowledgeNode,
  isProjectKnowledgeNode,
  isSchoolKnowledgeNode,
  KnowledgeCategory,
  KnowledgeConfidence,
  type KnowledgeNode,
  KnowledgeNodeType,
  type KnowledgeRelationship,
  KnowledgeRelationshipType,
  type KnowledgeSource,
  KnowledgeStatus,
  relationshipPolicyFor,
} from "@/domain/knowledge";
import { KnowledgeRegion } from "@/domain/shared";

export const allKnowledgeFilters = "all";

export type KnowledgeSortOption = "name" | "updated" | "confidence" | "type";

export type KnowledgeExplorerFilters = {
  query: string;
  type: KnowledgeNodeType | typeof allKnowledgeFilters;
  category?: KnowledgeCategory | typeof allKnowledgeFilters;
  confidence: KnowledgeConfidence | typeof allKnowledgeFilters;
  status: KnowledgeStatus | typeof allKnowledgeFilters;
  region: KnowledgeRegion | typeof allKnowledgeFilters;
  state: string | typeof allKnowledgeFilters;
  sort: KnowledgeSortOption;
};

export type KnowledgeConnection = {
  relationship: KnowledgeRelationship;
  connectedNode: KnowledgeNode;
  direction: "outgoing" | "incoming";
};

export function relationshipEndpointOptions(
  nodes: KnowledgeNode[],
  relationshipType: KnowledgeRelationshipType,
  selectedFromNodeId = "",
  workspaceId = nodes.find((node) => node.id === selectedFromNodeId)?.workspaceId || nodes[0]?.workspaceId || "",
) {
  const policy = relationshipPolicyFor(relationshipType);
  return {
    policy,
    fromNodes: nodes.filter((node) => (
      node.status === KnowledgeStatus.Active
      && node.type === policy.fromNodeType
      && (!workspaceId || node.workspaceId === workspaceId)
    )),
    toNodes: nodes.filter((node) => (
      node.status === KnowledgeStatus.Active
      && node.type === policy.toNodeType
      && node.id !== selectedFromNodeId
      && (!workspaceId || node.workspaceId === workspaceId)
    )),
  };
}

const confidenceRank: Record<KnowledgeConfidence, number> = {
  [KnowledgeConfidence.Verified]: 5,
  [KnowledgeConfidence.Supported]: 4,
  [KnowledgeConfidence.Inferred]: 3,
  [KnowledgeConfidence.Unverified]: 2,
  [KnowledgeConfidence.Conflicting]: 1,
};

function schoolSearchValues(node: KnowledgeNode) {
  if (!isSchoolKnowledgeNode(node)) return [];
  return [
    node.officialName,
    node.nickname || "",
    node.city,
    node.state,
    node.region,
    node.division,
    node.governingBody,
    node.schoolWebsite,
    node.athleticsWebsite,
    ...node.recruitingNotes,
  ];
}

export function filterKnowledgeNodes(
  nodes: KnowledgeNode[],
  filters: KnowledgeExplorerFilters,
  sources: KnowledgeSource[] = [],
) {
  const query = filters.query.trim().toLowerCase();
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const filtered = nodes.filter((node) => {
    if (filters.type !== allKnowledgeFilters && node.type !== filters.type) return false;
    if (filters.category && filters.category !== allKnowledgeFilters && node.category !== filters.category) return false;
    if (filters.confidence !== allKnowledgeFilters && node.confidence !== filters.confidence) return false;
    if (filters.status !== allKnowledgeFilters && node.status !== filters.status) return false;
    if (filters.region !== allKnowledgeFilters && (!isSchoolKnowledgeNode(node) || node.region !== filters.region)) return false;
    if (filters.state !== allKnowledgeFilters && (!isSchoolKnowledgeNode(node) || node.state !== filters.state)) return false;
    if (!query) return true;
    const searchValues = [
      node.id,
      node.name,
      node.description,
      node.type,
      node.category,
      node.confidence,
      ...node.aliases,
      ...node.tags,
      ...node.sourceIds.flatMap((sourceId) => {
        const source = sourceById.get(sourceId);
        return source ? [source.title, source.publisher || "", source.reliability] : [];
      }),
      ...schoolSearchValues(node),
    ];
    return searchValues.some((value) => value.toLowerCase().includes(query));
  });

  return [...filtered].sort((first, second) => {
    if (filters.sort === "updated") return Date.parse(second.updatedAt) - Date.parse(first.updatedAt) || first.name.localeCompare(second.name);
    if (filters.sort === "confidence") return confidenceRank[second.confidence] - confidenceRank[first.confidence] || first.name.localeCompare(second.name);
    if (filters.sort === "type") return first.type.localeCompare(second.type) || first.name.localeCompare(second.name);
    return first.name.localeCompare(second.name) || first.id.localeCompare(second.id);
  });
}

export function connectionsForNode(
  nodeId: string,
  nodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[],
): KnowledgeConnection[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return relationships.reduce<KnowledgeConnection[]>((connections, relationship) => {
    if (relationship.fromNodeId === nodeId) {
      const connectedNode = nodeById.get(relationship.toNodeId);
      if (connectedNode) connections.push({ relationship, connectedNode, direction: "outgoing" });
    }
    if (relationship.toNodeId === nodeId) {
      const connectedNode = nodeById.get(relationship.fromNodeId);
      if (connectedNode) connections.push({ relationship, connectedNode, direction: "incoming" });
    }
    return connections;
  }, []);
}

export function connectedProjectIds(
  node: KnowledgeNode,
  nodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[],
) {
  const projectIds = new Set<string>();
  if (isProjectKnowledgeNode(node)) projectIds.add(node.projectId);
  for (const connection of connectionsForNode(node.id, nodes, relationships)) {
    if (
      connection.relationship.status === KnowledgeStatus.Active
      && connection.connectedNode.status === KnowledgeStatus.Active
      && connection.relationship.workspaceId === node.workspaceId
      && connection.connectedNode.workspaceId === node.workspaceId
      && isProjectKnowledgeNode(connection.connectedNode)
    ) {
      projectIds.add(connection.connectedNode.projectId);
    }
  }
  return Array.from(projectIds).sort((first, second) => first.localeCompare(second));
}

export function connectedContentIds(
  node: KnowledgeNode,
  nodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[],
) {
  const contentIds = new Set<string>();
  if (isContentKnowledgeNode(node)) contentIds.add(node.contentId);
  for (const connection of connectionsForNode(node.id, nodes, relationships)) {
    if (
      connection.relationship.status === KnowledgeStatus.Active
      && connection.connectedNode.status === KnowledgeStatus.Active
      && connection.relationship.workspaceId === node.workspaceId
      && connection.connectedNode.workspaceId === node.workspaceId
      && isContentKnowledgeNode(connection.connectedNode)
    ) {
      contentIds.add(connection.connectedNode.contentId);
    }
  }
  return Array.from(contentIds).sort((first, second) => first.localeCompare(second));
}

export function schoolStates(nodes: KnowledgeNode[]) {
  return Array.from(new Set(nodes.filter(isSchoolKnowledgeNode).map((node) => node.state)))
    .sort((first, second) => first.localeCompare(second));
}

export function knowledgeOverview(nodes: KnowledgeNode[], relationships: KnowledgeRelationship[]) {
  return {
    totalNodes: nodes.length,
    totalRelationships: relationships.length,
    verified: nodes.filter((node) => node.confidence === KnowledgeConfidence.Verified).length,
    unverified: nodes.filter((node) => node.confidence === KnowledgeConfidence.Unverified).length,
    conflicting: nodes.filter((node) => node.confidence === KnowledgeConfidence.Conflicting).length
      + relationships.filter((relationship) => relationship.confidence === KnowledgeConfidence.Conflicting).length,
    recentlyUpdated: [...nodes].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt)).slice(0, 5),
  };
}

export function formatKnowledgeLabel(value: string) {
  return value
    .toLowerCase()
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
