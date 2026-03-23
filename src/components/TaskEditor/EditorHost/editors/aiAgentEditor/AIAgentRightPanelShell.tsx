/**
 * Tab bar + active panel for the AI Agent right column (layout shell; no domain logic).
 */

import React from 'react';
import { GitBranch, ListTree } from 'lucide-react';
import type { AIAgentRightPanelTab } from './aiAgentRightPanelTab';

export interface AIAgentRightPanelShellProps {
  activeTab: AIAgentRightPanelTab;
  onTabChange: (tab: AIAgentRightPanelTab) => void;
  showUseCaseTab: boolean;
  variablesPanel: React.ReactNode;
  useCasePanel: React.ReactNode;
}

export function AIAgentRightPanelShell({
  activeTab,
  onTabChange,
  showUseCaseTab,
  variablesPanel,
  useCasePanel,
}: AIAgentRightPanelShellProps) {
  const effectiveTab: AIAgentRightPanelTab =
    !showUseCaseTab && activeTab === 'usecases' ? 'variables' : activeTab;

  return (
    <>
      <div className="flex border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => onTabChange('variables')}
          className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-medium transition-colors ${
            effectiveTab === 'variables'
              ? 'text-violet-300 border-b-2 border-violet-500 bg-slate-900/60'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ListTree size={16} />
          dati
        </button>
        {showUseCaseTab ? (
          <button
            type="button"
            onClick={() => onTabChange('usecases')}
            className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-medium transition-colors ${
              effectiveTab === 'usecases'
                ? 'text-violet-300 border-b-2 border-violet-500 bg-slate-900/60'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <GitBranch size={16} />
            use case
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {effectiveTab === 'variables' ? variablesPanel : useCasePanel}
      </div>
    </>
  );
}
