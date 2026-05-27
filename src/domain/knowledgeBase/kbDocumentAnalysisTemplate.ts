/**
 * Sezioni canoniche dell'analisi documento KB (allineate a prompt backend e tokenizer Monaco).
 */

/** Intestazioni ### obbligatorie nel markdown analisi (subset per tipo documento). */
export const KB_ANALYSIS_SECTION_HEADINGS = {
  type: '## Type:',
  entities: '### Entities',
  outputFlow: '### Output del flow (variabili task)',
  synonyms: '### Sinonimi',
  dialogRules: '### Regole di dialogo',
  disambigRules: '### Regole di disambiguazione',
  missingDataRules: '### Richiesta dati mancanti',
  mappingSchema: '### Schema mapping (pattern)',
  disambigQuestions: '### Domande di disambiguazione',
  kbDesignerNotes: '### Note sulla KB (designer)',
  finalOutput: '### Final structured output',
} as const;

/** Suffisso citazione fonte su ogni regola operativa. */
export const KB_ANALYSIS_SOURCE_SUFFIX = ' — Fonte:';
