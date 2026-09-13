"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { draftSections } from "@/domain/content-intelligence/editorial";
import { InstagramStoryEditor } from "./InstagramStoryEditor";
import { approvedStoryClaims, type Storyboard, type StoryboardInput } from "@/domain/content-intelligence/storyboard";
import type { DraftPackage, PackageBinding, ResearchPackage, Run } from "@/domain/content-intelligence/types";

export type IntelligenceState = { observedAt: string; packages: PackageBinding[]; runs: Run[]; research: ResearchPackage[]; drafts: DraftPackage[]; storyboards?: Storyboard[]; reservedMicros: number; monthlyMicros: number };
const button = "min-h-11 border border-white/20 px-4 py-3 text-sm font-bold text-white hover:border-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";
const messages: Record<string, string> = {
  "school-source-confirmation-required": "Confirm the official school website before starting research.",
  "school-source-preview-changed": "The website preview changed. Check it again before continuing.",
  "school-source-already-confirmed": "This school website is already confirmed. Open its research and post.",
  "gateway-not-enabled": "Research is paused while its connection is being verified. Existing School Spotlights remain available.",
  "sign-in-required": "Sign in again to continue.", "administrator-required": "This action requires Headquarters administrator access.",
  "server-connection-unavailable": "The secure research connection needs setup. Contact your Headquarters administrator.",
  "server-configuration-required": "The secure research connection needs setup. Contact your Headquarters administrator.",
  "provider-configuration-required": "The AI connection needs setup. Contact your Headquarters administrator.",
  "provider-permission-denied": "The AI connection could not authorize this request. Check its project permissions.",
  "monthly-budget-exhausted": "The $10 monthly research budget is fully reserved. No new request was started.",
  "request-budget-exhausted": "This request reached its $0.50 limit. Review its status before starting again.",
  "another-request-is-running": "Another request is already running. Refresh its status or cancel it first.",
  "approved-version-required": "Open and approve the current School Spotlight version before researching it.",
  "approved-version-changed": "The approved School Spotlight version changed. Reopen the current version before continuing.",
  "invalid-claim-wording": "Use 1–240 characters of evidence-backed wording for each claim.",
  "research-review-required": "Review every candidate claim and support at least one before generating drafts.",
  "research-review-changed": "The evidence review changed. Refresh and use its current version.",
  "conflict-needs-resolution": "Two supported claims disagree on the same detail. Exclude the unresolved claim before saving.",
  "no-readable-approved-sources": "No approved source page could be read. Review the source policy before retrying.",
  "request-cancelled": "The request was cancelled. Its budget reservation remains recorded.",
  "moderation-review-required": "This content needs a safety review. No generated result was saved.",
};
export function explain(code: string) { return messages[code] || "This request could not finish. Refresh its status before trying again."; }
export async function api(body?: unknown) {
  const user = auth?.currentUser;
  if (!user) throw new Error("sign-in-required");
  const token = await user.getIdToken();
  const response = await fetch("/api/content-intelligence", { method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "request-failed"); return data;
}

export function EvidenceReview({ research, busy, onSave }: { research: ResearchPackage; busy: boolean; onSave(decisions: { id: string; decision: string; text: string }[]): void }) {
  const [supported, setSupported] = useState(() => new Set(research.claims.filter(claim => claim.confidence === "supported").map(claim => claim.id)));
  const [wording, setWording] = useState<Record<string, string>>(() => Object.fromEntries(research.claims.map(claim => [claim.id, claim.text])));
  return <section className="mt-5 border-t border-white/15 pt-5" aria-label="Research evidence review">
    <h4 className="text-lg font-black">Check the facts</h4>
    <p className="mt-2 text-sm leading-6 text-zinc-300">Open each source and check that it supports the whole claim, applies to this school, and is current. Check only the claims you support. Unchecked claims will be excluded. Matching a quotation alone does not verify a claim. Edit the draft wording for clear, original Hoop Frens expression; every detail you keep must still be supported by the quotation.</p>
    {research.conflicts.length > 0 && <div className="mt-4 border border-amber-400/40 p-3 text-amber-100"><strong>Conflicting information</strong><ul className="mt-2 list-inside list-disc">{research.conflicts.map(field => <li key={field}>{field}</li>)}</ul></div>}
    <div className="mt-4 grid gap-4">{research.claims.map(claim => <article key={claim.id} className="min-w-0 border border-white/15 bg-black p-4">
      <p className="text-xs font-bold uppercase text-amber-200">{claim.confidence.replaceAll("-", " ")}</p>
      <label className="mt-2 block text-sm font-bold">Draft wording<textarea value={wording[claim.id]} maxLength={240} rows={3} disabled={busy} onChange={event => setWording(previous => ({ ...previous, [claim.id]: event.target.value }))} className="mt-2 w-full resize-y border border-white/20 bg-black p-3 text-white" /></label>
      {claim.evidence.map((evidence, index) => { const source = research.sources.find(source => source.id === evidence.sourceId); return <div key={index} className="mt-3 text-sm leading-6 text-zinc-300">
        <blockquote className="border-l-2 border-red-500 pl-3">“{evidence.quote}”</blockquote>
        {source && <><a href={source.url} target="_blank" rel="noreferrer" className="mt-2 block break-words text-red-300 underline">{source.title}</a><p>Accessed {new Date(source.accessedAt).toLocaleDateString()}</p></>}
      </div>; })}
      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={supported.has(claim.id)} disabled={busy} onChange={event => setSupported(previous => { const next = new Set(previous); if (event.target.checked) next.add(claim.id); else next.delete(claim.id); return next; })} className="h-5 w-5 accent-red-600" />I checked the evidence and support this claim.</label>
    </article>)}</div>
    {research.missingInformation.length > 0 && <div className="mt-4 border border-amber-400/30 p-4"><h5 className="font-bold text-amber-100">Information still needed</h5><ul className="mt-2 list-inside list-disc text-sm leading-6">{research.missingInformation.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    {research.binding.projectId.startsWith("school-request-") && <p className="mt-4 text-sm text-zinc-300">Saving your checked facts approves this exact editorial school package and automatically assembles your Instagram post. It does not publish or approve photo usage rights.</p>}
    <button className={`${button} mt-4`} disabled={busy || !research.claims.length || research.claims.some(claim => !wording[claim.id]?.trim())} onClick={() => onSave(research.claims.map(claim => ({ id: claim.id, decision: supported.has(claim.id) ? "supported" : "rejected", text: wording[claim.id] })))}>{research.binding.projectId.startsWith("school-request-") ? "Approve checked facts and build my post" : "Save checked facts"}</button>
  </section>;
}

export function GovernedContentIntelligence({ onDirtyChange }: { onDirtyChange?(value: boolean): void }) {
  const [state, setState] = useState<IntelligenceState | null>(null);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storyDirty, setStoryDirty] = useState(false);
  useEffect(() => { onDirtyChange?.(storyDirty); }, [storyDirty, onDirtyChange]);
  const refresh = useCallback(async () => {
    const value = await api() as IntelligenceState;
    // Keep unsaved edits attached to their evidence snapshot. Saves still validate the live binding on the server.
    setState(previous => storyDirty && previous ? { ...value, packages: previous.packages, research: previous.research } : value);
    return value;
  }, [storyDirty]);
  useEffect(() => { let active = true; api().then(value => { if (active) setState(value); }).catch(error => { if (active) setError(explain(error.message)); }); return () => { active = false; }; }, []);
  const selected = state?.packages.find(pkg => pkg.projectId === projectId);
  const research = state?.research.filter(item => item.binding.projectId === projectId && item.binding.contentHash === selected?.contentHash).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const drafts = state?.drafts.filter(item => item.researchPackageId === research?.id && item.researchRevision === research?.revision && item.binding.contentHash === selected?.contentHash).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const running = state?.runs.filter(run => run.status === "running") || [];
  const storyboard = state?.storyboards?.find(b => b.researchPackageId === research?.id && b.researchRevision === research?.revision && b.binding.contentHash === selected?.contentHash);
  const latest = state?.runs.filter(run => run.binding.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  async function saveStory(board: StoryboardInput, revision: number): Promise<Storyboard> {
    setBusy(true);
    try {
      const result = await api({ action: "save-storyboard", researchId: research?.id, researchRevision: research?.revision, revision, board }) as Storyboard;
      // Update the acknowledged revision immediately; a failed refresh must not turn a successful save into a retry.
      setState(previous => previous ? { ...previous, storyboards: [...(previous.storyboards || []).filter(b => b.id !== result.id), result] } : previous);
      return result;
    } finally { setBusy(false); }
  }

  async function mutate(body: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { const result = await api(body); if (result.status === "failed") setError(explain(result.errorCode)); else if (result.status === "cancelled") setNotice(explain("request-cancelled")); else setNotice("Saved. Review the result below."); await refresh(); }
    catch (error) { setError(explain(error instanceof Error ? error.message : "request-failed")); }
    finally { setBusy(false); }
  }
  async function start(action: "research" | "generate") {
    const storageKey = `hf-content-request:${auth?.currentUser?.uid}:${projectId}:${action}:${research?.id || ""}:${research?.revision || 0}`;
    let requestId = sessionStorage.getItem(storageKey);
    if (!requestId) { requestId = crypto.randomUUID(); sessionStorage.setItem(storageKey, requestId); }
    setBusy(true); setError(""); setNotice("The request is running. You can refresh its status or cancel it below.");
    // The job is durable on the server; refreshing does not initiate another provider request.
    const timer = setInterval(() => { void refresh().catch(() => undefined); }, 3000);
    try {
      const run = await api({ action, projectId, requestId, ...(action === "generate" ? { researchId: research?.id, researchRevision: research?.revision } : {}) }) as Run;
      if (run.status !== "running") sessionStorage.removeItem(storageKey);
      if (run.status === "failed") setError(explain(run.errorCode || "request-failed"));
      setNotice(run.status === "completed" ? "Saved. Review the result below." : run.status === "cancelled" ? explain("request-cancelled") : "The request is still running. Refresh its status.");
      await refresh();
    } catch (error) { setError(explain(error instanceof Error ? error.message : "request-failed")); }
    finally { clearInterval(timer); setBusy(false); }
  }
  return <section className="mt-8 border border-red-500/30 bg-[#0e0e0e] p-4 sm:p-6" aria-labelledby="governed-content-title">
    <p className="text-xs font-black uppercase tracking-widest text-red-400">Hoop Frens Content Intelligence</p>
    <h3 id="governed-content-title" className="mt-2 text-2xl font-black">Research a school. Build a sourced story.</h3>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Start from an approved School Spotlight. Research official sources, review the evidence, then create platform drafts in the Hoop Frens voice.</p>
    <p className="mt-2 text-sm text-zinc-400">Each research or drafting request reserves $0.50 from the $10 monthly budget, allowing up to 20 requests per month. Reservations remain counted after completion, failure or cancellation. Outputs are internal drafts.</p>
    {state && <p className="mt-2 text-sm font-bold">This month: ${(state.reservedMicros / 1_000_000).toFixed(2)} reserved of ${(state.monthlyMicros / 1_000_000).toFixed(2)}</p>}
    {error && <p role="alert" className="mt-4 border border-amber-400/40 p-3 text-sm text-amber-100">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-zinc-200">{notice}</p>}
    <div className="mt-5 flex flex-wrap items-end gap-3">
      <label className="w-full min-w-0 text-sm font-bold sm:w-auto sm:flex-1">Approved School Spotlight<select value={projectId} disabled={busy || storyDirty} onChange={event => { setProjectId(event.target.value); setNotice(""); setError(""); }} className="mt-2 min-h-12 w-full border border-white/20 bg-black p-3 text-white"><option value="">Choose a school and version</option>{state?.packages.filter(pkg => pkg.scope !== "school-request").map(pkg => <option key={pkg.projectId} value={pkg.projectId}>{pkg.schoolName}{pkg.team ? ` · ${pkg.team}` : ""} · Approved version {pkg.version}</option>)}</select></label>
      <button className={button} onClick={() => { setError(""); void refresh().catch(error => setError(explain(error.message))); }}>Refresh status</button>
    </div>
    {state && !state.packages.some(pkg => pkg.scope !== "school-request") && <p className="mt-3 text-sm text-zinc-300">No approved package is available under the current source policy. Approve a School Spotlight or ask for its official sources to be added to the policy.</p>}
    {selected && <p className="mt-3 text-sm text-zinc-300">All results will link to {selected.schoolName}, approved version {selected.version}.</p>}
    {storyDirty && <p className="mt-3 text-sm text-amber-100">Save or discard your storyboard edits before changing schools or evidence.</p>}
    <div className="mt-4 flex flex-wrap gap-3"><button className={`${button} bg-red-600`} disabled={busy || storyDirty || !selected || running.length > 0} onClick={() => void start("research")}>Research official sources</button><button className={button} disabled={busy || !research || !research.claims.some(claim => claim.confidence === "supported") || research.claims.some(claim => !["supported", "rejected"].includes(claim.confidence)) || running.length > 0} onClick={() => void start("generate")}>Create six platform drafts</button></div>
    {running.map(run => <div key={run.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-white/20 p-3"><p className="text-sm">{run.binding.schoolName}: {Date.parse(run.expiresAt) < Date.parse(state!.observedAt) ? "Request interrupted or timed out; cancel before starting again." : "Request running"}</p><button className={button} onClick={() => { void api({ action: "cancel", runId: run.id }).then(() => refresh()).catch(error => setError(explain(error.message))); }}>Cancel request</button></div>)}
    {latest?.status === "failed" && <p className="mt-4 text-sm text-amber-200">Last request: {explain(latest.errorCode || "request-failed")}</p>}
    {research && approvedStoryClaims(research).length > 0 && research.claims.every(c => ["supported", "rejected"].includes(c.confidence)) && <InstagramStoryEditor key={`${research.id}:${research.revision}`} research={research} saved={storyboard} busy={busy} onSave={saveStory} onDirty={setStoryDirty} />}
    {research && <details className="mt-5" open={!research.claims.every(c => ["supported", "rejected"].includes(c.confidence))}><summary className="min-h-11 cursor-pointer py-3 text-lg font-bold">Research evidence and wording</summary><EvidenceReview key={`${research.id}:${research.revision}`} research={research} busy={busy || storyDirty} onSave={decisions => void mutate({ action: "review", researchId: research.id, revision: research.revision, decisions })} /></details>}
    {drafts && <p className="mt-6 text-sm text-zinc-400">The six-platform text drafts below are separate from your saved Instagram storyboard. Storyboard edits do not rewrite these drafts.</p>}
    {drafts && <section className="mt-6" aria-label="Platform drafts"><h4 className="text-xl font-black">Six platform drafts</h4><p className="mt-2 text-sm text-zinc-400">Approved School Spotlight version {drafts.binding.version} · Evidence review {drafts.researchRevision}. Review copy and source context before any later use.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{drafts.drafts.map(draft => <article key={draft.platform} className="min-w-0 border border-white/15 bg-black p-4"><p className="text-xs font-black uppercase text-red-300">{draft.platform} · Draft</p><h5 className="mt-2 font-black">{draft.title}</h5><p className="mt-1 text-sm text-zinc-400">{draft.format}</p>{draftSections(draft).map((section, index) => <section key={index} className="mt-4 border-t border-white/10 pt-3"><h6 className="text-xs font-bold uppercase text-zinc-400">{section.label}</h6>{section.blocks.map((block, blockIndex) => <div key={blockIndex} className="mt-2 text-sm leading-6"><p>{block.text}</p>{block.citations.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="block break-words text-red-300 underline">Source: {source.title}</a>)}</div>)}</section>)}<details className="mt-4 text-sm text-zinc-400"><summary className="min-h-11 cursor-pointer">Visual direction</summary><ul className="list-inside list-disc leading-6">{draft.visualDirections.map(direction => <li key={direction}>{direction}</li>)}</ul></details></article>)}</div></section>}
  </section>;
}
