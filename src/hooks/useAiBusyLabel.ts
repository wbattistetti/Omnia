/**
 * Helper UI per i CTA AI:
 *  - `busyLabel('Creando X')` -> 'Creando X (gpt-5)...' se il modello globale e impostato,
 *    altrimenti 'Creando X...'.
 *  - `hasModel` per disabilitare i bottoni e mostrare il toast inline quando il modello manca.
 *
 * Single source of truth: il modello vive nel context `useAIProvider` (chiave localStorage
 * `omnia.aiModel`), impostato in Impostazioni > Omnia Tutor (IA interna).
 */

import { useAIProvider } from '@context/AIProviderContext';

export interface AiBusyLabelHelpers {
  /** Modello attivo dal context globale; stringa vuota se non configurato. */
  model: string;
  /** True se l'utente ha selezionato un modello in Settings > Omnia Tutor. */
  hasModel: boolean;
  /**
   * Compone l'etichetta "in corso" per un CTA AI.
   * Esempio: `busyLabel('Creando use case')` -> `Creando use case (gpt-5)...`.
   * Se nessun modello e impostato, ritorna la frase senza parentesi: `Creando use case...`.
   */
  busyLabel: (gerundPhrase: string) => string;
}

export function useAiBusyLabel(): AiBusyLabelHelpers {
  const { model } = useAIProvider();
  const hasModel = Boolean(model);
  return {
    model,
    hasModel,
    busyLabel: (gerundPhrase: string) =>
      hasModel ? `${gerundPhrase} (${model})...` : `${gerundPhrase}...`,
  };
}
