/**
 * Left-side panel: project-scoped variables (global across flows), opened from the main app toolbar.
 */

import React, { useCallback, useMemo, useReducer } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { VariableInstance } from '@types/variableTypes';
import { variableCreationService } from '../services/VariableCreationService';
import { useProjectData, useProjectDataUpdate } from '../context/ProjectDataContext';
import { useProjectTranslations } from '../context/ProjectTranslationsContext';
import { resolveVariableStoreProjectId } from '../utils/safeProjectId';
import { getVariableLabel } from '../utils/getVariableLabel';

export interface GlobalProjectDataPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null | undefined;
}

function isProjectGlobalVar(v: VariableInstance): boolean {
  const scope = v.scope ?? 'project';
  if (scope !== 'project') return false;
  if (String(v.taskInstanceId ?? '').trim()) return false;
  return true;
}

function GlobalVarRow({
  instance,
  projectId,
  translations,
  addTranslation,
  onRefresh,
}: {
  instance: VariableInstance;
  projectId: string;
  translations: Record<string, string>;
  addTranslation: (guid: string, text: string) => void;
  onRefresh: () => void;
}) {
  const devFb = import.meta.env.DEV ? String(instance.varName || '').trim() : undefined;
  const resolvedLabel = getVariableLabel(instance.id, translations, devFb);
  const [draft, setDraft] = React.useState(resolvedLabel);

  React.useEffect(() => {
    setDraft(getVariableLabel(instance.id, translations, devFb));
  }, [instance.id, translations, devFb]);

  const commitRename = useCallback(() => {
    const t = draft.trim();
    const current = getVariableLabel(instance.id, translations, devFb);
    if (!t || t === current) return;
    const ok = variableCreationService.renameVariableById(projectId, instance.id, t);
    if (ok) {
      addTranslation(instance.id, t);
      onRefresh();
    } else setDraft(current);
  }, [draft, instance.id, translations, devFb, projectId, addTranslation, onRefresh]);

  const displayForDrag = getVariableLabel(instance.id, translations, devFb);

  return (
    <div
      className="rounded-md border border-slate-700/80 bg-slate-800/50 p-2 space-y-1.5"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', displayForDrag);
        e.dataTransfer.setData('application/x-omnia-global-var-id', instance.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <div className="flex gap-1 items-start">
        <input
          className="flex-1 min-w-0 rounded bg-slate-900/80 border border-slate-600 px-1.5 py-1 text-xs text-slate-100"
          value={draft}
          onChange={(e) => setDraft(e.targetValue)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
          aria-label="Rimuovi variabile"
          onClick={() => {
            variableCreationService.removeVariableById(projectId, instance.id);
            onRefresh();
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">Project · global</span>
    </div>
  );
}

export function GlobalProjectDataPanel({ open, onClose, projectId: projectIdProp }: GlobalProjectDataPanelProps) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const { data: projectData } = useProjectData();
  const pdUpdate = useProjectDataUpdate();
  const { translations, addTranslation } = useProjectTranslations();

  const projectId = useMemo(() => {
    const fromProp = projectIdProp?.trim();
    const fromCtx = pdUpdate?.getCurrentProjectId?.()?.trim();
    let fromStorage = '';
    try {
      fromStorage = localStorage.getItem('currentProjectId') || '';
    } catch {
      /* noop */
    }
    return resolveVariableStoreProjectId(fromProp || fromCtx || fromStorage || undefined);
  }, [projectIdProp, pdUpdate, projectData, refresh]);

  const globals = useMemo(() => {
    return variableCreationService.getAllVariables(projectId).filter(isProjectGlobalVar);
  }, [projectId, refresh, projectData]);

  const addVariable = useCallback(() => {
    const base = variableCreationService.createManualVariable(projectId, `var_${Date.now().toString(36)}`, {
      scope: 'project',
    });
    const label = String(base.varName || '').trim();
    if (label) addTranslation(base.id, label);
    refresh();
  }, [projectId, addTranslation]);

  if (!open) return null;

  return (
    <div
      className="fixed left-0 top-14 bottom-0 z-[60] flex w-[min(22rem,100vw)] max-w-[100vw] flex-col border-r border-teal-700/50 bg-[#0c1018] shadow-2xl pointer-events-auto"
      role="dialog"
      aria-label="Global Data"
    >
      <div className="flex items-center justify-between gap-2 border-b border-teal-800/60 px-3 py-2 shrink-0 bg-teal-950/40">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-teal-100 truncate">Global Data</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Variabili di progetto utilizzabili in tutti i flow. Trascina il nome in un campo di testo dove supportato.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title="Chiudi"
          aria-label="Chiudi Global Data"
          onClick={onClose}
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={addVariable}
          disabled={!projectId}
          className="inline-flex items-center gap-1 rounded-md bg-teal-800/80 px-2 py-1 text-xs font-medium text-teal-50 hover:bg-teal-700 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Aggiungi
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-2">
        {!projectId && (
          <p className="text-xs text-amber-500/90 px-1">Apri o salva un progetto per vedere le variabili globali.</p>
        )}
        {projectId && globals.length === 0 && (
          <p className="text-xs text-slate-500 px-1">Nessuna variabile globale. Usa Aggiungi o creane dai task.</p>
        )}
        {globals.map((v) => (
          <GlobalVarRow
            key={v.id}
            instance={v}
            projectId={projectId}
            translations={translations}
            addTranslation={addTranslation}
            onRefresh={refresh}
          />
        ))}
      </div>
    </div>
  );
}
