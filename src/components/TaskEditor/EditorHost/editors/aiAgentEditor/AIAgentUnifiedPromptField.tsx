/**
 * Single primary field: natural-language description (textarea) or runtime prompt (revision editor shell).
 */

import React from 'react';
import { AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER } from './constants';
import { AIAgentRevisionEditorShell } from './AIAgentRevisionEditorShell';
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
  /** Agent mode: immutable base + revision patch. */
  promptBaseText: string;
  deletedMask: readonly boolean[];
  inserts: readonly InsertOp[];
  onApplyRevisionOps: (ops: readonly RevisionBatchOp[]) => void;
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
}: AIAgentUnifiedPromptFieldProps) {
  return (
    <section>
      {mode === 'description' ? (
        headerAction ? (
          <div className="flex flex-wrap items-center justify-end gap-2 mb-2">{headerAction}</div>
        ) : null
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <label className="block text-sm font-medium text-slate-300 min-w-0 flex-1">
            Prompt agente runtime (modificabile)
          </label>
          {headerAction ? <div className="shrink-0 flex items-center">{headerAction}</div> : null}
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
        <textarea
          className="w-full min-h-[200px] lg:min-h-[280px] rounded-md bg-slate-900 border border-slate-700 p-3 text-sm font-mono text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder={AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER}
          aria-label="Descrizione"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          readOnly={readOnly}
          spellCheck
        />
      )}
    </section>
  );
}
