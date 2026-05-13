/**
 * Pannelli usati dal `AIAgentConstructionWizardShell`. Storicamente erano pannelli
 * Dockview registrati per nome nello shell esterno; oggi sono semplici React component
 * istanziati direttamente dal renderer dello step wizard. Il file è rimasto qui per
 * minimizzare il diff post-unificazione layout.
 */

import React from 'react';
import { AIAgentUnifiedPromptField } from './AIAgentUnifiedPromptField';
import { AIAgentProposedFieldsTable } from './AIAgentProposedFieldsTable';
import { AIAgentUseCaseComposer } from './AIAgentUseCaseComposer';
import { ViewSkaGenerator } from './useCaseGeneratorWizard/ViewSkaGenerator';
import { ConversationsBubbleView } from './useCaseGeneratorWizard/ConversationsBubbleView';
import { useStyleGateFlash } from './useCaseGeneratorWizard/ConversationsStyleGate';
import { ConversationStyleEditor } from './useCaseGeneratorWizard/ConversationStyleEditor';
import { ConversationStyleSelector } from './useCaseGeneratorWizard/ConversationStyleSelector';
import {
  countConversationsByStyleId,
  firstInvalidCheckedStyle,
  hasAnyCheckedStyle,
  listGeneratedStyleIds,
} from '@domain/aiAgentConversationStyle/conversationStyleSelections';
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
    agentConversationStyleAuto,
    setAgentConversationStyleAuto,
    agentConversationStyleSelections,
    setAgentConversationStyleSelections,
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

  /**
   * **Gate di stile v2 (multi-pill)** — passo «Conversazione»:
   *  - `firstInvalidCheckedStyle` identifica la prima pill con problemi (descrizione vuota
   *    o esempio mancante con auto OFF). Se nessuna è checkata, `null`.
   *  - Click sui pulsanti di generazione: il wrapper qui sotto blocca la chiamata se il gate
   *    è chiuso (nessuna pill checkata OPPURE almeno una pill checkata invalida) e attiva il
   *    flash mirato sulla pill colpevole.
   *  - `clearFlash()` in effetto: se le selezioni cambiano e il gate torna OK, il flash
   *    viene resettato.
   */
  const styleFlash = useStyleGateFlash();
  const styleHasCandidates = hasAnyCheckedStyle(agentConversationStyleSelections);
  const firstInvalidStyleId = firstInvalidCheckedStyle(
    agentConversationStyleSelections,
    agentConversationStyleAuto
  );
  const styleGateOpen = styleHasCandidates && firstInvalidStyleId === null;
  React.useEffect(() => {
    if (styleGateOpen) {
      styleFlash.clearFlash();
    }
  }, [styleGateOpen, styleFlash]);

  /**
   * Wrapper del callback di creazione conversazione: rispetta il gate v2 multi-stile.
   *
   * - Se nessuna pill è checkata → flash globale + payoff "Devi prima scegliere uno stile…".
   * - Se almeno una pill checkata è invalida → flash mirato sulla pill colpevole (la PRIMA
   *   in ordine registry) + payoff localizzato sul suo editor.
   * - Altrimenti → delega all'originale, che farà N chiamate parallele (vedi
   *   `runAssembleConversation` in `AIAgentEditor.tsx`).
   */
  const wrappedAssembleConversation = React.useCallback(
    (params: { outcome: 'positive' | 'negative'; allowSuggestedUseCases: boolean }) => {
      if (!styleHasCandidates) {
        styleFlash.triggerFlash({
          message: 'Spunta almeno uno stile a sinistra prima di generare.',
        });
        return;
      }
      if (firstInvalidStyleId) {
        const isAuto = agentConversationStyleAuto;
        const message = isAuto
          ? 'Compila la descrizione dello stile prima di generare.'
          : 'Inserisci almeno un esempio di dialogo per questo stile.';
        styleFlash.triggerFlash({ targetStyleId: firstInvalidStyleId, message });
        return;
      }
      return onAssembleConversation(params);
    },
    [
      styleHasCandidates,
      firstInvalidStyleId,
      agentConversationStyleAuto,
      styleFlash,
      onAssembleConversation,
    ]
  );

  /**
   * Filtro vista sopra le bubble: stile selezionato (locale, non persistito).
   * Default `null` = mostra «Tutti» — coerente con la lista di stili oggi presente.
   * Se il selettore mostra un solo stile, la sua selezione è implicita ma il filtro
   * resta `null` per non confondere il designer.
   */
  const [conversationsFilterStyleId, setConversationsFilterStyleId] = React.useState<
    string | null
  >(null);

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
    const conversationsCount = useCaseGeneratorWizard.conversations.length;

    /**
     * Costruzione del leftPanel — passo «Conversazione» (gate v2 multi-stile):
     *
     * - **Empty (no conversations)**: `ConversationStyleEditor` occupa TUTTO il pannello
     *   (full height, niente split, niente placeholder). Il pannello DX guida già il
     *   designer con la "Guida rapida" + i 3 pulsanti di generazione.
     * - **Con conversazioni**: split verticale — editor stili sopra (compatto, ~40%)
     *   con eventuale `ConversationStyleSelector` (filtro vista) + bubble sotto (~60%).
     *
     * Negli altri passi: composer (lista use case), come prima.
     */
    let leftPanel: React.ReactNode;
    if (showBubbleView) {
      const generatedStyleIds = listGeneratedStyleIds(useCaseGeneratorWizard.conversations);
      const countByStyleId = countConversationsByStyleId(useCaseGeneratorWizard.conversations);
      const filteredConversations = conversationsFilterStyleId
        ? useCaseGeneratorWizard.conversations.filter(
            (c) =>
              c.styleId === conversationsFilterStyleId ||
              (conversationsFilterStyleId === '__legacy__' && !c.styleId)
          )
        : useCaseGeneratorWizard.conversations;

      const styleEditorNode = (
        <ConversationStyleEditor
          selections={agentConversationStyleSelections}
          onSelectionsChange={setAgentConversationStyleSelections}
          auto={agentConversationStyleAuto}
          onAutoChange={setAgentConversationStyleAuto}
          flashingStyleId={styleFlash.flashingStyleId}
          payoffMessageByStyleId={styleFlash.payoffByStyleId}
        />
      );

      if (conversationsCount === 0) {
        leftPanel = (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {styleEditorNode}
          </div>
        );
      } else {
        leftPanel = (
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-[2] flex-col overflow-hidden border-b border-sky-500/15">
              {styleEditorNode}
            </div>
            <div className="flex min-h-0 flex-[3] flex-col overflow-hidden">
              {generatedStyleIds.length > 1 ? (
                <div className="shrink-0 border-b border-sky-500/15 bg-slate-950/50 px-3 py-1.5">
                  <ConversationStyleSelector
                    label="Mostra:"
                    value={conversationsFilterStyleId}
                    onChange={setConversationsFilterStyleId}
                    availableStyleIds={generatedStyleIds}
                    countByStyleId={countByStyleId}
                    includeAllOption
                  />
                </div>
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ConversationsBubbleView
                  conversations={filteredConversations}
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
              </div>
            </div>
          </div>
        );
      }
    } else {
      leftPanel = composer;
    }

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
            onCreateConversation={wrappedAssembleConversation}
            createConversationBusy={assembleConversationBusy}
            conversationsPayoffMessage={styleFlash.payoffMessage}
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
