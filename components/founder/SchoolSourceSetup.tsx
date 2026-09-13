"use client";
import { useState } from "react";
import type { SchoolRequest } from "@/domain/content-intelligence/simple-post";
import { schoolSourcePolicy } from "@/domain/content-intelligence/policy";
import { api, explain } from "./GovernedContentIntelligence";
const button="mt-4 min-h-12 rounded-xl border border-white/20 bg-red-700 px-5 py-3 font-bold disabled:opacity-40";
export function SchoolSourceSetup({request,onReady,onBack}:{request:SchoolRequest;onReady(id:string):Promise<void>;onBack():void}) {
  const configured=Object.values(schoolSourcePolicy).find(s=>s.name.toLowerCase()===request.schoolName.toLowerCase());
  const [website,setWebsite]=useState(request.sourcePreview?.url || (configured ? `https://${configured.domains[1] || configured.domains[0]}/` : ""));
  const [preview,setPreview]=useState(request.sourcePreview ? request : null);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function inspect(){setBusy(true);setError("");setConfirmed(false);try{setPreview(await api({action:"preview-school-source",id:request.id,website}));}catch{setError("We could not read that website. Use the school's official athletics website with https://. Your request is still saved.");}finally{setBusy(false);}}
  async function start(){setBusy(true);setError("");try{await api({action:"approve-school-source",id:request.id,previewHash:preview?.sourcePreviewHash});await onReady(request.id);}catch(e){setError(explain(e instanceof Error?e.message:""));}finally{setBusy(false);}}
  return <section className="mt-6 rounded-2xl border border-white/15 p-6" aria-label="Confirm school website"><h3 className="text-2xl font-bold">Find the right {request.schoolName}</h3><p className="mt-2 text-zinc-300">{request.team}{request.location?` · ${request.location}`:""}. Confirm the school website once. Then we can research this team and build your post after you check the facts.</p>
    <form onSubmit={e=>{e.preventDefault();void inspect();}}><label className="mt-5 block font-bold">Official athletics website<input required type="url" maxLength={2048} placeholder="https://school-athletics-website.com" value={website} disabled={busy || !!request.sourceApprovedAt} onChange={e=>{setWebsite(e.target.value);setPreview(null);setConfirmed(false);}} className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-black p-3"/></label><button className={button} disabled={busy}>{busy?"Working…":"Check this website · free"}</button></form>
    {error&&<p role="alert" className="mt-4 text-amber-100">{error}</p>}
    {preview?.sourcePreview&&<div className="mt-5 rounded-xl bg-white/5 p-4"><a className="break-words font-bold text-red-300 underline" href={preview.sourcePreview.url} target="_blank" rel="noreferrer">{preview.sourcePreview.title}</a><p className="mt-3 text-sm leading-6 text-zinc-300">{preview.sourcePreview.excerpt}</p><label className="mt-4 flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-red-500"/>This is the right school’s official athletics website. Use it to research {request.team.toLowerCase()}.</label><p className="mt-3 text-sm text-zinc-400">Research reserves up to $0.50, including on failure or cancellation. Monthly AI limit: $10. Photos and post assembly have no AI charge.</p><button className={button} disabled={!confirmed||busy} onClick={()=>void start()}>Confirm school and start research · $0.50</button></div>}
    <button className={`${button} ml-3 bg-transparent`} disabled={busy} onClick={onBack}>Back to schools</button>
  </section>;
}
