/**
 * Compact Monaco editor for KB / system prompt Markdown.
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import type * as Monaco from 'monaco-editor';
import {
  ensureKbReaderMonacoTheme,
  KB_MARKDOWN_PLAIN_CHROME,
  KB_READER_MONACO_THEME_ID,
  kbAgentProseMarkdownOptions,
  kbReaderMonacoOptions,
} from '@components/knowledgeBase/kbMonacoTheme';
import { TUTOR_ID_ATTR } from '@domain/activeTutor/tutorUiIds';
import { ensureKbMarkdownLanguage } from '@components/knowledgeBase/kbMarkdownLanguage';
import { applyMonacoEmbeddedEditorUi } from '@utils/monacoEmbeddedSetup';

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

export type KbMarkdownMonacoProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  heightPx?: number;
  /** When true, editor height tracks the parent container (use with flex-1 parent). */
  fillHeight?: boolean;
  ariaLabel?: string;
  /** `plain` = no line numbers; `agentProse` = plain + sans body (AI Agent fields). */
  appearance?: 'editor' | 'plain' | 'agentProse';
  language?: string;
  editorDidMount?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
  /** Host wrapper context menu (e.g. backend path insert). */
  onHostContextMenu?: (e: React.MouseEvent) => void;
  /** data-tutor-id sul bordo visibile dell'editor (Active Tutor attention). */
  tutorHostId?: string;
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
  editorDidMount,
  onHostContextMenu,
  tutorHostId,
}: KbMarkdownMonacoProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = React.useState(heightPx);
  const handleEditorWillMount = React.useCallback((monaco: typeof Monaco) => {
    ensureKbMarkdownLanguage(monaco);
    ensureKbReaderMonacoTheme(monaco);
  }, []);

  const handleEditorDidMount = React.useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      applyMonacoEmbeddedEditorUi(editor);
      editorDidMount?.(editor);
    },
    [editorDidMount]
  );

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

  const isAgentProse = appearance === 'agentProse';
  const isPlain = appearance === 'plain' || isAgentProse;
  const baseOptions = isAgentProse
    ? kbAgentProseMarkdownOptions(readOnly)
    : kbReaderMonacoOptions(isPlain ? KB_MARKDOWN_PLAIN_CHROME : EDITOR_OPTIONS);

  return (
    <div
      ref={hostRef}
      {...(tutorHostId ? { [TUTOR_ID_ATTR]: tutorHostId } : {})}
      className={
        (fillHeight ? 'h-full min-h-0 ' : '') +
        'overflow-hidden rounded-md border bg-slate-950/80 ' +
        (isPlain
          ? 'border-slate-700 focus-within:border-violet-500/60'
          : 'border-slate-700/80')
      }
      aria-label={ariaLabel}
      onContextMenu={onHostContextMenu}
    >
      <MonacoEditor
        width="100%"
        height={editorHeight}
        language={language}
        theme={KB_READER_MONACO_THEME_ID}
        value={value}
        editorWillMount={handleEditorWillMount}
        editorDidMount={handleEditorDidMount}
        options={
          isAgentProse
            ? baseOptions
            : { ...baseOptions, readOnly, domReadOnly: readOnly }
        }
        onChange={readOnly ? undefined : (v) => onChange?.(v ?? '')}
      />
    </div>
  );
}
