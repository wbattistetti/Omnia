/**
 * Dark Monaco theme for KB reader (12px mono, richer Markdown token colors).
 */

import type * as Monaco from 'monaco-editor';
import { KB_MONACO_FONT_FAMILY } from './kbTypography';

export const KB_READER_MONACO_THEME_ID = 'omnia-kb-reader';

let registered = false;

/** Idempotent: defines and selects the KB reader theme. */
export function ensureKbReaderMonacoTheme(monaco: typeof Monaco): void {
  if (!registered) {
    monaco.editor.defineTheme(KB_READER_MONACO_THEME_ID, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'markup.heading', foreground: '67e8f9', fontStyle: 'bold' },
        { token: 'markup.heading.1', foreground: '67e8f9', fontStyle: 'bold' },
        { token: 'markup.heading.2', foreground: '7dd3fc', fontStyle: 'bold' },
        { token: 'kb.label', foreground: 'fcd34d', fontStyle: 'bold' },
        { token: 'markup.bold', foreground: 'e2e8f0' },
        { token: 'markup.italic', foreground: 'c4b5fd', fontStyle: 'italic' },
        { token: 'markup.list', foreground: '94a3b8' },
        { token: 'markup.list.numbered', foreground: '94a3b8' },
        { token: 'kb.id', foreground: '34d399', fontStyle: 'bold' },
        { token: 'kb.arrow', foreground: 'f472b6' },
        { token: 'kb.control', foreground: 'c4b5fd', fontStyle: 'italic' },
        { token: 'kb.hr', foreground: '475569' },
        { token: 'kb.text', foreground: 'cbd5e1' },
        { token: 'string', foreground: 'cbd5e1' },
        { token: 'string.escape', foreground: 'f9a8d4' },
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'a78bfa' },
        { token: 'metatag', foreground: '64748b' },
        { token: 'markup.inline.raw', foreground: 'fda4af' },
        { token: 'variable', foreground: 'cbd5e1' },
      ],
      colors: {
        'editor.background': '#020617',
        'editor.foreground': '#cbd5e1',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#94a3b8',
        'editor.selectionBackground': '#312e8133',
        'editor.lineHighlightBackground': '#1e293b44',
      },
    });
    registered = true;
  }
  monaco.editor.setTheme(KB_READER_MONACO_THEME_ID);
}

export function kbReaderMonacoOptions(
  base: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...base,
    fontSize: 12,
    fontFamily: KB_MONACO_FONT_FAMILY,
    lineHeight: 18,
  };
}

/** No line numbers / gutter — reads like a text area, not an IDE. */
export const KB_MARKDOWN_PLAIN_CHROME: Record<string, unknown> = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  automaticLayout: true,
  lineNumbers: 'off',
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  guides: { indentation: false },
  scrollbar: {
    vertical: 'auto',
    horizontal: 'hidden',
    verticalScrollbarSize: 8,
  },
  padding: { top: 10, bottom: 10 },
  tabSize: 2,
};

const AGENT_PROSE_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** AI Agent description / sections: plain chrome + readable sans body (syntax colors kept). */
export function kbAgentProseMarkdownOptions(readOnly: boolean): Record<string, unknown> {
  return {
    ...KB_MARKDOWN_PLAIN_CHROME,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: AGENT_PROSE_FONT,
    readOnly,
    domReadOnly: readOnly,
  };
}
