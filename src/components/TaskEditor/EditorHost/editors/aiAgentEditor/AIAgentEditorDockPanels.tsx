/**
 * Pannelli usati dal `AIAgentConstructionWizardShell`. Storicamente erano pannelli
 * Dockview registrati per nome nello shell esterno; oggi sono semplici React component
 * istanziati direttamente dal renderer dello step wizard. Il file è rimasto qui per
 * minimizzare il diff post-unificazione layout.
 */

import React from 'react';
import { FontProvider } from '@context/FontContext';
import { AIAgentStructuredSectionsPanel } from './AIAgentStructuredSectionsPanel';
import { AIAgentProposedFieldsTable } from './AIAgentProposedFieldsTable';
import { AIAgentUseCaseComposer } from './AIAgentUseCaseComposer';
import { resolveUseCaseBundleGeneratingLabel } from '@domain/aiAgentUseCase/useCaseBundleChunkConfig';
import { ViewSkaGenerator } from './useCaseGeneratorWizard/ViewSkaGenerator';
import { ConversationsBubbleView } from './useCaseGeneratorWizard/ConversationsBubbleView';
import { useStyleGateFlash } from './useCaseGeneratorWizard/ConversationsStyleGate';
import {
  ConversationStyleEditor,
  ConversationStyleToolbar,
} from './useCaseGeneratorWizard/ConversationStyleEditor';
import {
  conversationMatchesStyleId,
  countConversationsByStyleId,
  firstInvalidCheckedStyle,
  hasAnyCheckedStyle,
  listCheckedStyleIds,
} from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import { InlineStylePillEditor } from './useCaseGeneratorWizard/ConversationStyleEditor';
import { UseCaseWizardListToolbarProvider } from './useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import { AI_AGENT_GLOBAL_USE_CASE_STYLES, AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER } from './constants';
import {
  mergeUseCaseGlobalStyleContract,
  parseStyleContractToLearningNotes,
} from './mergeUseCaseGlobalStyleContract';
import {
  conversationalRulesToUseCases,
  useCasesToConversationalRules,
} from '@domain/conversationalRules/ruleUseCaseMapping';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';
import { DesignDescriptionTextarea } from './DesignDescriptionTextarea';
import { ProjectDerivedBackendsSection } from '@components/BackendCatalog/ProjectDerivedBackendsSection';
import { KnowledgeBaseViewer } from '@components/knowledgeBase/KnowledgeBaseViewer';
import { EditorBackendsPanel } from './EditorBackendsPanel';
import { tutorIdProps, UI_IDS } from './activeTutor/uiIds';

/**
 * Wizard step 1 — un singolo Dockview (single-pane) le cui tab sono:
 *   - "Descrizione" (sempre): textarea libera in linguaggio naturale.
 *   - Tab strutturate (solo dopo Crea Agente): Scopo, Sequenza, Contesto,
 *     Vincoli, Personalità, Tono, Esempi, … + Prompt Finale.
 *
 * Pre-Crea Agente la lista è ridotta a una sola tab ("Descrizione"), così
 * l'utente parte dalla forma libera. Dopo la creazione l'AI scompone la
 * descrizione nelle sezioni e il dock fa apparire alla destra di "Descrizione"
 * tutte le tab strutturate. L'utente vede sempre **una tab attiva alla volta**
 * (no split visibile imposto), mantenendo continuità con il vecchio layout
 * `AIAgentLeftColumn`.
 */
