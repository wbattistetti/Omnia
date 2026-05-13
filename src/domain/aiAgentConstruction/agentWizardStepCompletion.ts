/**
 * AI Agent — Regole di completamento per gli step del wizard di costruzione.
 *
 * Single source of truth per «quando uno step è ✅». Funzioni pure, testabili in isolamento,
 * nessuna dipendenza React. Le regole sono definite dal prodotto (regole D del design):
 *
 *   Step 1 — Task         → descrizione del task non vuota (gate STRETTO)
 *   Step 2 — Backend      → SEMPRE ✅ (soft, mock-data deferred)
 *   Step 3 — Conversazione→ ≥1 use case + ≥1 conversazione (gate STRETTO)
 *   Step 4 — Dati         → SEMPRE ✅ (soft, deferred)
 *   Step 5 — Voce         → SEMPRE ✅ (default voice precaricata)
 *
 * Solo i due gate stretti (1 e 3) possono trattenere il flusso. Gli step soft permettono
 * comunque di aprire la pagina per personalizzare (visibili e navigabili) ma non bloccano
 * l'auto-transizione `wizard → edit` quando tutti sono ✅.
 *
 * Nota di evoluzione: quando in futuro vorrai rendere stretti anche gli altri step
 * (es. richiedere almeno un backend dichiarato, o slot tipizzati, o voce esplicita),
 * basta rimpiazzare il `return true` della relativa funzione `isStep*Complete`.
 */

import type { AgentWizardStepIndex } from './agentConstructionPhase';
import { AGENT_WIZARD_STEP_COUNT } from './agentConstructionPhase';

/**
 * Snapshot dei dati del task necessari per valutare il completamento dei 5 step.
 * Volutamente minimale: niente logica, solo i dati grezzi che bastano alle regole.
 *
 * @property descriptionTrimmed   `task.agentDesignDescription.trim()`
 * @property useCaseCount         numero di use case nel catalogo dell'agente
 * @property conversationCount    numero di conversazioni del wizard interno (passo 2 use case)
 */
export interface AgentWizardCompletionInput {
  readonly descriptionTrimmed: string;
  readonly useCaseCount: number;
  readonly conversationCount: number;
}

/** Step 1 — completato se la descrizione del task è non vuota. */
export function isStep1TaskComplete(input: AgentWizardCompletionInput): boolean {
  return input.descriptionTrimmed.length > 0;
}

/**
 * Step 2 — Backend. SOFT per ora: sempre completato. Quando vorrai gating stretto
 * (es. ≥1 backend dichiarato O flag «no-backend agent») cambia questa funzione.
 */
export function isStep2BackendComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

/** Step 3 — completato se esiste almeno una use case e almeno una conversazione. */
export function isStep3ConversationComplete(input: AgentWizardCompletionInput): boolean {
  return input.useCaseCount >= 1 && input.conversationCount >= 1;
}

/** Step 4 — Dati. SOFT per ora: sempre completato (slot review/typing deferred). */
export function isStep4DataComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

/** Step 5 — Voce. SOFT per ora: la voce di default fa scattare ✅ all'avvio. */
export function isStep5VoiceComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

/** Mapping ordinato 0..4 → predicato di completamento dello step. */
const STEP_COMPLETION_RULES: ReadonlyArray<(input: AgentWizardCompletionInput) => boolean> = [
  isStep1TaskComplete,
  isStep2BackendComplete,
  isStep3ConversationComplete,
  isStep4DataComplete,
  isStep5VoiceComplete,
];

/**
 * Valuta tutti i 5 step e restituisce un array `[bool, bool, bool, bool, bool]` dove
 * l'indice `i` indica se lo step `i+1` è completato.
 */
export function evaluateAgentWizardCompletion(
  input: AgentWizardCompletionInput
): readonly boolean[] {
  return STEP_COMPLETION_RULES.map((rule) => rule(input));
}

/**
 * True se TUTTI i 5 step sono ✅. Trigger della transizione automatica `wizard → edit`.
 */
export function areAllAgentWizardStepsComplete(input: AgentWizardCompletionInput): boolean {
  return evaluateAgentWizardCompletion(input).every(Boolean);
}

/**
 * Ritorna l'indice del prossimo step disponibile (primo step non completato).
 * Se tutti sono ✅, ritorna l'ultimo step (utility per UI di navigazione).
 */
export function nextIncompleteAgentWizardStep(
  input: AgentWizardCompletionInput
): AgentWizardStepIndex {
  const flags = evaluateAgentWizardCompletion(input);
  for (let i = 0; i < AGENT_WIZARD_STEP_COUNT; i++) {
    if (!flags[i]) return i as AgentWizardStepIndex;
  }
  return (AGENT_WIZARD_STEP_COUNT - 1) as AgentWizardStepIndex;
}
