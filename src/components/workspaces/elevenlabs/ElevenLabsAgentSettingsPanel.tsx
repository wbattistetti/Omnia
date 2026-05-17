/**
 * «Agente» tab: mirror of ElevenLabs settings + editable Markdown system prompt (workspace session).
 */

import React from 'react';
import type { WorkspaceAgentSettings, WorkspaceAgentToolInventory } from '@workspaces/core/types';
import type { ProjectData } from '@types/project';
import type { KbLocalSnippetInput } from '@workspaces/elevenlabs/api/kbPromptApi';
import { ElevenLabsToolListRow } from './ElevenLabsToolListRow';
import { ElevenLabsAgentSystemPromptEditor } from './ElevenLabsAgentSystemPromptEditor';
import { ElevenLabsWorkspaceWebhookSection } from './ElevenLabsWorkspaceWebhookSection';

export type ElevenLabsAgentSettingsPanelProps = {
  settings: WorkspaceAgentSettings;
  agentName: string;
  agentId: string;
  toolInventory: WorkspaceAgentToolInventory;
  systemPromptMarkdown: string;
  onSystemPromptChange: (markdown: string) => void;
  collectKbSnippets: () => readonly KbLocalSnippetInput[];
  /** Remote ConvAI prompt (read-only reference). */
  remoteGlobalPrompt?: string;
  projectData?: ProjectData | null;
  projectId?: string;
  updateProjectData?: (data: ProjectData) => void;
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
        <pre className="max-h-40 overflow-y-auto overscroll-y-contain whitespace-pre-wrap rounded-md border border-slate-700/80 bg-slate-900/80 p-3 text-xs leading-relaxed text-slate-400 [scrollbar-gutter:stable]">
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
  systemPromptMarkdown,
  onSystemPromptChange,
  collectKbSnippets,
  remoteGlobalPrompt,
  projectData,
  projectId,
  updateProjectData,
}: ElevenLabsAgentSettingsPanelProps): React.ReactElement {
  const agentTools = toolInventory.agentTools;
  const remotePrompt = (remoteGlobalPrompt ?? settings.globalPrompt).trim();

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain px-4 py-4 [scrollbar-gutter:stable]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-violet-100">{agentName || agentId}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{agentId}</p>
          <p className="mt-2 text-xs text-slate-400">
            Prompt di sistema editabile in sessione workspace (Markdown). Il mirror ElevenLabs resta
            in sola lettura sotto; sync remoto in un passo successivo.
          </p>
        </header>

        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Prompt di sistema (workspace)
          </h4>
          <ElevenLabsAgentSystemPromptEditor
            systemPromptMarkdown={systemPromptMarkdown}
            onSystemPromptChange={onSystemPromptChange}
            collectKbSnippets={collectKbSnippets}
            editorHeightPx={320}
          />
        </section>

        {remotePrompt ? (
          <Field label="Prompt remoto ElevenLabs (specchio)" value={remotePrompt} multiline />
        ) : null}

        <Field label="Primo messaggio" value={settings.firstMessage} multiline />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lingua" value={settings.language} />
          <Field label="Modello LLM" value={settings.llm} />
          <Field label="Voice ID" value={settings.voiceId} />
          <Field label="Modello TTS" value={settings.ttsModel} />
        </div>
        <section className="space-y-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Webhook workspace (agente)
          </h4>
          <ElevenLabsWorkspaceWebhookSection
            projectData={projectData}
            projectId={projectId}
            updateDataDirectly={updateProjectData}
            catalogScope={{ scope: 'agent', agentId }}
          />
        </section>
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Strumenti ConvAI ({agentTools.length})
          </h4>
          <p className="text-xs text-slate-400">
            Tool webhook/client risolti dal mirror remoto ElevenLabs.
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