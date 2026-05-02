/**
 * Seleziona i task Backend Call da includere come tool ConvAI (function calling), oltre ai tool manuali.
 */

import React from 'react';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

export interface BackendToolsSectionProps {
  config: IAAgentConfig;
  onChange: (next: IAAgentConfig) => void;
  showOverrideBadge?: boolean;
  /** Bump quando il catalogo/task cambiano (nuovi Backend Call nel repository). */
  catalogReloadNonce?: number;
}

export function BackendToolsSection({
  config,
  onChange,
  showOverrideBadge,
  catalogReloadNonce = 0,
}: BackendToolsSectionProps) {
  const backendTasks = React.useMemo(() => {
    return taskRepository.getAllTasks().filter((t) => t.type === TaskType.BackendCall);
  }, [catalogReloadNonce]);

  const selected = new Set(config.convaiBackendToolTaskIds ?? []);

  const toggle = (taskId: string) => {
    const next = new Set(config.convaiBackendToolTaskIds ?? []);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    onChange({ ...config, convaiBackendToolTaskIds: [...next] });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row flex-wrap items-center gap-1">
        <span className="text-[10px] font-semibold uppercase leading-none tracking-wide text-slate-400">
          Backend → tool ConvAI
        </span>
        {showOverrideBadge ? (
          <span className="rounded border border-amber-500/35 bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-200">
            override
          </span>
        ) : null}
      </div>
      <p className="text-[9px] leading-snug text-slate-500">
        Ogni backend selezionato deve avere nome interno (label), descrizione ConvAI sul task Backend Call e
        URL endpoint. I parametri tool sono derivati dalle righe SEND.
      </p>
      {backendTasks.length === 0 ? (
        <p className="text-[10px] text-slate-500">Nessun Backend Call nel progetto.</p>
      ) : (
        <div className="flex max-h-[min(40vh,200px)] flex-col gap-0.5 overflow-y-auto rounded border border-slate-800/90 bg-slate-950/70 px-1 py-1">
          {backendTasks.map((t) => {
            const label = String(t.label ?? '').trim() || `${t.id.slice(0, 8)}…`;
            return (
              <label
                key={t.id}
                className="flex cursor-pointer items-start gap-1.5 rounded px-0.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-900/80"
                title={t.id}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                />
                <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
