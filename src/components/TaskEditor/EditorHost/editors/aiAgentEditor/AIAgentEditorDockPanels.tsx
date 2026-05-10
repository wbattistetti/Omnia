/**
 * Dockview panel bodies for the outer AI Agent editor layout (registered by component name in AIAgentEditorDockShell).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { AIAgentUnifiedPromptField } from './AIAgentUnifiedPromptField';
import { AIAgentProposedFieldsTable } from './AIAgentProposedFieldsTable';
import { AIAgentUseCaseComposer } from './AIAgentUseCaseComposer';
import { ViewSkaGenerator } from './useCaseGeneratorWizard/ViewSkaGenerator';
import { UseCaseWizardListToolbarProvider } from './useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import { AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER } from './constants';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';
import { useBackendPathInsertMenu } from './useBackendPathInsertMenu';
import { ProjectDerivedBackendsSection } from '@components/BackendCatalog/ProjectDerivedBackendsSection';

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
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {proposedFields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            Usa {primaryAgentActionLabel} per popolare i dati da raccogliere.
          </div>
        ) : (
          <AIAgentProposedFieldsTable
            fields={proposedFields}
            outputVariableMappings={outputVariableMappings}
            onUpdateField={onUpdateProposedField}
            onRemoveField={onRemoveProposedField}
            onLabelBlur={onProposedLabelBlur}
          />
        )}
        <ProjectDerivedBackendsSection />
      </div>
    </div>
  );
}

export function EditorUseCasesPanel(_props: IDockviewPanelProps) {
  const {
    instanceId,
    logicalSteps,
    useCases,
    setUseCases,
    useCaseComposerBusy,
    useCaseBundleGenerationBusy,
    useCasePhraseStylePropagationBusy,
    useCaseCreationMessage,
    useCaseComposerError,
    onClearUseCaseComposerError,
    onCreateUseCase,
    onRegenerateUseCase,
    onRegenerateAgentMessage,
    onAnnotateAgentMessageForJson,
    onDeleteUseCase,
    useCaseGlobalStyleId,
    setUseCaseGlobalStyleId,
    previewStyleId,
    setPreviewStyleId,
    hasAgentGeneration,
    showRightPanel,
    generating,
    onGenerateUseCaseBundle,
    useCaseGeneratorWizard,
    useCaseBundleFeedback,
    onDismissUseCaseBundleFeedback,
    useCaseHighlightIds,
    onClearUseCaseHighlight,
    onPropagateExamplePhraseStyle,
    assistantPhraseStyleNewIds,
    onAssistantPhraseDraftChange,
  } = useAIAgentEditorDock();

  const showGenerateCta = hasAgentGeneration && showRightPanel;
  const useWizardShell = Boolean(hasAgentGeneration && showRightPanel && useCaseGeneratorWizard);

  const useCaseComposerBlockingBusy =
    useCaseComposerBusy ||
    useCaseBundleGenerationBusy ||
    useCasePhraseStylePropagationBusy;

  const composer = (
    <AIAgentUseCaseComposer
      editorTaskInstanceId={instanceId}
      logicalSteps={logicalSteps}
      useCases={useCases}
      setUseCases={setUseCases}
      busy={useCaseComposerBlockingBusy}
      creationMessage={useCaseCreationMessage}
      error={useCaseComposerError}
      onDismissError={onClearUseCaseComposerError}
      onCreateUseCase={onCreateUseCase}
      onRegenerateUseCase={onRegenerateUseCase}
      onRegenerateAgentMessage={onRegenerateAgentMessage}
      onAnnotateAgentMessageForJson={onAnnotateAgentMessageForJson}
      onDeleteUseCase={onDeleteUseCase}
      useCaseGlobalStyleId={useCaseGlobalStyleId}
      onUseCaseGlobalStyleIdChange={setUseCaseGlobalStyleId}
      previewStyleId={previewStyleId}
      onPreviewStyleIdChange={setPreviewStyleId}
      onGenerateUseCaseBundle={
        useWizardShell ? undefined : showGenerateCta ? onGenerateUseCaseBundle : undefined
      }
      generating={generating}
      primaryGenerateOnRightOnly={useWizardShell}
      highlightIds={useCaseHighlightIds}
      onClearUseCaseHighlight={onClearUseCaseHighlight}
      assistantPhraseStyleNewIds={assistantPhraseStyleNewIds}
      onAssistantPhraseDraftChange={onAssistantPhraseDraftChange}
    />
  );

  if (useWizardShell && useCaseGeneratorWizard) {
    return (
      <div className="h-full min-h-0 overflow-hidden flex flex-col bg-slate-950/80">
        <UseCaseWizardListToolbarProvider>
          <ViewSkaGenerator
            wizard={useCaseGeneratorWizard}
            leftPanel={composer}
            onGenerateUseCaseBundle={showGenerateCta ? onGenerateUseCaseBundle : undefined}
            generateBusy={useCaseBundleGenerationBusy || generating}
            showStepOneListToolbar={useCases.length > 0}
            useCaseCount={useCases.length}
            onAdvanceWizardStep={() => useCaseGeneratorWizard.advanceToNextStep()}
            bundleFeedback={useCaseBundleFeedback}
            onDismissBundleFeedback={onDismissUseCaseBundleFeedback}
            onApplyExamplePhraseStyle={onPropagateExamplePhraseStyle}
            examplePhraseStyleBusy={useCasePhraseStylePropagationBusy}
          />
        </UseCaseWizardListToolbarProvider>
      </div>
    );
  }

  return <div className="h-full min-h-0 overflow-hidden flex flex-col bg-slate-950/80">{composer}</div>;
}
