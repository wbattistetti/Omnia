/**
 * Compact Monaco editor for KB / system prompt Markdown.
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
  fontSize: 12,
  lineNumbers: 'on' as const,
  folding: true,
  renderLineHighlight: 'line' as const,
  tabSize: 2,
};

const PLAIN_OPTIONS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
  fontSize: 12,
  lineNumbers: 'off' as const,
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none' as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  scrollbar: {
    vertical: 'auto' as const,
    horizontal: 'hidden' as const,
    verticalScrollbarSize: 8,
  },
  padding: { top: 8, bottom: 8 },
  tabSize: 2,
};

export type KbMarkdownMonacoProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  heightPx?: number;
  ariaLabel?: string;
  /** `plain` = textbox-like (no line numbers / line highlight). */
  appearance?: 'editor' | 'plain';
  language?: string;
};

export function KbMarkdownMonaco({
  value,
  onChange,
  readOnly = false,
  heightPx = 160,
  ariaLabel,
  appearance = 'editor',
  language = 'markdown',
}: KbMarkdownMonacoProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = React.useState(heightPx);

  React.useLayoutEffect(() => {
    setEditorHeight(heightPx);
  }, [heightPx]);

  const isPlain = appearance === 'plain';
  const baseOptions = isPlain ? PLAIN_OPTIONS : EDITOR_OPTIONS;

  return (
    <div
      ref={hostRef}
      className={
        'overflow-hidden rounded-md border bg-slate-950/80 ' +
        (isPlain ? 'border-slate-700 focus-within:border-violet-500/60' : 'border-slate-700/80 bg-[#0c0c0f]')
      }
      aria-label={ariaLabel}
    >
      <MonacoEditor
        width="100%"
        height={editorHeight}
        language={language}
        theme="vs-dark"
        value={value}
        options={{
          ...baseOptions,
          readOnly,
          domReadOnly: readOnly,
        }}
        onChange={readOnly ? undefined : (v) => onChange?.(v ?? '')}
      />
    </div>
  );
}


