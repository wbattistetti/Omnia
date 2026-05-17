/**
 * Vertical workflow step list (Omnia canvas-style) for remote ConvAI nodes.
 */

import React from 'react';
import type { WorkspaceWorkflowEdge, WorkspaceWorkflowNode } from '@workspaces/core/types';
import { MessageSquare, CircleDot, Wrench, PhoneForwarded, HelpCircle } from 'lucide-react';

export type ElevenLabsWorkflowListProps = {
  nodes: readonly WorkspaceWorkflowNode[];
  edges: readonly WorkspaceWorkflowEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
};

function kindIcon(kind: WorkspaceWorkflowNode['kind']): React.ReactElement {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (kind) {
    case 'subagent':
      return <MessageSquare className={cls} aria-hidden />;
    case 'start':
    case 'end':
      return <CircleDot className={cls} aria-hidden />;
    case 'tool':
      return <Wrench className={cls} aria-hidden />;
    case 'transfer':
      return <PhoneForwarded className={cls} aria-hidden />;
    default:
      return <HelpCircle className={cls} aria-hidden />;
  }
}

export function ElevenLabsWorkflowList({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: ElevenLabsWorkflowListProps): React.ReactElement {
  const edgesBySource = React.useMemo(() => {
    const m = new Map<string, WorkspaceWorkflowEdge[]>();
    for (const e of edges) {
      const list = m.get(e.sourceNodeId) ?? [];
      list.push(e);
      m.set(e.sourceNodeId, list);
    }
    return m;
  }, [edges]);

  const displayNodes = React.useMemo(() => {
    const subagents = nodes.filter((n) => n.kind === 'subagent' || n.kind === 'tool');
    if (subagents.length > 0) return subagents;
    const middle = nodes.filter((n) => n.kind !== 'start' && n.kind !== 'end');
    if (middle.length > 0) return middle;
    return nodes;
  }, [nodes]);

  if (displayNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-slate-500">
        Nessun nodo workflow nel payload remoto (agente senza grafo o prompt solo globale).
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1 p-2" role="listbox" aria-label="Passi workflow ElevenLabs">
      {displayNodes.map((node) => {
        const selected = selectedNodeId === node.id;
        const out = edgesBySource.get(node.id) ?? [];
        return (
          <li key={node.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelectNode(node.id)}
              className={
                'flex w-full min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ' +
                (selected
                  ? 'border-violet-500/70 bg-violet-950/50 text-violet-50 ring-1 ring-violet-400/30'
                  : 'border-slate-700/60 bg-slate-900/40 text-slate-200 hover:border-slate-600 hover:bg-slate-800/80')
              }
            >
              <span className="mt-0.5 text-violet-300">{kindIcon(node.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{node.label}</span>
                {out.length > 0 ? (
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    → {out.map((e) => e.label || e.conditionText || e.targetNodeId).join(' · ')}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
