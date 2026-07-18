import { formatKnowledgeLabel } from "@/components/executive/knowledgeExplorerUtils";
import type { KnowledgeNode } from "@/domain/knowledge";
import { ChevronRight } from "lucide-react";

type KnowledgeNodeListProps = {
  nodes: KnowledgeNode[];
  selectedNodeId: string | null;
  onSelect(nodeId: string, trigger: HTMLButtonElement): void;
};

export function KnowledgeNodeList({ nodes, selectedNodeId, onSelect }: KnowledgeNodeListProps) {
  if (nodes.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-black/40 px-5 py-10 text-center">
        <p className="text-sm font-black uppercase tracking-wider text-white">No matching knowledge nodes</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Adjust the search or filters to broaden the graph view.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2" aria-label="Knowledge nodes">
      {nodes.map((node) => {
        const selected = node.id === selectedNodeId;
        return (
          <button
            key={node.id}
            type="button"
            aria-expanded={selected}
            onClick={(event) => onSelect(node.id, event.currentTarget)}
            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border px-4 py-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
              selected
                ? "border-red-500/70 bg-red-500/10"
                : "border-white/10 bg-black hover:border-white/25 hover:bg-white/[0.03]"
            }`}
          >
            <span className="min-w-0">
              <span className="block break-words text-sm font-black leading-5 text-white">{node.name}</span>
              <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                {formatKnowledgeLabel(node.type)} · {formatKnowledgeLabel(node.confidence)} · {formatKnowledgeLabel(node.status)}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className={selected ? "text-red-400" : "text-zinc-600"} size={17} />
          </button>
        );
      })}
    </div>
  );
}
