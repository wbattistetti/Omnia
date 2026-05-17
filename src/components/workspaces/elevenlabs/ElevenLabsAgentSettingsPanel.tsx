/**
 * «Agente» tab: read-only mirror of ElevenLabs global agent settings.
 */

import React from 'react';
import type { WorkspaceAgentSettings, WorkspaceAgentToolInventory } from '@workspaces/core/types';
import { ElevenLabsToolListRow } from './ElevenLabsToolListRow';

export type ElevenLabsAgentSettingsPanelProps = {
  settings: WorkspaceAgentSettings;
  agentName: string;
  agentId: string;
  toolInventory: WorkspaceAgentToolInventory;
};

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}): React.ReactElement {
  const display = value.trim() || '—';
  return (
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</h4>
      {multiline ? (
        <pre className="whitespace-pre-wrap rounded-md border border-slate-700/80 bg-slate-900/80 p-3 text-xs leading-relaxed text-slate-200">
          {display}
        </pre>
      ) : (
        <p className="rounded-md border border-slate-700/80 bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-200">
          {display}
        </p>
      )}
    </section>
  );
}

export function ElevenLabsAgentSettingsPanel({
  settings,
  agentName,
  agentId,
  toolInventory,
}: ElevenLabsAgentSettingsPanelProps): React.ReactElement {
  const agentTools = toolInventory.agentTools;
  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-violet-100">{agentName || agentId}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{agentId}</p>
          <p className="mt-2 text-xs text-slate-400">
            Vista specchio (sola lettura). Modifica su ElevenLabs e usa Aggiorna nel tab.
          </p>
        </header>
        <Field label="Prompt di sistema" value={settings.globalPrompt} multiline />
        <Field label="Primo messaggio" value={settings.firstMessage} multiline />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lingua" value={settings.language} />
          <Field label="Modello LLM" value={settings.llm} />
          <Field label="Voice ID" value={settings.voiceId} />
          <Field label="Modello TTS" value={settings.ttsModel} />
        </div>
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Strumenti agente ({agentTools.length})
          </h4>
          <p className="text-xs text-slate-400">
            Tool webhook/client dal prompt globale ConvAI (`tool_ids` / `tools` inline). I nodi possono
            ereditarli o aggiungerne di locali.
          </p>
          {agentTools.length > 0 ? (
            <ul className="space-y-1.5">
              {agentTools.map((t) => (
                <ElevenLabsToolListRow key={t.id} tool={t} inherited />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Nessun tool risolto a livello agente.</p>
          )}
        </section>
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Workflow
          </h4>
          <p className="text-xs text-slate-300">
            Prevenzione loop subagent:{' '}
            <span className="font-medium text-slate-100">
              {settings.preventSubagentLoops ? 'attiva' : 'disattiva'}
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
