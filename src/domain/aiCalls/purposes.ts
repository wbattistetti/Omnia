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
  USE_CASE_BUNDLE_NARRATIVE_ORDER: 'USE_CASE_BUNDLE_NARRATIVE_ORDER',
  USE_CASE_CATEGORIZE: 'USE_CASE_CATEGORIZE',
  USE_CASE_GENERATE_MORE: 'USE_CASE_GENERATE_MORE',
  USE_CASE_DIALOGUE_CREATE: 'USE_CASE_DIALOGUE_CREATE',
  /** Root composer INVIO: quanti use case dal testo incollato (semantica, non punteggiatura). */
  USE_CASE_SPLIT_ROOT_DRAFT: 'USE_CASE_SPLIT_ROOT_DRAFT',
  CONVERSATION_POSITIVE: 'CONVERSATION_POSITIVE',
  CONVERSATION_NEGATIVE: 'CONVERSATION_NEGATIVE',
  CONVERSATION_SUGGESTED: 'CONVERSATION_SUGGESTED',
  CONVERSATION_PROOFREAD: 'CONVERSATION_PROOFREAD',
  USE_CASE_TOKENIZE: 'USE_CASE_TOKENIZE',
  /** Generalizza titolo + scenario (payoff) per riuso cross-dominio. */
  USE_CASE_GENERALIZE_META: 'USE_CASE_GENERALIZE_META',
  /** Rifinisce forma scenario (stesso significato, testo più chiaro/sintetico). */
  USE_CASE_POLISH_SCENARIO: 'USE_CASE_POLISH_SCENARIO',
  /** Rifinisce forma descrizione task (struttura/paragrafi, stesso significato). */
  AGENT_POLISH_DESIGN_DESCRIPTION: 'AGENT_POLISH_DESIGN_DESCRIPTION',
  /** Estrazione osservazioni dal diff designer su testo task (descrizione / sezioni). */
  AGENT_REVIEW_TASK_TEXT_OBSERVATIONS: 'AGENT_REVIEW_TASK_TEXT_OBSERVATIONS',
  /** Testo task concordato dopo revisione osservazioni. */
  AGENT_FINALIZE_TASK_TEXT: 'AGENT_FINALIZE_TASK_TEXT',
  /** Chiarimento risposta su osservazione testo task. */
  AGENT_CLARIFY_TASK_TEXT_OBSERVATION: 'AGENT_CLARIFY_TASK_TEXT_OBSERVATION',
  USE_CASE_COMPLETE_CORRECTION: 'USE_CASE_COMPLETE_CORRECTION',
  USE_CASE_COMPLETE_CORRECTION_PREVIEW: 'USE_CASE_COMPLETE_CORRECTION_PREVIEW',
  TRAINING_PHRASES_GENERATE: 'TRAINING_PHRASES_GENERATE',
  TEXT_TRANSLATE: 'TEXT_TRANSLATE',
  /** Raffinamento analisi markdown documento KB (tab Analisi del documento). */
  KB_REFINE_DOCUMENT_ANALYSIS: 'KB_REFINE_DOCUMENT_ANALYSIS',
  /** Prima proposta analisi documento KB (Guardi tu). */
  KB_PROPOSE_DOCUMENT_ANALYSIS: 'KB_PROPOSE_DOCUMENT_ANALYSIS',
  /** Estrazione osservazioni dal diff utente/agente. */
  KB_REVIEW_DOCUMENT_ANALYSIS_OBSERVATIONS: 'KB_REVIEW_DOCUMENT_ANALYSIS_OBSERVATIONS',
  /** Analisi finale concordata dopo conferma osservazioni. */
  KB_FINALIZE_DOCUMENT_ANALYSIS: 'KB_FINALIZE_DOCUMENT_ANALYSIS',
  /** Risposta aggiornata dopo chiarimento utente su un'osservazione. */
  KB_CLARIFY_DOCUMENT_ANALYSIS_OBSERVATION: 'KB_CLARIFY_DOCUMENT_ANALYSIS_OBSERVATION',
  /** Domanda libera al Tutor Attivo (solo manuale designer). */
  TUTOR_FREE_QUESTION: 'TUTOR_FREE_QUESTION',
  /** Prima proposta analisi uso backend per agente. */
  BACKEND_PROPOSE_ANALYSIS: 'BACKEND_PROPOSE_ANALYSIS',
  /** Raffinamento bozza analisi backend. */
  BACKEND_REFINE_ANALYSIS: 'BACKEND_REFINE_ANALYSIS',
  /** Revisione osservazioni su analisi backend. */
  BACKEND_REVIEW_ANALYSIS_OBSERVATIONS: 'BACKEND_REVIEW_ANALYSIS_OBSERVATIONS',
  /** Analisi backend concordata dopo revisione. */
  BACKEND_FINALIZE_ANALYSIS: 'BACKEND_FINALIZE_ANALYSIS',
  /** Chiarimento risposta su osservazione analisi backend. */
  BACKEND_CLARIFY_ANALYSIS_OBSERVATION: 'BACKEND_CLARIFY_ANALYSIS_OBSERVATION',
  /** Specifica funzionalità da aggiungere a backend esistente (post-review). */
  BACKEND_CREATE_SUGGESTED_FEATURE: 'BACKEND_CREATE_SUGGESTED_FEATURE',
  /** Distillazione estrema analisi KB/backend per contesto use case e runtime. */
  RUNTIME_ANALYSIS_DISTILL: 'RUNTIME_ANALYSIS_DISTILL',
  /** Domande di test semantiche per validazione use case. */
  USE_CASE_GENERATE_TEST_QUESTIONS: 'USE_CASE_GENERATE_TEST_QUESTIONS',
  /** Analisi sovrapposizione semantica singolo use case vs catalogo. */
  USE_CASE_ANALYZE_OVERLAP: 'USE_CASE_ANALYZE_OVERLAP',
  /** Verifica sovrapposizioni su tutto il catalogo use case. */
  USE_CASE_CHECK_OVERLAPS: 'USE_CASE_CHECK_OVERLAPS',
} as const;

