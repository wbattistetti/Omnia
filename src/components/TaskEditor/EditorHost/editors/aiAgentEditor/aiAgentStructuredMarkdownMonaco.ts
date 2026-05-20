/**
 * Monaco markdown language + theme for AI Agent structured sections and description.
 */

import type * as Monaco from 'monaco-editor';
import { ensureKbMarkdownLanguage, OMNIA_KB_MD_LANG } from '@components/knowledgeBase/kbMarkdownLanguage';
import {
  ensureKbReaderMonacoTheme,
  KB_READER_MONACO_THEME_ID,
  kbAgentProseMarkdownOptions,
} from '@components/knowledgeBase/kbMonacoTheme';

export const OMNIA_AGENT_SECTION_MD_LANG = OMNIA_KB_MD_LANG;

let agentTokensRegistered = false;

function registerAgentSectionExtraTokens(monaco: typeof Monaco): void {
  if (agentTokensRegistered) return;
  agentTokensRegistered = true;
  monaco.languages.setMonarchTokensProvider(OMNIA_AGENT_SECTION_MD_LANG, {
    defaultToken: 'kb.text',
    tokenizer: {
      root: [
        [/^#{1}\s+.+$/, 'markup.heading.1'],
        [/^#{2}\s+.+$/, 'markup.heading.2'],
        [/^#{3,6}\s+.+$/, 'markup.heading'],
        [/^\s*Must\s*:\s*$/i, 'kb.label'],
        [/^\s*Must\s+not\s*:\s*$/i, 'kb.label'],
        [/^\s*---+\s*$/, 'kb.hr'],
        [/\*\*[^*\n]+:\*\*/, 'kb.label'],
        [/\*\*[^*\n]+\*\*/, 'markup.bold'],
        [/^\s*\d+\.\s+/, 'markup.list.numbered'],
        [/^\s*[-*+]\s+/, 'markup.list'],
        [/`[^`\n]+`/, 'markup.inline.raw'],
      ],
    },
  });
}

/** Idempotent: KB markdown + agent section tokens + dark reader theme. */
export function ensureAIAgentStructuredMarkdownMonaco(monaco: typeof Monaco): void {
  ensureKbMarkdownLanguage(monaco);
  registerAgentSectionExtraTokens(monaco);
  ensureKbReaderMonacoTheme(monaco);
}

export function agentStructuredMarkdownEditorOptions(
  readOnly: boolean
): Record<string, unknown> {
  return kbAgentProseMarkdownOptions(readOnly);
}

export { KB_READER_MONACO_THEME_ID };
