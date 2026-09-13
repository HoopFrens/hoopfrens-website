"use client";
import { useState } from "react";
import { photoCategories, type PhotoCandidate, type PhotoSearch } from "@/domain/content-intelligence/photos";
import type { StoryAsset, StoryboardInput } from "@/domain/content-intelligence/storyboard";
const button = "min-h-11 rounded-lg border border-white/20 px-4 py-3 font-bold disabled:opacity-40 hover:border-red-300 focus-visible:outline-2 focus-visible:outline-red-300";
export function SchoolPhotoPicker({board, disabled, search, onChoose}: {board:StoryboardInput;disabled:boolean;search():Promise<PhotoSearch>;onChoose(asset:StoryAsset, slideId:string):void}) {
  const [result,setResult]=useState<PhotoSearch|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [category,setCategory]=useState("All photos");const [target,setTarget]=useState(board.slides[0]?.id || "");
  const current=board.slides.find(s=>s.id===target);const photos=result?.photos.filter(p=>category==="All photos"||p.category===category)||[];
  async function find(){setBusy(true);setError("");try{setResult(await search());}catch{setError("Photo search could not finish. Check your connection and try again. Your post is saved separately.");}finally{setBusy(false);}}
  return <section className="mt-6 rounded-2xl border border-white/15 p-5" aria-label="Find school photos"><h5 className="text-xl font-bold">Find better photos</h5><p className="mt-2 text-sm leading-6 text-zinc-300">Look for courts, fields, weight rooms, campus views, locker rooms and game action on official school pages. No AI charge.</p><button className={`${button} mt-4 bg-red-700`} disabled={disabled||busy} onClick={()=>void find()}>{busy?"Looking for school photos…":"Find school photos"}</button>{error&&<p role="alert" className="mt-3 text-amber-100">{error}</p>}
  {result&&<><p role="status" className="mt-3 text-sm">{result.photos.length} photo choices from {result.searchedPages} pages. Not every school has photos in every category.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Photo type<select className="mt-2 min-h-11 w-full rounded border border-white/20 bg-black p-3" value={category} onChange={e=>setCategory(e.target.value)}>{["All photos",...photoCategories].map(c=><option key={c}>{c}</option>)}</select></label><label className="text-sm">Use a photo for<select className="mt-2 min-h-11 w-full rounded border border-white/20 bg-black p-3" value={target} onChange={e=>setTarget(e.target.value)}>{board.slides.map((s,i)=><option key={s.id} value={s.id}>Picture {i+1}: {s.headline}{s.locked?" (locked)":""}</option>)}</select></label></div>
  {!photos.length&&<p className="mt-4 text-sm text-zinc-300">No photos found in this category. Try another category or keep the current picture.</p>}
  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{photos.map(p=><PhotoChoice key={p.asset.id} photo={p} disabled={disabled||!current||current.locked||board.assets.length>=12&&!board.assets.some(a=>a.id===p.asset.id)} onChoose={()=>onChoose(p.asset,target)}/>)}</div>
  <details className="mt-4 text-sm text-zinc-400"><summary className="min-h-11 cursor-pointer">Photo search details</summary>{result.notes.map((note,i)=><p className="mt-2" key={i}>{note}</p>)}</details></>}
  </section>;
}
function PhotoChoice({photo,disabled,onChoose}:{photo:PhotoCandidate;disabled:boolean;onChoose():void}) {
  const [failed,setFailed]=useState(false);
  return <article className="min-w-0 overflow-hidden rounded-xl border border-white/15 bg-black">{failed?<p className="p-4 text-sm">Preview unavailable. Choose another photo.</p>:
  // eslint-disable-next-line @next/next/no-img-element
  <img src={photo.asset.imageUrl} alt={photo.asset.label} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} className="aspect-[4/3] w-full object-cover"/>}<div className="p-3"><p className="text-xs font-bold text-red-300">{photo.category} · Suggested</p><p className="mt-2 text-sm">{photo.asset.label}</p><a href={photo.asset.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block break-words text-xs text-zinc-300 underline">{photo.asset.credit}</a><button className={`${button} mt-3 w-full text-sm`} disabled={disabled||failed} onClick={onChoose}>Use this photo</button></div></article>;
}
