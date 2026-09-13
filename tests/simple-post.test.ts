import assert from "node:assert/strict";
import test from "node:test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { latestSchoolPackages, simpleCarousel, validateSchoolRequest } from "@/domain/content-intelligence/simple-post";
import { validateStoryboard } from "@/domain/content-intelligence/storyboard";
import { IntelligenceRepository, collections } from "@/server/content-intelligence/repository";
import type { ResearchPackage } from "@/domain/content-intelligence/types";
const evidence: ResearchPackage = {
  id: "simple-fixture", kind: "governed-research", version: 1, revision: 2, binding: { ownerId: "simple-owner", workspaceId: "executive-workspace", projectId: "simple-project", packageId: "simple-v2", schoolId: "school-malone-university", schoolName: "Malone University", version: 2, contentHash: "fixture-only" },
  sources: [{id:"s1",url:"https://malonepioneers.com/fixture",title:"Synthetic evidence",contentHash:"fixture",accessedAt:"2026-09-13T00:00:00Z"}],
  claims: [{id:"c1",text:"Osborne Hall fixture fact, not a real claim.",field:"facility",value:"fixture",confidence:"supported",review:{actorId:"simple-owner",decision:"supported",at:"2026-09-13T00:00:00Z"},evidence:[{sourceId:"s1",quote:"Osborne Hall fixture fact, not a real claim."}]}],
  missingInformation: [], conflicts: [], createdAt: "2026-09-13T00:00:00Z", policyVersion: "fixture", originatingRunId:"fixture-run"
};
test("simple school choices select one newest version independently of source ordering", () => {
  const older = {...evidence.binding,version:1,packageId:"simple-v1",projectId:"old-project"};
  assert.deepEqual(latestSchoolPackages([evidence.binding,older]),[evidence.binding]);
  assert.deepEqual(latestSchoolPackages([older,evidence.binding]),[evidence.binding]);
});
test("simple carousel uses reviewed claims, leaves permissions and final copy review pending", () => {
  const board = simpleCarousel(evidence);
  assert.deepEqual(validateStoryboard(board,evidence),board);
  assert.equal(board.slides.length,3);
  assert.equal(board.slides[1].body,evidence.claims[0].text);
  assert.ok(board.assets.every(a=>a.rights==="pending" && !a.permissionNote));
  assert.ok(board.slides.every(s=>!s.copyReviewed));
  assert.equal(board.captionReviewed,false);
  const rejected=structuredClone(evidence);rejected.claims[0].confidence="rejected";
  assert.throws(()=>simpleCarousel(rejected),/research-review-required/);
});
test("unknown facility facts never receive a preselected real-school photo", () => {
  const copy=structuredClone(evidence);copy.claims[0].text="Synthetic basketball detail.";
  const board=simpleCarousel(copy);
  assert.equal(board.assets.length,0);
  assert.ok(board.slides.every(s=>s.layout==="text" && s.assetId===null));
});
test("school requests capture team and location without accepting caller status or authority", () => {
  assert.deepEqual(validateSchoolRequest({schoolName:" New College ",team:"Football",location:"Ohio"}),{schoolName:"New College",team:"Football",location:"Ohio"});
  for(const input of [{schoolName:"A",team:"Football",location:""},{schoolName:"College",team:"Baseball",location:""},{schoolName:"College",team:"Football",location:"",status:"approved"},{schoolName:"College\nOther",team:"Football",location:""}]) assert.throws(()=>validateSchoolRequest(input));
});
test("school request persistence is owner-scoped, idempotent, honest about waiting and makes no research or KG records",{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const app=initializeApp({projectId:`demo-simple-${process.pid}`},"simple-test");const db=getFirestore(app);const repo=new IntelligenceRepository(db);
  try{
    await db.collection("users").doc("simple-owner").set({role:"admin"});
    const input={schoolName:"Synthetic College",team:"Football",location:"Test only"};
    await assert.rejects(repo.submitSchool("other-owner","request1",input),/administrator-required/);
    const saved=await repo.submitSchool("simple-owner","request1",input);
    assert.equal(saved.status,"needs-setup");
    assert.deepEqual(await repo.submitSchool("simple-owner","request1",input),saved);
    await assert.rejects(repo.submitSchool("simple-owner","request1",{...input,team:"Men's basketball"}),/request-id-reused/);
    assert.equal((await db.collection(collections.requests).get()).size,1);
    for(const collection of [collections.runs,collections.budget,"internalProjects","internalKnowledgeNodes"]) assert.equal((await db.collection(collection).get()).size,0);
    assert.equal((await repo.state("simple-owner")).requests.length,1);
    assert.equal((await repo.state("other-owner")).requests.length,0);
  }finally{await deleteApp(app);}
});
