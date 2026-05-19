/**
 * Compact Monaco editor for KB / system prompt Markdown.
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import type * as Monaco from 'monaco-editor';
import {
  ensureKbReaderMonacoTheme,
  KB_READER_MONACO_THEME_ID,
  kbReaderMonacoOptions,
} from '@components/knowledgeBase/kbMonacoTheme';
import { ensureKbMarkdownLanguage } from '@components/knowledgeBase/kbMarkdownLanguage';

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
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
  /** When true, editor height tracks the parent container (use with flex-1 parent). */
  fillHeight?: boolean;
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
  fillHeight = false,
  ariaLabel,
  appearance = 'editor',
  language = 'markdown',
}: KbMarkdownMonacoProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = React.useState(heightPx);
  const handleEditorWillMount = React.useCallback((monaco: typeof Monaco) => {
    ensureKbMarkdownLanguage(monaco);
    ensureKbReaderMonacoTheme(monaco);
  }, []);

  React.useLayoutEffect(() => {
    if (fillHeight) return;
    setEditorHeight(heightPx);
  }, [heightPx, fillHeight]);

  React.useLayoutEffect(() => {
    if (!fillHeight || !hostRef.current) return;
    const el = hostRef.current;
    const apply = () => {
      const h = el.clientHeight;
      if (h > 0) setEditorHeight(h);
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fillHeight]);

  const isPlain = appearance === 'plain';
  const baseOptions = kbReaderMonacoOptions(isPlain ? PLAIN_OPTIONS : EDITOR_OPTIONS);

  return (
    <div
      ref={hostRef}
      className={
        (fillHeight ? 'h-full min-h-0 ' : '') +
        'overflow-hidden rounded-md border bg-slate-950/80 ' +
        (isPlain ? 'border-slate-700 focus-within:border-violet-500/60' : 'border-slate-700/80')
      }
      aria-label={ariaLabel}
    >
      <MonacoEditor
        width="100%"
        height={editorHeight}
        language={language}
        theme={KB_READER_MONACO_THEME_ID}
        value={value}
        editorWillMount={handleEditorWillMount}
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
