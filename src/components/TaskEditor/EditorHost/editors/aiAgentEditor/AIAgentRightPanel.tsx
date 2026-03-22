/**
 * Right column: tabs for proposed fields, chat preview, and (after first agent generation) use case composer.
 */

import React from 'react';
import { GitBranch, ListTree, MessageSquare } from 'lucide-react';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import { AIAgentPreviewChatPanel } from './AIAgentPreviewChatPanel';
import { AIAgentProposedFieldsTable } from './AIAgentProposedFieldsTable';
import { AIAgentUseCaseComposer } from './AIAgentUseCaseComposer';

export interface AIAgentRightPanelProps {
  rightPanelTab: 'variables' | 'chat' | 'usecases';
  onRightPanelTabChange: (tab: 'variables' | 'chat' | 'usecases') => void;
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
  previewStyleId: string;
  onPreviewStyleIdChange: (id: string) => void;
  previewTurns: AIAgentPreviewTurn[];
  onPreviewTurnsChange: (next: AIAgentPreviewTurn[]) => void;
}

export function AIAgentRightPanel({
  rightPanelTab,
  onRightPanelTabChange,
  primaryAgentActionLabel,
  proposedFields,
  outputVariableMappings,
  onUpdateProposedField,
  onProposedLabelBlur,
  previewStyleId,
  onPreviewStyleIdChange,
  previewTurns,
  onPreviewTurnsChange,
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
  return (
    <div className="w-full lg:w-[min(44%,520px)] xl:w-[min(42%,560px)] shrink-0 flex flex-col min-h-[280px] lg:min-h-0 bg-slate-900/40">
      <div className="flex border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => onRightPanelTabChange('variables')}
          className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-medium transition-colors ${
            rightPanelTab === 'variables'
              ? 'text-violet-300 border-b-2 border-violet-500 bg-slate-900/60'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ListTree size={16} />
          dati
        </button>
        <button
          type="button"
          onClick={() => onRightPanelTabChange('chat')}
          className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-medium transition-colors ${
            rightPanelTab === 'chat'
              ? 'text-violet-300 border-b-2 border-violet-500 bg-slate-900/60'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MessageSquare size={16} />
          anteprima
        </button>
        {showUseCaseComposerTab ? (
          <button
            type="button"
            onClick={() => onRightPanelTabChange('usecases')}
            className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-medium transition-colors ${
              rightPanelTab === 'usecases'
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
        {rightPanelTab === 'variables' ? (
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
        ) : rightPanelTab === 'chat' ? (
          <AIAgentPreviewChatPanel
            selectedStyleId={previewStyleId}
            onStyleIdChange={onPreviewStyleIdChange}
            turns={previewTurns}
            onTurnsChange={onPreviewTurnsChange}
            emptyPlaceholder={
              <div className="h-full min-h-[160px] rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-sm text-slate-500 px-4 text-center">
                Nessuna simulazione ancora. Usa {primaryAgentActionLabel} e apri questa scheda per vedere tono e
                sequenza delle domande.
              </div>
            }
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
