/**
 * Read-only inspector for a ConvAI workflow node (Generale, KB, Strumenti, …).
 */

import React from 'react';
import type {
  WorkspaceAgentSettings,
  WorkspaceAgentToolInventory,
  WorkspaceWorkflowNode,
} from '@workspaces/core/types';
import { ElevenLabsNodeKnowledgeBasePanel } from './ElevenLabsNodeKnowledgeBasePanel';
import { ElevenLabsNodeToolsPanel } from './ElevenLabsNodeToolsPanel';

export type ElevenLabsNodeInspectorProps = {
  node: WorkspaceWorkflowNode | null;
  globalPrompt?: string;
  agentSettings?: WorkspaceAgentSettings;
  toolInventory?: WorkspaceAgentToolInventory;
  onOpenAgentTab?: () => void;
  onImportNode?: () => void;
  importBusy?: boolean;
};

type InspectorTab = 'general' | 'knowledgeBase' | 'tools' | 'voice' | 'llm' | 'raw';

const INSPECTOR_TABS: readonly { id: InspectorTab; label: string }[] = [
  { id: 'general', label: 'Generale' },
  { id: 'knowledgeBase', label: 'Knowledge Base' },
  { id: 'tools', label: 'Strumenti' },
  { id: 'voice', label: 'Voce' },
  { id: 'llm', label: 'LLM' },
  { id: 'raw', label: 'Raw' },
];

const EMPTY_TOOL_INVENTORY: WorkspaceAgentToolInventory = { agentTools: [], allTools: [] };

export function ElevenLabsNodeInspector({
  node,
  globalPrompt,
  agentSettings,
  toolInventory = EMPTY_TOOL_INVENTORY,
  onOpenAgentTab,
  onImportNode,
  importBusy = false,
}: ElevenLabsNodeInspectorProps): React.ReactElement {
  const [tab, setTab] = React.useState<InspectorTab>('general');

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center text-sm text-slate-500">
        Seleziona un nodo del workflow remoto.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-800 bg-slate-950/60">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-violet-100">{node.label}</h3>
          <p className="truncate text-[11px] text-slate-500">
            {node.kind} · <span className="font-mono">{node.id}</span>
          </p>
        </div>
        {onImportNode ? (
          <button
            type="button"
            disabled={importBusy}
            onClick={onImportNode}
            className="shrink-0 rounded-md border border-violet-500/60 bg-violet-950/50 px-2.5 py-1 text-xs font-semibold text-violet-100 hover:bg-violet-900/60 disabled:opacity-50"
          >
            {importBusy ? 'Import…' : 'Edit in Omnia'}
          </button>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 px-2 py-1.5" role="tablist">
        {INSPECTOR_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={
              'shrink-0 rounded px-2 py-1 text-xs font-medium whitespace-nowrap ' +
              (tab === t.id
                ? 'bg-violet-900/70 text-violet-100'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
        {tab === 'general' ? (
          <div className="space-y-3">
            {node.inheritsGlobalPrompt ? (
              <div className="rounded-md border border-slate-600/80 bg-slate-900/60 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  System prompt
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Questo nodo eredita il prompt di sistema dell&apos;agente (tab{' '}
                  <span className="font-medium text-violet-200">Agente</span>), come in ElevenLabs.
                  Non ha un override locale.
                </p>
              </div>
            ) : null}
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {node.kind === 'subagent' ? 'Sovrascrivi prompt' : 'Istruzioni nodo'}
            </label>
            {node.inheritsGlobalPrompt ? (
              <p className="text-xs italic text-slate-500">(nessun testo di override sul nodo)</p>
            ) : (
              <pre className="whitespace-pre-wrap rounded-md border border-slate-700/80 bg-slate-900/80 p-2 text-xs leading-relaxed text-slate-200">
                {node.promptText.trim() || '(vuoto)'}
              </pre>
            )}
            {globalPrompt?.trim() && node.inheritsGlobalPrompt ? (
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-300">
                  Anteprima prompt agente (ereditato)
                </summary>
                <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950/80 p-2 text-[11px] leading-relaxed text-slate-400">
                  {globalPrompt.trim()}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
        {tab === 'voice' ? (
          <div className="space-y-2 text-xs text-slate-300">
            <p className="text-slate-400">
              Voce ereditata dalle impostazioni agente (come in ElevenLabs quando il nodo non
              sovrascrive).
            </p>
            <p>
              <span className="text-slate-500">Voice ID:</span>{' '}
              <span className="font-mono">{agentSettings?.voiceId?.trim() || '—'}</span>
            </p>
            <p>
              <span className="text-slate-500">TTS:</span>{' '}
              <span className="font-mono">{agentSettings?.ttsModel?.trim() || '—'}</span>
            </p>
          </div>
        ) : null}
        {tab === 'llm' ? (
          <div className="space-y-2 text-xs text-slate-300">
            <p className="text-slate-400">Modello LLM a livello agente.</p>
            <p>
              <span className="text-slate-500">Modello:</span>{' '}
              <span className="font-mono">{agentSettings?.llm?.trim() || '—'}</span>
            </p>
            <p>
              <span className="text-slate-500">Lingua:</span>{' '}
              {agentSettings?.language?.trim() || '—'}
            </p>
          </div>
        ) : null}
        {tab === 'knowledgeBase' ? <ElevenLabsNodeKnowledgeBasePanel node={node} /> : null}
        {tab === 'tools' ? (
          <ElevenLabsNodeToolsPanel
            node={node}
            toolInventory={toolInventory}
            onOpenAgentTab={onOpenAgentTab}
          />
        ) : null}
        {tab === 'raw' ? (
          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-slate-400">
            {JSON.stringify(node.raw ?? node, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
