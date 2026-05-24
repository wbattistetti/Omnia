/**
 * Controlled Monaco markdown editor for AI Agent task description (syntax highlight).
 */

import React from 'react';
import type * as Monaco from 'monaco-editor';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
import { AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER } from './constants';
import { monacoSelectionAdapter } from './backendPathSelectionAdapter';
import { useBackendPathInsertMenu } from './useBackendPathInsertMenu';

export interface AgentDescriptionMarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  ariaLabel?: string;
  containerClassName?: string;
  fillHeight?: boolean;
  insertBackendPathInDesign?: (path: string, rangeStart: number, rangeEnd?: number) => void;
  tutorHostId?: string;
}

export function AgentDescriptionMarkdownEditor({
  value,
  onChange,
  readOnly = false,
  ariaLabel = 'Descrizione',
  containerClassName = 'relative flex min-h-0 flex-1 flex-col',
  fillHeight = true,
  insertBackendPathInDesign,
  tutorHostId,
}: AgentDescriptionMarkdownEditorProps): React.ReactElement {
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const onDesignInsert = React.useCallback(
    (path: string, s: number, e: number) => {
      insertBackendPathInDesign?.(path, s, e);
    },
    [insertBackendPathInDesign]
  );

  const { onContextMenu, backendPathMenu } = useBackendPathInsertMenu({
    enabled: Boolean(insertBackendPathInDesign),
    readOnly,
    selection: monacoSelectionAdapter(editorRef),
    onInsert: onDesignInsert,
  });

  return (
    <div className={containerClassName}>
      <KbMarkdownMonaco
        fillHeight={fillHeight}
        appearance="agentProse"
        ariaLabel={ariaLabel}
        value={value}
        onChange={readOnly ? undefined : onChange}
        readOnly={readOnly}
        editorDidMount={(editor) => {
          editorRef.current = editor;
        }}
        onHostContextMenu={onContextMenu}
        tutorHostId={tutorHostId}
      />
      {!value.trim() && !readOnly ? (
        <div
            className="pointer-events-none absolute left-3 top-2.5 text-sm text-slate-500"
          aria-hidden
        >
          {AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER}
        </div>
      ) : null}
      {backendPathMenu}
    </div>
  );
}