export function EditorUnifiedDescriptionPanel() {
  const {
    instanceId,
    generating,
    hasAgentGeneration,
    composedRuntimeMarkdown,
    structuredSectionsState,
    onApplyRevisionOps,
    onApplyOtCommit,
    onUndoSection,
    onRedoSection,
    structuredOtEnabled,
    iaRevisionDiffBySection,
    onDismissIaRevisionForSection,
  } = useAIAgentEditorDock();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 bg-teal-950/25 border-l-4 border-teal-500/55">
      <AIAgentStructuredSectionsPanel
        instanceId={instanceId}
        runtimeMarkdown={composedRuntimeMarkdown}
        sectionsState={structuredSectionsState}
        readOnly={generating}
        onApplyRevisionOps={onApplyRevisionOps}
        onApplyOtCommit={onApplyOtCommit}
        onUndoSection={onUndoSection}
        onRedoSection={onRedoSection}
        structuredOtEnabled={structuredOtEnabled}
        iaRevisionDiffBySection={iaRevisionDiffBySection}
        onDismissIaRevisionForSection={onDismissIaRevisionForSection}
        embeddedDock
        includeDescriptionLeadingTab
        omitStructuredSections={!hasAgentGeneration}
      />
    </div>
  );
}

export function EditorTaskDescriptionPanel() {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden p-3 bg-teal-950/25 border-l-4 border-teal-500/55 space-y-2">
      <DesignDescriptionTextarea
        containerClassName="flex min-h-0 flex-1 flex-col"
        className="w-full flex-1 min-h-[200px] rounded-md bg-slate-900 border border-slate-700 p-3 text-sm font-mono text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed resize-none"
      />
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
    <div
      {...tutorIdProps(UI_IDS.datiPanel)}
      className="h-full min-h-0 flex flex-col overflow-hidden p-3 bg-slate-100/95 dark:bg-slate-950/80"
    >
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

export function EditorUseCasesPanel({
  forcedCatalogMode,
}: {
  forcedCatalogMode?: 'prompts' | 'error_handling';
} = {}) {
  const {
    instanceId,
    logicalSteps,
    useCases,
    setUseCases,
    conversationalRules,
    setConversationalRules,
    useCaseCatalogMode,
    useCaseComposerBusy,
    useCaseBundleGenerationBusy,
    useCaseBundleGenerationCount,
    useCaseBundleGenerationOrdering,
    useCaseBundleGenerationCategorizing,
    useCaseKbDialogGenerationBusy = false,
    useCaseCategories,
    setUseCaseCategories,
    useCasePhraseStylePropagationBusy,
    useCasePhraseStyleBatchProgress,
    useCaseCreationMessage,
    useCaseComposerError,
    onClearUseCaseComposerError,
    onCreateUseCase,
    onSplitRootUseCaseDraft,
    onRootUseCaseBatchCreated,
    onCreateConversationalRule,
    onRegenerateUseCase,
    onGeneralizeUseCaseMeta,
    onPolishUseCaseScenario,
    onRegenerateAgentMessage,
    onAnnotateAgentMessageForJson,
    onDeleteUseCase,
    onDeleteConversationalRule,
    onUseCaseInvalidationNoteChange,
    onUseCaseInvalidationStateChange,
    useCaseGlobalStyleId,
    setUseCaseGlobalStyleId,
    agentUseCaseStyleLearningNotes,
    setAgentUseCaseStyleLearningNotes,
    agentStartPromptConfig,
    setAgentStartPromptConfig,
    agentStartUseCaseId,
    setAgentStartUseCaseId,
    agentLogUseCase,
    previewStyleId,
    setPreviewStyleId,
    hasAgentGeneration,
    showRightPanel,
    generating,
    onGenerateUseCaseBundle,
    onGenerateKbDialogUseCases,
    kbDeterministicMode = false,
    useCaseGeneratorWizard,
    useCaseBundleFeedback,
    onDismissUseCaseBundleFeedback,
    useCaseHighlightIds,
    onClearUseCaseHighlight,
    onPropagateExamplePhraseStyle,
    onCompleteCorrection,
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
    projectSlotLexicon,
    compileMappingBanner,
    slotMappingOpenRequestNonce,
    approveLexiconSurface,
    revokeLexiconSurface,
    updateLexiconSlotId,
    designDescription,
    knowledgeBaseDocuments,
    backendPlaceholders,
  } = useAIAgentEditorDock();

  const emptyTutorGenerateContext = React.useMemo(
    () => ({
      hasDesignDescription: designDescription.trim().length > 0,
      hasKbDocuments: knowledgeBaseDocuments.length > 0,
      hasBackend: backendPlaceholders.length > 0,
    }),
    [designDescription, knowledgeBaseDocuments.length, backendPlaceholders.length]
  );

  const showGenerateCta = hasAgentGeneration && showRightPanel;
  const useWizardShell = Boolean(hasAgentGeneration && showRightPanel && useCaseGeneratorWizard);
  const isErrorHandlingCatalog =
    forcedCatalogMode === 'error_handling' ||
    (forcedCatalogMode == null && useCaseCatalogMode === 'error_handling');

  const catalogUseCases = React.useMemo(
    () =>
      isErrorHandlingCatalog
        ? conversationalRulesToUseCases(conversationalRules)
        : useCases,
    [isErrorHandlingCatalog, conversationalRules, useCases]
  );

  const setCatalogUseCases = React.useCallback(
    (action: React.SetStateAction<AIAgentUseCase[]>) => {
      if (!isErrorHandlingCatalog) {
        setUseCases(action);
        return;
      }
      setConversationalRules((prevRules) => {
        const prevById = new Map(prevRules.map((r) => [r.id, r]));
        const prevAsUseCases = conversationalRulesToUseCases(prevRules);
        const nextUseCases =
          typeof action === 'function' ? action(prevAsUseCases) : action;
        return useCasesToConversationalRules(nextUseCases, prevById);
      });
    },
    [isErrorHandlingCatalog, setUseCases, setConversationalRules]
  );

  const catalogOnCreate = isErrorHandlingCatalog ? onCreateConversationalRule : onCreateUseCase;
  const catalogOnDelete = isErrorHandlingCatalog ? onDeleteConversationalRule : onDeleteUseCase;
  const noopRegenerate = React.useCallback(async () => null, []);

  const useCaseComposerBlockingBusy =
    useCaseComposerBusy ||
    useCaseBundleGenerationBusy ||
    useCaseBundleGenerationCategorizing ||
    useCaseKbDialogGenerationBusy ||
    useCasePhraseStylePropagationBusy;

  const bundleGenerateBusyLabel = useCaseBundleGenerationBusy
    ? resolveUseCaseBundleGeneratingLabel(
        useCaseBundleGenerationCount,
        useCaseBundleGenerationOrdering,
        useCaseBundleGenerationCategorizing
      )
    : undefined;

  const baseUseCaseStyleContract = React.useMemo(
    () =>
      AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === useCaseGlobalStyleId)?.contract ?? '',
    [useCaseGlobalStyleId]
  );

  const generationStyleContract = React.useMemo(
    () => mergeUseCaseGlobalStyleContract(baseUseCaseStyleContract, agentUseCaseStyleLearningNotes),
    [baseUseCaseStyleContract, agentUseCaseStyleLearningNotes]
  );

  const onGenerationStyleContractChange = React.useCallback(
    (next: string) => {
      setAgentUseCaseStyleLearningNotes(
        parseStyleContractToLearningNotes(next, baseUseCaseStyleContract)
      );
    },
    [baseUseCaseStyleContract, setAgentUseCaseStyleLearningNotes]
  );

  /**
   * Lift-up della selezione lista del composer: serve al pannello DX «Mostra JSON» per
   * proiettare in Monaco il JSON conversazionale dello use case attivo. Stato in memoria,
   * non persistito (la persistenza della selezione resta dentro il composer via
   * `sessionStorage`-based pending mechanism).
   */
  const [selectedUseCaseId, setSelectedUseCaseId] = React.useState<string | null>(null);
  const selectedUseCase = React.useMemo(
    () => catalogUseCases.find((u) => u.id === selectedUseCaseId) ?? null,
    [catalogUseCases, selectedUseCaseId]
  );

  /**
   * Set dei use case **esclusi** dalle conversazioni (toggle nell'header della lista). Filtro
   * di vista per `ConversationsBubbleView`: nasconde le bubble agent dei use case esclusi senza
   * cancellarle dallo storage. Memo: ricomputo solo se cambia il flag su qualche use case.
   */
  const excludedUseCaseIds = React.useMemo(
    () =>
      new Set(
        catalogUseCases
          .filter((u) => u.included_in_conversations === false)
          .map((u) => u.id)
      ),
    [catalogUseCases]
  );

  const composer = (
    <AIAgentUseCaseComposer
      editorTaskInstanceId={instanceId}
      logicalSteps={logicalSteps}
      useCases={catalogUseCases}
      setUseCases={setCatalogUseCases}
      composerCatalog={isErrorHandlingCatalog ? 'conversational_rules' : 'prompts'}
      busy={useCaseComposerBlockingBusy && !isErrorHandlingCatalog}
      creationMessage={isErrorHandlingCatalog ? null : useCaseCreationMessage}
      error={useCaseComposerError}
      onDismissError={onClearUseCaseComposerError}
      onCreateUseCase={catalogOnCreate}
      onSplitRootUseCaseDraft={
        isErrorHandlingCatalog
          ? async () => ({ labels: [], startLabel: null })
          : onSplitRootUseCaseDraft
      }
      onRootUseCaseBatchCreated={
        isErrorHandlingCatalog ? () => {} : onRootUseCaseBatchCreated
      }
      onRegenerateUseCase={isErrorHandlingCatalog ? noopRegenerate : onRegenerateUseCase}
      onGeneralizeUseCaseMeta={isErrorHandlingCatalog ? noopRegenerate : onGeneralizeUseCaseMeta}
      onPolishUseCaseScenario={
        isErrorHandlingCatalog ? noopRegenerate : onPolishUseCaseScenario
      }
      onRegenerateAgentMessage={
        isErrorHandlingCatalog ? async () => null : onRegenerateAgentMessage
      }
      onAnnotateAgentMessageForJson={
        isErrorHandlingCatalog ? async () => false : onAnnotateAgentMessageForJson
      }
      onDeleteUseCase={catalogOnDelete}
      onUseCaseInvalidationNoteChange={onUseCaseInvalidationNoteChange}
      onUseCaseInvalidationStateChange={onUseCaseInvalidationStateChange}
      useCaseGlobalStyleId={useCaseGlobalStyleId}
      onUseCaseGlobalStyleIdChange={setUseCaseGlobalStyleId}
      useCaseStyleLearningNotes={agentUseCaseStyleLearningNotes}
      onUseCaseStyleLearningNotesChange={setAgentUseCaseStyleLearningNotes}
      previewStyleId={previewStyleId}
      onPreviewStyleIdChange={setPreviewStyleId}
      onGenerateUseCaseBundle={
        isErrorHandlingCatalog ? undefined : onGenerateUseCaseBundle
      }
      onGenerateKbDialogUseCases={
        isErrorHandlingCatalog ? undefined : onGenerateKbDialogUseCases
      }
      kbDeterministicMode={kbDeterministicMode}
      kbDialogGenerateBusy={useCaseKbDialogGenerationBusy}
      generating={generating}
      bundleGenerateBusyLabel={bundleGenerateBusyLabel}
      useCaseBundleGenerationCount={useCaseBundleGenerationCount}
      useCaseBundleGenerationOrdering={useCaseBundleGenerationOrdering}
      bundleGenerationCategorizing={useCaseBundleGenerationCategorizing}
      emptyTutorGenerateContext={emptyTutorGenerateContext}
      useCaseCategories={useCaseCategories}
      onUseCaseCategoryLabelChange={(categoryId, label) => {
        setUseCaseCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? { ...c, label } : c))
        );
      }}
      onUseCaseCategoryDescriptionChange={(categoryId, description) => {
        setUseCaseCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId ? { ...c, description: description.trim() || undefined } : c
          )
        );
      }}
      highlightIds={useCaseHighlightIds}
      onClearUseCaseHighlight={onClearUseCaseHighlight}
      assistantPhraseStyleNewIds={assistantPhraseStyleNewIds}
      onAssistantPhraseDraftChange={onAssistantPhraseDraftChange}
      onCompleteCorrection={onCompleteCorrection}
      onSelectionChange={setSelectedUseCaseId}
      controlledSelectionId={selectedUseCaseId}
      showTokenizedAgentMessage={Boolean(useCaseGeneratorWizard?.showTokenizedInBubbles)}
      tokenizedByUseCaseId={tokenizedByUseCaseId}
      projectSlotLexicon={projectSlotLexicon}
      startPromptConfig={agentStartPromptConfig}
      onStartPromptConfigChange={setAgentStartPromptConfig}
      startUseCaseId={agentStartUseCaseId}
      onStartUseCaseIdChange={setAgentStartUseCaseId}
      includeLogInPromptExport={agentLogUseCase}
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
   * Filtro vista bubble post-generazione: `null` significa "nessuno stile visualizzabile",
   * non più "Tutti". La vista mostra solo lo stile checkato con glow nella toolbar.
   */
  const [conversationsFilterStyleId, setConversationsFilterStyleId] = React.useState<
    string | null
  >(null);
  /**
   * StyleId della pill in editing inline (matita on-hover sulla pill della toolbar).
   * `null` = nessun editor aperto. Quando valorizzato, l'editor della singola pill
   * viene renderizzato sopra le bubble nel pannello SX e le spinge giù; chiudendolo
   * (X) si torna alla vista bubble normale. Stato locale, non persistito.
   */
  const [pillEditorStyleId, setPillEditorStyleId] = React.useState<string | null>(null);
  const checkedStyleIds = React.useMemo(
    () => listCheckedStyleIds(agentConversationStyleSelections),
    [agentConversationStyleSelections]
  );
  const conversationsCountForStyleToolbar = useCaseGeneratorWizard?.conversations.length ?? 0;
  React.useEffect(() => {
    if (
      !useWizardShell ||
      !useCaseGeneratorWizard ||
      useCaseGeneratorWizard.currentStepId !== 'conversations' ||
      conversationsCountForStyleToolbar === 0
    ) {
      return;
    }
    if (checkedStyleIds.length === 0) {
      if (conversationsFilterStyleId !== null) setConversationsFilterStyleId(null);
      return;
    }
    if (
      conversationsFilterStyleId === null ||
      !checkedStyleIds.includes(conversationsFilterStyleId)
    ) {
      setConversationsFilterStyleId(checkedStyleIds[0] ?? null);
    }
  }, [
    checkedStyleIds,
    conversationsCountForStyleToolbar,
    conversationsFilterStyleId,
    useCaseGeneratorWizard,
    useWizardShell,
  ]);

  const wizardCatalogCount = catalogUseCases.length;

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
    const showBubbleView = isStepConversations && !isErrorHandlingCatalog;
    const conversationsCount = useCaseGeneratorWizard.conversations.length;
    const countByStyleId = countConversationsByStyleId(useCaseGeneratorWizard.conversations);

    /**
     * Costruzione del leftPanel — passo «Conversazione» (gate v2 multi-stile):
     *
     * - **Empty (no conversations)**: `ConversationStyleEditor` occupa TUTTO il pannello
     *   (full height, niente split, niente placeholder). Il pannello DX guida già il
     *   designer con la "Guida rapida" + i 3 pulsanti di generazione.
     * - **Con conversazioni**: niente editor stile nel pannello SX; rimangono solo le bubble.
     *   Le pill stile vivono nella toolbar contestuale sopra, dove checkbox = genera e glow = vista.
     *
     * Negli altri passi: composer (lista use case), come prima.
     */
    let leftPanel: React.ReactNode;
    if (showBubbleView) {
      /**
       * Bug fix (2026-05-13): il filtro vista DEVE coincidere con la classificazione
       * fatta da `listGeneratedStyleIds` / `countConversationsByStyleId`. Le conversazioni
       * legacy senza `styleId` vengono attribuite al default («Cortese»), quindi qui usiamo
       * `conversationMatchesStyleId` invece di un confronto stretto: altrimenti la pill
       * mostra «Cortese (1)» ma il pannello SX resta vuoto («Nessuna conversazione»).
       */
      const filteredConversations = conversationsFilterStyleId
        ? useCaseGeneratorWizard.conversations.filter((c) =>
            conversationMatchesStyleId(c, conversationsFilterStyleId)
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
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {/*
              Editor inline della pill: visibile SOLO quando l'utente clicca la matita
              su una pill nella toolbar. È un blocco shrink-0 che si espande SOPRA le
              bubble e le spinge giù (split, non sostituzione — vedi spec). La X chiude
              l'editor riportando alla vista bubble normale.
            */}
            {pillEditorStyleId ? (
              <div className="shrink-0 border-b border-sky-500/25 bg-sky-950/20">
                <InlineStylePillEditor
                  styleId={pillEditorStyleId}
                  selections={agentConversationStyleSelections}
                  onSelectionsChange={setAgentConversationStyleSelections}
                  auto={agentConversationStyleAuto}
                  onAutoChange={setAgentConversationStyleAuto}
                  payoffMessage={
                    styleFlash.payoffByStyleId?.[pillEditorStyleId] ?? null
                  }
                  onClose={() => setPillEditorStyleId(null)}
                />
              </div>
            ) : null}

            {checkedStyleIds.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs font-semibold text-rose-300">
                Spunta almeno uno stile nella toolbar per vedere o generare conversazioni.
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden">
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
            )}
          </div>
        );
      }
    } else {
      leftPanel = (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{composer}</div>
        </div>
      );
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
      <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100/95 dark:bg-slate-950/80">
        <FontProvider>
        <UseCaseWizardListToolbarProvider
          compileMappingBanner={compileMappingBanner}
          slotMappingOpenRequestNonce={slotMappingOpenRequestNonce}
        >
          <ViewSkaGenerator
            wizard={useCaseGeneratorWizard}
            leftPanel={leftPanel}
            onGenerateUseCaseBundle={
              !isErrorHandlingCatalog && showGenerateCta ? onGenerateUseCaseBundle : undefined
            }
            generateBusy={useCaseBundleGenerationBusy || generating}
            useCaseBundleGenerationCount={useCaseBundleGenerationCount}
            useCaseBundleGenerationOrdering={useCaseBundleGenerationOrdering}
            showStepOneListToolbar={wizardCatalogCount > 0}
            useCaseCount={wizardCatalogCount}
            onAdvanceWizardStep={() => useCaseGeneratorWizard.advanceToNextStep()}
            bundleFeedback={useCaseBundleFeedback}
            onDismissBundleFeedback={onDismissUseCaseBundleFeedback}
            onApplyExamplePhraseStyle={onPropagateExamplePhraseStyle}
            examplePhraseStyleBusy={useCasePhraseStylePropagationBusy}
            examplePhraseStyleBatchProgress={useCasePhraseStyleBatchProgress}
            onCreateConversation={wrappedAssembleConversation}
            createConversationBusy={assembleConversationBusy}
            conversationsPayoffMessage={styleFlash.payoffMessage}
            conversationsToolbarSlot={
              isStepConversations && conversationsCount > 0 ? (
                <ConversationStyleToolbar
                  selections={agentConversationStyleSelections}
                  onSelectionsChange={setAgentConversationStyleSelections}
                  visibleStyleId={conversationsFilterStyleId}
                  onVisibleStyleIdChange={setConversationsFilterStyleId}
                  editingStyleId={pillEditorStyleId}
                  onEditingStyleIdChange={setPillEditorStyleId}
                  countByStyleId={countByStyleId}
                  flashingStyleId={styleFlash.flashingStyleId}
                  payoffMessage={
                    checkedStyleIds.length === 0
                      ? 'Spunta almeno uno stile'
                      : styleFlash.payoffMessage
                  }
                />
              ) : null
            }
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
            useCases={catalogUseCases}
            projectSlotLexicon={projectSlotLexicon}
            onApproveLexiconEntry={approveLexiconSurface}
            onRevokeLexiconEntry={revokeLexiconSurface}
            onUpdateLexiconSlotId={updateLexiconSlotId}
            generationStyleContract={generationStyleContract}
            onGenerationStyleContractChange={onGenerationStyleContractChange}
            generationStyleFieldDisabled={useCaseComposerBlockingBusy}
          />
        </UseCaseWizardListToolbarProvider>
        </FontProvider>
      </div>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100/95 dark:bg-slate-950/80">
      <UseCaseWizardListToolbarProvider
        compileMappingBanner={compileMappingBanner}
        slotMappingOpenRequestNonce={slotMappingOpenRequestNonce}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{composer}</div>
      </UseCaseWizardListToolbarProvider>
    </div>
  );
}

