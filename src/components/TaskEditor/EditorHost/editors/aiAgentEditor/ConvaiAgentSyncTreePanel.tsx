/**
 * Albero agenti ElevenLabs + sotto-agenti workflow per il dialog sync Omnia.
 */

import React from 'react';
import { ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { getConvaiAgentDetail } from '@workspaces/elevenlabs/api/convaiAgentApi';
import { parseConvaiWorkflowFromConversationConfig } from '@workspaces/elevenlabs/parseConvaiWorkflow';
import type { WorkspaceWorkflowNodeKind } from '@workspaces/core/types';

export type ConvaiSyncTreeSelection =
  | { scope: 'root'; agentId: string; displayName: string }
  | {
      scope: 'workflow';
      agentId: string;
      agentDisplayName: string;
      nodeId: string;
      nodeLabel: string;
    };

export type ConvaiAgentTreeEntry = {
  agentId: string;
  name: string;
  expanded: boolean;
  loading: boolean;
  error: string | null;
  workflowNodes: Array<{ id: string; label: string; kind: WorkspaceWorkflowNodeKind }>;
};

const WORKFLOW_CHILD_KINDS = new Set<WorkspaceWorkflowNodeKind>(['subagent', 'tool']);

function displayAgentName(name: string, agentId: string): string {
  const n = name.trim();
  return n || agentId;
}

async function fetchWorkflowNodesForAgent(
  agentId: string
): Promise<Array<{ id: string; label: string; kind: WorkspaceWorkflowNodeKind }>> {
  const detail = await getConvaiAgentDetail(agentId);
  const graph = parseConvaiWorkflowFromConversationConfig(detail.conversationConfig);
  return graph.nodes
    .filter((n) => WORKFLOW_CHILD_KINDS.has(n.kind))
    .map((n) => ({ id: n.id, label: n.label, kind: n.kind }));
}

export function buildSyncActionLabel(
  selection: ConvaiSyncTreeSelection | null,
  useNewAgent: boolean,
  newAgentName: string
): string {
  if (useNewAgent) {
    const n = newAgentName.trim();
    return n ? `Crea ${n}` : 'Crea agente';
  }
  if (!selection) return 'Aggiorna agente';
  if (selection.scope === 'root') {
    return `Aggiorna ${selection.displayName}`;
  }
  return `Aggiorna ${selection.agentDisplayName}.${selection.nodeLabel}`;
}

export function ConvaiAgentSyncTreePanel({
  agents,
  entriesByAgentId,
  selection,
  onSelectionChange,
  onToggleExpand,
  onLoadWorkflow,
  onDeleteAgent,
  disabled,
  deletingAgentId,
}: {
  agents: readonly { agentId: string; name: string }[];
  entriesByAgentId: Record<string, ConvaiAgentTreeEntry | undefined>;
  selection: ConvaiSyncTreeSelection | null;
  onSelectionChange: (next: ConvaiSyncTreeSelection) => void;
  onToggleExpand: (agentId: string) => void;
  onLoadWorkflow: (agentId: string, name: string) => void;
  onDeleteAgent: (agentId: string) => void;
  disabled?: boolean;
  deletingAgentId?: string | null;
}): React.ReactElement {
  const isSelected = (agentId: string, nodeId?: string) => {
    if (!selection || selection.agentId !== agentId) return false;
    if (nodeId === undefined) return selection.scope === 'root';
    return selection.scope === 'workflow' && selection.nodeId === nodeId;
  };

  if (agents.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-slate-500">
        Nessun agente ConvAI nel workspace. Crea un nuovo agente sopra o aggiorna l&apos;elenco.
      </p>
    );
  }

  return (
    <div className="max-h-[min(22rem,50vh)] min-h-[12rem] overflow-y-auto rounded-lg border border-slate-600/60 bg-slate-950/80 p-1">
      {agents.map((a) => {
        const entry = entriesByAgentId[a.agentId];
        const agentLabel = displayAgentName(a.name, a.agentId);
        const expanded = entry?.expanded ?? false;
        const loading = entry?.loading ?? false;
        const wfNodes = entry?.workflowNodes ?? [];

        return (
          <div key={a.agentId} className="mb-0.5 last:mb-0">
            <div className="flex items-stretch gap-0.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleExpand(a.agentId)}
                className="inline-flex w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
                aria-label={expanded ? 'Comprimi workflow' : 'Espandi workflow'}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (!expanded && !entry?.workflowNodes.length && !loading) {
                    onLoadWorkflow(a.agentId, a.name);
                  }
                  onSelectionChange({ scope: 'root', agentId: a.agentId, displayName: agentLabel });
                }}
                className={`min-w-0 flex-1 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  isSelected(a.agentId)
                    ? 'bg-violet-900/55 text-violet-50 ring-1 ring-violet-500/45'
                    : 'text-slate-200 hover:bg-slate-800/80'
                } disabled:opacity-40`}
              >
                <span className="font-medium">{agentLabel}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                  {a.agentId}
                </span>
              </button>
              <button
                type="button"
                title="Elimina agente"
                disabled={disabled || deletingAgentId === a.agentId}
                onClick={() => onDeleteAgent(a.agentId)}
                className="inline-flex w-8 shrink-0 items-center justify-center rounded text-rose-400/90 hover:bg-rose-950/50 disabled:opacity-40"
              >
                {deletingAgentId === a.agentId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>

            {expanded ? (
              <div className="ml-7 border-l border-slate-700/60 pl-2 pb-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onSelectionChange({
                      scope: 'root',
                      agentId: a.agentId,
                      displayName: agentLabel,
                    })
                  }
                  className={`mt-0.5 w-full rounded px-2 py-1 text-left text-[11px] ${
                    isSelected(a.agentId)
                      ? 'bg-violet-900/40 text-violet-100'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  Agente principale (prompt / tool / KB root)
                </button>
                {entry?.error ? (
                  <p className="mt-1 px-2 text-[10px] text-rose-300">{entry.error}</p>
                ) : null}
                {loading ? (
                  <p className="mt-1 px-2 text-[10px] text-slate-500">Caricamento workflow…</p>
                ) : wfNodes.length === 0 && !entry?.error ? (
                  <p className="mt-1 px-2 text-[10px] text-slate-500">Nessun sotto-agente nel workflow.</p>
                ) : (
                  wfNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onSelectionChange({
                          scope: 'workflow',
                          agentId: a.agentId,
                          agentDisplayName: agentLabel,
                          nodeId: node.id,
                          nodeLabel: node.label,
                        })
                      }
                      className={`mt-0.5 w-full rounded px-2 py-1 text-left text-[11px] ${
                        isSelected(a.agentId, node.id)
                          ? 'bg-violet-900/40 text-violet-100'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span>{node.label}</span>
                      <span className="ml-1 text-[10px] text-slate-500">({node.kind})</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export { fetchWorkflowNodesForAgent };
