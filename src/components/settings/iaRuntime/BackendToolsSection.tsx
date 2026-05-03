/**
 * Seleziona i task Backend Call da includere come tool ConvAI (function calling), oltre ai tool manuali.
 */

import React from 'react';
import { GitBranchPlus } from 'lucide-react';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  deriveBackendToolDefinition,
  mergeEffectiveIaAgentTools,
} from '@domain/iaAgentTools/backendToolDerivation';
import { collectReachableBackendCallTaskIdsFromFlow } from '@domain/iaAgentTools/collectReachableBackendCallTaskIdsFromFlow';
import { extractManualCatalogBackendTaskIdsFromProjectData } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { useProjectData } from '@context/ProjectDataContext';

/** Canvas del flow che contiene il nodo dell’AI Agent (per discovery archi uscenti). */
export type ConvaiBackendToolsDiscoveryContext = {
  aiAgentTaskId: string;
  flow: { nodes: unknown[]; edges: unknown[] };
};

export interface BackendToolsSectionProps {
  config: IAAgentConfig;
  onChange: (next: IAAgentConfig) => void;
  showOverrideBadge?: boolean;
  /** Bump quando il catalogo/task cambiano (nuovi Backend Call nel repository). */
  catalogReloadNonce?: number;
  /**
   * Solo override per-task: consente «Aggiungi da canvas» (backend a valle sul grafo).
   * Se assente, il pulsante non viene mostrato.
   */
  convaiBackendToolsDiscoveryContext?: ConvaiBackendToolsDiscoveryContext | null;
}

