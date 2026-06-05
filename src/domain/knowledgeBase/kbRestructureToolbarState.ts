/**
 * Stato toolbar tab Documento riformattato KB.
 */

export type KbRestructureToolbarState = {
  executeVisible: boolean;
  executeLabel: string;
  executeEnabled: boolean;
  executeBusy: boolean;
  /** Etichetta tab (es. «Rispondi alle domande» se domande IA aperte). */
  tabLabel: string;
  /** Tab in attesa risposte: stile avviso al posto del warning accanto al bottone. */
  tabAwaitingAnswers: boolean;
  onExecute: () => void;
};

export function kbRestructureToolbarStateSnapshot(state: KbRestructureToolbarState): string {
  return [
    state.executeVisible,
    state.executeLabel,
    state.executeEnabled,
    state.executeBusy,
    state.tabLabel,
    state.tabAwaitingAnswers,
  ].join('\0');
}
