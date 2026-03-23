/**
 * IA read-only diff overlay + dual-layer textarea revision editor (base + insert/delete patch ops).
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
}: AIAgentRevisionEditorShellProps) {
  const suffix = instanceId || 'default';

  return (
    <div className="space-y-2">
      {iaRevisionDiff ? (
        <AIAgentIaRevisionOverlay
          modelUriSuffix={`${suffix}-ia`}
          oldIaPrompt={iaRevisionDiff.oldIaPrompt}
          newIaPrompt={iaRevisionDiff.newIaPrompt}
          onDismiss={onDismissIaRevisionDiff}
        />
      ) : null}
      <TextDualLayerRevisionEditor
        baseText={promptBaseText}
        deletedMask={deletedMask}
        inserts={inserts}
        readOnly={readOnly}
        onApplyRevisionOps={onApplyRevisionOps}
        otMode={otMode}
        otCurrentText={otCurrentText}
        onApplyOtCommit={onApplyOtCommit}
      />
    </div>
  );
}