/** Tab Backend — stesso pannello del wizard Omnia (EditorBackendsPanel). */
export function EditorBackendsTabPanel(): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100/95 dark:bg-slate-950/80">
      <EditorBackendsPanel {...({} as React.ComponentProps<typeof EditorBackendsPanel>)} />
    </div>
  );
}

/** Tab Conversation — stile conversazione + regole (catalogo error_handling). */
export function EditorConversationPanel(): React.ReactElement {
  const {
    instanceId,
    conversationalRules,
    setConversationalRules,
    agentConversationStyleAuto,
    setAgentConversationStyleAuto,
    agentConversationStyleSelections,
    setAgentConversationStyleSelections,
    agentUseCaseStyleLearningNotes,
    setAgentUseCaseStyleLearningNotes,
    useCaseComposerBusy,
    useCaseComposerError,
    onClearUseCaseComposerError,
    onCreateConversationalRule,
    onDeleteConversationalRule,
    useCaseGlobalStyleId,
    setUseCaseGlobalStyleId,
  } = useAIAgentEditorDock();

  const ruleUseCases = React.useMemo(
    () => conversationalRulesToUseCases(conversationalRules),
    [conversationalRules]
  );

  const setRuleUseCases = React.useCallback(
    (action: React.SetStateAction<typeof ruleUseCases>) => {
      setConversationalRules((prevRules) => {
        const prevAsUseCases = conversationalRulesToUseCases(prevRules);
        const nextAsUseCases =
          typeof action === 'function' ? action(prevAsUseCases) : action;
        const byId = new Map(prevRules.map((r) => [r.id, r]));
        return nextAsUseCases.map((uc, index) => {
          const prev = byId.get(uc.id);
          const assistantTurn = uc.dialogue?.find((t) => t.role === 'assistant');
          return {
            id: uc.id,
            libraryRuleId: prev?.libraryRuleId ?? null,
            label: uc.label,
            scenario: uc.payoff ?? uc.scenario?.llm ?? '',
            exampleMessage: assistantTurn?.content ?? '',
            sort_order: index,
            enabled: uc.included_in_conversations !== false,
          };
        });
      });
    },
    [setConversationalRules]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100/95 dark:bg-slate-950/80">
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
        <section className="rounded-lg border border-slate-700/80 bg-slate-900/40 p-3">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
            Stile conversazione
          </h2>
          <ConversationStyleEditor
            selections={agentConversationStyleSelections}
            onSelectionsChange={setAgentConversationStyleSelections}
            auto={agentConversationStyleAuto}
            onAutoChange={setAgentConversationStyleAuto}
          />
          <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Note stile (apprendimento)
          </label>
          <textarea
            className="mt-1 w-full min-h-[72px] rounded border border-slate-600 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
            value={agentUseCaseStyleLearningNotes}
            onChange={(e) => setAgentUseCaseStyleLearningNotes(e.target.value)}
            placeholder="Note per la prossima generazione…"
          />
        </section>

        {ruleUseCases.length > 0 ? (
          <section className="min-h-[240px] flex flex-col rounded-lg border border-slate-700/60 overflow-hidden">
            <h2 className="shrink-0 border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Regole conversazionali
            </h2>
            <div className="min-h-0 flex-1">
              <AIAgentUseCaseComposer
                editorTaskInstanceId={instanceId}
                logicalSteps={[]}
                useCases={ruleUseCases}
                setUseCases={setRuleUseCases}
                busy={useCaseComposerBusy}
                error={useCaseComposerError}
                onDismissError={onClearUseCaseComposerError}
                onCreateUseCase={async (params) =>
                  onCreateConversationalRule({
                    label: params.label,
                    parentId: params.parentId,
                    creationScope: params.creationScope,
                  })
                }
                onDeleteUseCase={(id) => onDeleteConversationalRule(id)}
                useCaseGlobalStyleId={useCaseGlobalStyleId}
                onUseCaseGlobalStyleIdChange={setUseCaseGlobalStyleId}
                useCaseStyleLearningNotes={agentUseCaseStyleLearningNotes}
                onUseCaseStyleLearningNotesChange={setAgentUseCaseStyleLearningNotes}
                composerCatalog="conversational_rules"
              />
            </div>
          </section>
        ) : (
          <p className="text-center text-sm text-slate-500">
            Nessuna regola conversazionale in questa review.
          </p>
        )}
      </div>
    </div>
  );
}

