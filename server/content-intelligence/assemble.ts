import "server-only";
import { bindingSchool } from "@/domain/content-intelligence/policy";
import { simpleCarousel } from "@/domain/content-intelligence/simple-post";
import { requireCondition, type ResearchPackage } from "@/domain/content-intelligence/types";
import { type PhotoCandidate } from "@/domain/content-intelligence/photos";
import { type Storyboard } from "@/domain/content-intelligence/storyboard";
import { collections, digest, type IntelligenceRepository } from "./repository";
import { findSchoolPhotos } from "./photos";

export function assembleCarousel(research: ResearchPackage, photos: PhotoCandidate[]) {
  const board = simpleCarousel(research);
  const used = new Set<string>();
  for (const slide of board.slides) {
    if (slide.role === "takeaway" || slide.assetId) continue;
    const claimText = slide.claimIds.map(id=>research.claims.find(c=>c.id===id)?.text || "").join(" ").toLowerCase();
    const words = claimText.match(/[a-z]{5,}/g) || [];
    const candidates = photos.filter(p=>!used.has(p.asset.id) && p.category!=="Other" && (research.binding.team!=="Football" ? p.category!=="Fields" : p.category!=="Courts" && (p.category!=="Fields" || /football|stadium/i.test(p.context))));
    const scored = candidates.map(p=>({p,score:words.filter(w=>p.context.toLowerCase().includes(w)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    const photo=scored[0]?.p;
    if(!photo)continue;
    used.add(photo.asset.id); board.assets.push(photo.asset); slide.assetId=photo.asset.id; slide.layout="photo";
  }
  return board;
}
export async function assemblePost(repository: IntelligenceRepository, ownerId: string, researchId: string, signal: AbortSignal, finder = findSchoolPhotos): Promise<Storyboard> {
  const research=await repository.research(researchId,ownerId);
  await repository.db.runTransaction(tx=>repository.binding(tx,research.binding.projectId,ownerId,research.binding));
  requireCondition(research.binding.scope!=="school-request","approved-version-required");
  const id=`storyboard-${digest([research.id,research.revision])}`;
  const previous=(await repository.ref(collections.storyboards,id).get()).data() as Storyboard | undefined;
  if(previous)return (await repository.renderSnapshot(id,previous.revision,ownerId)).board;
  let photos: PhotoCandidate[]=[];
  try { photos=(await finder(research.binding.schoolId,research.sources.map(s=>s.url),signal,undefined,bindingSchool(research.binding))).photos; }
  catch { signal.throwIfAborted(); /* Missing photos produce visible text cards; facts remain usable. */ }
  signal.throwIfAborted();
  try { return await repository.saveStoryboard(research.id,ownerId,research.revision,0,assembleCarousel(research,photos)); }
  catch(error) {
    // A concurrent assembly/save wins; never overwrite its edits or spend again.
    const existing=(await repository.ref(collections.storyboards,id).get()).data() as Storyboard | undefined;
    if(existing)return (await repository.renderSnapshot(id,existing.revision,ownerId)).board;
    throw error;
  }
}
