import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { IntelligenceRepository, collections, digest } from "@/server/content-intelligence/repository";
import { runIntelligence } from "@/server/content-intelligence/service";
import { schoolWebsite } from "@/server/content-intelligence/request-package";
import { assemblePost, assembleCarousel } from "@/server/content-intelligence/assemble";
import { RenderService } from "@/server/instagram-render/service";
import { RenderStore } from "@/server/instagram-render/store";
import { Gateway } from "@/server/content-intelligence/gateway";
import { type ResearchTeam } from "@/domain/content-intelligence/types";
import { validateStoryboard } from "@/domain/content-intelligence/storyboard";

test("school source onboarding rejects local/IP/non-HTTPS URLs before retrieval",()=>{
  for(const url of ["http://college.edu", "https://127.0.0.1", "https://[::1]", "https://localhost", "https://host.internal", "https://user:pass@college.edu", "https://college.edu:123", "https://college.edu/?target=private"])assert.throws(()=>schoolWebsite(url));
  assert.equal(schoolWebsite("https://college.edu/athletics").href,"https://college.edu/athletics");
});
for (const team of ["Men's basketball","Women's basketball","Football"] as ResearchTeam[]) {
 test(`new school ${team}: request → research → explicit package approval → automatic draft → PNG/ZIP`,{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const tag=team.replace(/[^a-z]/gi,"").toLowerCase();
  const app=initializeApp({projectId:`demo-workflow-${tag}-${process.pid}`},tag); const db=getFirestore(app); const repo=new IntelligenceRepository(db); const owner="workflow-owner";
  const root=await mkdtemp(join(tmpdir(),"hf-request-render-"));
  // Synthetic provider responses only. This test neither reads nor calls a real key.
  process.env.OPENAI_API_KEY="synthetic-test-only";process.env.HOOPFRENS_CONTENT_INTELLIGENCE_ENABLED="true";
  try {
   await repo.ref("users",owner).set({role:"admin"});
   const req=await repo.submitSchool(owner,"request1",{schoolName:"Synthetic College",team,location:"Fixture only"});
   await assert.rejects(repo.db.runTransaction(tx=>repo.binding(tx,req.id,owner)),/school-source-confirmation-required/);
   const sourcePolicy={name:req.schoolName,domains:["college.edu"],priorityUrls:["https://college.edu/athletics"]};
   const sourcePreview={title:"Synthetic College athletics",excerpt:"Synthetic fixture only",url:sourcePolicy.priorityUrls[0],contentHash:"fixture"};
   await repo.saveSchoolSource(req.id,owner,{sourcePolicy,sourcePreview});
   await assert.rejects(repo.approveSchoolSource(req.id,owner,"old-preview"),/school-source-preview-changed/);
   await repo.approveSchoolSource(req.id,owner,digest(sourcePreview));
   await assert.rejects(repo.saveSchoolSource(req.id,owner,{sourcePolicy,sourcePreview}),/already-confirmed/);
   const initial=await db.runTransaction(tx=>repo.binding(tx,req.id,owner)); assert.equal(initial.scope,"school-request");assert.equal(initial.team,team);
   let providerCalls=0; const payloads:Record<string,unknown>[]=[];
   const fact=team==="Football"?"The football team uses Sample Stadium.":`The ${team.toLowerCase()} team uses Sample Court.`;
   const dependencies={gateway:(repository:IntelligenceRepository,run:Parameters<IntelligenceRepository["recordCall"]>[0],signal:AbortSignal)=>new Gateway(repository,run,signal,async(_url,options)=>{
    providerCalls++;const body=JSON.parse(String(options?.body));payloads.push(body);
    if(body.model==="omni-moderation-latest")return Response.json({results:[{flagged:false}]});
    const text=body.tools?"Synthetic search":JSON.stringify({claims:[{field:"home venue",value:"Sample",text:fact,sourceId:"source-1",quote:fact}],missingInformation:[]});
    return Response.json({id:"resp_fixture",status:"completed",usage:{input_tokens:100,output_tokens:100},output:[{type:"message",content:[{type:"output_text",text}]}]});
   }),source:async(url:string,_domains:string[],_signal:AbortSignal,index:number)=>({id:`source-${index+1}`,url,title:"Fixture venue",text:fact,contentHash:digest(fact),accessedAt:new Date().toISOString()})};
   const run=await runIntelligence(repo,owner,{projectId:req.id,requestId:"research1",kind:"research"},new AbortController().signal,dependencies);
   assert.equal(run.status,"completed",run.errorCode);assert.equal(providerCalls,4);
   assert.ok(payloads.some(p=>typeof p.input==="string"&&p.input.includes(team)));
   const extraction=payloads.find(p=>(p.text as {format?:{name?:string}})?.format?.name==="extract_claims");assert.match(String(extraction?.instructions),new RegExp(team.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
   const repeat=await runIntelligence(repo,owner,{projectId:req.id,requestId:"research1",kind:"research"},new AbortController().signal,dependencies);assert.equal(repeat.id,run.id);assert.equal(providerCalls,4);
   const research=await repo.research(run.resultId!,owner);await assert.rejects(assemblePost(repo,owner,research.id,new AbortController().signal),/approved-version-required/);
   const reviewed=await repo.review(research.id,owner,research.revision,research.claims.map(c=>({id:c.id,decision:"supported",text:c.text})));
   assert.equal(reviewed.binding.scope,"request-package");assert.equal(reviewed.binding.version,1);
   const pkg=(await repo.ref(collections.requestPackages,reviewed.binding.packageId).get()).data()!;
   assert.equal(pkg.pkg.rightsConfirmed,false);assert.equal(pkg.approvedBy,owner);assert.equal(pkg.pkg.selectedFacts[0].value,fact);
   const photo={category:team==="Football"?"Fields" as const:"Courts" as const,context:team==="Football"?"Sample Stadium football":"Sample Court basketball",asset:{id:"fixture-photo",label:"Synthetic venue",imageUrl:"https://college.edu/images/fixture.jpg",sourceUrl:"https://college.edu/athletics",credit:"Test fixture",rights:"pending" as const,permissionNote:"",capturedOn:""}};
   const pictured=assembleCarousel(reviewed,[photo]);
   assert.ok(pictured.slides.some(slide=>slide.assetId==="fixture-photo"));
   assert.equal(pictured.assets[0].rights,"pending");
   if(team==="Football")assert.ok(assembleCarousel(reviewed,[{...photo,category:"Courts",context:"Sample Stadium basketball court"}]).slides.every(slide=>slide.assetId===null));
   let photoCalls=0;const finder=async()=>{photoCalls++;return {photos:[],searchedPages:0,foundAt:new Date().toISOString(),notes:["Synthetic search has no photos"]};};
   const board=await assemblePost(repo,owner,reviewed.id,new AbortController().signal,finder);
   assert.equal(board.binding.packageId,pkg.pkg.id);assert.equal(board.captionReviewed,false);assert.ok(board.caption.includes(team.toLowerCase()));
   if(team==="Football")assert.doesNotMatch(JSON.stringify(board),/basketball|Inside the gym|from the court/);
   assert.equal((await assemblePost(repo,owner,reviewed.id,new AbortController().signal,finder)).id,board.id);assert.equal(photoCalls,1);
   const {brief,slides,assets,caption}=board;
   const checked=await repo.saveStoryboard(reviewed.id,owner,reviewed.revision,board.revision,{brief,slides:slides.map(s=>({...s,copyReviewed:true})),assets,caption,captionReviewed:true});
   const render=new RenderService(new RenderStore(root),(id,revision,uid)=>repo.renderSnapshot(id,revision,uid));
   const job=await render.start(owner,checked.id,checked.revision,"render1");assert.equal(job.status,"proof",job.errorCode);assert.equal(job.blockers.length,0);
   await render.approve(owner,job.id); const zip=await render.download(owner,job.id,"instagram.zip",false);
   assert.ok(Object.keys(unzipSync(zip.bytes)).includes("caption.txt"));
   for(const name of ["internalKnowledgeNodes","internalKnowledgeSources","internalProjects","internalProductionPackages"])assert.equal((await db.collection(name).get()).size,0);
   assert.equal((await repo.ref(collections.budget,run.budgetMonth).get()).data()?.reservedMicros,500000);
   await assert.rejects(repo.research(research.id,"other-owner"),/record-not-available/);
   await assert.rejects(repo.review(research.id,owner,research.revision,[]),/research-review-changed/);
   const changed={...reviewed,binding:{...reviewed.binding,scope:"school-request" as const}};
   assert.throws(()=>validateStoryboard(assembleCarousel(reviewed,[]),changed),/approved-version-required/);
   // A later explicit facts approval creates a new immutable version and invalidates this export.
   await repo.review(reviewed.id,owner,reviewed.revision,reviewed.claims.map(c=>({id:c.id,decision:"supported",text:c.text})));
   await assert.rejects(render.download(owner,job.id,"instagram.zip",false),/research-review-changed|approved-version-changed/);
  } finally {await deleteApp(app);await rm(root,{recursive:true,force:true});}
 });
}