export type AiCallPurposeId = (typeof AI_CALL_PURPOSE)[keyof typeof AI_CALL_PURPOSE];

const LABELS: Readonly<Record<AiCallPurposeId, string>> = Object.freeze({
  [AI_CALL_PURPOSE.AGENT_CREATE]: 'Creazione agente (estrazione struttura dal task)',
  [AI_CALL_PURPOSE.AGENT_REFINE]: 'Raffinamento agente (rigenerazione su descrizione modificata)',
  [AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL]: 'Generazione iniziale use case bundle',
  [AI_CALL_PURPOSE.USE_CASE_BUNDLE_NARRATIVE_ORDER]: 'Ordinamento narrativo use case',
  [AI_CALL_PURPOSE.USE_CASE_CATEGORIZE]: 'Categorizzazione use case',
  [AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE]: 'Generazione altri use case',
  [AI_CALL_PURPOSE.USE_CASE_DIALOGUE_CREATE]: 'Creazione dialogo per nuovo use case',
  [AI_CALL_PURPOSE.USE_CASE_SPLIT_ROOT_DRAFT]:
    'Analisi bozza root: quanti use case creare dal testo incollato',
  [AI_CALL_PURPOSE.CONVERSATION_POSITIVE]: 'Conversazione con chiusura positiva',
  [AI_CALL_PURPOSE.CONVERSATION_NEGATIVE]: 'Conversazione con chiusura negativa',
  [AI_CALL_PURPOSE.CONVERSATION_SUGGESTED]: 'Conversazione esplorativa nuovi use case',
  [AI_CALL_PURPOSE.CONVERSATION_PROOFREAD]: 'Correzione ortografica frasi modificate',
  [AI_CALL_PURPOSE.USE_CASE_TOKENIZE]: 'Tokenizzazione use case',
  [AI_CALL_PURPOSE.USE_CASE_GENERALIZE_META]: 'Generalizzazione titolo e scenario use case',
  [AI_CALL_PURPOSE.USE_CASE_POLISH_SCENARIO]: 'Aggiusta forma testo scenario (senza cambiare significato)',
  [AI_CALL_PURPOSE.AGENT_POLISH_DESIGN_DESCRIPTION]:
    'Riformatta descrizione task (senza cambiare significato)',
  [AI_CALL_PURPOSE.AGENT_REVIEW_TASK_TEXT_OBSERVATIONS]:
    'Revisione osservazioni su testo task (descrizione / sezioni)',
  [AI_CALL_PURPOSE.AGENT_FINALIZE_TASK_TEXT]: 'Testo task concordato dopo revisione',
  [AI_CALL_PURPOSE.AGENT_CLARIFY_TASK_TEXT_OBSERVATION]:
    'Chiarimento risposta su osservazione testo task',
  [AI_CALL_PURPOSE.USE_CASE_COMPLETE_CORRECTION]:
    'Completa correzione: propagazione directional dello stile sui messaggi agente',
  [AI_CALL_PURPOSE.USE_CASE_COMPLETE_CORRECTION_PREVIEW]:
    'Anteprima correzione: sintesi stile e prime bozze (max 3 messaggi)',
  [AI_CALL_PURPOSE.TRAINING_PHRASES_GENERATE]: 'Generazione training phrases intent',
  [AI_CALL_PURPOSE.TEXT_TRANSLATE]: 'Traduzione testo',
  [AI_CALL_PURPOSE.KB_REFINE_DOCUMENT_ANALYSIS]: 'Raffinamento analisi documento KB',
  [AI_CALL_PURPOSE.KB_PROPOSE_DOCUMENT_ANALYSIS]: 'Prima proposta analisi documento KB',
  [AI_CALL_PURPOSE.KB_REVIEW_DOCUMENT_ANALYSIS_OBSERVATIONS]:
    'Revisione osservazioni analisi documento KB',
  [AI_CALL_PURPOSE.KB_FINALIZE_DOCUMENT_ANALYSIS]: 'Analisi documento KB concordata',
  [AI_CALL_PURPOSE.KB_CLARIFY_DOCUMENT_ANALYSIS_OBSERVATION]:
    'Chiarimento risposta su osservazione analisi KB',
  [AI_CALL_PURPOSE.TUTOR_FREE_QUESTION]: 'Tutor attivo: domanda libera (manuale designer)',
  [AI_CALL_PURPOSE.BACKEND_PROPOSE_ANALYSIS]: 'Prima proposta analisi uso backend',
  [AI_CALL_PURPOSE.BACKEND_REFINE_ANALYSIS]: 'Raffinamento analisi uso backend',
  [AI_CALL_PURPOSE.BACKEND_REVIEW_ANALYSIS_OBSERVATIONS]:
    'Revisione osservazioni analisi backend',
  [AI_CALL_PURPOSE.BACKEND_FINALIZE_ANALYSIS]: 'Analisi backend concordata',
  [AI_CALL_PURPOSE.BACKEND_CLARIFY_ANALYSIS_OBSERVATION]:
    'Chiarimento risposta su osservazione analisi backend',
  [AI_CALL_PURPOSE.BACKEND_CREATE_SUGGESTED_FEATURE]:
    'Specifica funzionalità da aggiungere al backend',
  [AI_CALL_PURPOSE.RUNTIME_ANALYSIS_DISTILL]:
    'Distillazione estrema analisi KB/backend per runtime',
  [AI_CALL_PURPOSE.USE_CASE_GENERATE_TEST_QUESTIONS]:
    'Generazione domande di test per use case',
  [AI_CALL_PURPOSE.USE_CASE_ANALYZE_OVERLAP]:
    'Analisi sovrapposizione use case vs catalogo',
  [AI_CALL_PURPOSE.USE_CASE_CHECK_OVERLAPS]: 'Verifica sovrapposizioni catalogo use case',
});

/** Human-readable label for a known purpose id; falls back to the id itself when unknown. */
export function describeAiCallPurpose(purpose: string | null | undefined): string {
  if (!purpose) return 'Chiamata IA non categorizzata';
  return (LABELS as Record<string, string>)[purpose] ?? purpose;
}
