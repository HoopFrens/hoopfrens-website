"use client";

import { useEffect, useRef, useState } from "react";
import { api, EvidenceReview, explain, type IntelligenceState } from "./GovernedContentIntelligence";
import { SchoolSourceSetup } from "./SchoolSourceSetup";
import { SchoolPhotoPicker } from "./SchoolPhotoPicker";
import { photoCaption, type PhotoSearch } from "@/domain/content-intelligence/photos";
import { InstagramRenderPanel } from "./InstagramRenderPanel";
import { SlidePreview } from "./InstagramStoryEditor";
import { latestSchoolPackages, simpleCarousel, teamChoices, type SchoolRequest, type SchoolRequestInput } from "@/domain/content-intelligence/simple-post";
import { approvedStoryClaims, validateStoryboard, type Storyboard, type StoryboardInput } from "@/domain/content-intelligence/storyboard";
import type { PackageBinding, ResearchPackage, Run } from "@/domain/content-intelligence/types";

const button = "min-h-12 rounded-xl border border-white/20 px-5 py-3 text-base font-bold text-white hover:border-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:cursor-not-allowed disabled:opacity-40";
const field = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-white/20 bg-black p-3 text-base text-white";
type State = IntelligenceState & { requests?: SchoolRequest[] };

export function SimplePostStudio({ onDirtyChange }: { onDirtyChange?(value: boolean): void }) {
  const [state, setState] = useState<State | null>(null);
  const [school, setSchool] = useState("");
  const [team, setTeam] = useState<SchoolRequestInput["team"]>("Men's basketball");
  const [location, setLocation] = useState("");
  const [setupId, setSetupId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [downloadStep, setDownloadStep] = useState(false);
  const researchRequest = useRef<{ key: string; id: string } | null>(null);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const schools = latestSchoolPackages(state?.packages || []);
  const selected = state?.packages.find(p => p.projectId === projectId);
  const matched = schools.find(p => p.schoolName.toLowerCase() === school.trim().toLowerCase() && (p.team || "Men's basketball") === team);
  const setup = state?.requests?.find(r => r.id === setupId);
  const research = state?.research.filter(r => r.binding.projectId === projectId && r.binding.contentHash === selected?.contentHash).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
  const saved = state?.storyboards?.filter(b => b.researchPackageId === research?.id && b.researchRevision === research?.revision && b.binding.contentHash === selected?.contentHash).sort((a,b) => b.revision-a.revision)[0];
  const running = state?.runs.filter(r => r.status === "running") || [];
  const checked = !!research && research.binding.scope !== "school-request" && approvedStoryClaims(research).length > 0 && research.claims.every(c => ["supported", "rejected"].includes(c.confidence));

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  async function refresh() {
    const next = await api() as State;
    setState(previous => dirty && previous ? { ...next, packages: previous.packages, research: previous.research } : next);
    return next;
  }
  useEffect(() => {
    let active = true;
    api().then(value => { if (active) setState(value); }).catch(e => { if (active) setError(explain(e.message)); });
    return () => { active = false; };
  }, []);
  const pollRunning = !busy && running.some(run => Date.parse(run.expiresAt) > Date.parse(state?.observedAt || ""));
  useEffect(() => {
    if (!pollRunning) return;
    const timer = setInterval(() => { void api().then((next: State) => setState(previous => dirty && previous ? {...next, packages:previous.packages, research:previous.research} : next)).catch(() => undefined); }, 3000);
    return () => clearInterval(timer);
  }, [pollRunning, dirty]);
  async function submit() {
    setBusy(true); setError(""); setNotice("");
    const request = { schoolName: school.trim(), team, location: location.trim() };
    const key = JSON.stringify(request);
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() };
    try {
      const savedRequest = await api({ action: "submit-school", requestId: submission.current.id, request }) as SchoolRequest;
      await refresh();
      setSetupId(savedRequest.id);
    } catch (e) { setError(e instanceof Error && e.message === "school-request-limit" ? "Your school request list is full. Review the existing requests before adding more." : "We could not save this school request. Your information is still here. Try again."); }
    finally { setBusy(false); }
  }
  async function startResearch(target = selected) {
    if (!target) return;
    const key = target.projectId;
    const storageKey = `hf-simple-research:${target.ownerId}:${key}`;
    if (researchRequest.current?.key !== key) {
      let previous: string | null = null;
      try { previous = sessionStorage.getItem(storageKey); } catch { /* Server still enforces concurrency and budget. */ }
      researchRequest.current = { key, id: previous || crypto.randomUUID() };
      try { sessionStorage.setItem(storageKey, researchRequest.current.id); } catch { /* No credentials are stored. */ }
    }
    setBusy(true); setError(""); setNotice("Finding facts from the school's official sources. This may take a few minutes.");
    const timer = setInterval(() => void refresh().catch(() => undefined), 3000);
    try {
      const run = await api({ action: "research", projectId: key, requestId: researchRequest.current.id }) as Run;
      if (run.status !== "running") { researchRequest.current = null; try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ } }
      if (run.status === "failed") setError(explain(run.errorCode || ""));
      setNotice(run.status === "completed" ? "Research is ready. Check the facts below, then your post will appear." : run.status === "cancelled" ? "Research stopped. The $0.50 reservation stays counted." : "Research has not finished. Check its status below.");
      await refresh();
    } catch (e) { setError(explain(e instanceof Error ? e.message : "")); }
    finally { clearInterval(timer); setBusy(false); }
  }
  async function assemble(researchId: string) {
    setNotice("Finding suitable photos and putting your post together. No AI charge.");
    await api({action:"assemble-post",researchId});
    await refresh(); setNotice("Your post is ready to check. Suggested photos still need your eye.");
  }
  async function ready(id: string) {
    const next = await refresh();
    const binding = next.packages.find((p: PackageBinding) => p.projectId === id);
    if (!binding) throw new Error("school-source-confirmation-required");
    setSetupId("");setProjectId(id);await startResearch(binding);
  }
  async function saveBoard(board: StoryboardInput, revision: number) {
    const result = await api({ action: "save-storyboard", researchId: research?.id, researchRevision: research?.revision, revision, board }) as Storyboard;
    setState(previous => previous ? { ...previous, storyboards: [...(previous.storyboards || []).filter(b => b.id !== result.id), result] } : previous);
    return result;
  }
  return <section className="mx-auto max-w-5xl" aria-labelledby="simple-post-title">
    <p className="text-sm font-bold text-red-300">Hoop Frens · Instagram</p>
    <h2 id="simple-post-title" className="mt-2 text-3xl font-black sm:text-4xl">Make a school post</h2>
    <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-300">Pick a school. Check your post. Download the pictures and caption.</p>
    <ol className="mt-6 grid grid-cols-3 gap-2 text-sm font-bold" aria-label="Your three steps">{["1. Choose a school", "2. Check your post", "3. Download"].map((s,i) => <li key={s} className={`rounded-lg border p-3 ${i === (selected ? downloadStep ? 2 : 1 : 0) ? "border-red-400 bg-red-950/40" : "border-white/15 text-zinc-400"}`}>{s}</li>)}</ol>
    {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300/30 p-4 text-amber-100">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-white/5 p-4 text-zinc-200">{notice}</p>}
    {!state && !error && <p role="status" className="mt-5">Loading your schools and saved posts…</p>}
    {!state && error && <button className={`${button} mt-3`} onClick={() => { setError(""); void refresh().catch(e => setError(explain(e.message))); }}>Try loading again</button>}
    {state && !selected && !setup && <>
      <form className="mt-6 rounded-2xl border border-white/15 bg-[#101010] p-5 sm:p-7" onSubmit={e => { e.preventDefault(); if (matched) { setProjectId(matched.projectId); setNotice(""); setError(""); } else void submit(); }}>
        <label className="block text-base font-bold">Which school?<input required minLength={2} maxLength={120} list="ready-schools" placeholder="Type the school name" className={field} value={school} disabled={busy} onChange={e => setSchool(e.target.value)} /></label>
        <datalist id="ready-schools">{schools.map(s => <option key={s.projectId} value={s.schoolName} />)}</datalist>
        <label className="mt-4 block text-base font-bold">Which team?<select className={field} value={team} disabled={busy} onChange={e => setTeam(e.target.value as SchoolRequestInput["team"])}>{teamChoices.map(t => <option key={t}>{t}</option>)}</select></label>
        {school.trim().length >= 2 && !matched && <><label className="mt-4 block text-sm">City and state (helps us find the right school)<input maxLength={120} value={location} onChange={e => setLocation(e.target.value)} className={field} disabled={busy} /></label><p className="mt-4 text-sm leading-6 text-amber-100">Next, confirm the official athletics website. We’ll research the team you selected, then build your post after you check the facts.</p></>}
        <button className={`${button} mt-5 w-full bg-red-600`} disabled={busy || school.trim().length < 2}>{busy ? "Saving…" : matched ? "Open my post" : school.trim().length < 2 ? "Choose a school to begin" : "Continue with this school"}</button>
        <p className="mt-3 text-sm text-zinc-400">Photo carousel + caption. You upload it to Instagram after reviewing it.</p>
      </form>
      {schools.length > 0 && <div className="mt-6"><h3 className="font-bold">Ready to work on</h3><div className="mt-3 flex flex-wrap gap-3">{schools.map(s => <button key={s.projectId} className={button} disabled={busy} onClick={() => { setSchool(s.schoolName); setTeam(s.team || "Men's basketball"); setProjectId(s.projectId); setError(""); setNotice(""); }}>{s.schoolName}<span className="mt-1 block text-xs font-normal text-zinc-400">{s.team || "Men’s basketball"} · Open latest work</span></button>)}</div></div>}
      {!!state.requests?.length && <details className="mt-6 rounded-xl border border-white/15 p-4"><summary className="cursor-pointer font-bold">School requests ({state.requests.length})</summary>{state.requests.map(r => <div key={r.id} className="mt-3 border-t border-white/10 pt-3 text-sm">{r.schoolName} · {r.team}{r.location ? ` · ${r.location}` : ""}<button className={`${button} mt-2 block`} disabled={busy} onClick={() => { if(r.sourceApprovedAt) {setProjectId(r.id);setSchool(r.schoolName);setTeam(r.team);} else setSetupId(r.id); }}>{r.sourceApprovedAt ? "Open research and post" : "Continue: confirm website"}</button></div>)}</details>}
    </>}
    {setup && !selected && <SchoolSourceSetup key={setup.id} request={setup} onReady={ready} onBack={()=>setSetupId("")} />}
    {selected && <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">{selected.schoolName} · {selected.team || "Men’s basketball"}</h3><button className={button} disabled={busy || dirty} onClick={() => { setProjectId(""); setDownloadStep(false); setNotice(""); setError(""); }}>Choose another school</button></div>
      {dirty && <p className="mt-2 text-sm text-zinc-400">Save or discard your changes before choosing another school.</p>}
      {!research && <div className="mt-5 rounded-xl border border-white/15 p-5"><h4 className="text-xl font-bold">Let’s find the story</h4><p className="mt-2 leading-7 text-zinc-300">We’ll research {selected.team?.toLowerCase() || "men’s basketball"} on the confirmed official website, then draft your carousel after you check the facts.</p><p className="mt-3 text-sm">Research reserves $0.50, including if it fails or is cancelled. Monthly limit: $10.</p><button className={`${button} mt-4 bg-red-600`} disabled={busy || running.length > 0} onClick={() => void startResearch()}>Research this school · $0.50</button></div>}
      {research && !checked && <EvidenceReview key={`${research.id}:${research.revision}`} research={research} busy={busy} onSave={async decisions => { setBusy(true); setError(""); try { const reviewed = await api({ action: "review", researchId: research.id, revision: research.revision, decisions }) as ResearchPackage; await refresh(); if (reviewed.claims.some(c=>c.confidence==="supported")) await assemble(reviewed.id); } catch(e) { setError(explain(e instanceof Error ? e.message : "")); } finally { setBusy(false); } }} />}
      {research && !checked && !research.claims.some(c=>c.confidence==="needs-review" || c.confidence==="conflicting") && <button className={`${button} mt-4`} disabled={busy || running.length>0} onClick={()=>void startResearch()}>Find more facts · $0.50</button>}
      {research && checked && !saved && <div className="mt-4"><p>Facts saved. Continue to build the pictures and caption.</p><button className={button} disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await assemble(research.id);}catch(e){setError(explain(e instanceof Error?e.message:""));}finally{setBusy(false);}}}>{busy?"Putting your post together…":"Assemble my post · free"}</button></div>}
      {research && checked && saved && <SimpleCarousel key={`${research.id}:${research.revision}`} research={research} saved={saved} onSave={saveBoard} onDirty={setDirty} onDownloadStep={setDownloadStep} />}
    </>}
    {running.map(run => <div key={run.id} className="mt-5 rounded-xl border border-white/15 p-4"><p role="status">{run.binding.schoolName}: {Date.parse(run.expiresAt) < Date.parse(state!.observedAt) ? "Research was interrupted. Cancel it before trying again." : "Working on research…"}</p><button className={`${button} mt-3`} onClick={() => { void api({ action: "cancel", runId: run.id }).then(() => refresh()).catch(e => setError(explain(e.message))); }}>Stop research</button></div>)}
    {state && <details className="mt-8 text-sm text-zinc-400"><summary className="min-h-11 cursor-pointer py-3">Budget and saved details</summary><p>This month: ${(state.reservedMicros/1e6).toFixed(2)} reserved of ${(state.monthlyMicros/1e6).toFixed(2)}. Editing and making images have no AI charge.</p>{selected && <p className="mt-2">{selected.scope === "school-request" ? "School confirmed; facts not yet approved" : `School version ${selected.version}`}{research ? ` · Facts review ${research.revision}` : ""}. The exact saved version stays linked behind the scenes.</p>}<button className={`${button} mt-3`} disabled={refreshing} onClick={async () => { setRefreshing(true); try { await refresh(); } catch(e) { setError(explain(e instanceof Error ? e.message : "")); } finally { setRefreshing(false); } }}>Check for updates</button></details>}
  </section>;
}

