/**
 * AI Agent — Phase machine di alto livello del Task Editor.
 *
 * Modello mentale (concordato con il prodotto, vedi design notes):
 *
 *   `wizard` → l'utente sta costruendo l'agente per la prima volta seguendo il
 *              flusso guidato (5 step: Task → Backend → Conversazione → Dati → Voce).
 *              Una schermata Tutor di benvenuto è mostrata se anche `wizardCurrentStep`
 *              è 0 e nessuno step risulta ancora completato.
 *
 *   `edit`   → l'agente è già stato costruito almeno una volta. Viene aperto direttamente
 *              il Dockview di refinement libero (modalità esperta), senza gating.
 *
 * La transizione `wizard → edit` è automatica: scatta quando TUTTI i 5 step sono ✅
 * (vedi `useAIAgentWizardCompletion`). NON esiste un bottone «Termina».
 *
 * Backward-compat: i task pre-feature non hanno questi campi. Il loader
 * (`resolveAgentConstructionPhase`) deduce la fase dal vecchio flag
 * `agentDesignHasGeneration`: se l'agente ha già generato almeno una volta, parte
 * direttamente in `edit` (i veterani non rivedono il wizard).
 */

/** Fasi di costruzione di alto livello del Task Editor AI Agent. */
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
 * Strategia (fail-safe ma backward-compatible):
 *
 * 1. Se la phase è esplicitamente persistita e valida → usa quella.
 * 2. Altrimenti: se l'agente ha già generato almeno una volta (`hasAgentGeneration`)
 *    → `edit` (veterani che non hanno mai visto il wizard non lo vedono ora).
 * 3. Altrimenti → `wizard` (nuovi task partono dal flusso guidato).
 *
 * @param persistedPhase  valore letto da `task.agentConstructionPhase` (può essere undefined/sconosciuto)
 * @param hasAgentGeneration  flag `task.agentDesignHasGeneration` (true se già generato)
 */
export function resolveAgentConstructionPhase(
  persistedPhase: unknown,
  hasAgentGeneration: boolean
): AgentConstructionPhase {
  if (isAgentConstructionPhase(persistedPhase)) return persistedPhase;
  return hasAgentGeneration ? 'edit' : 'wizard';
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
