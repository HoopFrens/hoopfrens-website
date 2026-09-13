import test from "node:test";
import assert from "node:assert/strict";
import { extractPhotoCandidates, findSchoolPhotos, photoSearchPolicy } from "@/server/content-intelligence/photos";
import { photoCaption } from "@/domain/content-intelligence/photos";
const domains=["malone.edu","malonepioneers.com"];
const page="https://malonepioneers.com/facilities";
test("photo discovery classifies facilities and extracts explicit credits without granting rights",()=>{
 const result=extractPhotoCandidates(`<title>Facilities</title><main><figure><img src="/images/weights.jpg" alt="Strength and conditioning room" width="1200" height="800"><figcaption>Photo by Jane Example</figcaption></figure><img src="/images/quad.jpg" alt="Campus quad"><img src="/images/field.jpg" alt="Football field"><img src="/images/locker.jpg" alt="Locker room"></main>`,page,domains);
 assert.deepEqual(result.photos.map(p=>p.category),["Weight rooms","Campus","Fields","Locker rooms"]);
 assert.equal(result.photos[0].asset.credit,"Jane Example");
 assert.ok(result.photos.every(p=>p.asset.rights==="pending"&&!p.asset.permissionNote));
 assert.match(result.photos[1].asset.credit,/Source:/);
});
test("discovery rejects off-domain, internal, SVG, logos and thumbnails and prefers a larger srcset",()=>{
 const result=extractPhotoCandidates(`<header><img src="/images/nav.jpg"></header><img src="http://127.0.0.1/private.jpg"><img src="https://evil.test/campus.jpg"><img src="/images/logo.png"><img src="/images/small.jpg" width="90" height="90"><img src="/images/x.svg"><img src="/images/court-small.jpg" srcset="/images/court-small.jpg 400w, /images/court-large.jpg 1400w" alt="Court"><a href="https://evil.test/facilities">Facilities</a><a href="/weight-room">Weight room</a>`,page,domains);
 assert.equal(result.photos.length,1);assert.match(result.photos[0].asset.imageUrl,/court-large.jpg/);assert.deepEqual(result.links,["https://malonepioneers.com/weight-room"]);
});
test("photo crawl stays bounded and ignores conference pages as school-photo sources",async()=>{
 let calls=0;
 const result=await findSchoolPhotos("school-malone-university",["https://ncaa.org/other-school"],new AbortController().signal,async(url,allowed)=>{
   calls++;assert.deepEqual(allowed,domains);assert.doesNotMatch(url,/ncaa/);
   return {url:new URL(url),text:`<img src="/images/court-${calls}.jpg" alt="Basketball court">`+Array.from({length:25},(_,i)=>`<a href="/facilities/${calls}-${i}">Facility</a>`).join("")};
 });
 assert.equal(calls,photoSearchPolicy.maxPages);assert.equal(result.searchedPages,calls);assert.ok(result.photos.length<=photoSearchPolicy.maxPhotos);
});
test("cancelled photo discovery stops without claiming finished results",async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(findSchoolPhotos("school-malone-university",[],controller.signal),/cancelled/);
});
test("download caption credits only used photos and deduplicates the credited source",()=>{
 const asset={id:"a",credit:"Photographer",label:"Test",sourceUrl:page,imageUrl:page+".jpg",rights:"pending" as const,permissionNote:"",capturedOn:""};
 const board={caption:"A caption.",assets:[asset,{...asset,id:"b"},{...asset,id:"unused",credit:"Unused source"}],slides:[{assetId:"a",layout:"photo"},{assetId:"b",layout:"photo"}]} as Parameters<typeof photoCaption>[0];
 assert.equal(photoCaption(board),"A caption.\n\nPhoto credits / sources: Photographer.");
});
