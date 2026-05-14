/**
 * Shared UI copy and styling for the AI Agent task editor (design-time).
 */

export const LABEL_CREATE_AGENT = 'Create Agent';
export const LABEL_REFINE_AGENT = 'Refine comportamento';
/** Toolbar / empty-state CTA for IA scenario generation. */
export const LABEL_GENERATE_USE_CASES = 'Genera use case';
/** In-tab / toolbar status while Create or Refine is in flight. */
export const LABEL_GENERATING_IA_AGENT = 'generating IA agent...';
/** Status while IA creates a single root/child use case. */
export const LABEL_CREATING_ONE_USE_CASE = 'Sto creando il nuovo use case…';
/** Status while IA creates several root use cases in one batch (Enter su più righe / separatori). */
export const LABEL_CREATING_MULTIPLE_USE_CASES = 'Sto creando i nuovi use case…';
/** Shown when scenario text diverges from last AI baseline — refines label + message to match. */
export const LABEL_REGENERATE_USE_CASE_FOR_SCENARIO = 'Rigenera use case';
/** Messaggio accanto al globo / sotto il menu mentre la generalizzazione IA è in corso. */
export const LABEL_GENERALIZE_USE_CASE_META_PENDING = 'Sto generalizzando, attendi …';
/** Conferma nel menu a tendina del globo (evita generalizzazioni accidentali). */
export const LABEL_GENERALIZE_USE_CASE_META_CONFIRM = 'Generalizza';
/** Shown when assistant example is empty after generation — retry LLM for that turn. */
export const LABEL_REGENERATE_AGENT_EXAMPLE = 'Rigenera esempio messaggio';
/** Wraps current textarea selection in [...] as a runtime slot. */
export const LABEL_AGENT_MSG_WRAP_TOKEN = 'Token';
/** Floating selection menu — wrap selection in a single slot. */
export const LABEL_AGENT_MSG_SELECTION_TOKENIZE = 'Tokenizza';
/** Floating selection menu — remove brackets for the slot that contains the selection. */
export const LABEL_AGENT_MSG_SELECTION_UNTOKEN = 'Rimuovi token';
/** Strips all [...] wrappers from the assistant message (plain text again). */
export const LABEL_AGENT_MSG_STRIP_TOKENS = 'Senza quadre';
/** Calls LLM to wrap runtime fragments in [slot] and refresh motor JSON preview. */
export const LABEL_AGENT_MSG_CREATE_JSON = 'Crea JSON';
/** Re-sync motor JSON after manual edits (snapshot was stale). */
export const LABEL_AGENT_MSG_UPDATE_JSON = 'Aggiorna JSON';

export const AI_AGENT_GLOBAL_USE_CASE_STYLES: Array<{ id: string; label: string; contract: string }> = [
  {
    id: 'cortese',
    label: 'Cortese',
    contract: 'Tono sempre cortese, rispettoso e rassicurante; risposte chiare e collaborative.',
  },
  {
    id: 'ironico',
    label: 'Ironico',
    contract: 'Tono leggermente ironico ma professionale; mai offensivo, sempre utile e chiaro.',
  },
  {
    id: 'formale',
    label: 'Formale',
    contract: 'Registro formale, lessico preciso, frasi sobrie e orientate alla chiarezza operativa.',
  },
];

export const DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID = AI_AGENT_GLOBAL_USE_CASE_STYLES[0].id;

/** Accent used in header, toolbar, and borders. */
export const AI_AGENT_HEADER_COLOR = '#a78bfa';

export const EMPTY_OUTPUT_MAPPINGS: Record<string, string> = {};

/** Minimum length for Create Agent (description) and Refine Agent (prompt) inputs. */
export const AI_AGENT_MIN_INPUT_CHARS = 8;

/**
 * Placeholder for the task description textarea (guidance before Create / Refine).
 */
export const AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER = `Scrivi qui, in linguaggio naturale e con il massimo dettaglio possibile, cosa deve fare l'agente conversazionale e in quale contesto opera.

Spiega in modo chiaro:
• obiettivo del task (es. prenotare una visita, raccogliere un reclamo, guidare una scelta);
• quali informazioni l'agente deve ottenere dall'utente e in che ordine ha senso chiederle;
• vincoli o regole importanti (formati dati, obbligatorietà, cosa fare in caso di errore o rifiuto);
• tono desiderato (formale, cordiale, sintetico, ecc.) se rilevante.

Più la descrizione è completa e precisa, più il sistema potrà generare un design coerente (comportamento, dati da raccogliere, scenari).

Esempio: «Prenotazione visita medica: chiedere tipo di visita, date preferite, nome e cognome, telefono; confermare la prenotazione; consentire correzioni in qualsiasi momento.»`;
