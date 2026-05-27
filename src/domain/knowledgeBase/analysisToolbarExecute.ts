/**
 * Esegue l'azione toolbar unificata in base alla fase e alle sorgenti (documento / sezioni).
 */

import type { KbAnalysisToolbarPresentation } from './kbDocumentAnalysisWorkflow';

export type AnalysisToolbarExecuteSources = {
  documentPresentation: KbAnalysisToolbarPresentation | null;
  onDocumentExecute: (() => void) | null;
  sectionPresentation: KbAnalysisToolbarPresentation | null;
  onSectionExecute: (() => void) | null;
};

/** Avvia review o applica aggiornamento per ogni sorgente nella fase corrente. */
export function runMergedAnalysisToolbarAction(
  merged: KbAnalysisToolbarPresentation,
  sources: AnalysisToolbarExecuteSources
): void {
  if (merged.phase === 'hidden' || merged.phase === 'review_observations') return;

  if (merged.phase === 'request_review') {
    if (sources.documentPresentation?.phase === 'request_review') {
      sources.onDocumentExecute?.();
    }
    if (sources.sectionPresentation?.phase === 'request_review') {
      sources.onSectionExecute?.();
    }
    return;
  }

  if (merged.phase === 'apply_update') {
    if (sources.documentPresentation?.phase === 'apply_update') {
      sources.onDocumentExecute?.();
    }
    if (sources.sectionPresentation?.phase === 'apply_update') {
      sources.onSectionExecute?.();
    }
  }
}
