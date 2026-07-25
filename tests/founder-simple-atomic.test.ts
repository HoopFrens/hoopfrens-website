import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryKnowledgeGraphRepository,
  createVolatileKnowledgeGraphStore,
  KnowledgeNodeType,
} from "@/domain/knowledge";
import { addSchoolFromFounderReview, FounderSchoolSubmissionError } from "@/services";

const workspaceId = "executive-workspace";
const actorId = "founder-admin";
const schoolInput = {
  officialName: "Atomic University",
  city: "Ashland",
  state: "OH",
  athleticsWebsite: "https://athletics.atomic.example",
  governingBody: "NCAA",
  division: "Division II",
};

function clock() {
  let value = 0;
  return () => new Date(Date.UTC(2026, 6, 18, 16, 0, value++)).toISOString();
}

test("Founder-confirmed Add School commits one complete bundle or nothing", async () => {
  const store = createVolatileKnowledgeGraphStore();
  const faultingRepository = createInMemoryKnowledgeGraphRepository(store, {
    now: clock(),
    beforeAuditWrite(event) {
      if (event.subjectType === "relationship") {
        throw new Error("Injected School bundle audit failure");
      }
    },
  });

  await assert.rejects(
    addSchoolFromFounderReview(faultingRepository, schoolInput, actorId),
    (error: unknown) => error instanceof FounderSchoolSubmissionError
      && error.code === "unexpected"
      && error.cause instanceof Error
      && /Injected School bundle audit failure/.test(error.cause.message),
  );
  assert.deepEqual(await faultingRepository.listSources(workspaceId), []);
  assert.deepEqual(await faultingRepository.listNodes(workspaceId), []);
  assert.deepEqual(await faultingRepository.listRelationships(workspaceId), []);
  assert.deepEqual(await faultingRepository.listAuditEvents(workspaceId), []);

  const repository = createInMemoryKnowledgeGraphRepository(store, { now: clock() });
  const [first, second] = await Promise.all([
    addSchoolFromFounderReview(repository, schoolInput, actorId),
    addSchoolFromFounderReview(repository, schoolInput, actorId),
  ]);

  assert.equal(first.school.id, second.school.id);
  assert.deepEqual([first.created, second.created].sort(), [false, true]);
  assert.equal((await repository.listSources(workspaceId)).length, 1);
  const nodes = await repository.listNodes(workspaceId);
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.State).length, 1);
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.Region).length, 1);
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.School).length, 1);
  assert.equal((await repository.listRelationships(workspaceId)).length, 2);
  assert.equal((await repository.listAuditEvents(workspaceId)).length, 6);
});

test("two repositories sharing one store preserve concurrent Ashland and Malone School bundles", async () => {
  const store = createVolatileKnowledgeGraphStore();
  const ashlandRepository = createInMemoryKnowledgeGraphRepository(store, { now: clock() });
  const maloneRepository = createInMemoryKnowledgeGraphRepository(store, { now: clock() });

  const [ashland, malone] = await Promise.all([
    addSchoolFromFounderReview(ashlandRepository, {
      officialName: "Ashland University",
      city: "Ashland",
      state: "OH",
      athleticsWebsite: "https://goashlandeagles.com",
      governingBody: "NCAA",
      division: "Division II",
    }, actorId),
    addSchoolFromFounderReview(maloneRepository, {
      officialName: "Malone University",
      city: "Canton",
      state: "OH",
      athleticsWebsite: "https://malonepioneers.com",
      governingBody: "NCAA",
      division: "Division II",
    }, actorId),
  ]);

  assert.equal(ashland.created, true);
  assert.equal(malone.created, true);
  assert.equal(ashland.school.id, "school-ashland-university");
  assert.equal(malone.school.id, "school-malone-university");

  const nodes = await ashlandRepository.listNodes(workspaceId);
  assert.deepEqual(
    nodes.filter((node) => node.type === KnowledgeNodeType.School).map((node) => node.id).sort(),
    ["school-ashland-university", "school-malone-university"],
  );
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.State).length, 1);
  assert.equal(nodes.filter((node) => node.type === KnowledgeNodeType.Region).length, 1);
  assert.equal((await ashlandRepository.listSources(workspaceId)).length, 2);
  assert.equal((await ashlandRepository.listRelationships(workspaceId)).length, 4);
  assert.equal((await ashlandRepository.listAuditEvents(workspaceId)).length, 10);
});
