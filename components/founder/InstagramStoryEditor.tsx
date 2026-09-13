"use client";

import { useEffect, useState } from "react";
import { approvedStoryClaims, audiences, readerActions, slideRoles, startStoryboard, storyHooks, storyIssues, storyTypes, validateStoryboard,
  type StoryAsset, type Storyboard, type StoryboardInput, type StoryBrief, type StorySlide, type StoryType } from "@/domain/content-intelligence/storyboard";
import type { ResearchPackage } from "@/domain/content-intelligence/types";
import { InstagramRenderPanel } from "./InstagramRenderPanel";

const field = "mt-1 w-full min-w-0 rounded border border-white/20 bg-[#171717] p-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-red-300 disabled:opacity-50";
const button = "min-h-11 rounded border border-white/25 px-3 py-2 text-sm font-bold hover:border-red-300 focus-visible:outline-2 focus-visible:outline-red-300 disabled:cursor-not-allowed disabled:opacity-40";
const emptyAsset = (): StoryAsset => ({ id: crypto.randomUUID(), label: "", imageUrl: "", sourceUrl: "", credit: "", capturedOn: "", rights: "pending", permissionNote: "" });
function contentOf(board: StoryboardInput): StoryboardInput { return { brief: board.brief, slides: board.slides, assets: board.assets, caption: board.caption, captionReviewed: board.captionReviewed }; }

function StoryPhoto({ asset, slide }: { asset: StoryAsset; slide: StorySlide }) {
  const [failed, setFailed] = useState(false);
  return failed ? <p className="flex h-full items-center justify-center p-4 text-center text-xs">Photo unavailable. Check its direct image link.</p> :
    // Direct original-image placement avoids generative changes to documentary evidence.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset.imageUrl} alt={asset.label} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" style={{ objectPosition: `${slide.focalX}% ${slide.focalY}%` }} />;
}

export function SlidePreview({ board, selected, simple = false, team }: { board: StoryboardInput; selected: number; simple?: boolean; team?: string }) {
  const slide = board.slides[selected];
  const asset = board.assets.find(a => a.id === slide.assetId);
  return <div className="mx-auto w-full max-w-[360px]">
    <div className="flex aspect-[4/5] flex-col overflow-auto bg-[#f3efe6] text-[#141414] shadow-xl" aria-label={`Layout preview of slide ${selected + 1}`}>
      <div className="flex justify-between gap-2 border-b-2 border-[#d5232c] px-4 py-3 text-[10px] font-black tracking-[0.15em]"><span>HOOP FRENS</span><span>{board.brief.type === "journey" ? "ATHLETE JOURNEYS" : team === "Football" ? "FIELD NOTES" : "COURT NOTES"}</span></div>
      {slide.layout === "photo" && <div className="relative min-h-[45%] flex-1 bg-neutral-300">
        {asset ? <StoryPhoto key={asset.imageUrl} asset={asset} slide={slide} /> : <div className="flex h-full min-h-40 flex-col items-center justify-center p-5 text-center"><strong className="text-sm">Photo needed</strong><p className="mt-2 text-xs">Choose a source photo for this slide.</p></div>}
      </div>}
      <div className={`px-5 py-4 ${slide.layout === "text" ? "flex flex-1 flex-col justify-center bg-[#141414] text-[#f3efe6]" : ""}`}>
        <h6 className="break-words text-[23px] font-black uppercase leading-tight">{slide.headline}</h6>
        {slide.body && <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{slide.body}</p>}
      </div>
      <div className="flex justify-between gap-3 border-t border-black/15 px-4 py-3 text-[10px]"><span className="break-words">{asset ? `Photo: ${asset.credit}` : "Hoop Frens editorial draft"}</span><span className="shrink-0">{selected + 1} / {board.slides.length}</span></div>
    </div>
    <p className="mt-2 text-xs leading-5 text-zinc-400">{simple ? "Preview · final picture comes next." : "Layout preview · final pictures come next."} {asset?.rights === "pending" ? "Usage rights unverified." : ""} {!simple && "Long copy may scroll here; check the readability notes before rendering."}</p>
  </div>;
}

