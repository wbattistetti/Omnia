/**
 * Regole condivise per parentesi quadre nei messaggi use case (passo 1 generazione / edit).
 * La semantica canonica (slot_id, fillFrom) avviene in compile design-time, non qui.
 */

/** Istruzioni per UC_SYSTEM, rigenerazioni, propagazione stile, ecc. */
const USE_CASE_READABLE_BRACKET_RULES = `READABLE_BRACKET_RULES (design-time pass 1 — surfaces in dialogue):
- Mark ONLY runtime-variable fragments with square brackets [ … ].
- Inside [ ] put a **realistic spoken example** as the agent would say it (e.g. [8 giugno 2026], [09:30], [visita cardiologica], [lunedì]), NOT technical snake_case ids like [data_richiesta], [ora_inizio_mattino], or [servizio] as a label.
- Fixed script stays OUTSIDE brackets: in Italian use \`alle [09:30]\` not \`[alle 09:30]\`; keep articles and prepositions outside.
- One concrete worked example per varying role in the phrase; the platform maps these surfaces → canonical slot_id at **compile** using project lexicon + backend RECEIVE.
- When USE OF BACKENDS / OpenAPI context is available, pick example values consistent with API fields (dates, times, slot lists), still as human-readable text inside brackets.`;

/** Per annotate_assistant_message_for_json (legacy motor preview): stessi letterali in content. */
const ANNOTATE_READABLE_BRACKET_RULES = `Inside [ ] insert the **literal example phrase** from the message (or a minimal realistic example if inserting new brackets), NOT snake_case slot_id names. motor.slots[].surface MUST equal the exact text inside the matching brackets in content. motor.slots[].slot_id is a provisional semantic label (snake_case) for preview only — canonical mapping is finalized at compile.`;

module.exports = {
  USE_CASE_READABLE_BRACKET_RULES,
  ANNOTATE_READABLE_BRACKET_RULES,
};