/** Wizard passo Error Handling — regole conversazionali trasversali. */
export function EditorErrorHandlingPanel() {
  return (
    <div {...tutorIdProps(UI_IDS.errorHandlingEditor)} className="h-full min-h-0 flex flex-col overflow-hidden">
      <EditorUseCasesPanel forcedCatalogMode="error_handling" />
    </div>
  );
}

/** Wizard passo Backend — vista Knowledge Base (documenti sul task corrente). */
export function EditorKnowledgeBasePanel() {
  const {
    generating,
    projectId,
    knowledgeBaseDocuments,
    knowledgeBaseAddFiles,
    knowledgeBaseRemoveDocument,
    knowledgeBaseUpdateDocument,
    knowledgeBaseReorderDocuments,
    knowledgeBaseCallMeta,
    knowledgeBaseTaskContext,
    registerKbAddDocumentPicker,
  } = useAIAgentEditorDock();

  return (
    <div
      {...tutorIdProps(UI_IDS.knowledgeBasePanel)}
      className="h-full min-h-0 flex flex-col overflow-hidden bg-violet-950/20 border-l-4 border-violet-500/50"
    >
      <KnowledgeBaseViewer
        className="min-h-0 flex-1"
        documents={knowledgeBaseDocuments}
        projectId={projectId}
        callMeta={knowledgeBaseCallMeta}
        taskContext={knowledgeBaseTaskContext}
        disabled={generating}
        onAddFiles={(files) => knowledgeBaseAddFiles(files)}
        onRemoveDocument={knowledgeBaseRemoveDocument}
        onReorderDocuments={knowledgeBaseReorderDocuments}
        onUpdateDocument={knowledgeBaseUpdateDocument}
        hideWorkspaceHeader
        onRegisterAddDocumentPicker={registerKbAddDocumentPicker}
        footerHint="I file sono nel repository progetto; l'analisi markdown resta sul task."
        tutorDocumentListId={UI_IDS.kbDocumentList}
        tutorAnalysisResultId={UI_IDS.kbAnalysisResult}
      />
    </div>
  );
}

