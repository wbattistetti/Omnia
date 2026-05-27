/**
 * Monaco markdown editabile con evidenziazione arancione vs baseline agente.
 */

import React from 'react';
import type * as Monaco from 'monaco-editor';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
import { useDesignerDraftInsertHighlight } from '../useDesignerDraftInsertHighlight';
import '../designerDraftInsertHighlight.css';

export type BackendAnalysisEditableMonacoProps = {
  value: string;
  agentBaseline: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeightPx?: number;
  fillHeight?: boolean;
  ariaLabel: string;
};

export function BackendAnalysisEditableMonaco({
  value,
  agentBaseline,
  onChange,
  readOnly = false,
  minHeightPx = 140,
  fillHeight = false,
  ariaLabel,
}: BackendAnalysisEditableMonacoProps): React.ReactElement {
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
      heightPx={minHeightPx}
      fillHeight={fillHeight}
      appearance="plain"
      ariaLabel={ariaLabel}
      editorDidMount={(editor) => {
        editorRef.current = editor;
        applyDecorations();
      }}
    />
  );
}
