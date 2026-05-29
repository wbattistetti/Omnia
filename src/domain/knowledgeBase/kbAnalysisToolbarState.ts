/**
 * Toolbar state surfaced from KbDocumentAnalysisTab to the workspace tab bar.
 */

import type { KbAnalysisActionLabel } from './kbDocumentAnalysisWorkflow';

export type KbAnalysisToolbarState = {
  readonly executeVisible: boolean;
  readonly executeLabel: KbAnalysisActionLabel;
  readonly executeEnabled: boolean;
  readonly executeEmphasized: boolean;
  /** Tab «Analisi del documento»: sfondo arancione finché serve Esegui/Aggiorna. */
  readonly analysisTabHighlight: boolean;
  readonly executeBusy: boolean;
  readonly onExecute: () => void;
  readonly reviewToggleVisible: boolean;
  readonly reviewPanelOpen: boolean;
  readonly onToggleReviewPanel: () => void;
};

/** Firma JSON dei campi toolbar (esclude callback) per evitare loop setState. */
export function kbAnalysisToolbarStateSnapshot(
  state: Pick<
    KbAnalysisToolbarState,
    | 'executeVisible'
    | 'executeLabel'
    | 'executeEnabled'
    | 'executeEmphasized'
    | 'analysisTabHighlight'
    | 'executeBusy'
    | 'reviewToggleVisible'
    | 'reviewPanelOpen'
  >
): string {
  return JSON.stringify({
    executeVisible: state.executeVisible,
    executeLabel: state.executeLabel,
    executeEnabled: state.executeEnabled,
    executeEmphasized: state.executeEmphasized,
    analysisTabHighlight: state.analysisTabHighlight,
    executeBusy: state.executeBusy,
    reviewToggleVisible: state.reviewToggleVisible,
    reviewPanelOpen: state.reviewPanelOpen,
  });
}
