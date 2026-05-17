/**
 * Read-only «Knowledge Base» tab for a ConvAI workflow node (mirrors ElevenLabs UI).
 */

import React from 'react';
import type { WorkspaceNodeKnowledgeBase, WorkspaceWorkflowNode } from '@workspaces/core/types';
import { ElevenLabsReadOnlyToggle } from './ElevenLabsReadOnlyToggle';
import { FileText } from 'lucide-react';

const DEFAULT_KB: WorkspaceNodeKnowledgeBase = {
  inheritsAgentKnowledgeBase: true,
  additionalDocuments: [],
};

export type ElevenLabsNodeKnowledgeBasePanelProps = {
  node: WorkspaceWorkflowNode;
};

export function ElevenLabsNodeKnowledgeBasePanel({
  node,
}: ElevenLabsNodeKnowledgeBasePanelProps): React.ReactElement {
  const kb = node.knowledgeBase ?? DEFAULT_KB;

  if (node.kind !== 'subagent' && node.kind !== 'tool') {
    return (
      <p className="text-xs text-slate-500">
        Knowledge Base per nodo si applica ai subagent del workflow.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <ElevenLabsReadOnlyToggle
        label="Eredita base di conoscenza"
        checked={kb.inheritsAgentKnowledgeBase}
        hint="Include i documenti KB configurati sull'agente principale."
      />
      <section className="flex items-center justify-between gap-3 py-3">
        <p className="text-sm text-slate-200">Base di conoscenza aggiuntiva</p>
        <button
          type="button"
          disabled
          title="Modifica su ElevenLabs (sola lettura in Omnia)"
          className="shrink-0 rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-400 opacity-60"
        >
          Aggiungi documento
        </button>
      </section>
      {kb.additionalDocuments.length > 0 ? (
        <ul className="space-y-1.5 pb-2">
          {kb.additionalDocuments.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start gap-2 rounded-md border border-slate-700/60 bg-slate-900/50 px-2.5 py-2 text-xs text-slate-300"
            >
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{doc.name}</span>
                <span className="font-mono text-[10px] text-slate-500">{doc.id}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pb-2 text-xs text-slate-500">Nessun documento aggiuntivo su questo nodo.</p>
      )}
      <p className="border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        Vista specchio — modifica nel portale ElevenLabs e usa Aggiorna nel workspace.
      </p>
    </div>
  );
}
