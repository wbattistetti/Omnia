/**
 * Dockview panel bodies for the outer AI Agent editor layout (registered by component name in AIAgentEditorDockShell).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { AIAgentUnifiedPromptField } from './AIAgentUnifiedPromptField';
import { AIAgentProposedFieldsTable } from './AIAgentProposedFieldsTable';
import { AIAgentUseCaseComposer } from './AIAgentUseCaseComposer';
import { AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER } from './constants';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';
import { useBackendPathInsertMenu } from './useBackendPathInsertMenu';

export function EditorUnifiedDescriptionPanel(_props: IDockviewPanelProps) {
  const {
    instanceId,
    designDescription,
    setDesignDescription,
    generating,
    insertBackendPathInDesign,
  } = useAIAgentEditorDock();

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3 space-y-3 bg-teal-950/25 border-l-4 border-teal-500/55">
      <AIAgentUnifiedPromptField
        mode="description"
        value={designDescription}
        onChange={setDesignDescription}
        readOnly={generating}
        insertBackendPathInDesign={insertBackendPathInDesign}
        instanceId={instanceId}
        iaRevisionDiff={null}
        onDismissIaRevisionDiff={() => {}}
        promptBaseText=""
        deletedMask={[]}
        inserts={[]}
        onApplyRevisionOps={() => {}}
      />
    </div>
  );
}

export function EditorTaskDescriptionPanel(_props: IDockviewPanelProps) {
  const { designDescription, setDesignDescription, generating, insertBackendPathInDesign } =
    useAIAgentEditorDock();
  const descRef = React.useRef<HTMLTextAreaElement | null>(null);

  const onInsert = React.useCallback(
    (path: string, s: number, e: number) => {
      insertBackendPathInDesign(path, s, e);
    },
    [insertBackendPathInDesign]
  );

  const { onContextMenu, backendPathMenu } = useBackendPathInsertMenu({
    enabled: true,
    readOnly: generating,
    inputRef: descRef,
    onInsert,
  });

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden p-3 bg-teal-950/25 border-l-4 border-teal-500/55 space-y-2">
      <textarea
        ref={descRef}
        className="w-full flex-1 min-h-[200px] rounded-md bg-slate-900 border border-slate-700 p-3 text-sm font-mono text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed resize-none"
        placeholder={AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER}
        aria-label="Descrizione"
        value={designDescription}
        onChange={(e) => setDesignDescription(e.target.value)}
        readOnly={generating}
        spellCheck
        onContextMenu={onContextMenu}
      />
      {backendPathMenu}
    </div>
  );
}

export function EditorDatiPanel(_props: IDockviewPanelProps) {
  const {
    primaryAgentActionLabel,
    proposedFields,
    outputVariableMappings,
    onUpdateProposedField,
    onRemoveProposedField,
    onProposedLabelBlur,
  } = useAIAgentEditorDock();

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden p-3 bg-slate-950/80">
      {proposedFields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
          Usa {primaryAgentActionLabel} per popolare i dati da raccogliere.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AIAgentProposedFieldsTable
            fields={proposedFields}
            outputVariableMappings={outputVariableMappings}
            onUpdateField={onUpdateProposedField}
            onRemoveField={onRemoveProposedField}
            onLabelBlur={onProposedLabelBlur}
          />
        </div>
      )}
    </div>
  );
}

export function EditorUseCasesPanel(_props: IDockviewPanelProps) {
  const {
    logicalSteps,
    useCases,
    setUseCases,
    useCaseComposerBusy,
    useCaseComposerError,
    onClearUseCaseComposerError,
    onRegenerateUseCase,
    previewStyleId,
    setPreviewStyleId,
    hasAgentGeneration,
    showRightPanel,
    generating,
    onGenerateUseCaseBundle,
  } = useAIAgentEditorDock();

  const showGenerateCta = hasAgentGeneration && showRightPanel;

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col bg-slate-950/80">
      <AIAgentUseCaseComposer
        logicalSteps={logicalSteps}
        useCases={useCases}
        setUseCases={setUseCases}
        busy={useCaseComposerBusy}
        error={useCaseComposerError}
        onDismissError={onClearUseCaseComposerError}
        onRegenerateUseCase={onRegenerateUseCase}
        previewStyleId={previewStyleId}
        onPreviewStyleIdChange={setPreviewStyleId}
        onGenerateUseCaseBundle={showGenerateCta ? onGenerateUseCaseBundle : undefined}
        generating={generating}
      />
    </div>
  );
}
