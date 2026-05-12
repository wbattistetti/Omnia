/**
 * Types for the guided use-case generator wizard (pipeline UI + dirty baselines per step).
 */

/**
 * Tre passi della pipeline wizard:
 *  1. `use_case_list`   — generazione/revisione della lista use case
 *  2. `conversations`   — montaggio e revisione delle conversazioni multi-use-case
 *  3. `tokenization`    — compat legacy: compilazione prompt/JSON derivata dagli use case
 *
 * Storia: la pipeline aveva un quarto passo `json_generation` (rimosso nel rifactor a 3 step).
 * Il prompt conversazionale completo è ora generato on-demand via pulsante toolbar
 * (vedi `buildConversationalPrompt`), non come step esplicito.
 */
export type UseCaseGeneratorWizardStepId =
  | 'use_case_list'
  | 'conversations'
  | 'tokenization';

/**
 * Outcome di una conversazione simulata: l'arco narrativo si chiude in modo positivo
 * (accettazione / conferma) o negativo (date esaurite o abbandono educato).
 */
export type UseCaseGeneratorWizardConversationOutcome = 'positive' | 'negative';

/**
 * Ciclo di vita di uno use case emergente (lampadina): nasce `pending` quando l'AI lo suggerisce,
 * diventa `promoted` se il designer lo aggiunge al catalogo, oppure `rejected` se lo scarta.
 *
 * Conseguenze operative:
 * - pending: la bubble vive con testo locale, editabile, NON propagato al catalogo.
 * - promoted: l'id sintetico `suggested:xxx` è sostituito da un useCaseId reale; da quel
 *   momento la bubble è una vista del canonico (edit = edit del canonico).
 * - rejected: la bubble resta visibile, locked, esclusa da propagate-stile e proofread.
 */
export type UseCaseGeneratorWizardTurnSuggestionStatus =
  | 'pending'
  | 'promoted'
  | 'rejected';

export interface UseCaseGeneratorWizardTurnSuggestion {
  status: UseCaseGeneratorWizardTurnSuggestionStatus;
  /** Etichetta proposta dall'AI per lo use case emergente (mostrata nella pillola amber). */
  proposedLabel: string;
}

/** Simulated multi-use-case conversation (design-time wizard). */
export interface UseCaseGeneratorWizardTurnUser {
  /** Stable id necessario per dirty-diff vs baseline AI e per editing controllato. */
  turnId: string;
  role: 'user';
  text: string;
}

export interface UseCaseGeneratorWizardTurnAgent {
  turnId: string;
  role: 'agent';
  /**
   * Use case sorgente:
   * - per bubble reali: id presente nel catalogo `useCases`. La bubble è una *vista* della
   *   frase canonica → edit della bubble = edit del canonico (vedi propagazione).
   * - per bubble emergenti: id sintetico nella forma `suggested:<uuid>`; il canonico non esiste
   *   ancora e il testo vive solo localmente fino alla promozione.
   */
  useCaseId: string;
  /** Etichetta cached al momento della generazione (mostrata anche se l'use case viene rinominato). */
  useCaseLabel: string;
  text: string;
  /** Presente solo quando la bubble è uno use case emergente. Stato pilotato dal designer. */
  suggestion?: UseCaseGeneratorWizardTurnSuggestion;
}

export type UseCaseGeneratorWizardTurn =
  | UseCaseGeneratorWizardTurnUser
  | UseCaseGeneratorWizardTurnAgent;

export interface UseCaseGeneratorWizardConversation {
  conversationId: string;
  turns: UseCaseGeneratorWizardTurn[];
  /** Outcome dichiarato dal designer al momento della creazione (toolbar Outcome). */
  outcome: UseCaseGeneratorWizardConversationOutcome;
  /** Snapshot della scelta «Permetti use case emergenti» al momento della creazione. */
  allowsSuggestedUseCases?: boolean;
  /**
   * Descrizione sintetica dell'arco narrativo (1–2 frasi) generata dall'AI all'atto del
   * montaggio. Mostrata in testa al pannello bubble chat come label multiriga: aiuta il
   * designer a capire al volo «di cosa parla» la conversazione senza leggerla tutta.
   * Opzionale per non rompere conversazioni già persistite senza summary.
   */
  scenarioSummary?: string;
}

export interface UseCaseGeneratorWizardPersistedState {
  /** Default true: modalità guidata sempre disponibile nel view generator. */
  enabled?: boolean;
  stepIndex: number;
  /** Massimo indice passo (0–2) selezionabile nella pipeline. */
  unlockedMaxStepIndex?: number;
}

/**
 * Prefisso per gli id sintetici degli use case emergenti generati dall'AI prima della promozione.
 * Esposto come costante per evitare stringhe magiche sparse (matching, anti-sinonimi, persist).
 */
export const SUGGESTED_USE_CASE_ID_PREFIX = 'suggested:' as const;

/** True se l'id appartiene a uno use case emergente (non ancora promosso). */
export function isSuggestedUseCaseId(useCaseId: string): boolean {
  return typeof useCaseId === 'string' && useCaseId.startsWith(SUGGESTED_USE_CASE_ID_PREFIX);
}
