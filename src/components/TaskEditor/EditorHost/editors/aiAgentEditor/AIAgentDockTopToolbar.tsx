/**
 * Top toolbar above Dockview: Create/Refine agent + Genera use case (IA), aligned right.
 */

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';

export interface AIAgentDockTopToolbarProps {
  /** When false, hide "Genera use case" (no right column / use case UI). */
  showRightPanel: boolean;
}

export function AIAgentDockTopToolbar({ showRightPanel }: AIAgentDockTopToolbarProps) {
  const {
    hasAgentGeneration,
    headerAction,
    onGenerateUseCaseBundle,
    useCaseComposerBusy,
    generating,
  } = useAIAgentEditorDock();

  const showUseCaseGenerate = hasAgentGeneration && showRightPanel;
  if (!headerAction && !showUseCaseGenerate) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-1.5 z-10">
      {headerAction}
      {showUseCaseGenerate ? (
        <button
          type="button"
          disabled={useCaseComposerBusy || generating}
          onClick={() => void onGenerateUseCaseBundle()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white"
        >
          {useCaseComposerBusy ? (
            <Loader2 className="animate-spin" size={16} aria-hidden />
          ) : (
            <Sparkles size={16} aria-hidden />
          )}
          Genera use case (IA)
        </button>
      ) : null}
    </div>
  );
}
