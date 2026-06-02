/**
 * Shared UI copy and styling for the AI Agent task editor (design-time).
 */

export const LABEL_CREATE_AGENT = 'Create Agent';
export const LABEL_REFINE_AGENT = 'Refine comportamento';
/** Toolbar / empty-state CTA for IA scenario generation. */
export const LABEL_GENERATE_USE_CASES = 'Genera use case';
/** Empty tutor: titolo accanto alla mascotte (una riga). */
export const LABEL_EMPTY_USE_CASE_TUTOR_HEADLINE =
  'Generiamo gli use case per guidare l’agente!';
/** Link inline nello stato vuoto use case (due occorrenze nel paragrafo intro). */
export const LABEL_EMPTY_USE_CASE_CLICK_HERE = 'clicca qui';
/** Placeholder textarea quando l’utente sceglie «incolla lista». */
export const PLACEHOLDER_EMPTY_USE_CASE_DRAFT =
  'Incolla o scrivi qui uno o più scenari e ti aiuto a riorganizzarli.';
/** CTA accanto alla textbox quando la lista ha già use case (iniziativa IA). */
export const LABEL_GENERATE_MORE_USE_CASES = 'Crea altri use case';
/** Guida sotto la textbox con lista già popolata (aggiunta da input utente). */
export const HINT_ADD_USE_CASES_FROM_INPUT =
  'Incolla o scrivi uno o più scenari qui sotto: INVIO e l’IA li analizza e li aggiunge alla lista.';
/** Placeholder textarea root composer (lista use case già popolata). */
export const PLACEHOLDER_ROOT_USE_CASE_DRAFT =
  'Descrivi in modo molto libero gli scenari che vorresti includere e premi enter o clicca sul pulsante a fianco. Omnia analizzerà il testo e suggerirà gli use case appropriati con descrizioni complete e suggerendo i messaggi per l\'agente.';
/** In-tab / toolbar status while Create or Refine is in flight. */
export const LABEL_GENERATING_IA_AGENT = 'generating IA agent...';
/** Status while IA creates a single root/child use case. */
export const LABEL_CREATING_ONE_USE_CASE = 'Sto creando il nuovo use case…';
/** Status while IA creates several root use cases in one batch (Enter su più righe / separatori). */
export const LABEL_CREATING_MULTIPLE_USE_CASES = 'Sto creando i nuovi use case…';
/** Root draft textarea: explicit CTA (same action as Enter). */
export const LABEL_ANALYZE_AND_CREATE_USE_CASES =
  'Analizza e crea eventualmente nuovi use case';
/** Root draft chip: LLM split phase (replaces top banner). */
export const LABEL_ROOT_DRAFT_ANALYZING =
  'OK, sto analizzando… per capire quali use case aggiungere…';
/** Shown when scenario text diverges from last AI baseline — refines label + message to match. */
export const LABEL_REGENERATE_USE_CASE_FOR_SCENARIO = 'Rigenera use case';
/** Messaggio accanto al globo / sotto il menu mentre la generalizzazione IA è in corso. */
export const LABEL_GENERALIZE_USE_CASE_META_PENDING = 'Sto generalizzando, attendi …';
/** Toolbar scenario: rifinisce forma del testo senza cambiare significato. */
export const LABEL_POLISH_USE_CASE_SCENARIO = 'Aggiusta testo';
export const TOOLTIP_POLISH_USE_CASE_SCENARIO =
  'Rifinisce chiarezza e forma dello scenario (stesso significato, nessun fatto nuovo)';
/** Durante polish scenario sulla riga. */
export const LABEL_POLISH_USE_CASE_SCENARIO_PENDING = 'Sto aggiustando il testo…';
/** Pillola sulla textarea Descrizione task. */
export const LABEL_POLISH_DESIGN_DESCRIPTION_OFFER =
  'Vuoi che ti riscriva il testo in modo più formattato, senza cambiarne il contenuto?';
export const LABEL_POLISH_DESIGN_DESCRIPTION_PENDING =
  'Attendi: sto riscrivendo il testo in un formato più organizzato, senza modificarne il senso…';
/** Soglia minima di caratteri «diversi» per proporre il polish descrizione. */
export const DESIGN_DESCRIPTION_POLISH_MIN_CHAR_DELTA = 50;
/** Conferma nel menu a tendina del globo (evita generalizzazioni accidentali). */
export const LABEL_GENERALIZE_USE_CASE_META_CONFIRM = 'Generalizza';
/** Shown when assistant example is empty after generation — retry LLM for that turn. */
export const LABEL_REGENERATE_AGENT_EXAMPLE = 'Rigenera esempio messaggio';
/** Wraps current textarea selection in [...] as a runtime slot. */
export const LABEL_AGENT_MSG_WRAP_TOKEN = 'Token';
/** @deprecated Usare semantic/style token. */
export const LABEL_AGENT_MSG_SELECTION_TOKENIZE = 'Tokenizza';
/** Floating selection menu — semantic slot `[…]`. */
export const LABEL_AGENT_MSG_SELECTION_SEMANTIC_TOKEN = 'Semantic token';
/** Floating selection menu — style token `«…»`. */
export const LABEL_AGENT_MSG_SELECTION_STYLE_TOKEN = 'Style token';
/** Floating selection menu — remove token (semantic or style). */
export const LABEL_AGENT_MSG_SELECTION_UNTOKEN = 'Untokenize';
/** Toolbar messaggio: combinatoria varianti style token. */
export const TOOLTIP_AGENT_MSG_GENERATE_STYLE_EXAMPLES =
  'Combinazioni locali delle varianti stile (senza IA)';
export const TOOLTIP_AGENT_MSG_STYLE_POLISH =
  'Rifinisce con IA le combinazioni delle varianti stile (stessa semantica)';
export const TOOLTIP_AGENT_MSG_STYLE_CREATIVE =
  'Genera con IA nuove formulazioni oltre le combinazioni degli stili';
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
    contract:
      'Messaggi molto sintetici, conversazionali e naturali — come al call center: cortesi, rassicuranti, senza prolissità. Scenari completi ma descritti in modo breve e diretto.',
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
