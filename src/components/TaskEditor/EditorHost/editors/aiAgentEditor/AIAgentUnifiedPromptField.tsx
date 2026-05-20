/**
 * Single primary field: task description (Monaco markdown) or runtime prompt (section editor shell).
 */

import React from 'react';
import { AIAgentRevisionEditorShell } from './AIAgentRevisionEditorShell';
import { AgentDescriptionMarkdownEditor } from './AgentDescriptionMarkdownEditor';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import type { InsertOp } from './effectiveFromRevisionMask';
import type { RevisionBatchOp } from './textRevisionLinear';

export type UnifiedEditorMode = 'description' | 'agent_prompt';

export interface AIAgentUnifiedPromptFieldProps {
  mode: UnifiedEditorMode;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  headerAction?: React.ReactNode;
  instanceId: string | undefined;
  iaRevisionDiff: { oldIaPrompt: string; newIaPrompt: string } | null;
  onDismissIaRevisionDiff: () => void;
  promptBaseText: string;
  deletedMask: readonly boolean[];
  inserts: readonly InsertOp[];
  onApplyRevisionOps: (ops: readonly RevisionBatchOp[]) => void;
  insertBackendPathInDesign?: (path: string, rangeStart: number, rangeEnd?: number) => void;
}

export function AIAgentUnifiedPromptField({
  mode,
  value,
  onChange,
  readOnly,
  headerAction,
  instanceId,
  iaRevisionDiff,
  onDismissIaRevisionDiff,
  promptBaseText,
  deletedMask,
  inserts,
  onApplyRevisionOps,
  insertBackendPathInDesign: insertBackendPathInDesignProp,
}: AIAgentUnifiedPromptFieldProps) {
  const dock = useOptionalAIAgentEditorDock();
  const insertBackendPathInDesign =
    insertBackendPathInDesignProp ?? dock?.insertBackendPathInDesign;

  return (
    <section>
      {mode === 'description' ? (
        headerAction ? (
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">{headerAction}</div>
        ) : null
      ) : (
        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
          <label className="block min-w-0 flex-1 text-sm font-medium text-slate-300">
            Prompt agente runtime (modificabile)
          </label>
          {headerAction ? <div className="flex shrink-0 items-center">{headerAction}</div> : null}
        </div>
      )}
      {mode === 'agent_prompt' ? (
        <AIAgentRevisionEditorShell
          instanceId={instanceId}
          promptBaseText={promptBaseText}
          deletedMask={deletedMask}
          inserts={inserts}
          onApplyRevisionOps={onApplyRevisionOps}
          readOnly={readOnly}
          iaRevisionDiff={iaRevisionDiff}
          onDismissIaRevisionDiff={onDismissIaRevisionDiff}
        />
      ) : (
        <AgentDescriptionMarkdownEditor
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          fillHeight={false}
          containerClassName="relative flex min-h-[200px] flex-col lg:min-h-[280px]"
          insertBackendPathInDesign={insertBackendPathInDesign}
        />
      )}
    </section>
  );
}
