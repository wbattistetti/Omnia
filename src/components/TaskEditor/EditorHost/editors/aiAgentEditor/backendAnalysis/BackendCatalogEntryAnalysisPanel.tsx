/**
 * Analisi di un singolo backend nel catalogo (accordion + Esegui/Aggiorna).
 */

import React from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { runMergedAnalysisToolbarAction } from '@domain/knowledgeBase/analysisToolbarExecute';
import {
  catalogEntryHasCompleteIaAnalysis,
  catalogEntryHasSubstantiveAnalysis,
} from '@domain/backendAnalysis/mergeCatalogEntryAnalysis';
import { catalogEntryAnalysisStaleAfterSpecRefresh } from '@domain/backendAnalysis/catalogEntryAnalysisStaleAfterSpecRefresh';
import { taskRepository } from '@services/TaskRepository';
import { useAgentBackendAnalysis } from '../AgentBackendAnalysisContext';
import { CatalogBackendAccordion } from '../BackendAnalysisWorkspace';
import { useBackendAnalysisEdit } from './BackendAnalysisEditContext';

export type BackendCatalogEntryAnalysisPanelProps = {
  catalogEntryId: string;
  defaultOpen?: boolean;
};

const PRIMARY_BTN =
  'inline-flex shrink-0 items-center gap-1 rounded border border-cyan-600/70 bg-cyan-600/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm shadow-cyan-950/40 hover:bg-cyan-500 disabled:opacity-50';

export function BackendCatalogEntryAnalysisPanel({
  catalogEntryId,
  defaultOpen = false,
}: BackendCatalogEntryAnalysisPanelProps): React.ReactElement | null {
  const { document, manualEntries } = useAgentBackendAnalysis();
  const edit = useBackendAnalysisEdit();
  const backend = document.backends[catalogEntryId];
  const catalogEntry = manualEntries.find((e) => e.id === catalogEntryId);
  const liveTask = taskRepository.getTask(catalogEntryId);
  const [open, setOpen] = React.useState(defaultOpen);

  const busy = edit.catalogEntryAnalysisBusyId === catalogEntryId;
  const analysisError =
    edit.catalogEntryAnalysisErrorId === catalogEntryId ? edit.catalogEntryAnalysisError : null;
  const analysisJustDone = edit.catalogEntryAnalysisDoneId === catalogEntryId;

  const hasStartedAnalysis = backend ? catalogEntryHasSubstantiveAnalysis(backend) : false;
  const canExpandBody = Boolean(backend) && hasStartedAnalysis && !busy;

  React.useEffect(() => {
    if (!canExpandBody && open) setOpen(false);
  }, [canExpandBody, open]);

  if (!backend) return null;

  const presentation = edit.getBackendSectionToolbarPresentation(catalogEntryId);
  const sectionBusy = edit.sectionReviewBusy;
  const analysisComplete = catalogEntryHasCompleteIaAnalysis(backend);
  const analysisStaleAfterSpecRefresh =
    Boolean(catalogEntry) &&
    catalogEntryAnalysisStaleAfterSpecRefresh(catalogEntry!, backend, liveTask);

  const primaryLabel = hasStartedAnalysis || analysisStaleAfterSpecRefresh ? 'Aggiorna' : 'Esegui';

  const onPrimaryAnalysis = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || sectionBusy || !edit.canRunReview) return;
    void edit.runCatalogEntryAnalysis(catalogEntryId, {
      force: hasStartedAnalysis || analysisStaleAfterSpecRefresh,
    });
  };

  const onToolbarAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!presentation.executeEnabled || sectionBusy) return;
    runMergedAnalysisToolbarAction(presentation, {
      documentPresentation: null,
      onDocumentExecute: null,
      sectionPresentation: presentation,
      onSectionExecute: () => edit.runBackendSectionToolbarAction(catalogEntryId),
    });
  };

  const actionClass =
    'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold disabled:opacity-50 ' +
    (presentation.executeEmphasized
      ? 'border-amber-600/60 bg-amber-950/50 text-amber-100'
      : 'border-violet-600/50 bg-violet-950/40 text-violet-100');

  return (
    <div className="min-w-0 shrink-0 rounded-md border border-violet-900/40 bg-violet-950/10">
      <div className="flex w-full flex-wrap items-center gap-1.5 px-2 py-1.5">
        {canExpandBody ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center text-violet-400/80 hover:text-violet-200"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Comprimi analisi' : 'Espandi analisi'}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <span className="inline-flex w-3.5 shrink-0" aria-hidden />
        )}

        <span className="text-xs font-semibold text-violet-100/95">Analisi</span>

        {busy ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-300" aria-hidden />
        ) : (
          <button
            type="button"
            disabled={sectionBusy || !edit.canRunReview}
            onClick={onPrimaryAnalysis}
            className={PRIMARY_BTN}
            title={
              primaryLabel === 'Esegui'
                ? 'Avvia la prima analisi IA per questo backend'
                : analysisStaleAfterSpecRefresh
                  ? 'Rigenera l’analisi sui parametri SEND/RECEIVE aggiornati'
                  : 'Rigenera l’analisi IA per questo backend'
            }
          >
            {primaryLabel}
          </button>
        )}

        {presentation.executeVisible ? (
          <button
            type="button"
            disabled={!presentation.executeEnabled || sectionBusy || busy}
            onClick={onToolbarAction}
            className={`${actionClass} ml-auto`}
            title="Confronta le tue modifiche con l’analisi IA e aggiorna"
          >
            {sectionBusy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            {presentation.executeLabel}
          </button>
        ) : null}
      </div>

      {analysisStaleAfterSpecRefresh && !busy && !analysisError ? (
        <p className="border-t border-amber-900/40 bg-amber-950/20 px-2 py-1.5 text-[11px] leading-snug text-amber-100/90">
          Firma backend aggiornata (Recupera specifiche): premi{' '}
          <span className="font-semibold">Aggiorna</span> per rigenerare ruoli e descrizioni sui
          parametri attuali.
        </p>
      ) : null}
      {busy ? (
        <p className="border-t border-violet-900/30 px-2 py-2 text-[11px] text-violet-200/80">
          Analisi IA in corso per questo backend…
        </p>
      ) : null}
      {analysisError ? (
        <p className="border-t border-red-900/40 bg-red-950/20 px-2 py-2 text-[11px] text-red-200">
          {analysisError}
        </p>
      ) : null}
      {analysisJustDone && !analysisError && analysisComplete ? (
        <p className="border-t border-emerald-900/35 bg-emerald-950/15 px-2 py-2 text-[11px] text-emerald-100/90">
          Analisi IA completata. Modifica i testi: compare «Rivedi modifiche», poi «Aggiorna».
        </p>
      ) : null}
      {analysisJustDone && !analysisError && !analysisComplete && !busy ? (
        <p className="border-t border-amber-900/40 bg-amber-950/20 px-2 py-2 text-[11px] text-amber-100/90">
          Analisi parziale: compila «Come usare» o premi «Aggiorna» se mancano ruoli e descrizioni
          parametri.
        </p>
      ) : null}

      {open && canExpandBody ? (
        <div
          className="max-h-[min(52vh,560px)] min-h-0 overflow-y-auto overflow-x-hidden border-t border-violet-900/30 px-2 pb-2 pt-1 pr-1"
          data-backend-analysis-scroll
        >
          <CatalogBackendAccordion backend={backend} defaultOpen embedInCatalog />
        </div>
      ) : null}
    </div>
  );
}
