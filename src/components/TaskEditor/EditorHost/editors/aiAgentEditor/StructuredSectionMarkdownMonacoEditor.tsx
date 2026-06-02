/**
 * Markdown Monaco editor for structured AI Agent sections (syntax highlight, word wrap).
 * Commits edits as OT or linear revision ops against the section base text.
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import type * as Monaco from 'monaco-editor';
import type { InsertOp } from './effectiveFromRevisionMask';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import type { OtOp } from './otTypes';
import type { RevisionBatchOp } from './textRevisionLinear';
import {
  agentStructuredMarkdownEditorOptions,
  ensureAIAgentStructuredMarkdownMonaco,
  KB_READER_MONACO_THEME_ID,
  OMNIA_AGENT_SECTION_MD_LANG,
} from './aiAgentStructuredMarkdownMonaco';
import { commitEffectiveTextChange } from './revisionCommitFromEffective';
import { monacoSelectionAdapter } from './backendPathSelectionAdapter';
import { useBackendPathInsertMenu } from './useBackendPathInsertMenu';
import { useDebouncedCallback } from './useDebouncedCallback';
import { applyMonacoEmbeddedEditorUi } from '@utils/monacoEmbeddedSetup';
import { useDesignerDraftInsertHighlight } from './useDesignerDraftInsertHighlight';

const COMMIT_DEBOUNCE_MS = 280;

export interface StructuredSectionMarkdownMonacoEditorProps {
  baseText: string;
  deletedMask: readonly boolean[];
  inserts: readonly InsertOp[];
  readOnly: boolean;
  otMode: boolean;
  otCurrentText?: string;
  onApplyRevisionOps: (ops: readonly RevisionBatchOp[]) => void;
  onApplyOtCommit?: (ops: readonly OtOp[]) => void;
  minHeightPx?: number;
  onInsertBackendPathAtCaret?: (backendPath: string, rangeStart: number, rangeEnd?: number) => void;
  onUndoRequest?: () => void;
  onRedoRequest?: () => void;
  /** Last agent-stabilized section text; designer additions vs this are highlighted inline. */
  designerHighlightBaseline?: string;
}

export function StructuredSectionMarkdownMonacoEditor({
  baseText,
  deletedMask,
  inserts,
  readOnly,
  otMode,
  otCurrentText,
  onApplyRevisionOps,
  onApplyOtCommit,
  minHeightPx = 280,
  onInsertBackendPathAtCaret,
  onUndoRequest,
  onRedoRequest,
  designerHighlightBaseline = '',
}: StructuredSectionMarkdownMonacoEditorProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [heightPx, setHeightPx] = React.useState(minHeightPx);
  const isOt = Boolean(otMode && onApplyOtCommit && otCurrentText !== undefined);

  const effectiveValue = React.useMemo(
    () =>
      isOt && otCurrentText !== undefined
        ? otCurrentText
        : effectiveFromRevisionMask(baseText, deletedMask, inserts),
    [isOt, otCurrentText, baseText, deletedMask, inserts]
  );

  const [draft, setDraft] = React.useState(effectiveValue);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  const { applyDecorations } = useDesignerDraftInsertHighlight({
    editorRef,
    agentBaseline: designerHighlightBaseline,
    draft,
    enabled: Boolean(designerHighlightBaseline.trim()),
  });

  /** Sync parent → editor only when not typing (undo/redo, tab switch); avoids dictation/IME fights. */
  React.useEffect(() => {
    if (editorRef.current?.hasTextFocus()) return;
    if (draftRef.current === effectiveValue) return;
    setDraft(effectiveValue);
  }, [effectiveValue]);

  React.useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.clientHeight;
      if (h > 0) setHeightPx(h);
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commitDraft = React.useCallback(
    (next: string) => {
      const result = commitEffectiveTextChange({
        baseText,
        deletedMask,
        inserts,
        otMode: isOt,
        otCurrentText: isOt ? otCurrentText : undefined,
        targetEffective: next,
      });
      if (result.kind === 'ot') {
        onApplyOtCommit?.(result.ops);
      } else if (result.kind === 'linear') {
        onApplyRevisionOps(result.ops);
      }
    },
    [baseText, deletedMask, inserts, isOt, otCurrentText, onApplyOtCommit, onApplyRevisionOps]
  );

  const commitDraftDebounced = useDebouncedCallback(commitDraft, COMMIT_DEBOUNCE_MS);

  const onBackendInsert = React.useCallback(
    (path: string, s: number, e: number) => {
      onInsertBackendPathAtCaret?.(path, s, e);
    },
    [onInsertBackendPathAtCaret]
  );

  const { onContextMenu, backendPathMenu } = useBackendPathInsertMenu({
    enabled: Boolean(onInsertBackendPathAtCaret),
    readOnly,
    selection: monacoSelectionAdapter(editorRef),
    onInsert: onBackendInsert,
  });

  const handleEditorWillMount = React.useCallback((monaco: typeof Monaco) => {
    ensureAIAgentStructuredMarkdownMonaco(monaco);
  }, []);

  const handleEditorDidMount = React.useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;
      applyMonacoEmbeddedEditorUi(editor);
      applyDecorations();

      if (onUndoRequest) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
          if (!readOnly) onUndoRequest();
        });
      }
      if (onRedoRequest) {
        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
          () => {
            if (!readOnly) onRedoRequest();
          }
        );
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
          if (!readOnly) onRedoRequest();
        });
      }

      editor.onDidBlurEditorText(() => {
        if (!readOnly) commitDraft(draftRef.current);
      });
    },
    [readOnly, onUndoRequest, onRedoRequest, applyDecorations, commitDraft]
  );

  const handleChange = React.useCallback(
    (value: string) => {
      const v = value ?? '';
      setDraft(v);
      if (!readOnly) {
        commitDraftDebounced(v);
      }
    },
    [readOnly, commitDraftDebounced]
  );

  const showRevisionToolbar = Boolean(onUndoRequest || onRedoRequest);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {showRevisionToolbar ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            disabled={readOnly || !onUndoRequest}
            onClick={() => onUndoRequest?.()}
            className="rounded border border-slate-600/70 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800/80 disabled:opacity-40"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={readOnly || !onRedoRequest}
            onClick={() => onRedoRequest?.()}
            className="rounded border border-slate-600/70 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800/80 disabled:opacity-40"
          >
            Ripeti
          </button>
        </div>
      ) : null}
      <div
        ref={hostRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-700/80 bg-slate-950/80"
        style={{ minHeight: minHeightPx }}
        onContextMenu={onContextMenu}
      >
        <MonacoEditor
          width="100%"
          height={heightPx}
          language={OMNIA_AGENT_SECTION_MD_LANG}
          theme={KB_READER_MONACO_THEME_ID}
          value={draft}
          editorWillMount={handleEditorWillMount}
          editorDidMount={handleEditorDidMount}
          options={agentStructuredMarkdownEditorOptions(readOnly)}
          onChange={readOnly ? undefined : handleChange}
        />
      </div>
      {backendPathMenu}
    </div>
  );
}