function SimpleCarousel({ research, saved, onSave, onDirty, onDownloadStep }: { onDownloadStep(value: boolean): void; research: ResearchPackage; saved?: Storyboard; onSave(board: StoryboardInput, revision: number): Promise<Storyboard>; onDirty(value: boolean): void }) {
  const [board, setBoard] = useState<StoryboardInput>(() => saved ? content(saved) : simpleCarousel(research));
  const [baseline, setBaseline] = useState(saved);
  const [dirty, setDirty] = useState(!saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"edit" | "download">("edit");
  const reviewed = board.captionReviewed && board.slides.every(s => s.copyReviewed);
  const locked = board.slides.some(s => s.locked);
  const stale = (saved?.revision || 0) > (baseline?.revision || 0);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => e.preventDefault(); window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function change(next: StoryboardInput) { setBoard(next); setDirty(true); setError(""); }
  async function save(nextView: "edit" | "download") {
    setBusy(true); setError("");
    try {
      if (dirty || !baseline) { const result = await onSave(validateStoryboard(board, research, baseline), baseline?.revision || 0); setBaseline(result); setBoard(content(result)); setDirty(false); }
      setView(nextView); onDownloadStep(nextView === "download");
    } catch { setError("Your post could not be saved. Check for updates or use More options to check the photo links. Your edits are still here."); }
    finally { setBusy(false); }
  }
  function discard() { const latest = saved || baseline; setBoard(latest ? content(latest) : simpleCarousel(research)); setBaseline(latest); setDirty(false); setError(""); }
  if (view === "download" && baseline) return <div className="mt-6"><button className={button} onClick={() => { setView("edit"); onDownloadStep(false); }}>Back to my post</button><InstagramRenderPanel key={`${baseline.id}:${baseline.revision}`} board={baseline} dirty={dirty} simple /></div>;
  return <div className="mt-6">
    <h4 className="text-2xl font-black">Here’s your post</h4><p className="mt-2 leading-7 text-zinc-300">Check the pictures and words. Open “Edit this slide” only if you want to change something.</p>
    {error && <p role="alert" className="mt-3 rounded border border-amber-300/30 p-3 text-amber-100">{error}</p>}
    {stale && <p role="alert" className="mt-3 text-amber-100">A newer post was saved elsewhere. Save is paused so it won’t be overwritten. <button className={button} onClick={discard}>Load latest saved post</button></p>}
    <div className="mt-5 grid min-w-0 gap-6 sm:grid-cols-2">{board.slides.map((slide, i) => <article key={slide.id} className="min-w-0 rounded-2xl border border-white/15 bg-[#101010] p-4"><h5 className="mb-3 text-sm font-bold">Picture {i+1} of {board.slides.length}</h5><SlidePreview board={board} selected={i} simple team={research.binding.team} /><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 font-bold">Edit this slide</summary><fieldset disabled={busy || slide.locked}>
      <label className="block text-sm">Big words<input className={field} maxLength={100} value={slide.headline} onChange={e => change({ ...board, captionReviewed: false, slides: board.slides.map(s => s.id === slide.id ? { ...s, headline: e.target.value, copyReviewed: false } : s) })} /></label>
      <label className="mt-3 block text-sm">Details<textarea className={field} rows={4} maxLength={320} value={slide.body} onChange={e => change({ ...board, captionReviewed: false, slides: board.slides.map(s => s.id === slide.id ? { ...s, body: e.target.value, copyReviewed: false } : s) })} /></label>
      <label className="mt-3 block text-sm">Picture<select className={field} value={slide.assetId || ""} onChange={e => change({ ...board, slides: board.slides.map(s => s.id === slide.id ? { ...s, assetId: e.target.value || null, layout: e.target.value ? "photo" : "text", copyReviewed: false } : s) })}><option value="">Use a text card</option>{board.assets.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
      {slide.assetId && <label className="mt-3 block text-sm">Move the photo up or down<input className="mt-3 w-full accent-red-500" type="range" min={0} max={100} value={slide.focalY} onChange={e => change({ ...board, slides: board.slides.map(s => s.id === slide.id ? { ...s, focalY: Number(e.target.value) } : s) })} /></label>}
      </fieldset>{slide.locked && <p className="mt-2 text-sm">This slide is locked. Use the detailed editor in More options to unlock it.</p>}</details></article>)}</div>
    <section className="mt-6 rounded-2xl border border-white/15 p-5"><h5 className="text-xl font-bold">Your caption</h5><textarea aria-label="Your Instagram caption" className={`${field} leading-7`} maxLength={1800} rows={7} value={board.caption} disabled={busy} onChange={e => change({ ...board, caption: e.target.value, captionReviewed: false })} /></section>
    <SchoolPhotoPicker board={board} disabled={busy} search={() => api({ action: "find-photos", researchId: research.id }) as Promise<PhotoSearch>} onChoose={(asset, slideId) => {
      const selectedAsset = board.assets.find(a => a.id === asset.id) || asset;
      change({ ...board, captionReviewed: false, assets: board.assets.some(a => a.id === asset.id) ? board.assets : [...board.assets, asset], slides: board.slides.map(s => s.id === slideId && !s.locked ? { ...s, assetId: selectedAsset.id, layout: "photo", copyReviewed: false } : s) });
    }} />
    {board.assets.some(a => board.slides.some(s => s.assetId === a.id)) && <section className="mt-6 rounded-2xl border border-white/15 p-5"><h5 className="text-xl font-bold">Photo credits</h5><p className="mt-2 text-sm leading-6 text-zinc-300">Credits are added to your downloaded caption. Source credits identify where a photo was found; they do not establish usage rights. No separate photo approval is required.</p>{board.assets.filter(a => board.slides.some(s => s.assetId === a.id)).map(a => <fieldset key={a.id} disabled={busy || board.slides.some(s => s.assetId === a.id && s.locked)} className="mt-4 border-t border-white/10 pt-4"><legend className="sr-only">{a.label}</legend><a className="text-red-300 underline" href={a.sourceUrl} target="_blank" rel="noreferrer">{a.label} · Photo source</a><label className="mt-3 block text-sm">Photo credit<input className={field} maxLength={100} value={a.credit} onChange={e => change({ ...board, captionReviewed: false, assets: board.assets.map(p => p.id === a.id ? { ...p, credit: e.target.value } : p) })} /></label><p className="mt-2 text-xs text-zinc-400">{a.rights === "cleared" ? "Permission note on file." : "Usage rights unverified."}</p></fieldset>)}<details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer">Caption with photo credits</summary><p className="whitespace-pre-wrap leading-7">{photoCaption(board)}</p></details><button className={`${button} mt-4`} disabled={busy || locked} onClick={() => change({ ...board, assets: [], slides: board.slides.map(s => ({ ...s, assetId: null, layout: "text", copyReviewed: false })), captionReviewed: false })}>Use text cards instead of photos</button></section>}
    <details className="mt-5 rounded-xl border border-white/15 p-4"><summary className="min-h-11 cursor-pointer font-bold">Check facts and sources</summary>{research.claims.filter(c => board.slides.some(s => s.claimIds.includes(c.id))).map(c => <div key={c.id} className="mt-4"><p>{c.text}</p>{c.evidence.map((e,i) => { const source = research.sources.find(s => s.id === e.sourceId); return <div key={i} className="mt-2 border-l-2 border-red-500 pl-3 text-sm text-zinc-300"><blockquote>{e.quote}</blockquote>{source && <a href={source.url} target="_blank" rel="noreferrer" className="break-words text-red-300 underline">{source.title}</a>}</div>; })}</div>)}{research.missingInformation.length > 0 && <><h6 className="mt-4 font-bold text-amber-100">What we still don’t know</h6><ul className="mt-2 list-inside list-disc text-sm">{research.missingInformation.map((m,i) => <li key={i}>{m}</li>)}</ul></>}</details>
    <label className="mt-5 flex items-start gap-3 rounded-xl bg-white/5 p-4 leading-7"><input className="mt-1 h-5 w-5 shrink-0 accent-red-500" type="checkbox" checked={reviewed} disabled={busy || board.slides.some(s => s.locked && !s.copyReviewed)} onChange={e => change({ ...board, captionReviewed: e.target.checked, slides: board.slides.map(s => s.locked ? s : { ...s, copyReviewed: e.target.checked }) })} />I checked every slide and the caption. The facts match the sources, and the words say what I want.</label>
    <div className="mt-5 flex flex-wrap gap-3"><button className={`${button} bg-red-600`} disabled={busy || stale} onClick={() => void save("download")}>{busy ? "Saving…" : "Next: make my pictures"}</button><button className={button} disabled={busy || !dirty || stale} onClick={() => void save("edit")}>Save for later</button><button className={button} disabled={busy || !dirty} onClick={discard}>Discard changes</button></div>
    <p className="mt-3 text-sm text-zinc-400">You can preview without approving. Final download waits for your copy review and clear, readable pictures.</p>
  </div>;
}
function content(board: Storyboard): StoryboardInput { return { brief: board.brief, slides: board.slides, assets: board.assets, caption: board.caption, captionReviewed: board.captionReviewed }; }
