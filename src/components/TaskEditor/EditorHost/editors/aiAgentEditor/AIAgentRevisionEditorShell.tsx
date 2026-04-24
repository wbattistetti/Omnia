/**
 * IA revision diff (toggleable) + dual-layer textarea revision editor (base + insert/delete patch ops).
 */

import React from 'react';
import { AIAgentIaRevisionOverlay } from './AIAgentIaRevisionOverlay';
import { TextDualLayerRevisionEditor } from './TextDualLayerRevisionEditor';
import type { InsertOp } from './effectiveFromRevisionMask';
import type { OtOp } from './otTypes';
import type { RevisionBatchOp } from './textRevisionLinear';

export interface AIAgentRevisionEditorShellProps {
  instanceId: string | undefined;
  promptBaseText: string;
  deletedMask: readonly boolean[];
  inserts: readonly InsertOp[];
  onApplyRevisionOps: (ops: readonly RevisionBatchOp[]) => void;
  readOnly: boolean;
  iaRevisionDiff: { oldIaPrompt: string; newIaPrompt: string } | null;
  onDismissIaRevisionDiff: () => void;
  /** When true with {@link otCurrentText} and {@link onApplyOtCommit}, textarea uses OT commit path. */
  otMode?: boolean;
  otCurrentText?: string;
  onApplyOtCommit?: (ops: readonly OtOp[]) => void;
  onUndoRequest?: () => void;
  onRedoRequest?: () => void;
  /** Right-click: insert BackendCall path token at caret / selection in section text. */
  onInsertBackendPathAtCaret?: (backendPath: string, rangeStart: number, rangeEnd?: number) => void;
}

export function AIAgentRevisionEditorShell({
  instanceId,
  promptBaseText,
  deletedMask,
  inserts,
  onApplyRevisionOps,
  readOnly,
  iaRevisionDiff,
  onDismissIaRevisionDiff,
  otMode = false,
  otCurrentText,
  onApplyOtCommit,
  onUndoRequest,
  onRedoRequest,
  onInsertBackendPathAtCaret,
}: AIAgentRevisionEditorShellProps) {
  const suffix = instanceId || 'default';
  const [showIaDiff, setShowIaDiff] = React.useState(false);

  React.useEffect(() => {
    if (!iaRevisionDiff) {
      setShowIaDiff(false);
    }
  }, [iaRevisionDiff]);

  const editorBlock = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TextDualLayerRevisionEditor
        baseText={promptBaseText}
        deletedMask={deletedMask}
        inserts={inserts}
        readOnly={readOnly}
        onApplyRevisionOps={onApplyRevisionOps}
        otMode={otMode}
        otCurrentText={otCurrentText}
        onApplyOtCommit={onApplyOtCommit}
        onUndoRequest={onUndoRequest}
        onRedoRequest={onRedoRequest}
        onInsertBackendPathAtCaret={onInsertBackendPathAtCaret}
      />
    </div>
  );

  if (iaRevisionDiff) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-1 overflow-hidden rounded-md border border-violet-900/45 bg-slate-950/40">
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-violet-900/35 bg-violet-950/15 px-2 py-1">
          <button
            type="button"
            aria-pressed={showIaDiff}
            onClick={() => setShowIaDiff((v) => !v)}
            className="rounded border border-violet-600/55 bg-violet-950/35 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-100 hover:bg-violet-900/40"
          >
            {showIaDiff ? 'Editor' : 'DIFF'}
          </button>
          <button
            type="button"
            onClick={onDismissIaRevisionDiff}
            className="text-[11px] text-violet-300 hover:text-violet-100 underline"
          >
            Nascondi confronto
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showIaDiff ? (
            <AIAgentIaRevisionOverlay
              chrome="none"
              modelUriSuffix={`${suffix}-ia`}
              oldIaPrompt={iaRevisionDiff.oldIaPrompt}
              newIaPrompt={iaRevisionDiff.newIaPrompt}
              onDismiss={onDismissIaRevisionDiff}
            />
          ) : (
            editorBlock
          )}
        </div>
      </div>
    );
  }

  return <div className="flex h-full min-h-0 flex-1 flex-col gap-2">{editorBlock}</div>;
}
