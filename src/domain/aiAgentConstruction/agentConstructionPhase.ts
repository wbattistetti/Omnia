/**
 * AI Agent — Phase machine di alto livello del Task Editor.
 *
 * **Stato attuale (post-unificazione layout):** esiste un *solo* shell, il
 * Construction Wizard. Il vecchio Dockview classic (`AIAgentEditorDockShell`) è stato
 * rimosso. TUTTI i task — sia nuovi sia legacy con `hasAgentGeneration=true` — usano
 * lo stesso `AIAgentConstructionWizardShell`.
 *
 * Per ragioni di compatibilità del payload persistito, il campo
 * `task.agentConstructionPhase` può ancora esistere su disco con valore `'edit'` (scritto
 * da versioni precedenti). Il resolver lo normalizza a `'wizard'`: NON c'è più un
 * branch di rendering che differenzi le due fasi. Il tipo viene mantenuto come union
 * letterale per non rompere la firma di snapshot/patch e la lettura dei dati storici,
 * ma `'edit'` è di fatto deprecato e non viene mai più scritto da nuovo codice.
 *
 * La schermata Tutor di benvenuto è mostrata solo se `agentWizardTutorAcknowledged === false`.
 * Per i task legacy con `hasAgentGeneration=true` lo snapshot la forza a `true` (vedi
 * `buildTaskSnapshotFromRaw`), così i veterani non rivedono l'onboarding.
 *
 * Per i veterani (`hasAgentGeneration === true`) lo stepper sblocca anche la navigazione
 * libera tra step incompleti (vedi `AIAgentConstructionStepper#bypassGating`): un task
 * pre-wizard può non avere completato la "voce" o i "backend" e va comunque navigabile.
 */

/**
 * Fasi di costruzione del Task Editor AI Agent.
 *
 * - `'wizard'` → unica fase attiva: shell wizard 5-step.
 * - `'edit'`   → DEPRECATO. Conservato solo per compatibilità di payload storici.
 *                Il resolver lo mappa a `'wizard'`. Non viene mai scritto da nuovo
 *                codice.
 */
export type AgentConstructionPhase = 'wizard' | 'edit';

/**
 * Indici (0-based) dei 5 step del wizard di costruzione iniziale.
 * Volutamente const-enum-like ma come union literal per evitare runtime cost.
 *
 * - 0 → Task description
 * - 1 → Backend
 * - 2 → Conversazione (use case + dialoghi + prompt)
 * - 3 → Dati (slot inferiti)
 * - 4 → Voce
 */
export type AgentWizardStepIndex = 0 | 1 | 2 | 3 | 4;

/** Numero totale di step del wizard. Single source of truth. */
export const AGENT_WIZARD_STEP_COUNT = 5 as const;

/** Indice del primo step. Costante semantica per evitare magic number `0`. */
export const AGENT_WIZARD_FIRST_STEP_INDEX: AgentWizardStepIndex = 0;

/** Indice dell'ultimo step. */
export const AGENT_WIZARD_LAST_STEP_INDEX: AgentWizardStepIndex = 4;

/**
 * True se `value` è un indice step valido (0..4). Usato dai parser di persistenza
 * per scartare valori spuri da JSON storici/manomessi senza propagare bug.
 */
export function isAgentWizardStepIndex(value: unknown): value is AgentWizardStepIndex {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= AGENT_WIZARD_LAST_STEP_INDEX
  );
}

/**
 * True se `value` è una phase valida. Tollerante a stringhe sconosciute.
 */
export function isAgentConstructionPhase(value: unknown): value is AgentConstructionPhase {
  return value === 'wizard' || value === 'edit';
}

/**
 * Risolve la phase effettiva dato lo stato persistito letto dal task.
 *
 * **Post-unificazione layout:** esiste un solo shell (il Construction Wizard).
 * Il resolver ignora il valore persistito e ritorna sempre `'wizard'`.
 * I parametri sono mantenuti in firma per non rompere i call site dello snapshot
 * builder, ma non hanno più effetto sul valore restituito.
 *
 * I task storici con `agentConstructionPhase === 'edit'` continuano a essere letti
 * senza errore: vengono semplicemente normalizzati a `'wizard'` in render.
 */
export function resolveAgentConstructionPhase(
  _persistedPhase: unknown,
  _hasAgentGeneration: boolean
): AgentConstructionPhase {
  return 'wizard';
}

/**
 * Risolve l'indice step corrente del wizard, con fallback al primo step.
 * Garantisce che, se la phase è `edit`, l'indice sia comunque valido (utile come
 * indicatore di navigazione rapida nello stepper, anche post-completamento).
 */
export function resolveAgentWizardCurrentStep(
  persistedStep: unknown
): AgentWizardStepIndex {
  if (isAgentWizardStepIndex(persistedStep)) return persistedStep;
  return AGENT_WIZARD_FIRST_STEP_INDEX;
}
