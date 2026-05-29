/**
 * Sotto-tab Catalogo / Analisi dei backend con azione integrata nel tab Analisi.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  mergeKbAnalysisToolbarPresentations,
  type KbAnalysisToolbarPresentation,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import { runMergedAnalysisToolbarAction } from '@domain/knowledgeBase/analysisToolbarExecute';
import { useOptionalBackendAnalysisDocumentActions } from './BackendAnalysisDocumentActionsContext';
import { useOptionalBackendAnalysisEdit } from './BackendAnalysisEditContext';

const HIDDEN_TOOLBAR: KbAnalysisToolbarPresentation = {
  phase: 'hidden',
  executeVisible: false,
  executeLabel: 'Aggiorna',
  executeEnabled: false,
  executeEmphasized: false,
};

export type BackendsAnalysisSubTabsProps = {
  showingCatalog: boolean;
  /** Tab analisi globale (prima analisi agente): nascosta dopo la prima analisi completata. */
  showGlobalAnalysisTab: boolean;
  onSelectCatalog: () => void;
  onSelectAnalysis: () => void;
};

export function BackendsAnalysisSubTabs({
  showingCatalog,
  showGlobalAnalysisTab,
  onSelectCatalog,
  onSelectAnalysis,
}: BackendsAnalysisSubTabsProps): React.ReactElement {
  const docActions = useOptionalBackendAnalysisDocumentActions();
  const sectionEdit = useOptionalBackendAnalysisEdit();

  const docPresentation = docActions?.presentation ?? HIDDEN_TOOLBAR;
  const sectionPresentation = sectionEdit?.sectionToolbarPresentation ?? HIDDEN_TOOLBAR;

  const merged = React.useMemo(
    () => mergeKbAnalysisToolbarPresentations([docPresentation, sectionPresentation]),
    [docPresentation, sectionPresentation]
  );

  const showAction = showGlobalAnalysisTab && !showingCatalog && merged.executeVisible;
  const busy = Boolean(docActions?.busy || sectionEdit?.sectionReviewBusy);

  const onActionClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!merged.executeEnabled || busy) return;
      runMergedAnalysisToolbarAction(merged, {
        documentPresentation: docPresentation,
        onDocumentExecute: docActions ? () => docActions.onExecute() : null,
        sectionPresentation,
        onSectionExecute: sectionEdit ? () => sectionEdit.runSectionToolbarAction() : null,
      });
    },
    [merged, busy, docPresentation, docActions, sectionPresentation, sectionEdit]
  );

  const actionClass =
    'inline-flex items-center gap-1 border-l border-violet-400/40 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50 ' +
    (merged.executeEmphasized
      ? 'bg-amber-950/70 text-amber-100'
      : 'bg-violet-800/70 text-violet-50');

  return (
    <div className="mb-2 flex shrink-0 items-center gap-1 rounded-md border border-slate-700/70 bg-slate-900/40 p-1">
      <button
        type="button"
        onClick={onSelectCatalog}
        className={
          'rounded px-2.5 py-1 text-xs font-semibold ' +
          (showingCatalog || !showGlobalAnalysisTab
            ? 'bg-violet-800/70 text-violet-50'
            : 'text-slate-300 hover:bg-slate-800/70')
        }
      >
        Catalogo backend
      </button>
      {showGlobalAnalysisTab ? (
        <div
          className={
            'inline-flex overflow-hidden rounded ' +
            (!showingCatalog ? 'bg-violet-800/70' : '')
          }
        >
          <button
            type="button"
            onClick={onSelectAnalysis}
            className={
              'px-2.5 py-1 text-xs font-semibold ' +
              (!showingCatalog
                ? 'text-violet-50'
                : 'text-slate-300 hover:bg-slate-800/70 rounded')
            }
          >
            Analisi di tutti i backend
          </button>
          {showAction ? (
            <button
              type="button"
              disabled={!merged.executeEnabled || busy}
              onClick={onActionClick}
              title="Ciclo modifica: rivedi osservazioni, poi aggiorna l'analisi"
              className={actionClass}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
              {merged.executeLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
