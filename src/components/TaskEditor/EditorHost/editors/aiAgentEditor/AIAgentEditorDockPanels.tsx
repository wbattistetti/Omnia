/**
 * Dockview panel bodies for the outer AI Agent editor layout (registered by component name in AIAgentEditorDockShell).
 */

import React from 'react';
import { AIAgentUnifiedPromptField } from './AIAgentUnifiedPromptField';
import { AIAgentProposedFieldsTable } from './AIAgentProposedFieldsTable';
import { AIAgentUseCaseComposer } from './AIAgentUseCaseComposer';
import { ViewSkaGenerator } from './useCaseGeneratorWizard/ViewSkaGenerator';
import { ConversationsBubbleView } from './useCaseGeneratorWizard/ConversationsBubbleView';
import { UseCaseWizardListToolbarProvider } from './useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import { AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER } from './constants';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';
import { useBackendPathInsertMenu } from './useBackendPathInsertMenu';
import { ProjectDerivedBackendsSection } from '@components/BackendCatalog/ProjectDerivedBackendsSection';

export function EditorUnifiedDescriptionPanel() {
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

export function EditorTaskDescriptionPanel() {
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

export function EditorDatiPanel() {
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

export function EditorUseCasesPanel() {
  const {
    instanceId,
    logicalSteps,
    useCases,
    setUseCases,
    useCaseComposerBusy,
    useCaseBundleGenerationBusy,
    useCasePhraseStylePropagationBusy,
    useCasePhraseStyleBatchProgress,
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
    onAssembleConversation,
    assembleConversationBusy,
    onProofreadConversationAgentTurns,
    proofreadConversationBusy,
    onPromoteSuggestionToCatalog,
    onRejectSuggestion,
    onTokenizeUseCases,
    tokenizeUseCasesBusy,
    tokenizedByUseCaseId,
    onClearAllWizardOutput,
    onClearWizardConversations,
    onClearWizardTokenization,
  } = useAIAgentEditorDock();

  const showGenerateCta = hasAgentGeneration && showRightPanel;
  const useWizardShell = Boolean(hasAgentGeneration && showRightPanel && useCaseGeneratorWizard);

  const useCaseComposerBlockingBusy =
    useCaseComposerBusy ||
    useCaseBundleGenerationBusy ||
    useCasePhraseStylePropagationBusy;

  /**
   * Lift-up della selezione lista del composer: serve al pannello DX «Mostra JSON» per
   * proiettare in Monaco il JSON conversazionale dello use case attivo. Stato in memoria,
   * non persistito (la persistenza della selezione resta dentro il composer via
   * `sessionStorage`-based pending mechanism).
   */
  const [selectedUseCaseId, setSelectedUseCaseId] = React.useState<string | null>(null);
  const selectedUseCase = React.useMemo(
    () => useCases.find((u) => u.id === selectedUseCaseId) ?? null,
    [useCases, selectedUseCaseId]
  );

  /**
   * Set dei use case **esclusi** dalle conversazioni (toggle nell'header della lista). Filtro
   * di vista per `ConversationsBubbleView`: nasconde le bubble agent dei use case esclusi senza
   * cancellarle dallo storage. Memo: ricomputo solo se cambia il flag su qualche use case.
   */
  const excludedUseCaseIds = React.useMemo(
    () =>
      new Set(
        useCases.filter((u) => u.included_in_conversations === false).map((u) => u.id)
      ),
    [useCases]
  );

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
      onSelectionChange={setSelectedUseCaseId}
      controlledSelectionId={selectedUseCaseId}
      showTokenizedAgentMessage={Boolean(useCaseGeneratorWizard?.showTokenizedInBubbles)}
      tokenizedByUseCaseId={tokenizedByUseCaseId}
    />
  );

  if (useWizardShell && useCaseGeneratorWizard) {
    const currentStepId = useCaseGeneratorWizard.currentStepId;
    const isStepConversations = currentStepId === 'conversations';
    /**
     * v8: rimossa la vista dedicata «TokenizationListView» nel pannello SX al Passo 3.
     * Razionale: la tokenizzazione è già visibile (a) nelle bubble del Passo 2 col toggle
     * «Mostra Tokens», (b) come overlay implicito del messaggio canonico nello use case
     * body (l'AI ri-tokenizza la frase canonica). Al Passo 3 quindi il pannello SX resta
     * il composer (stesso del Passo 1) e l'azione «Tokenizza» vive solo nel pannello DX
     * tutorial (TokenizationStepReviewCard). Riduce ridondanza percepita e mantiene la
     * lista canonica sempre accessibile durante la pipeline.
     *
     * v6: rimosso il toggle Riga 2 «usecases / conversazioni». Al Passo 2 la vista è
     * sempre la bubble chat. Se il designer vuole rivedere la lista canonica, clicca
     * sullo step 1 della pipeline.
     */
    const showBubbleView = isStepConversations;

    const leftPanel: React.ReactNode = showBubbleView ? (
      <ConversationsBubbleView
        conversations={useCaseGeneratorWizard.conversations}
        activeConversationId={useCaseGeneratorWizard.activeConversationId}
        onUpdateTurnText={useCaseGeneratorWizard.updateConversationTurnText}
        modifiedAgentTurnKeysByConversation={
          useCaseGeneratorWizard.conversationStylePlan.modifiedByConversation
        }
        onPromoteSuggestion={onPromoteSuggestionToCatalog}
        onRejectSuggestion={onRejectSuggestion}
        showTokenized={useCaseGeneratorWizard.showTokenizedInBubbles}
        tokenizedByUseCaseId={tokenizedByUseCaseId}
        excludedUseCaseIds={excludedUseCaseIds}
      />
    ) : (
      composer
    );

    const tokenizedUseCaseCount = useCases.reduce(
      (n, u) =>
        typeof u.assistant_example_tokenized === 'string' && u.assistant_example_tokenized
          ? n + 1
          : n,
      0
    );
    const tokenizationHasManualEdits = Object.values(
      useCaseGeneratorWizard.tokenizationDiffByUseCaseId
    ).some(Boolean);

    return (
      <div className="h-full min-h-0 overflow-hidden flex flex-col bg-slate-950/80">
        <UseCaseWizardListToolbarProvider>
          <ViewSkaGenerator
            wizard={useCaseGeneratorWizard}
            leftPanel={leftPanel}
            onGenerateUseCaseBundle={showGenerateCta ? onGenerateUseCaseBundle : undefined}
            generateBusy={useCaseBundleGenerationBusy || generating}
            showStepOneListToolbar={useCases.length > 0}
            useCaseCount={useCases.length}
            onAdvanceWizardStep={() => useCaseGeneratorWizard.advanceToNextStep()}
            bundleFeedback={useCaseBundleFeedback}
            onDismissBundleFeedback={onDismissUseCaseBundleFeedback}
            onApplyExamplePhraseStyle={onPropagateExamplePhraseStyle}
            examplePhraseStyleBusy={useCasePhraseStylePropagationBusy}
            examplePhraseStyleBatchProgress={useCasePhraseStyleBatchProgress}
            onCreateConversation={onAssembleConversation}
            createConversationBusy={assembleConversationBusy}
            onProofreadConversationAgentTurns={onProofreadConversationAgentTurns}
            proofreadConversationBusy={proofreadConversationBusy}
            onTokenizeUseCases={onTokenizeUseCases}
            tokenizeUseCasesBusy={tokenizeUseCasesBusy}
            tokenizedUseCaseCount={tokenizedUseCaseCount}
            tokenizationHasManualEdits={tokenizationHasManualEdits}
            onClearAllWizardOutput={onClearAllWizardOutput}
            onClearWizardConversations={onClearWizardConversations}
            onClearWizardTokenization={onClearWizardTokenization}
            selectedUseCase={selectedUseCase}
            onSelectUseCaseRequest={setSelectedUseCaseId}
            useCases={useCases}
          />
        </UseCaseWizardListToolbarProvider>
      </div>
    );
  }

  return <div className="h-full min-h-0 overflow-hidden flex flex-col bg-slate-950/80">{composer}</div>;
}
