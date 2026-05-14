/**
 * Single source of truth for the user-facing "scope" of every AI call.
 *
 * The same identifier is:
 *  - sent to the backend in the request body (`purpose` field) so `AIProviderService.callAI`
 *    can persist it in `backend/data/ai_call_log.json`,
 *  - read by the frontend hook `useLastCallCost(purpose)` to render the inline "Last $X.XX"
 *    next to the AI button that triggered the most recent call,
 *  - displayed verbatim in the AI Call Log dialog (`$` icon in the Toolbar).
 *
 * Each entry pairs a stable id (used by code) with a human label (used by the UI). Strings are
 * Italian to match the user's locale; if you ever need i18n, swap `label` with a translation key.
 *
 * Adding a new purpose: append both id and label here, then pass the id to whichever AI request.
 * Never inline magic strings at call sites — that defeats the de-duplication this module provides.
 */

export const AI_CALL_PURPOSE = {
  AGENT_CREATE: 'AGENT_CREATE',
  AGENT_REFINE: 'AGENT_REFINE',
  USE_CASE_BUNDLE_INITIAL: 'USE_CASE_BUNDLE_INITIAL',
  USE_CASE_GENERATE_MORE: 'USE_CASE_GENERATE_MORE',
  USE_CASE_DIALOGUE_CREATE: 'USE_CASE_DIALOGUE_CREATE',
  CONVERSATION_POSITIVE: 'CONVERSATION_POSITIVE',
  CONVERSATION_NEGATIVE: 'CONVERSATION_NEGATIVE',
  CONVERSATION_SUGGESTED: 'CONVERSATION_SUGGESTED',
  CONVERSATION_PROOFREAD: 'CONVERSATION_PROOFREAD',
  USE_CASE_TOKENIZE: 'USE_CASE_TOKENIZE',
  USE_CASE_COMPLETE_CORRECTION: 'USE_CASE_COMPLETE_CORRECTION',
  USE_CASE_COMPLETE_CORRECTION_PREVIEW: 'USE_CASE_COMPLETE_CORRECTION_PREVIEW',
  TRAINING_PHRASES_GENERATE: 'TRAINING_PHRASES_GENERATE',
  TEXT_TRANSLATE: 'TEXT_TRANSLATE',
} as const;

export type AiCallPurposeId = (typeof AI_CALL_PURPOSE)[keyof typeof AI_CALL_PURPOSE];

const LABELS: Readonly<Record<AiCallPurposeId, string>> = Object.freeze({
  [AI_CALL_PURPOSE.AGENT_CREATE]: 'Creazione agente (estrazione struttura dal task)',
  [AI_CALL_PURPOSE.AGENT_REFINE]: 'Raffinamento agente (rigenerazione su descrizione modificata)',
  [AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL]: 'Generazione iniziale use case bundle',
  [AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE]: 'Generazione altri use case',
  [AI_CALL_PURPOSE.USE_CASE_DIALOGUE_CREATE]: 'Creazione dialogo per nuovo use case',
  [AI_CALL_PURPOSE.CONVERSATION_POSITIVE]: 'Conversazione con chiusura positiva',
  [AI_CALL_PURPOSE.CONVERSATION_NEGATIVE]: 'Conversazione con chiusura negativa',
  [AI_CALL_PURPOSE.CONVERSATION_SUGGESTED]: 'Conversazione esplorativa nuovi use case',
  [AI_CALL_PURPOSE.CONVERSATION_PROOFREAD]: 'Correzione ortografica frasi modificate',
  [AI_CALL_PURPOSE.USE_CASE_TOKENIZE]: 'Tokenizzazione use case',
  [AI_CALL_PURPOSE.USE_CASE_COMPLETE_CORRECTION]:
    'Completa correzione: propagazione directional dello stile sui messaggi agente',
  [AI_CALL_PURPOSE.USE_CASE_COMPLETE_CORRECTION_PREVIEW]:
    'Anteprima correzione: sintesi stile e prime bozze (max 3 messaggi)',
  [AI_CALL_PURPOSE.TRAINING_PHRASES_GENERATE]: 'Generazione training phrases intent',
  [AI_CALL_PURPOSE.TEXT_TRANSLATE]: 'Traduzione testo',
});

/** Human-readable label for a known purpose id; falls back to the id itself when unknown. */
export function describeAiCallPurpose(purpose: string | null | undefined): string {
  if (!purpose) return 'Chiamata IA non categorizzata';
  return (LABELS as Record<string, string>)[purpose] ?? purpose;
}
