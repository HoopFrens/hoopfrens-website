import { createInMemoryKnowledgeGraphRepository, createVolatileKnowledgeGraphStore } from "@/domain/knowledge";
import { addSchoolFromFounderReview, assembleSchoolSpotlightPackage, createSchoolSpotlightDraftInput, deriveSchoolSpotlightFacts, knowledgeService } from "@/services";
import type { FounderWorkflowDraft } from "@/domain/founder-simple";
import { ProjectType, type Project } from "@/domain/project";

// This builds a fixture with released domain services. It is never persisted outside the emulator.
export async function approvedMaloneFixture() {
  const ownerId = "founder-fixture"; const at = "2026-09-06T12:00:00.000Z";
  const knowledge = createInMemoryKnowledgeGraphRepository(createVolatileKnowledgeGraphStore());
  const { school } = await addSchoolFromFounderReview(knowledge, { officialName: "Malone University", city: "Canton", state: "OH", governingBody: "NCAA", division: "Division II", athleticsWebsite: "https://malonepioneers.com" }, ownerId);
  const graph = await knowledgeService.loadGraph(knowledge, "executive-workspace");
  const project = { id: "project-malone-fixture", workspaceId: "executive-workspace", ownerId, title: "Malone fixture", type: ProjectType.SchoolSpotlight, projectType: ProjectType.SchoolSpotlight, knowledgeEntityIds: [school.id] } as Project;
  const input = createSchoolSpotlightDraftInput("malone-fixture-draft", ownerId);
  const draft: FounderWorkflowDraft = { ...input, createdAt: at, updatedAt: at, createdBy: ownerId, updatedBy: ownerId, revision: 1,
    schoolId: school.id, projectId: project.id, facts: deriveSchoolSpotlightFacts(graph, school.id), customization: { ...input.customization, rightsConfirmed: true } };
  const first = assembleSchoolSpotlightPackage(draft, graph, school, project, null, at);
  const pkg = assembleSchoolSpotlightPackage(draft, graph, school, project, first, at);
  return { pkg, project: { ...project, state: "approved", status: "approved", activeSchoolSpotlightPackageId: pkg.id, approvedSchoolSpotlightPackageId: pkg.id, approvedSchoolSpotlightPackageVersion: pkg.version, activeProductionVersion: pkg.version } };
}
