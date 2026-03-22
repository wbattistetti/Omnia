/**
 * Design-time shell for AI Agent tasks: composes column layout, toolbar wiring, and editor hooks.
 * Domain logic lives under `./aiAgentEditor/`; this file stays a thin orchestrator.
 */
import React from 'react';
import type { EditorProps } from '../types';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { useAIProvider } from '@context/AIProviderContext';
import { Bot } from 'lucide-react';
import { AI_AGENT_HEADER_COLOR } from './aiAgentEditor/constants';
import { AIAgentLeftColumn } from './aiAgentEditor/AIAgentLeftColumn';
import { AIAgentRightPanel } from './aiAgentEditor/AIAgentRightPanel';
import { useAIAgentEditorController } from './aiAgentEditor/useAIAgentEditorController';
import { useAIAgentToolbarController } from './aiAgentEditor/useAIAgentToolbarController';

export default function AIAgentEditor({ task, onToolbarUpdate, hideHeader }: EditorProps) {
  const instanceId = task.instanceId || task.id;
  const pdUpdate = useProjectDataUpdate();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;
  const { provider, model } = useAIProvider();

  const c = useAIAgentEditorController({
    instanceId,
    projectId,
    provider,
    model,
  });

  const { primaryAgentActionLabel } = useAIAgentToolbarController({
    task,
    hideHeader,
    onToolbarUpdate,
    hasAgentGeneration: c.hasAgentGeneration,
  });

  const headerColor = AI_AGENT_HEADER_COLOR;

  const showRightPanel =
    c.hasAgentGeneration ||
    c.proposedFields.length > 0 ||
    c.agentPrompt.trim().length > 0;

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {!hideHeader && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 shrink-0"
          style={{ borderLeftColor: headerColor, borderLeftWidth: 4 }}
        >
          <Bot size={20} style={{ color: headerColor }} />
          <span className="font-semibold">AI Agent (design-time)</span>
          <span className="text-xs text-slate-500 ml-auto">Task {c.instanceId}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <AIAgentLeftColumn
          instanceId={c.instanceId}
          showRightPanel={showRightPanel}
          hasAgentGeneration={c.hasAgentGeneration}
          designDescription={c.designDescription}
          onDesignDescriptionChange={c.setDesignDescription}
          composedRuntimeMarkdown={c.composedRuntimeMarkdown}
          structuredSectionsState={c.structuredSectionsState}
          onApplyRevisionOps={c.applyRevisionOps}
          iaRevisionDiffBySection={c.iaRevisionDiffBySection}
          onDismissIaRevisionForSection={c.dismissIaRevisionForSection}
          generating={c.generating}
          showPrimaryAgentAction={c.showPrimaryAgentAction}
          primaryAgentActionLabel={primaryAgentActionLabel}
          onGenerate={c.handleGenerate}
          generateError={c.generateError}
        />
        {showRightPanel ? (
          <AIAgentRightPanel
            rightPanelTab={c.rightPanelTab}
            onRightPanelTabChange={c.setRightPanelTab}
            showUseCaseComposerTab={c.hasAgentGeneration}
            logicalSteps={c.logicalSteps}
            useCases={c.useCases}
            setUseCases={c.setUseCases}
            useCaseComposerBusy={c.useCaseComposerBusy}
            useCaseComposerError={c.useCaseComposerError}
            onClearUseCaseComposerError={c.clearUseCaseComposerError}
            onGenerateUseCaseBundle={c.handleGenerateUseCaseBundle}
            onRegenerateUseCase={c.handleRegenerateUseCase}
            onRegenerateUseCaseTurn={c.handleRegenerateUseCaseTurn}
            primaryAgentActionLabel={primaryAgentActionLabel}
            proposedFields={c.proposedFields}
            outputVariableMappings={c.outputVariableMappings}
            onUpdateProposedField={c.updateProposedField}
            onProposedLabelBlur={c.syncFlowVariableFromLabel}
            previewStyleId={c.previewStyleId}
            onPreviewStyleIdChange={c.setPreviewStyleId}
            previewTurns={c.previewByStyle[c.previewStyleId] ?? []}
            onPreviewTurnsChange={(next) =>
              c.setPreviewByStyle((prev) => ({ ...prev, [c.previewStyleId]: next }))
            }
          />
        ) : null}
      </div>
    </div>
  );
}
