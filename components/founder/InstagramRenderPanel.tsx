"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { photoCaption } from "@/domain/content-intelligence/photos";
import { auth } from "@/lib/firebase";
import type { Storyboard } from "@/domain/content-intelligence/storyboard";
import { renderMessages, type RenderSummary } from "@/domain/content-intelligence/rendering";

const button = "min-h-11 rounded border border-white/25 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 hover:border-red-300 focus-visible:outline-2 focus-visible:outline-red-300";
async function api(query = "", body?: unknown) {
  if (!auth?.currentUser) throw new Error("sign-in-required");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`/api/instagram-render${query}`, { method: body ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) { const error = await response.json(); throw new Error(error.error); }
  return response;
}
function explain(error: unknown) { const code = error instanceof Error ? error.message : ""; return renderMessages[code] || "This action could not finish. Refresh its status before trying again."; }

export function InstagramRenderPanel({ board, dirty, simple = false }: { board: Storyboard; dirty: boolean; simple?: boolean }) {
  const [jobs, setJobs] = useState<RenderSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [proofs, setProofs] = useState<string[]>([]);
  const [proofLoaded, setProofLoaded] = useState("");
  const [reviewed, setReviewed] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const requestId = useRef<string | null>(null);
  const job = jobs.find(j => j.id === selected) || jobs[0];
  const current = job?.boardRevision === board.revision;
  const proofKey = job ? `${job.id}:${job.attempt}:${job.status}` : "";
  const refresh = useCallback(async () => { const response = await api(`?boardId=${encodeURIComponent(board.id)}`); const value = await response.json() as RenderSummary[]; setJobs(value); return value; }, [board.id]);
  useEffect(() => { let active = true; api(`?boardId=${encodeURIComponent(board.id)}`).then(r => r.json()).then(value => { if (active) setJobs(value); }).catch(e => { if (active) setError(explain(e)); }); return () => { active = false; }; }, [board.id]);
  useEffect(() => {
    if (!busy && !jobs.some(j => j.status === "running")) return;
    const timer = setInterval(() => void refresh().catch(() => undefined), 2500); return () => clearInterval(timer);
  }, [busy, jobs, refresh]);
  useEffect(() => {
    let active = true; const urls: string[] = [];
    if (job && ["proof", "approved"].includes(job.status) && current && !dirty) {
      const images = job.files.filter(f => f.type === "image/png");
      void (async () => {
        for (const file of images) {
          const r = await api(`?id=${job.id}&file=${file.name}&proof=1`); const blob = await r.blob();
          if (!active) return;
          urls.push(URL.createObjectURL(blob));
        }
        if (active) { setProofs([...urls]); setProofLoaded(proofKey); }
      })().catch(e => { if (active) setError(explain(e)); });
    }
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  // Job identity/status changes invalidate the exact proof review; polling unchanged jobs does not.
  }, [proofKey, current, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  async function action(kind: "start" | "retry" | "cancel" | "approve" | "delete") {
    setBusy(true); setError("");
    try {
      if (kind === "start" && !requestId.current) requestId.current = crypto.randomUUID();
      const body = kind === "start" ? { action: kind, boardId: board.id, revision: board.revision, requestId: requestId.current } : { action: kind, id: job?.id };
      const result = await (await api("", body)).json() as RenderSummary;
      if (kind === "start") requestId.current = null;
      setSelected(result.id); setJobs(previous => [result, ...previous.filter(j => j.id !== result.id)]);
      if (result.errorCode) setError(renderMessages[result.errorCode] || "Rendering could not finish.");
      await refresh();
    } catch (e) { setError(explain(e)); }
    finally { setBusy(false); }
  }
  async function download() {
    if (!job) return; setBusy(true); setError("");
    try {
      const response = await api(`?id=${job.id}&file=instagram.zip`); const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "hoop-frens-instagram.zip"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { setError(explain(e)); } finally { setBusy(false); }
  }
  return <section className="mt-6 min-w-0 rounded border border-white/20 p-4" aria-labelledby="render-title">
    <p className="text-xs font-bold uppercase tracking-widest text-red-300">{simple ? "3. Download your post" : "Final Instagram graphics · local workstation"}</p>
    <h5 id="render-title" className="mt-2 text-xl font-black">{simple ? "Make your Instagram pictures" : "Review the actual pixels before downloading."}</h5>
    <p className="mt-2 text-sm leading-6 text-zinc-300">{simple ? "Make the finished pictures, check them, then download your post. Files stay on this Mac. You upload them to Instagram yourself." : `Create 1080 × 1350 PNGs from saved revision ${board.revision}. Original photos and licensed fonts are placed directly. Files stay in private local storage.`}</p>
    {dirty && <p className="mt-3 text-sm text-amber-100">Save your storyboard edits before rendering or approving a proof.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-amber-100">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button className={`${button} bg-red-700`} disabled={busy || dirty || jobs.some(j => j.status === "running")} onClick={() => void action("start")}>{simple ? "Make my pictures" : "Create exact-size proof"}</button><button className={button} onClick={() => { setError(""); void refresh().catch(e => setError(explain(e))); }}>Refresh render status</button></div>
    {jobs.length > 0 && <details className="mt-4"><summary className="min-h-11 cursor-pointer text-sm">Earlier pictures and status</summary><label className="mt-4 block text-sm">Saved render<select className="mt-2 min-h-11 w-full min-w-0 rounded border border-white/20 bg-black p-2" value={job?.id || ""} onChange={e => setSelected(e.target.value)}>{jobs.map(j => <option key={j.id} value={j.id}>Storyboard {j.boardRevision} · {j.status} · {new Date(j.createdAt).toLocaleString()}</option>)}</select></label></details>}
    {job && <>
      <p role="status" className="mt-3 text-sm">{job.status === "running" ? `Rendering: ${job.progress}/${board.slides.length} slides completed. You can cancel below.` : `Render status: ${job.status}. Attempt ${job.attempt} of 2.`}</p>
      {!current && <p className="mt-2 text-sm text-amber-100">This proof belongs to an older storyboard revision. Create a new proof of the saved version.</p>}
      {job.status === "running" && <button className={`${button} mt-3`} onClick={() => void action("cancel")}>Cancel rendering</button>}
      {["failed", "cancelled"].includes(job.status) && <button className={`${button} mt-3`} disabled={busy || dirty || !current || job.attempt >= 2} onClick={() => void action("retry")}>Retry this render</button>}
      {job.blockers.length > 0 && <div className="mt-3 rounded border border-amber-300/30 p-3"><p className="font-bold">{simple ? "A few things to finish first" : "Final download is blocked"}</p><ul className="mt-2 list-inside list-disc space-y-2 text-sm">{job.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul><p className="mt-2 text-xs">Correct these items in the storyboard, save, then create a new proof.</p></div>}
      {proofLoaded === proofKey && !dirty && current && proofs.length > 0 && <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">{proofs.map((url, i) => <figure key={url} className="min-w-0">
        <figcaption className="mb-2 text-xs font-bold uppercase text-red-200">Slide {i + 1} · Actual render proof</figcaption>
        {/* Authenticated image bytes stay in short-lived browser object URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Actual graphic proof, slide ${i + 1}: ${board.slides[i]?.headline}`} width={1080} height={1350} className="h-auto w-full" />
      </figure>)}</div>}
      {job.status === "proof" && current && !dirty && <>
        <details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer font-bold">Review caption and proposed alt text</summary><p className="whitespace-pre-wrap py-3">{photoCaption(board)}</p>{board.slides.map((s, i) => <p className="mt-2" key={s.id}>{i + 1}. {s.layout === "photo" ? `Photo: ${board.assets.find(a => a.id === s.assetId)?.label}. ` : "Text card. "}{s.headline}{s.body ? `. ${s.body}` : ""}</p>)}</details>
        <label className="mt-3 flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-red-500" checked={reviewed === proofKey} disabled={proofLoaded !== proofKey || job.blockers.length > 0 || busy} onChange={e => setReviewed(e.target.checked ? proofKey : "")} />I inspected every rendered slide, its crop, readable text, photo credit, caption and alt text. I approve these exact graphics for download.</label>
        <button className={`${button} mt-3`} disabled={busy || reviewed !== proofKey || proofLoaded !== proofKey || job.blockers.length > 0} onClick={() => void action("approve")}>{simple ? "These look good — approve pictures" : "Approve final graphics"}</button>
      </>}
      {job.status === "approved" && current && <button className={`${button} mt-4 bg-red-700`} disabled={busy || dirty} onClick={() => void download()}>{simple ? "Download my Instagram post" : "Download PNGs + caption + sources (ZIP)"}</button>}
      {simple && job.status === "approved" && current && <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm leading-7"><h6 className="font-bold">Your next step in Instagram</h6><ol className="mt-2 list-inside list-decimal"><li>Download and open the ZIP folder.</li><li>Start an Instagram post and choose the numbered pictures in order.</li><li>Copy the text from caption.txt into your caption.</li><li>Check the post, then share it when you are ready.</li></ol></div>}
      {job.status !== "running" && job.status !== "deleted" && <div className="mt-4 border-t border-white/15 pt-3">{deleteConfirm === job.id ? <><p className="text-sm">Delete this render’s local image and download files? The audit record and saved storyboard remain.</p><button className={`${button} mt-2`} disabled={busy} onClick={() => void action("delete")}>Confirm file deletion</button><button className={`${button} ml-2`} onClick={() => setDeleteConfirm("")}>Keep files</button></> : <button className={button} disabled={busy} onClick={() => setDeleteConfirm(job.id)}>Delete render files</button>}</div>}
    </>}
  </section>;
}