export function BackendToolsSection({
  config,
  onChange,
  showOverrideBadge,
  catalogReloadNonce = 0,
  convaiBackendToolsDiscoveryContext = null,
}: BackendToolsSectionProps) {
  const { data: projectData } = useProjectData();
  const manualCatalogBackendTaskIds = React.useMemo(
    () => extractManualCatalogBackendTaskIdsFromProjectData(projectData),
    [projectData, catalogReloadNonce]
  );

  const backendTasks = React.useMemo(() => {
    return taskRepository.getAllTasks().filter((t) => t.type === TaskType.BackendCall);
  }, [catalogReloadNonce]);

  const selected = new Set(config.convaiBackendToolTaskIds ?? []);

  const toolMergeDiagnostics = React.useMemo(() => {
    const ids = config.convaiBackendToolTaskIds ?? [];
    const perId: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      const tid = String(id || '').trim();
      if (!tid) continue;
      const t = taskRepository.getTask(tid);
      const dr = t
        ? deriveBackendToolDefinition(t)
        : ({ ok: false as const, code: 'missing_task' as const, error: 'Task assente' });
      perId.push(dr.ok ? { id: tid, ok: true } : { id: tid, ok: false, error: dr.error });
    }
    const effective = mergeEffectiveIaAgentTools(config, (tid) => taskRepository.getTask(tid), {
      manualCatalogBackendTaskIds,
    });
    return { perId, effectiveCount: effective.length, selectedCount: ids.length };
  }, [config, catalogReloadNonce, manualCatalogBackendTaskIds]);

  const mergeBackendsFromDownstreamFlow = React.useCallback(() => {
    const ctx = convaiBackendToolsDiscoveryContext;
    if (!ctx?.flow?.nodes?.length || !String(ctx.aiAgentTaskId || '').trim()) {
      window.alert(
        'Canvas del flow non disponibile: salva il progetto e apri il task su un canvas dove il nodo contiene questo agente.'
      );
      return;
    }
    const discovered = collectReachableBackendCallTaskIdsFromFlow(ctx.flow, ctx.aiAgentTaskId);
    if (discovered.length === 0) {
      window.alert(
        'Nessun Backend Call trovato a valle (archi uscenti) dal nodo che contiene questo agente.'
      );
      return;
    }
    const nextSet = new Set(config.convaiBackendToolTaskIds ?? []);
    const added: string[] = [];
    const skipped: string[] = [];
    for (const id of discovered) {
      if (nextSet.has(id)) continue;
      const t = taskRepository.getTask(id);
      const dr = t
        ? deriveBackendToolDefinition(t)
        : ({ ok: false as const, code: 'missing_task' as const, error: 'Task assente' });
      if (dr.ok) {
        nextSet.add(id);
        added.push(id);
      } else {
        const label = t ? String(t.label ?? '').trim() : '';
        skipped.push(`${label || `${id.slice(0, 8)}…`} — ${dr.error}`);
      }
    }
    onChange({ ...config, convaiBackendToolTaskIds: [...nextSet] });
    const lines = [
      added.length ? `Aggiunti all’elenco tool: ${added.length}.` : 'Nessun nuovo backend idoneo.',
      skipped.length
        ? `Esclusi (manca descrizione ConvAI, label, tipo, ecc.): ${skipped.length}\n${skipped.slice(0, 6).join('\n')}${skipped.length > 6 ? '\n…' : ''}`
        : '',
    ].filter(Boolean);
    window.alert(lines.join('\n\n'));
  }, [config, convaiBackendToolsDiscoveryContext, onChange]);

  const toggle = (taskId: string) => {
    const next = new Set(config.convaiBackendToolTaskIds ?? []);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    onChange({ ...config, convaiBackendToolTaskIds: [...next] });
  };

  const brokenSelections = toolMergeDiagnostics.perId.filter((x) => !x.ok);

  return (
    <div className="flex flex-col gap-1" data-ia-runtime-focus="tools">
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
        URL endpoint. I parametri tool sono derivati dalle righe SEND. Senza{' '}
        <code className="text-slate-400">outputSchema</code> nel payload tool, documenta sempre il formato di
        risposta nella descrizione ConvAI e nella sezione <strong className="text-slate-400">Contesto</strong>{' '}
        (contratto: fuso, ISO, vincoli).
      </p>
      {brokenSelections.length > 0 ? (
        <div className="rounded border border-red-900/50 bg-red-950/30 px-1.5 py-1 text-[9px] leading-snug text-red-100/95">
          <div className="font-semibold uppercase tracking-wide text-red-300/95">Tool non generabili</div>
          <ul className="mt-0.5 list-inside list-disc">
            {brokenSelections.slice(0, 6).map((x) => (
              <li key={x.id}>
                <code className="text-red-200/90">{x.id.slice(0, 8)}…</code>
                {x.error ? ` — ${x.error}` : ''}
              </li>
            ))}
          </ul>
          {brokenSelections.length > 6 ? <p className="mt-0.5 text-red-200/80">…</p> : null}
        </div>
      ) : null}
      {toolMergeDiagnostics.selectedCount === 0 &&
      toolMergeDiagnostics.effectiveCount === 0 &&
      (!config.tools || config.tools.length === 0) ? (
        <p className="rounded border border-amber-900/40 bg-amber-950/25 px-1.5 py-1 text-[9px] text-amber-100/90">
          Nessun backend selezionato e nessun tool manuale: il payload ConvAI non includerà{' '}
          <code className="text-amber-200/90">prompt.tools</code>.
        </p>
      ) : null}
      {toolMergeDiagnostics.selectedCount > 0 && toolMergeDiagnostics.effectiveCount === 0 ? (
        <p className="rounded border border-amber-900/40 bg-amber-950/25 px-1.5 py-1 text-[9px] text-amber-100/90">
          Hai selezionato backend ma il merge non produce tool validi: controlla label, descrizione ConvAI e tipo
          Backend Call su ogni id (vedi errori sopra se presenti).
        </p>
      ) : null}
      {convaiBackendToolsDiscoveryContext ? (
        <button
          type="button"
          onClick={() => mergeBackendsFromDownstreamFlow()}
          className="inline-flex w-fit max-w-full items-center gap-1 rounded border border-violet-600/70 bg-violet-950/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100 hover:bg-violet-900/55"
          title="Unisce gli id dei Backend Call raggiungibili con archi USCENTI dal nodo che contiene questo agente. Esclude i task senza descrizione ConvAI o non validi come tool."
        >
          <GitBranchPlus className="h-3 w-3 shrink-0" aria-hidden />
          Aggiungi da canvas (a valle)
        </button>
      ) : null}
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
