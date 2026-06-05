/**
 * Sezioni canoniche dell'analisi documento KB (allineate a prompt backend e tokenizer Monaco).
 */

import { KB_ANALYSIS_LITE_SECTION_HEADINGS } from './kbDocumentAnalysisLite';

/** Intestazioni ### del template snello (prompt backend). */
export const KB_ANALYSIS_LITE_HEADINGS = {
  type: '## Type:',
  entities: `### ${KB_ANALYSIS_LITE_SECTION_HEADINGS.entities}`,
  outputFlow: `### ${KB_ANALYSIS_LITE_SECTION_HEADINGS.outputFlow}`,
  operationalRules: `### ${KB_ANALYSIS_LITE_SECTION_HEADINGS.operationalRules}`,
  clarificationQuestions: `### ${KB_ANALYSIS_LITE_SECTION_HEADINGS.clarificationQuestions}`,
} as const;

/** Intestazioni ### legacy (retrocompatibilità documenti già analizzati). */
export const KB_ANALYSIS_SECTION_HEADINGS = {
  type: '## Type:',
  entities: KB_ANALYSIS_LITE_HEADINGS.entities,
  outputFlow: KB_ANALYSIS_LITE_HEADINGS.outputFlow,
  operationalRules: KB_ANALYSIS_LITE_HEADINGS.operationalRules,
  clarificationQuestions: KB_ANALYSIS_LITE_HEADINGS.clarificationQuestions,
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
