import { formatKnowledgeLabel } from "@/components/executive/knowledgeExplorerUtils";
import { type KnowledgeSource, KnowledgeStatus } from "@/domain/knowledge";
import { Archive, ArrowUpRight, BookOpen } from "lucide-react";

type KnowledgeSourceDetailProps = {
  source: KnowledgeSource;
  actionPending: boolean;
  onArchive(): void;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function KnowledgeSourceDetail({ source, actionPending, onArchive }: KnowledgeSourceDetailProps) {
  return (
    <div className="grid gap-6" data-knowledge-source-detail="true">
      <section className="border border-white/10 bg-black p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <BookOpen aria-hidden="true" className="text-red-500" size={17} />
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">Source Provenance</h3>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Source ID</dt><dd className="mt-1 break-all font-bold text-zinc-200">{source.id}</dd></div>
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Publisher</dt><dd className="mt-1 font-bold text-zinc-200">{source.publisher || "Not recorded"}</dd></div>
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Type</dt><dd className="mt-1 font-bold text-zinc-200">{formatKnowledgeLabel(source.sourceType)}</dd></div>
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Reliability</dt><dd className="mt-1 font-bold text-zinc-200">{formatKnowledgeLabel(source.reliability)}</dd></div>
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Accessed At</dt><dd className="mt-1 font-bold text-zinc-200"><time dateTime={source.accessedAt}>{displayDate(source.accessedAt)}</time></dd></div>
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Published At</dt><dd className="mt-1 font-bold text-zinc-200">{source.publishedAt ? <time dateTime={source.publishedAt}>{displayDate(source.publishedAt)}</time> : "Not recorded"}</dd></div>
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Status</dt><dd className="mt-1 font-bold text-zinc-200">{formatKnowledgeLabel(source.status)}</dd></div>
          <div><dt className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Updated</dt><dd className="mt-1 font-bold text-zinc-200"><time dateTime={source.updatedAt}>{displayDate(source.updatedAt)}</time></dd></div>
        </dl>
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Canonical History</p>
          <ul className="mt-3 grid gap-2">
            {[...source.versionHistory].reverse().map((version) => (
              <li key={version.version} className="border-l border-white/15 pl-3 text-xs leading-5 text-zinc-400">
                <span className="font-black text-zinc-200">Version {version.version}</span> · {version.reason} · {version.changedBy}
              </li>
            ))}
          </ul>
        </div>
        {source.notes ? <div className="mt-5 border-l border-red-500/40 pl-4"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Verification Notes</p><p className="mt-2 text-sm leading-6 text-zinc-300">{source.notes}</p></div> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-400 hover:text-red-300">Open source <ArrowUpRight aria-hidden="true" size={14} /></a> : null}
          {source.status === KnowledgeStatus.Active ? (
            <button type="button" disabled={actionPending} onClick={onArchive} className="inline-flex items-center gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
              <Archive aria-hidden="true" size={14} /> Archive source
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
