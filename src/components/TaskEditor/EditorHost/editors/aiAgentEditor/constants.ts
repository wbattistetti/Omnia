/**
 * Shared UI copy and styling for the AI Agent task editor (design-time).
 */

export const LABEL_CREATE_AGENT = 'Create Agent';
export const LABEL_REFINE_AGENT = 'Refine comportamento';
/** Toolbar / empty-state CTA for IA scenario generation. */
export const LABEL_GENERATE_USE_CASES = 'Genera use case';
/** In-tab / toolbar status while Create or Refine is in flight. */
export const LABEL_GENERATING_IA_AGENT = 'generating IA agent...';

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
