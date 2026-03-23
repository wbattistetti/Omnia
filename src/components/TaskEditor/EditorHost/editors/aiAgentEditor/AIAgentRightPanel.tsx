/**
 * Right column: proposed fields + (after first agent generation) use case composer with per-scenario chat.
 * Tab chrome is delegated to AIAgentRightPanelShell for a future dockable layout swap.
 */

import React from 'react';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import { AIAgentProposedFieldsTable } from './AIAgentProposedFieldsTable';
import { AIAgentUseCaseComposer } from './AIAgentUseCaseComposer';
import type { AIAgentRightPanelTab } from './aiAgentRightPanelTab';
import { AIAgentRightPanelShell } from './AIAgentRightPanelShell';

export interface AIAgentRightPanelProps {
  rightPanelTab: AIAgentRightPanelTab;
  onRightPanelTabChange: (tab: AIAgentRightPanelTab) => void;
  showUseCaseComposerTab: boolean;
  logicalSteps: readonly AIAgentLogicalStep[];
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  useCaseComposerBusy: boolean;
  useCaseComposerError: string | null;
  onClearUseCaseComposerError: () => void;
  onGenerateUseCaseBundle: () => void | Promise<void>;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void>;
  onRegenerateUseCaseTurn: (useCaseId: string, turnId: string) => void | Promise<void>;
  primaryAgentActionLabel: string;
  proposedFields: AIAgentProposedVariable[];
  outputVariableMappings: Record<string, string>;
  onUpdateProposedField: (fieldName: string, patch: Partial<AIAgentProposedVariable>) => void;
  onProposedLabelBlur: (fieldName: string, labelTrimmed: string) => void;
}

export function AIAgentRightPanel({
  rightPanelTab,
  onRightPanelTabChange,
  primaryAgentActionLabel,
  proposedFields,
  outputVariableMappings,
  onUpdateProposedField,
  onProposedLabelBlur,
  showUseCaseComposerTab,
  logicalSteps,
  useCases,
  setUseCases,
  useCaseComposerBusy,
  useCaseComposerError,
  onClearUseCaseComposerError,
  onGenerateUseCaseBundle,
  onRegenerateUseCase,
  onRegenerateUseCaseTurn,
}: AIAgentRightPanelProps) {
  const variablesPanel = (
    <div className="space-y-2">
      {proposedFields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
          Usa {primaryAgentActionLabel} per popolare i dati da raccogliere.
        </div>
      ) : (
        <AIAgentProposedFieldsTable
          fields={proposedFields}
          outputVariableMappings={outputVariableMappings}
          onUpdateField={onUpdateProposedField}
          onLabelBlur={onProposedLabelBlur}
        />
      )}
    </div>
  );

  const useCasePanel = (
    <AIAgentUseCaseComposer
      logicalSteps={logicalSteps}
      useCases={useCases}
      setUseCases={setUseCases}
      busy={useCaseComposerBusy}
      error={useCaseComposerError}
      onDismissError={onClearUseCaseComposerError}
      onGenerateBundle={onGenerateUseCaseBundle}
      onRegenerateUseCase={onRegenerateUseCase}
      onRegenerateTurn={onRegenerateUseCaseTurn}
      primaryAgentActionLabel={primaryAgentActionLabel}
    />
  );

  return (
    <div className="w-full lg:w-[min(44%,520px)] xl:w-[min(42%,560px)] shrink-0 flex flex-col min-h-[280px] lg:min-h-0 bg-slate-900/40">
      <AIAgentRightPanelShell
        activeTab={rightPanelTab}
        onTabChange={onRightPanelTabChange}
        showUseCaseTab={showUseCaseComposerTab}
        variablesPanel={variablesPanel}
        useCasePanel={useCasePanel}
      />
    </div>
  );
}
