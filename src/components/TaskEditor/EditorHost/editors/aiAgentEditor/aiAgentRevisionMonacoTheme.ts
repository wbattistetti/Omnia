/**
 * Registers a dark diff theme for the AI Agent prompt revision editor (red removals, green inserts).
 */

import type * as Monaco from 'monaco-editor';

const THEME_ID = 'omnia-ai-agent-revision';

let registered = false;

/**
 * Defines and selects the revision diff theme on the given Monaco namespace (idempotent).
 */
export function ensureAIAgentRevisionDiffTheme(monaco: typeof Monaco): void {
  if (registered) {
    monaco.editor.setTheme(THEME_ID);
    return;
  }
  monaco.editor.defineTheme(THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      /* Softer inline IA diff (overlay); user-decorated editor ignores these. */
      'diffEditor.removedTextBackground': '#9f123955',
      'diffEditor.insertedTextBackground': '#15803d55',
      'diffEditor.removedLineBackground': '#4c051955',
      'diffEditor.insertedLineBackground': '#052e1640',
    },
  });
  monaco.editor.setTheme(THEME_ID);
  registered = true;
}
