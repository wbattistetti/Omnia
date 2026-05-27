/**
 * Monarch tokenizer per markdown «Analisi del documento» KB (sezioni colorate + fonti).
 */

import type * as Monaco from 'monaco-editor';
import { ensureKbReaderMonacoTheme } from './kbMonacoTheme';

export const OMNIA_KB_ANALYSIS_MD_LANG = 'omnia-kb-analysis-md';

let registered = false;

const SECTION_HEADINGS: Array<[RegExp, string]> = [
  [/^###\s+Entities\s*$/i, 'kb.section.entities'],
  [/^###\s+Output del flow/i, 'kb.section.outputFlow'],
  [/^###\s+Sinonimi\s*$/i, 'kb.section.synonyms'],
  [/^###\s+Regole di dialogo\s*$/i, 'kb.section.dialog'],
  [/^###\s+Regole di disambiguazione\s*$/i, 'kb.section.disambig'],
  [/^###\s+Richiesta dati mancanti\s*$/i, 'kb.section.missingData'],
  [/^###\s+Schema mapping/i, 'kb.section.mapping'],
  [/^###\s+Domande di disambiguazione\s*$/i, 'kb.section.questions'],
  [/^###\s+Note sulla KB/i, 'kb.section.kbNotes'],
  [/^###\s+Final structured output\s*$/i, 'kb.section.finalOutput'],
  [/^###\s+Value\s*→\s*Code mapping/i, 'kb.section.mapping'],
  [/^###\s+Rules\s*$/i, 'kb.section.dialog'],
  [/^###\s+Disambiguation questions\s*$/i, 'kb.section.questions'],
];

/** Idempotent: lingua analisi KB + tema reader. */
export function ensureKbAnalysisMarkdownMonaco(monaco: typeof Monaco): void {
  if (registered) {
    ensureKbReaderMonacoTheme(monaco);
    return;
  }
  registered = true;

  monaco.languages.register({
    id: OMNIA_KB_ANALYSIS_MD_LANG,
    extensions: ['.kb-analysis.md'],
    aliases: ['Omnia KB Analysis', 'kb-analysis-md'],
  });

  monaco.languages.setMonarchTokensProvider(OMNIA_KB_ANALYSIS_MD_LANG, {
    defaultToken: 'kb.text',
    tokenizer: {
      root: [
        [/^##\s+Type:\s*.+$/i, 'kb.typeLine'],
        [/^#{1}\s+.+$/, 'markup.heading.1'],
        [/^#{2}\s+.+$/, 'markup.heading.2'],
        ...SECTION_HEADINGS.map(([re, token]) => [re, token] as const),
        [/^#{3,6}\s+.+$/, 'markup.heading'],
        [/—\s*Fonte:\s*«[^»]+»/i, 'kb.sourceCitation'],
        [/Fonte:\s*«[^»]+»/i, 'kb.sourceCitation'],
        [/Fonte:\s*pattern\s+ricorrente/i, 'kb.sourcePattern'],
        [/\{\{[^}]+\}\}/, 'kb.flowVar'],
        [/^\s*---+\s*$/, 'kb.hr'],
        [/\*\*[^*\n]+:\*\*/, 'kb.label'],
        [/\*\*[^*\n]+\*\*/, 'markup.bold'],
        [/\bID\s+\d+\b/i, 'kb.id'],
        [/->|→|←/, 'kb.arrow'],
        [/^\s*[-*+]\s+/, 'markup.list'],
        [/`[^`\n]+`/, 'markup.inline.raw'],
        [/^\s*\|.+\|\s*$/, 'kb.tableRow'],
      ],
    },
  });

  ensureKbReaderMonacoTheme(monaco);
}
