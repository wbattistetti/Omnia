/**
 * Left column: phase 1 description textarea; phase 2 description + structured sections + global refine.
 */

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { AIAgentUnifiedPromptField } from './AIAgentUnifiedPromptField';
import { AIAgentStructuredSectionsPanel } from './AIAgentStructuredSectionsPanel';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';
import type { IaSectionDiffPair } from './AIAgentStructuredSectionsPanel';
import type { RevisionBatchOp } from './textRevisionLinear';

export interface AIAgentLeftColumnProps {
  instanceId: string | undefined;
  showRightPanel: boolean;
  hasAgentGeneration: boolean;
  designDescription: string;
  onDesignDescriptionChange: (value: string) => void;
  composedRuntimeMarkdown: string;
  structuredSectionsState: StructuredSectionsRevisionState;
  onApplyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  iaRevisionDiffBySection: Partial<Record<AgentStructuredSectionId, IaSectionDiffPair>> | null;
  onDismissIaRevisionForSection: (sectionId: AgentStructuredSectionId) => void;
  generating: boolean;
  showPrimaryAgentAction: boolean;
  primaryAgentActionLabel: string;
  onGenerate: () => void;
  generateError: string | null;
}

export function AIAgentLeftColumn({
  instanceId,
  showRightPanel,
  hasAgentGeneration,
  designDescription,
  onDesignDescriptionChange,
  composedRuntimeMarkdown,
  structuredSectionsState,
  onApplyRevisionOps,
  iaRevisionDiffBySection,
  onDismissIaRevisionForSection,
  generating,
  showPrimaryAgentAction,
  primaryAgentActionLabel,
  onGenerate,
  generateError,
}: AIAgentLeftColumnProps) {
  const headerAction = showPrimaryAgentAction ? (
    <button
      type="button"
      disabled={generating}
      onClick={() => void onGenerate()}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
    >
      {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
      {generating ? 'Generating…' : primaryAgentActionLabel}
    </button>
  ) : null;

  return (
    <div
      className={`min-w-0 min-h-0 overflow-y-auto p-4 space-y-4 border-b lg:border-b-0 border-slate-800 flex-1 ${
        showRightPanel ? 'lg:border-r' : 'w-full'
      }`}
    >
      {!hasAgentGeneration ? (
        <AIAgentUnifiedPromptField
          mode="description"
          value={designDescription}
          onChange={onDesignDescriptionChange}
          readOnly={generating}
          headerAction={headerAction}
          instanceId={instanceId}
          iaRevisionDiff={null}
          onDismissIaRevisionDiff={() => {}}
          promptBaseText=""
          deletedMask={[]}
          inserts={[]}
          onApplyRevisionOps={() => {}}
        />
      ) : (
        <>
          <section>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Descrizione task (contesto refine)
            </label>
            <textarea
              className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 p-3 text-sm font-mono text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
              value={designDescription}
              onChange={(e) => onDesignDescriptionChange(e.target.value)}
              readOnly={generating}
              spellCheck
            />
          </section>
          <AIAgentStructuredSectionsPanel
            instanceId={instanceId}
            runtimeMarkdown={composedRuntimeMarkdown}
            sectionsState={structuredSectionsState}
            readOnly={generating}
            onApplyRevisionOps={onApplyRevisionOps}
            iaRevisionDiffBySection={iaRevisionDiffBySection}
            onDismissIaRevisionForSection={onDismissIaRevisionForSection}
            headerAction={headerAction}
          />
        </>
      )}

      {generateError ? (
        <div className="rounded-md bg-red-950/50 border border-red-800 text-red-200 text-sm px-3 py-2">
          {generateError}
        </div>
      ) : null}
    </div>
  );
}