export function InstagramStoryEditor({ research, saved, busy, onSave, onDirty }: {
  research: ResearchPackage; saved?: Storyboard; busy: boolean;
  onSave(board: StoryboardInput, revision: number): Promise<Storyboard>;
  onDirty(dirty: boolean): void;
}) {
  const [board, setBoard] = useState<StoryboardInput | null>(() => saved ? contentOf(saved) : null);
  const [baseline, setBaseline] = useState(saved);
  const [brief, setBrief] = useState<StoryBrief>(() => saved?.brief || { type: "court", audience: audiences[0], action: readerActions[0], angle: "" });
  const [count, setCount] = useState(4);
  const claims = approvedStoryClaims(research);
  const [chosen, setChosen] = useState(() => claims.slice(0, 6).map(c => c.id));
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [assetDraft, setAssetDraft] = useState<StoryAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const disabled = busy || saving;
  const stale = (saved?.revision || 0) > (baseline?.revision || 0);
  const active = board?.slides[Math.min(selected, board.slides.length - 1)];
  const frozen = !!active && (active.locked || !!baseline?.slides.find(s => s.id === active.id)?.locked);
  const lockedOrder = !!board?.slides.some(s => s.locked) || !!baseline?.slides.some(s => s.locked);
  const issues = board ? storyIssues(board) : [];
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  function update(next: StoryboardInput) { setBoard(next); setDirty(true); setMessage(""); }
  function changeBrief(patch: Partial<StoryBrief>) { const next = { ...brief, ...patch }; setBrief(next); if (board) update({ ...board, brief: next }); }
  function edit(patch: Partial<StorySlide>, reviewOnly = false) {
    if (!board || !active) return;
    update({ ...board, captionReviewed: reviewOnly ? board.captionReviewed : false,
      slides: board.slides.map(s => s.id === active.id ? { ...s, ...patch, ...(!reviewOnly ? { copyReviewed: false } : {}) } : s) });
  }
  function move(delta: number) {
    if (!board || lockedOrder) return;
    const slides = [...board.slides]; const destination = selected + delta;
    if (destination < 0 || destination >= slides.length) return;
    [slides[selected], slides[destination]] = [slides[destination], slides[selected]];
    update({ ...board, slides }); setSelected(destination);
  }
  async function save() {
    if (!board) return;
    try {
      setMessage(""); const checked = validateStoryboard(board, research, baseline);
      setSaving(true); const result = await onSave(checked, baseline?.revision || 0);
      setBaseline(result); setBoard(contentOf(result)); setDirty(false); setMessage(`Storyboard revision ${result.revision} saved. This is an internal draft.`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "story-slide-locked" ? "Save the unlock first, then edit or move that slide." : code === "storyboard-revision-changed" ? "A newer revision was saved elsewhere. Refresh status, then load the latest saved version." : code === "research-review-changed" || code === "approved-version-changed" ? "The evidence or approved school version changed. Refresh status and reopen the current story." : "Could not save. Check required headlines, evidence selections, photo links and permission notes, then retry. Your edits remain here.");
    } finally { setSaving(false); }
  }
  function addAsset() {
    if (!board || !assetDraft) return;
    const next = { ...board, assets: [...board.assets, assetDraft] };
    try { validateStoryboard(next, research, baseline); update(next); setAssetDraft(null); }
    catch { setMessage("Use a direct JPG, PNG or WebP link and source page on this school's approved domains. Include a photo name, credit, and a permission note if cleared."); }
  }
  function loadSaved() { const value = saved || baseline; setBoard(value ? contentOf(value) : null); setBaseline(value); if (value) setBrief(value.brief); setDirty(false); setSelected(0); setAssetDraft(null); setMessage(value ? `Loaded revision ${value.revision}.` : "Unsaved storyboard discarded."); }

  return <section className="mt-6 min-w-0 rounded-lg border border-red-400/30 bg-[#111] p-4 sm:p-5" aria-labelledby="instagram-story-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-red-300">Instagram story studio</p><h4 id="instagram-story-title" className="mt-2 text-2xl font-black">Give every swipe a purpose.</h4></div><span className="rounded bg-white/10 px-3 py-2 text-xs">{dirty ? "Unsaved changes" : baseline ? `Saved revision ${baseline.revision}` : "New storyboard"}</span></div>
    <p className="mt-3 text-sm leading-6 text-zinc-300">{research.binding.schoolName} · Approved version {research.binding.version} · Evidence review {research.revision}. Build and edit a story without an AI charge. Review the copy and photo credits. Photo usage rights are recorded separately.</p>
    {stale && <p role="alert" className="mt-3 text-sm text-amber-200">A newer saved revision is available. Your local edits are preserved. <button className={`${button} ml-2`} onClick={loadSaved}>Load latest saved version</button></p>}
    {message && <p role="status" className="mt-3 rounded border border-amber-300/30 p-3 text-sm text-amber-100">{message}</p>}
    <fieldset disabled={disabled} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
      <legend className="mb-3 font-bold">1. Choose the story</legend>
      <label className="min-w-0 text-sm">Story type<select className={field} value={brief.type} onChange={e => changeBrief({ type: e.target.value as StoryType })}>{Object.entries(storyTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="min-w-0 text-sm">Audience<select className={field} value={brief.audience} onChange={e => changeBrief({ audience: e.target.value as StoryBrief["audience"] })}>{audiences.map(a => <option key={a}>{a}</option>)}</select></label>
      <label className="min-w-0 text-sm">Reader action<select className={field} value={brief.action} onChange={e => changeBrief({ action: e.target.value as StoryBrief["action"] })}>{readerActions.map(a => <option key={a}>{a}</option>)}</select></label>
      <label className="min-w-0 text-sm">Story angle <span className="text-zinc-400">(optional)</span><input className={field} maxLength={180} placeholder="What should the reader notice?" value={brief.angle} onChange={e => changeBrief({ angle: e.target.value })} /></label>
    </fieldset>
    {!board && <fieldset disabled={disabled} className="mt-4 min-w-0 rounded border border-white/15 p-4"><legend className="px-1 text-sm font-bold">Choose approved details</legend>
      {claims.map(c => <label key={c.id} className="flex min-h-11 items-start gap-3 py-2 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-red-500" checked={chosen.includes(c.id)} onChange={e => setChosen(p => e.target.checked ? [...p, c.id] : p.filter(id => id !== c.id))} />{c.text}</label>)}
      <label className="mt-3 block max-w-48 text-sm">Number of slides<select value={count} className={field} onChange={e => setCount(Number(e.target.value))}>{[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} slides</option>)}</select></label>
      <p className="mt-3 text-xs leading-5 text-zinc-400">The starter uses up to {count - 2} selected details. Extra slots stay visibly incomplete; no facts or photos are invented. You can add other approved details while editing.</p>
      <button className={`${button} mt-4 bg-red-700`} disabled={!chosen.length} onClick={() => { update(startStoryboard(research, brief, count, chosen)); setSelected(0); }}>Build starter storyboard</button>
    </fieldset>}
    {board && active && <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h5 className="font-bold">2. Arrange and edit your slides</h5><div className="flex gap-2"><button className={button} disabled={disabled || board.slides.length >= 8} onClick={() => { update({ ...board, slides: [...board.slides, { id: crypto.randomUUID(), role: "detail", headline: "Add a supported detail", body: "", claimIds: [], assetId: null, focalX: 50, focalY: 50, layout: "photo", locked: false, copyReviewed: false }] }); setSelected(board.slides.length); }}>Add slide</button><button className={button} disabled={disabled || !dirty} onClick={loadSaved}>Discard unsaved edits</button></div></div>
      <nav className="mt-3 flex gap-2 overflow-x-auto pb-3" aria-label="Storyboard slides">{board.slides.map((s, i) => <button key={s.id} aria-current={selected === i ? "step" : undefined} onClick={() => setSelected(i)} className={`${button} w-40 shrink-0 text-left ${selected === i ? "border-red-400 bg-red-950/50" : "bg-black"}`}><span className="block text-xs text-red-200">{i + 1} · {s.role}{s.locked ? " · Locked" : ""}</span><span className="mt-1 block truncate">{s.headline}</span></button>)}</nav>
      <div className="mt-3 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><button className={button} disabled={disabled || lockedOrder || selected === 0} onClick={() => move(-1)}>Move earlier</button><button className={button} disabled={disabled || lockedOrder || selected === board.slides.length - 1} onClick={() => move(1)}>Move later</button><button className={button} disabled={disabled || lockedOrder || board.slides.length <= 2} onClick={() => { update({ ...board, slides: board.slides.filter(s => s.id !== active.id), captionReviewed: false }); setSelected(Math.max(0, selected - 1)); }}>Remove slide</button></div>
          <label className="mt-3 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-red-500" disabled={disabled} checked={active.locked} onChange={e => edit({ locked: e.target.checked }, true)} />Lock this slide</label>
          {frozen && <p className="text-xs text-amber-200">To change this slide, uncheck the lock and save that unlock first. Slide order is protected while any slide is locked.</p>}
          <fieldset disabled={disabled || frozen} className="mt-3 min-w-0 space-y-4">
            <legend className="sr-only">Edit slide {selected + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Slide role<select value={active.role} className={field} onChange={e => edit({ role: e.target.value as StorySlide["role"] })}>{slideRoles.map(r => <option key={r}>{r}</option>)}</select></label><label className="text-sm">Layout<select value={active.layout} className={field} onChange={e => edit({ layout: e.target.value as StorySlide["layout"] })}><option value="photo">Photo first</option><option value="text">Question / text card</option></select></label></div>
            <label className="block text-sm">Headline <span className="text-zinc-400">({active.headline.length}/100)</span><input value={active.headline} maxLength={100} className={field} onChange={e => edit({ headline: e.target.value })} /></label>
            {active.role === "cover" && <div><p className="text-xs text-zinc-400">Original Hoop Frens starting points — edit to fit the evidence.</p><div className="mt-2 flex flex-wrap gap-2">{storyHooks(brief.type, research.binding.schoolName, research.binding.team).map(h => <button key={h} className={button} onClick={() => edit({ headline: h })}>{h}</button>)}</div></div>}
            <label className="block text-sm">On-slide wording <span className="text-zinc-400">({active.body.length}/320)</span><textarea rows={4} maxLength={320} value={active.body} className={field} onChange={e => edit({ body: e.target.value })} /></label>
            <div className="rounded border border-white/15 p-3"><p className="text-sm font-bold">Evidence for this slide</p>{claims.map(c => <label key={c.id} className="mt-2 flex items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-red-500" checked={active.claimIds.includes(c.id)} disabled={!active.claimIds.includes(c.id) && active.claimIds.length >= 4} onChange={e => edit({ claimIds: e.target.checked ? [...active.claimIds, c.id] : active.claimIds.filter(id => id !== c.id) })} />{c.text}</label>)}<button className={`${button} mt-3`} disabled={!active.claimIds.length || claims.filter(c => active.claimIds.includes(c.id)).map(c => c.text).join("\n\n").length > 320} onClick={() => edit({ body: claims.filter(c => active.claimIds.includes(c.id)).map(c => c.text).join("\n\n") })}>Use approved wording</button><p className="mt-2 text-xs text-zinc-400">Copy remains a draft until you check its meaning against the evidence. Edit canonical facts in evidence review, not here.</p></div>
            <label className="block text-sm">Slide photo<select className={field} value={active.assetId || ""} onChange={e => edit({ assetId: e.target.value || null })}><option value="">Choose a photo</option>{board.assets.map(a => <option key={a.id} value={a.id}>{a.label} · {a.rights === "cleared" ? "Permission recorded" : "Permission pending"}</option>)}</select></label>
            {active.assetId && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Horizontal crop focus<input type="range" min="0" max="100" value={active.focalX} className="mt-3 w-full accent-red-500" onChange={e => edit({ focalX: Number(e.target.value) })} /></label><label className="text-sm">Vertical crop focus<input type="range" min="0" max="100" value={active.focalY} className="mt-3 w-full accent-red-500" onChange={e => edit({ focalY: Number(e.target.value) })} /></label></div>}
            <label className="flex items-start gap-3 rounded border border-amber-300/30 p-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-red-500" checked={active.copyReviewed} onChange={e => edit({ copyReviewed: e.target.checked }, true)} />I checked every factual assertion in this headline and wording against the selected evidence. Any unlinked wording is a question or nonfactual editorial framing.</label>
          </fieldset>
          <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-bold">View selected source evidence</summary>{claims.filter(c => active.claimIds.includes(c.id)).map(c => <div key={c.id} className="mb-4 border-l-2 border-red-500 pl-3"><p>{c.text}</p>{c.evidence.map((e, i) => { const source = research.sources.find(s => s.id === e.sourceId); return <div key={i} className="mt-2 text-xs leading-5"><blockquote>“{e.quote}”</blockquote>{source && <a href={source.url} target="_blank" rel="noreferrer" className="break-words text-red-300 underline">{source.title}</a>}</div>; })}</div>)}</details>
        </div>
        <aside className="min-w-0"><p className="mb-3 text-sm font-bold">Phone-size preview</p><SlidePreview board={board} selected={Math.min(selected, board.slides.length - 1)} team={research.binding.team} /><div className="mt-3 flex justify-between gap-2"><button className={button} disabled={selected === 0} onClick={() => setSelected(p => p - 1)}>Previous slide</button><button className={button} disabled={selected >= board.slides.length - 1} onClick={() => setSelected(p => p + 1)}>Next slide</button></div></aside>
      </div>
      <details className="mt-6 rounded border border-white/15 p-4" open={board.assets.length === 0}><summary className="min-h-11 cursor-pointer font-bold">3. Source photos and credits ({board.assets.length}/12)</summary>
        <p className="mt-2 text-sm leading-6 text-zinc-300">Record direct image links from this school’s approved source domains. Original photos appear unchanged apart from crop. Public availability does not establish permission. Rendered pictures are saved privately on this Mac. Adding photos from your files is not available yet.</p>
        {board.assets.map(a => { const assetLocked = [...board.slides, ...(baseline?.slides || [])].some(s => s.assetId === a.id && s.locked); return <fieldset key={a.id} disabled={disabled || assetLocked} className="mt-4 min-w-0 rounded border border-white/15 p-3"><legend className="px-1 text-sm font-bold">{a.label}{assetLocked ? " · Used by locked slide" : ""}</legend><p className="break-words text-xs text-zinc-400">Credit: {a.credit} · Photo date: {a.capturedOn || "Unknown"}</p><a href={a.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block break-words text-sm text-red-300 underline">Open source page</a><label className="mt-3 block text-sm">Usage notes (optional)<textarea rows={2} maxLength={300} className={field} value={a.permissionNote} onChange={e => update({ ...board, assets: board.assets.map(x => x.id === a.id ? { ...x, permissionNote: e.target.value, rights: "pending" } : x) })} /></label><p className="mt-2 text-xs text-zinc-400">{a.rights === "cleared" ? "Permission note on file." : "Usage rights unverified. Credits do not grant permission."}</p><button className={`${button} mt-2`} onClick={() => update({ ...board, assets: board.assets.filter(x => x.id !== a.id), slides: board.slides.map(s => s.assetId === a.id ? { ...s, assetId: null, copyReviewed: false } : s) })}>Remove photo reference</button></fieldset>; })}
        {assetDraft ? <fieldset disabled={disabled} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2"><legend className="mb-2 font-bold">New source photo</legend>{([['label', 'Photo name'], ['imageUrl', 'Direct image URL'], ['sourceUrl', 'Source page URL'], ['credit', 'Photo credit'], ['capturedOn', 'Photo capture date (optional)']] as const).map(([key, label]) => <label key={key} className="min-w-0 text-sm">{label}<input className={field} type={key === "capturedOn" ? "date" : key.endsWith("Url") ? "url" : "text"} maxLength={key.endsWith("Url") ? 2048 : key === "credit" ? 100 : 80} value={assetDraft[key]} onChange={e => setAssetDraft({ ...assetDraft, [key]: e.target.value })} /></label>)}<div className="flex items-end gap-2"><button className={button} onClick={addAsset}>Add photo reference</button><button className={button} onClick={() => setAssetDraft(null)}>Cancel photo</button></div></fieldset> : <button className={`${button} mt-4`} disabled={disabled || board.assets.length >= 12} onClick={() => setAssetDraft(emptyAsset())}>Add source photo</button>}
      </details>
      <fieldset disabled={disabled} className="mt-6 min-w-0"><legend className="font-bold">4. Caption and review</legend><label className="mt-3 block text-sm">Instagram caption<textarea className={field} rows={6} maxLength={1800} value={board.caption} onChange={e => update({ ...board, caption: e.target.value, captionReviewed: false })} /></label><label className="mt-3 flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-red-500" checked={board.captionReviewed} onChange={e => update({ ...board, captionReviewed: e.target.checked })} />I checked that the caption’s factual claims are supported by the selected slide evidence.</label></fieldset>
      <div className="mt-4 rounded border border-white/20 p-4"><h5 className="font-bold">{issues.some(i => i.severity === "review") ? "Review still needed" : "Ready for Founder layout review"}</h5><p className="mt-1 text-xs text-zinc-400">This checklist does not approve publication or pass a release gate.</p>{issues.length > 0 && <ul className="mt-3 list-inside list-disc space-y-2 text-sm">{issues.map((issue, i) => <li key={i} className={issue.severity === "review" ? "text-amber-100" : "text-zinc-300"}>{issue.message}</li>)}</ul>}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className={`${button} bg-red-700`} disabled={disabled || !dirty || stale} onClick={() => void save()}>{saving ? "Saving storyboard…" : "Save storyboard revision"}</button><span className="text-xs text-zinc-400">Saves copy, evidence links, photo references and crop settings. No AI charge.</span></div>
      {baseline && <InstagramRenderPanel key={`${baseline.id}:${baseline.revision}`} board={baseline} dirty={dirty} />}
    </>}
  </section>;
}
