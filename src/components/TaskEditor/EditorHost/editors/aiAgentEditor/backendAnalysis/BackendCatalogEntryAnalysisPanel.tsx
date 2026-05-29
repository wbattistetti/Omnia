/**
 * Analisi di un singolo backend nel catalogo (accordion + azioni review/aggiorna).
 */

import React from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { runMergedAnalysisToolbarAction } from '@domain/knowledgeBase/analysisToolbarExecute';
import {
  catalogEntryHasCompleteIaAnalysis,
  catalogEntryNeedsIaAnalysis,
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

export function BackendCatalogEntryAnalysisPanel({
  catalogEntryId,
  defaultOpen = true,
}: BackendCatalogEntryAnalysisPanelProps): React.ReactElement | null {
  const { document, analysisLaunched, manualEntries } = useAgentBackendAnalysis();
  const edit = useBackendAnalysisEdit();
  const backend = document.backends[catalogEntryId];
  const catalogEntry = manualEntries.find((e) => e.id === catalogEntryId);
  const liveTask = taskRepository.getTask(catalogEntryId);
  const [open, setOpen] = React.useState(defaultOpen);

  const busy = edit.catalogEntryAnalysisBusyId === catalogEntryId;
  const analysisError =
    edit.catalogEntryAnalysisErrorId === catalogEntryId
      ? edit.catalogEntryAnalysisError
      : null;
  const analysisJustDone = edit.catalogEntryAnalysisDoneId === catalogEntryId;

  if (!backend) return null;

  const presentation = edit.getBackendSectionToolbarPresentation(catalogEntryId);
  const sectionBusy = edit.sectionReviewBusy;
  const analysisComplete = catalogEntryHasCompleteIaAnalysis(backend);
  const showReviewHint =
    !busy && analysisComplete && !presentation.executeVisible && !sectionBusy;

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

  const onRerunAnalysis = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || sectionBusy) return;
    void edit.runCatalogEntryAnalysis(catalogEntryId, { force: true });
  };

  const onUpdateAnalysisAfterSpecRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || sectionBusy) return;
    void edit.runCatalogEntryAnalysis(catalogEntryId, { force: true });
  };

  const needsIaAnalysis = catalogEntryNeedsIaAnalysis(backend);
  const analysisStaleAfterSpecRefresh =
    Boolean(catalogEntry) &&
    catalogEntryAnalysisStaleAfterSpecRefresh(catalogEntry!, backend, liveTask);

  const actionClass =
    'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold disabled:opacity-50 ' +
    (presentation.executeEmphasized
      ? 'border-amber-600/60 bg-amber-950/50 text-amber-100'
      : 'border-violet-600/50 bg-violet-950/40 text-violet-100');

  return (
    <div className="min-w-0 shrink-0 rounded-md border border-violet-900/40 bg-violet-950/10">
      <div className="flex w-full flex-wrap items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold text-violet-100/95 hover:text-violet-50"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-violet-400/80" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-violet-400/80" aria-hidden />
          )}
          Analisi
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-300" aria-hidden />
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {analysisStaleAfterSpecRefresh && !busy ? (
            <button
              type="button"
              disabled={sectionBusy || !edit.canRunReview}
              onClick={onUpdateAnalysisAfterSpecRefresh}
              className="rounded border border-amber-600/70 bg-amber-950/50 px-2 py-0.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/55 disabled:opacity-50"
              title="Firma OpenAPI aggiornata: rigenera l’analisi IA sui nuovi parametri SEND/RECEIVE"
            >
              Aggiorna analisi
            </button>
          ) : null}
          {needsIaAnalysis && !busy && !analysisStaleAfterSpecRefresh ? (
            <button
              type="button"
              disabled={sectionBusy || !edit.canRunReview}
              onClick={onRerunAnalysis}
              className="rounded border border-cyan-700/60 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-50"
              title={
                analysisLaunched
                  ? 'Prima analisi IA per questo backend'
                  : 'Avvia analisi IA (salva il progetto dopo per conservarla)'
              }
            >
              Analizza
            </button>
          ) : null}
          {!needsIaAnalysis && !analysisStaleAfterSpecRefresh && !busy ? (
            <button
              type="button"
              disabled={sectionBusy || !edit.canRunReview}
              onClick={onRerunAnalysis}
              className="rounded border border-slate-600/60 bg-slate-900/50 px-2 py-0.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
              title="Rigenera l’analisi IA per questo backend"
            >
              Rigenera
            </button>
          ) : null}
          {presentation.executeVisible ? (
            <button
              type="button"
              disabled={!presentation.executeEnabled || sectionBusy || busy}
              onClick={onToolbarAction}
              className={actionClass}
              title="Confronta le tue modifiche con l’analisi IA e aggiorna"
            >
              {sectionBusy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
              {presentation.executeLabel}
            </button>
          ) : null}
        </div>
      </div>
      {analysisStaleAfterSpecRefresh && !busy && !analysisError ? (
        <p className="border-t border-amber-900/40 bg-amber-950/20 px-2 py-1.5 text-[11px] leading-snug text-amber-100/90">
          Firma backend aggiornata (Recupera specifiche): premi{' '}
          <span className="font-semibold">Aggiorna analisi</span> per rigenerare ruoli e descrizioni
          sui parametri attuali.
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
          Analisi parziale: compila «Come usare» o rigenera con «Rigenera IA» se mancano ruoli e
          descrizioni parametri.
        </p>
      ) : null}
      {!busy && !analysisError && needsIaAnalysis && !analysisJustDone ? (
        <p className="border-t border-violet-900/25 px-2 py-1.5 text-[11px] text-slate-400">
          Analisi non ancora compilata: premi «Analizza» sulla riga del backend o qui sopra.
        </p>
      ) : null}
      {showReviewHint ? (
        <p className="border-t border-violet-900/25 px-2 py-1.5 text-[11px] leading-snug text-slate-500">
          Modifica «Come usare» o l’analisi di un parametro (icona matita): in alto apparirà{' '}
          <span className="text-violet-200/90">Rivedi modifiche</span>.
        </p>
      ) : null}
      {open && !busy ? (
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
