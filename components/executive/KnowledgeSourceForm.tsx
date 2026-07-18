"use client";

import {
  buildManualKnowledgeSource,
  formatKnowledgeSourceDateTimeLocal,
  type KnowledgeSource,
  type KnowledgeSourceCreateInput,
  knowledgeSourceDateValidationMessage,
  KnowledgeSourceReliability,
} from "@/domain/knowledge";
import { Loader2, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

type KnowledgeSourceFormProps = {
  pending: boolean;
  onSubmit(source: KnowledgeSourceCreateInput): Promise<void> | void;
};

function csv(value: FormDataEntryValue | null) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const inputClassName = "mt-2 h-11 w-full border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-red-500";
const textareaClassName = "mt-2 min-h-24 w-full border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-red-500";
const labelClassName = "text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500";

export function KnowledgeSourceForm({ pending, onSubmit }: KnowledgeSourceFormProps) {
  const [validationMessage, setValidationMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const sourceType = String(formData.get("sourceType") || "other") as KnowledgeSource["sourceType"];
    try {
      const source = buildManualKnowledgeSource({
        id: `source-${slug(title)}-${globalThis.crypto?.randomUUID?.().slice(0, 8) || Date.now()}`,
        workspaceId: "executive-workspace",
        title,
        url: String(formData.get("url") || ""),
        publisher: String(formData.get("publisher") || ""),
        sourceType,
        accessedAt: String(formData.get("accessedAt") || ""),
        publishedAt: String(formData.get("publishedAt") || ""),
        reliability: String(formData.get("reliability") || KnowledgeSourceReliability.Unverified) as KnowledgeSourceReliability,
        notes: String(formData.get("notes") || ""),
        projectIds: csv(formData.get("projectIds")),
      });
      setValidationMessage("");
      await onSubmit(source);
    } catch {
      setValidationMessage(knowledgeSourceDateValidationMessage);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5" data-knowledge-source-form="true">
      <p className="border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs font-bold leading-5 text-amber-100">
        Record only evidence you have personally verified. This form does not search, infer, or populate facts automatically.
      </p>
      <label className={labelClassName}>Source Title<input name="title" required className={inputClassName} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>Source Type
          <select name="sourceType" defaultValue="official" className={inputClassName}>
            {(["official", "institutional", "publication", "document", "founder", "other"] as const).map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className={labelClassName}>Reliability
          <select name="reliability" defaultValue={KnowledgeSourceReliability.Official} className={inputClassName}>
            {Object.values(KnowledgeSourceReliability).map((reliability) => <option key={reliability} value={reliability}>{reliability}</option>)}
          </select>
        </label>
      </div>
      <label className={labelClassName}>Source URL<input name="url" type="url" className={inputClassName} /></label>
      <label className={labelClassName}>Publisher<input name="publisher" className={inputClassName} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>Accessed At<input name="accessedAt" type="datetime-local" required step="60" defaultValue={formatKnowledgeSourceDateTimeLocal()} aria-describedby={validationMessage ? "knowledge-source-date-error" : undefined} className={inputClassName} /></label>
        <label className={labelClassName}>Published At<input name="publishedAt" type="datetime-local" className={inputClassName} /></label>
      </div>
      <label className={labelClassName}>Connected Project IDs <span className="normal-case tracking-normal text-zinc-700">(comma separated)</span><input name="projectIds" className={inputClassName} /></label>
      <label className={labelClassName}>Verification Notes<textarea name="notes" className={textareaClassName} /></label>
      {validationMessage ? <p id="knowledge-source-date-error" role="alert" className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">{validationMessage}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : <Save aria-hidden="true" size={15} />}
        {pending ? "Saving" : "Create Source"}
      </button>
    </form>
  );
}
