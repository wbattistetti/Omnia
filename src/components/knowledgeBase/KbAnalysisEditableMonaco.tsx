/**
 * Editor analisi documento KB: evidenziazione arancione designer + syntax sezioni.
 */

import React from 'react';
import type * as Monaco from 'monaco-editor';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
import { useDesignerDraftInsertHighlight } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useDesignerDraftInsertHighlight';
import '@components/TaskEditor/EditorHost/editors/aiAgentEditor/designerDraftInsertHighlight.css';
import { OMNIA_KB_ANALYSIS_MD_LANG } from './kbAnalysisMarkdownLanguage';

export type KbAnalysisEditableMonacoProps = {
  value: string;
  agentBaseline: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  fillHeight?: boolean;
  minHeightPx?: number;
  ariaLabel: string;
  editorDidMount?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
};

/** Monaco analisi KB con highlight inserimenti designer vs baseline agente. */
export function KbAnalysisEditableMonaco({
  value,
  agentBaseline,
  onChange,
  readOnly = false,
  fillHeight = false,
  minHeightPx = 140,
  ariaLabel,
  editorDidMount,
}: KbAnalysisEditableMonacoProps): React.ReactElement {
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const { applyDecorations } = useDesignerDraftInsertHighlight({
    editorRef,
    agentBaseline,
    draft: value,
    enabled: Boolean(agentBaseline.trim()) && !readOnly,
  });

  return (
    <KbMarkdownMonaco
      value={value}
      onChange={readOnly ? undefined : onChange}
      readOnly={readOnly}
      fillHeight={fillHeight}
      heightPx={minHeightPx}
      appearance="plain"
      language={OMNIA_KB_ANALYSIS_MD_LANG}
      ariaLabel={ariaLabel}
      editorDidMount={(editor) => {
        editorRef.current = editor;
        applyDecorations();
        editorDidMount?.(editor);
      }}
    />
  );
}
