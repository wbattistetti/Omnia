/**
 * Monarch tokenizer for PAROS-style KB Markdown (headings, labels, IDs, routing).
 */

import type * as Monaco from 'monaco-editor';

export const OMNIA_KB_MD_LANG = 'omnia-kb-md';

let registered = false;

/** Register `omnia-kb-md` once (idempotent). */
export function ensureKbMarkdownLanguage(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.register({
    id: OMNIA_KB_MD_LANG,
    extensions: ['.md'],
    aliases: ['Omnia KB Markdown', 'kb-md'],
  });

  monaco.languages.setMonarchTokensProvider(OMNIA_KB_MD_LANG, {
    defaultToken: 'kb.text',
    tokenizer: {
      root: [
        [/^#{1}\s+.+$/, 'markup.heading.1'],
        [/^#{2}\s+.+$/, 'markup.heading.2'],
        [/^#{3,6}\s+.+$/, 'markup.heading'],
        [/^\s*---+\s*$/, 'kb.hr'],
        [/\*\*[^*\n]+:\*\*/, 'kb.label'],
        [/\*\*[^*\n]+\*\*/, 'markup.bold'],
        [/\bID\s+\d+\b/i, 'kb.id'],
        [/->/, 'kb.arrow'],
        [/\b(se|altrimenti|oppure)\b/i, 'kb.control'],
        [/^\s*[-*+]\s+/, 'markup.list'],
        [/`[^`\n]+`/, 'markup.inline.raw'],
      ],
    },
  });
}
