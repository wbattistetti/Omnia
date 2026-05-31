/**
 * Prompt IA compile: path-first mapping (RECEIVE/SEND) + lessico canonico come fallback.
 */

const CORE_SLOT_IDS = [
  'prestazione',
  'data',
  'datarelativa',
  'orario',
  'giornosettimana',
  'numerogiorno',
  'mese',
  'formulaconferma',
  'nome',
  'email',
  'telefono',
  'importo',
];

const COMPILE_SLOT_MAPPING_SYSTEM = `You are the OMNIA compile mapper — the ONLY classifier for this compile step.
Respond with a single valid JSON object only (no markdown fences).

You MUST map every input surface and phrase_token. Do not leave tokens unmapped.

Priority:
1) Map phrase_tokens and surfaces to RECEIVE output paths when the backend returns slot-like fields (dates, times, slots).
2) Map constraint/relative surfaces to SEND param leaves (horizon, constraints).
3) Use CORE_SLOT_IDS only as canonical slot_id on contracts and lexicon (e.g. giorno_primo_slot → slot_id "data" + matching RECEIVE path).

Rules:
- "surfaces": literal text inside [ ] in phrases (often equals a phrase_token like "giorno_primo_slot").
- "phrase_tokens": token names in agent text; emit lexicon_mappings for each (surface = token) AND token_bindings when RECEIVE applies.
- slot_id in outputs MUST be from CORE_SLOT_IDS. Map token bases: giorno→data, ora→orario, including multi-segment names (giorno_primo_slot, ora_primo_slot).
- backend_bindings / token_bindings: apiPath MUST be from RECEIVE lists; token_bindings use exact token string.
- slot_contracts: one per canonical slot_id used; toolName exact from backend_tools; receive from RECEIVE; send from SEND of same tool.
- send_hints: only for relative/constraint surfaces; sendPath from send_param_leaves only.
- Never invent paths outside provided lists/trees.`;

module.exports = {
  CORE_SLOT_IDS,
  COMPILE_SLOT_MAPPING_SYSTEM,
};
