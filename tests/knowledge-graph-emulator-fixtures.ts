import {
  KnowledgeCategory,
  KnowledgeConfidence,
  type KnowledgeNodeCreateInput,
  KnowledgeNodeType,
  type KnowledgeRelationshipCreateInput,
  KnowledgeRelationshipType,
  type KnowledgeSourceCreateInput,
  KnowledgeSourceReliability,
} from "@/domain/knowledge";
import { KnowledgeRegion } from "@/domain/shared";

export const emulatorWorkspaceId = "executive-workspace";
export const emulatorActorId = "founder-admin";
export const emulatorContext = { actorId: emulatorActorId, reason: "Emulator integrity validation." };

export function emulatorSourceInput(id: string): KnowledgeSourceCreateInput {
  return {
    id,
    workspaceId: emulatorWorkspaceId,
    title: id === "source-official" ? "Official Athletics Source" : "Official Catalog Source",
    sourceType: "official",
    url: `https://example.edu/${id}`,
    publisher: "Example University",
    accessedAt: "2026-07-17T12:00:00.000Z",
    reliability: KnowledgeSourceReliability.Official,
    notes: "Founder-verified emulator evidence.",
    projectIds: [],
  };
}

export function emulatorNodeInput(
  id: string,
  type: Exclude<KnowledgeNodeType, KnowledgeNodeType.School | KnowledgeNodeType.Project | KnowledgeNodeType.Content>,
  name: string,
  sourceIds = ["source-official"],
): KnowledgeNodeCreateInput {
  const category = type === KnowledgeNodeType.State || type === KnowledgeNodeType.Region
    ? KnowledgeCategory.Geography
    : type === KnowledgeNodeType.Coach || type === KnowledgeNodeType.Player
      ? KnowledgeCategory.Person
      : KnowledgeCategory.Organization;
  return {
    id,
    workspaceId: emulatorWorkspaceId,
    type,
    category,
    name,
    description: `${name} canonical emulator record.`,
    confidence: KnowledgeConfidence.Verified,
    sourceIds,
    aliases: [],
    tags: ["emulator"],
  };
}

export function emulatorSchoolInput(id: string, name: string): Extract<KnowledgeNodeCreateInput, { type: KnowledgeNodeType.School }> {
  return {
    id,
    workspaceId: emulatorWorkspaceId,
    type: KnowledgeNodeType.School,
    category: KnowledgeCategory.Institution,
    name,
    description: `${name} canonical emulator School record.`,
    confidence: KnowledgeConfidence.Verified,
    sourceIds: ["source-official"],
    aliases: [],
    tags: ["emulator"],
    officialName: name,
    city: "Ashland",
    state: "Ohio",
    stateNodeId: "state-ohio",
    region: KnowledgeRegion.GreaterLakes,
    regionNodeId: "region-greater-lakes",
    conference: null,
    division: "NCAA Division II",
    governingBody: "NCAA",
    schoolWebsite: "https://example.edu",
    athleticsWebsite: "https://example.edu/athletics",
    facilities: [],
    coaches: [],
    recruitingNotes: [],
    connectedProjectIds: [],
    connectedContentIds: [],
  };
}

export function emulatorProjectInput(
  id: string,
  name: string,
): Extract<KnowledgeNodeCreateInput, { type: KnowledgeNodeType.Project }> {
  return {
    id,
    workspaceId: emulatorWorkspaceId,
    type: KnowledgeNodeType.Project,
    category: KnowledgeCategory.Work,
    name,
    description: `${name} canonical emulator Project record.`,
    confidence: KnowledgeConfidence.Verified,
    sourceIds: ["source-official"],
    aliases: [],
    tags: ["emulator"],
    projectId: `project-${id}`,
  };
}

export function emulatorContentInput(
  id: string,
  name: string,
): Extract<KnowledgeNodeCreateInput, { type: KnowledgeNodeType.Content }> {
  return {
    id,
    workspaceId: emulatorWorkspaceId,
    type: KnowledgeNodeType.Content,
    category: KnowledgeCategory.Content,
    name,
    description: `${name} canonical emulator Content record.`,
    confidence: KnowledgeConfidence.Verified,
    sourceIds: ["source-official"],
    aliases: [],
    tags: ["emulator"],
    contentId: `content-${id}`,
    contentUrl: `https://example.edu/content/${id}`,
  };
}

export function emulatorRelationshipInput(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  relationshipType: KnowledgeRelationshipType = KnowledgeRelationshipType.SchoolLocatedInState,
  sourceIds = ["source-official"],
): KnowledgeRelationshipCreateInput {
  return {
    id,
    workspaceId: emulatorWorkspaceId,
    fromNodeId,
    toNodeId,
    relationshipType,
    description: "Founder-verified emulator relationship.",
    confidence: KnowledgeConfidence.Verified,
    sourceIds,
    projectIds: [],
  };
}

export function firstTwoTransactionBarrier() {
  let arrivals = 0;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  return async () => {
    if (arrivals >= 2) return;
    arrivals += 1;
    const arrival = arrivals;
    if (arrivals === 2) release();
    await gate;
    // Both transactions have read the same claim state; stagger their commits so
    // the emulator deterministically exercises retry contention without evaluating
    // two near-budget rules batches in the same scheduler tick.
    if (arrival === 2) await new Promise((resolve) => setTimeout(resolve, 1500));
  };
}
