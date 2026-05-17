/**
 * Riepilogo import ElevenLabs dopo drop sul canvas (sopra il wizard step).
 */

import React from 'react';
import { X } from 'lucide-react';
import type { ElevenLabsImportRecap } from '@workspaces/elevenlabs/elevenLabsImportRecap';
import { clearElevenLabsImportRecapInIaJson } from '@workspaces/elevenlabs/elevenLabsImportRecap';
import { taskRepository } from '@services/TaskRepository';
import type { Task } from '@types/taskTypes';
import { OMNIA_AI_AGENT_REHYDRATE_FROM_REPO } from '../aiAgentDockPanelIds';

export type ElevenLabsImportRecapBannerProps = {
  taskId: string;
  recap: ElevenLabsImportRecap;
  onDismiss: () => void;
};

export function ElevenLabsImportRecapBanner({
  taskId,
  recap,
  onDismiss,
}: ElevenLabsImportRecapBannerProps): React.ReactElement {
  const parts: string[] = [];
  if (recap.promptApplied) parts.push('system prompt in Descrizione task');
  if (recap.variableCount > 0) {
    parts.push(`${recap.variableCount} variabili template in Dati`);
  }
  if (recap.backendsAdded > 0) {
    parts.push(`${recap.backendsAdded} backend nuovi nel catalogo`);
  } else if (recap.backendsLinked > 0) {
    parts.push(`${recap.backendsLinked} backend collegati`);
  }
  if (recap.remoteAgentId) {
    parts.push(`ConvAI ${recap.remoteAgentName || recap.remoteAgentId}`);
  }

  const handleDismiss = () => {
    const task = taskRepository.getTask(taskId);
    if (task) {
      const nextJson = clearElevenLabsImportRecapInIaJson(task.agentIaRuntimeOverrideJson);
      taskRepository.updateTask(taskId, {
        agentIaRuntimeOverrideJson: nextJson,
      } as Partial<Task>);
      document.dispatchEvent(
        new CustomEvent(OMNIA_AI_AGENT_REHYDRATE_FROM_REPO, {
          bubbles: true,
          detail: { taskId },
        })
      );
    }
    onDismiss();
  };

  return (
    <div
      className="shrink-0 border-b border-violet-800/60 bg-violet-950/50 px-5 py-3"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-violet-100">
            Importato da ElevenLabs — «{recap.nodeLabel}»
          </p>
          <p className="mt-1 text-xs leading-relaxed text-violet-200/90">
            {parts.length > 0
              ? parts.join(' · ')
              : 'Nessun contenuto remoto da importare per questo nodo.'}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Modifica subito Descrizione (passo 1) e Backend (passo 3). Il tutorial iniziale è stato saltato.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Chiudi riepilogo import"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}