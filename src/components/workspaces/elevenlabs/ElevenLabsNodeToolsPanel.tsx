/**
 * Read-only «Strumenti» tab for a ConvAI workflow node (mirrors ElevenLabs UI).
 */

import React from 'react';
import type {
  WorkspaceAgentToolInventory,
  WorkspaceNodeTools,
  WorkspaceWorkflowNode,
} from '@workspaces/core/types';
import { ElevenLabsReadOnlyToggle } from './ElevenLabsReadOnlyToggle';
import { ElevenLabsToolListRow } from './ElevenLabsToolListRow';
import { Pencil } from 'lucide-react';

const DEFAULT_TOOLS: WorkspaceNodeTools = {
  inheritsAgentTools: true,
  builtInTools: [],
  additionalTools: [],
};

export type ElevenLabsNodeToolsPanelProps = {
  node: WorkspaceWorkflowNode;
  toolInventory: WorkspaceAgentToolInventory;
  onOpenAgentTab?: () => void;
};

export function ElevenLabsNodeToolsPanel({
  node,
  toolInventory,
  onOpenAgentTab,
}: ElevenLabsNodeToolsPanelProps): React.ReactElement {
  const tools = node.tools ?? DEFAULT_TOOLS;
  const inheritedTools = tools.inheritsAgentTools ? toolInventory.agentTools : [];
  const localTools = toolInventory.allTools.filter(
    (t) => t.scope === 'node' && t.nodeId === node.id
  );

  if (node.kind !== 'subagent' && node.kind !== 'tool') {
    return (
      <p className="text-xs text-slate-500">
        Gli strumenti per nodo si configurano sui subagent del workflow.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {tools.builtInTools.length > 0 ? (
        <section className="border-b border-slate-800/80 pb-2">
          <h4 className="py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Strumenti integrati
          </h4>
          <ul className="space-y-0.5">
            {tools.builtInTools.map((t) => (
              <li
                key={t.id}
                className={
                  'flex items-center gap-2 rounded px-1 py-1.5 text-sm ' +
                  (t.enabled ? 'text-slate-200' : 'text-slate-500 line-through')
                }
              >
                <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span className="min-w-0 truncate">{t.label}</span>
                {!t.enabled ? (
                  <span className="ml-auto text-[10px] text-slate-600">disattivo</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="py-2 text-xs text-slate-500">
          Nessuno strumento di sistema nel payload del nodo (possono essere ereditati dall&apos;agente).
        </p>
      )}

      <ElevenLabsReadOnlyToggle
        label="Eredita strumenti"
        checked={tools.inheritsAgentTools}
        hint="Include i tool webhook/client definiti sull'agente principale."
      />

      {tools.inheritsAgentTools ? (
        <section className="border-b border-slate-800/80 pb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Tool ereditati dall&apos;agente ({inheritedTools.length})
            </h4>
            {onOpenAgentTab ? (
              <button
                type="button"
                onClick={onOpenAgentTab}
                className="text-[10px] font-medium text-violet-400 hover:text-violet-300"
              >
                Tab Agente →
              </button>
            ) : null}
          </div>
          {inheritedTools.length > 0 ? (
            <ul className="space-y-1.5">
              {inheritedTools.map((t) => (
                <ElevenLabsToolListRow key={`inh-${t.id}`} tool={t} inherited />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">
              Nessun tool webhook/client sull&apos;agente principale.
            </p>
          )}
        </section>
      ) : null}

      <section className="flex items-center justify-between gap-3 py-3">
        <p className="text-sm text-slate-200">Strumenti aggiuntivi</p>
        <button
          type="button"
          disabled
          title="Modifica su ElevenLabs (sola lettura in Omnia)"
          className="shrink-0 rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-400 opacity-60"
        >
          Aggiungi strumento
        </button>
      </section>

      {localTools.length > 0 ? (
        <ul className="space-y-1.5 pb-2">
          {localTools.map((t) => (
            <ElevenLabsToolListRow key={`loc-${t.id}`} tool={t} />
          ))}
        </ul>
      ) : (
        <p className="pb-2 text-xs text-slate-500">Nessuno strumento aggiuntivo su questo nodo.</p>
      )}

      <p className="border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        Per mappare webhook in Omnia: Backend Call nel wizard Agente AI e compile ConvAI.
      </p>
    </div>
  );
}
