import React, { useEffect } from 'react';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { ContractUpdateDialog } from '@responseEditor/ContractUpdateDialog';
import EditorHeader from '@components/common/EditorHeader';
import TaskDragLayer from '@responseEditor/TaskDragLayer';
import { FontProvider, useFontContext } from '@context/FontContext';
import { ToolbarButton } from '@dock/types';
import { ResponseEditorLayout } from '@responseEditor/components/ResponseEditorLayout';
import { useResponseEditor } from '@responseEditor/hooks/useResponseEditor';
import { validateTaskTreeStructure } from '@responseEditor/core/domain/validators';
import { useWizardIntegration } from '@responseEditor/hooks/useWizardIntegration';
import { WizardContext } from '@responseEditor/context/WizardContext';
import { WizardMode } from '../../../../TaskBuilderAIWizard/types/WizardMode';
import { useWizardModeTransition } from '@responseEditor/hooks/useWizardModeTransition';
import { useTaskTreeFromStore, useTaskTreeVersion } from '@responseEditor/core/state';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

import type { TaskMeta } from '@taskEditor/EditorHost/types';
import type { Task, TaskTree } from '@types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose, saveDecisionMade, onOpenSaveDialog }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void, saveDecisionMade?: boolean, onOpenSaveDialog?: () => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();

  // ✅ ARCHITECTURE: taskWizardMode is now SINGLE SOURCE OF TRUTH in Context
  // No more local state, no more derives, no more synchronization
  // taskWizardMode comes from useResponseEditorCore (which reads from taskMeta)
  // All components read from Context via useResponseEditorContext()

  // ✅ FIX: Ref per il pulsante save-to-library - creato qui e passato a useResponseEditor
  const saveToLibraryButtonRef = React.useRef<HTMLButtonElement>(null);

  // ✅ State per save location dialog
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [effectiveSaveDecisionMade, setEffectiveSaveDecisionMade] = React.useState(saveDecisionMade || false);

  // ✅ Handler per aprire dialog
  const handleOpenSaveDialog = React.useCallback(() => {
    setShowSaveDialog(true);
  }, []);

  // Validate TaskTree structure on mount/update
  useEffect(() => {
    if (taskTree) {
      try {
        validateTaskTreeStructure(taskTree, 'ResponseEditor');
      } catch (error) {
        // Error is logged but doesn't crash the app - allows graceful degradation
      }
    }
  }, [taskTree]);

  // ✅ FASE 3.1: Use main composite hook FIRST
  // This hook calls useResponseEditorCore which is the SINGLE SOURCE OF TRUTH for taskLabel
  const editor = useResponseEditor({
    taskTree,
    task,
    isTaskTreeLoading,
    onWizardComplete,
    currentProjectId,
    tabId,
    setDockTree,
    onClose,
    hideHeader,
    onToolbarUpdate,
    registerOnClose,
    // ✅ REMOVED: shouldBeGeneral - now from WizardContext
    saveDecisionMade: effectiveSaveDecisionMade,
    onOpenSaveDialog: handleOpenSaveDialog,
    // ✅ FIX: Pass ref per il pulsante save-to-library
    saveToLibraryButtonRef: saveToLibraryButtonRef,
  });

  // ✅ ARCHITECTURE: taskLabel comes ONLY from useResponseEditorCore (via editor.taskLabel)
  // NO FALLBACKS - NO CALCULATIONS - NO READINGS FROM taskTree OR task
  // If taskLabel is empty, it means useResponseEditorCore hasn't processed taskMeta yet
  // This is handled in ResponseEditorLayout with loading UI
  const taskLabel = editor.taskLabel || '';

  // ✅ ARCHITECTURE: taskWizardMode is SINGLE SOURCE OF TRUTH from useResponseEditorCore
  // No local state, no derives - just use editor.taskWizardMode directly
  const taskWizardMode = editor.taskWizardMode;

  // ✅ For wizard, use taskLabel from editor (which comes from useResponseEditorCore)
  // ✅ FIX: Preserva wizardIntegrationRaw anche quando taskWizardMode diventa 'none' se shouldBeGeneral era true
  const previousWizardIntegrationRef = React.useRef<any>(null);

  // ✅ FIX: Determina se dobbiamo preservare wizardIntegration basandoci sul ref (che mantiene lo stato precedente)
  const shouldPreserveWizardIntegration = previousWizardIntegrationRef.current?.shouldBeGeneral === true;

  const taskLabelForWizard = (taskWizardMode === 'full' || shouldPreserveWizardIntegration)
    ? (taskLabel || undefined)
    : undefined;
  // ✅ FIX: Usa sempre task.id (che è sempre row.id) quando task esiste
  // Quando taskWizardMode === 'full', task può essere TaskMeta (che ha id = row.id)
  // Per costruzione: task.id = row.id (sempre)
  // ✅ CRITICAL: rowId MUST be available when wizard mode is 'full'
  const rowIdForWizard = (taskWizardMode === 'full' || shouldPreserveWizardIntegration) && task
    ? task.id  // ✅ ALWAYS equals row.id (task can be TaskMeta or Task, both have id)
    : undefined;

  // ✅ DEBUG: Log per verificare che rowId sia disponibile
  if (taskWizardMode === 'full' && !rowIdForWizard) {
    console.error('[ResponseEditor] ❌ CRITICAL: rowIdForWizard is undefined when taskWizardMode === "full"', {
      taskWizardMode,
      task,
      taskId: task?.id,
      taskLabel,
    });
  }
  const projectIdForWizard = (taskWizardMode === 'full' || shouldPreserveWizardIntegration)
    ? currentProjectId || undefined
    : undefined;
  const localeForWizard = 'it';

  // ✅ DEBUG: Log per verificare che rowId sia disponibile
  if (taskWizardMode === 'full' && !rowIdForWizard) {
    console.error('[ResponseEditor] ❌ CRITICAL: rowIdForWizard is undefined when taskWizardMode === "full"', {
      taskWizardMode,
      task,
      taskId: task?.id,
      taskLabel,
      shouldPreserveWizardIntegration,
    });
  }

  const wizardIntegrationRaw = useWizardIntegration(
    taskLabelForWizard, // ✅ From editor.taskLabel (single source of truth)
    rowIdForWizard, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    projectIdForWizard,
    localeForWizard,
    onWizardComplete // ✅ CORRETTO: usa onWizardComplete dalla prop
  );

  // ✅ FIX: Mantieni riferimento al wizardIntegrationRaw precedente per preservare shouldBeGeneral
  // ✅ IMPORTANTE: Aggiorna il ref SEMPRE quando wizardIntegrationRaw ha shouldBeGeneral === true
  // Questo garantisce che anche se wizardIntegrationRaw diventa null, manteniamo lo stato precedente
  React.useEffect(() => {
    if (wizardIntegrationRaw?.shouldBeGeneral) {
      previousWizardIntegrationRef.current = wizardIntegrationRaw;
    }
    // ✅ Se wizardIntegrationRaw è null o shouldBeGeneral è false, mantieni il valore precedente nel ref
  }, [wizardIntegrationRaw]);

  // ✅ FIX: Mantieni wizardIntegration anche dopo completamento se shouldBeGeneral è true
  // ✅ IMPORTANTE: Se shouldBeGeneral è true, wizardIntegration deve rimanere disponibile anche quando taskWizardMode è 'none'
  // ✅ PROBLEMA: Quando taskLabel diventa undefined, useWizardIntegration crea una nuova istanza di useWizardState
  // che resetta shouldBeGeneral a false. Devo preservare shouldBeGeneral leggendolo da dataSchema[0]?.shouldBeGeneral
  // che viene salvato durante la generazione.
  const wizardIntegration = React.useMemo(() => {
    // ✅ PRIORITÀ 1: Se wizardIntegrationRaw ha shouldBeGeneral === true, mantieni sempre wizardIntegrationRaw
    // anche quando taskWizardMode === 'none'
    if (wizardIntegrationRaw?.shouldBeGeneral) {
      // ✅ Aggiorna il ref immediatamente (non aspettare useEffect)
      previousWizardIntegrationRef.current = wizardIntegrationRaw;
      return wizardIntegrationRaw;
    }

    // ✅ PRIORITÀ 1.5: Se dataSchema[0] ha shouldBeGeneral === true, ricostruisci wizardIntegrationRaw.shouldBeGeneral
    // Questo accade quando useWizardIntegration viene chiamato con taskLabel undefined e resetta lo stato
    // ma dataSchema[0] mantiene il valore originale di shouldBeGeneral
    if (wizardIntegrationRaw?.dataSchema?.[0]?.shouldBeGeneral === true) {
      // ✅ Ricrea wizardIntegrationRaw con shouldBeGeneral corretto usando dataSchema[0]
      const preservedWizardIntegration = {
        ...wizardIntegrationRaw,
        shouldBeGeneral: true, // ✅ Ricostruito da dataSchema[0]?.shouldBeGeneral
        generalizedLabel: wizardIntegrationRaw.dataSchema[0].generalizedLabel || null,
        generalizationReason: wizardIntegrationRaw.dataSchema[0].generalizationReason || null,
        generalizedMessages: wizardIntegrationRaw.dataSchema[0].generalizedMessages || null,
      };
      // ✅ Aggiorna il ref per preservare lo stato anche in futuro
      previousWizardIntegrationRef.current = preservedWizardIntegration;
      return preservedWizardIntegration;
    }

    // ✅ PRIORITÀ 2: Se il ref precedente aveva shouldBeGeneral === true, usalo (preserva stato)
    // Questo garantisce che anche se wizardIntegrationRaw diventa null, manteniamo lo stato
    if (previousWizardIntegrationRef.current?.shouldBeGeneral) {
      return previousWizardIntegrationRef.current;
    }

    // ✅ PRIORITÀ 3: Se wizard è attivo, usa wizardIntegrationRaw
    if (taskWizardMode === 'full') {
      return wizardIntegrationRaw;
    }

    // ✅ Altrimenti, null
    return null;
  }, [taskWizardMode, wizardIntegrationRaw]);

  // ✅ REMOVED: Debug log che causava loop infinito

  // ✅ REMOVED: effectiveShouldBeGeneral, generalizedLabel, generalizedMessages, generalizationReason
  // ✅ These are now read from WizardContext in components that need them

  // ✅ ARCHITECTURE: Monitor wizard completion and update Context (SINGLE SOURCE OF TRUTH)
  // No local state, no derives - update Context directly via editor.setTaskWizardMode
  // ✅ CRITICAL: Use taskTreeFromStore instead of taskTree prop
  // The taskTree in store is updated when onTaskBuilderComplete is called
  const taskTreeFromStore = useTaskTreeFromStore();
  const taskTreeVersion = useTaskTreeVersion(); // ✅ NEW: Force re-render when store updates
  const shouldTransitionToNone = useWizardModeTransition(
    taskWizardMode,
    wizardIntegration?.wizardMode,
    taskTreeFromStore, // ✅ Use taskTreeFromStore instead of taskTree prop
    wizardIntegration?.pipelineSteps,
    taskTreeVersion // ✅ NEW: Pass version to force recalculation when store updates
  );

  React.useEffect(() => {
    if (shouldTransitionToNone && taskWizardMode === 'full') {
      // ✅ ARCHITECTURE: Update Context directly (updates state in useResponseEditorCore)
      editor.setTaskWizardMode('none');
    }
  }, [shouldTransitionToNone, taskWizardMode, editor]);

  // ✅ B1: WizardContext value (only when wizard is active OR shouldBeGeneral is true) - calculated here to avoid race condition
  // ✅ FIX: Usa useMemo con dipendenze MINIME - solo quelle che determinano se il context deve esistere
  // I valori interni vengono letti direttamente da wizardIntegration (che è stabile grazie al useMemo precedente)
  const wizardContextValue = React.useMemo(() => {
    if (!wizardIntegration) {
      return null;
    }
    // ✅ FIX: Mantieni WizardContext anche dopo completamento se shouldBeGeneral è true
    if (taskWizardMode !== 'full' && !wizardIntegration.shouldBeGeneral) {
      return null;
    }

    // ✅ Leggi valori direttamente da wizardIntegration (non usarli come dipendenze)
    return {
      wizardMode: wizardIntegration.wizardMode || WizardMode.START,
      currentStep: wizardIntegration.currentStep || 'idle',
      dataSchema: wizardIntegration.dataSchema || [],
      pipelineSteps: wizardIntegration.pipelineSteps || [],
      showStructureConfirmation: wizardIntegration.showStructureConfirmation || false,
      structureConfirmed: wizardIntegration.structureConfirmed || false,
      showCorrectionMode: wizardIntegration.showCorrectionMode || false,
      correctionInput: wizardIntegration.correctionInput || '',
      setCorrectionInput: wizardIntegration.setCorrectionInput || (() => { }),
      shouldBeGeneral: wizardIntegration.shouldBeGeneral || false,
      generalizedLabel: wizardIntegration.generalizedLabel || null,
      generalizedMessages: wizardIntegration.generalizedMessages || null,
      generalizationReason: wizardIntegration.generalizationReason || null,
      // ✅ Wizard handlers
      handleStructureConfirm: wizardIntegration.handleStructureConfirm || (async () => { }),
      handleStructureReject: wizardIntegration.handleStructureReject || (() => { }),
      runGenerationPipeline: wizardIntegration.runGenerationPipeline || (async () => { }),
      // ✅ Wizard module handlers
      onProceedFromEuristica: wizardIntegration.onProceedFromEuristica || (async () => { }),
      onShowModuleList: wizardIntegration.onShowModuleList || (() => { }),
      onSelectModule: wizardIntegration.onSelectModule || (async () => { }),
      onPreviewModule: wizardIntegration.onPreviewModule || (() => { }),
      availableModules: wizardIntegration.availableModules || [],
      foundModuleId: wizardIntegration.foundModuleId ?? undefined,
      // ✅ Sotto-stati
      currentParserSubstep: wizardIntegration.currentParserSubstep || null,
      currentMessageSubstep: wizardIntegration.currentMessageSubstep || null,
    };
  }, [
    // ✅ FIX: SOLO dipendenze che determinano se il context deve esistere
    // wizardIntegration è già stabilizzato dal useMemo precedente
    wizardIntegration,
    taskWizardMode,
  ]);

  // ✅ ARCHITECTURE: Pass only necessary props (no monolithic editor object)
  // ✅ B1: Wrap ResponseEditorLayout with WizardContext.Provider to avoid race condition
  const layoutContent = (
    <ResponseEditorLayout
      combinedClass={combinedClass}
      hideHeader={hideHeader}
      // ✅ NOTE: taskTree, currentProjectId, taskMeta, taskLabel are still passed
      // for Context initialization (ResponseEditorLayout PROVIDES the Context, so it needs these values)
      // taskLabel comes ONLY from useResponseEditorCore (editor.taskLabel) - NO FALLBACKS
      taskTree={taskTree}
      currentProjectId={currentProjectId}
      taskMeta={task as TaskMeta | null}
      taskLabel={taskLabel} // ✅ SINGLE SOURCE: from useResponseEditorCore via editor.taskLabel
      rootRef={editor.rootRef}
      icon={editor.icon}
      iconColor={editor.iconColor}
      headerTitle={editor.headerTitle}
      toolbarButtons={editor.toolbarButtons}
      handleEditorClose={editor.handleEditorClose}
      isGeneralizable={editor.isGeneralizable}
      generalizationReason={editor.generalizationReason}
      showContractWizard={editor.showContractWizard}
      handleContractWizardClose={editor.handleContractWizardClose}
      handleContractWizardNodeUpdate={editor.handleContractWizardNodeUpdate}
      handleContractWizardComplete={editor.handleContractWizardComplete}
      needsIntentMessages={editor.needsIntentMessages}
      handleIntentMessagesComplete={editor.handleIntentMessagesComplete}
      // ✅ REMOVED: taskMeta duplicate (already passed above at line 147)
      mainList={editor.mainList}
      localTranslations={editor.localTranslations}
      escalationTasks={editor.escalationTasks}
      selectedMainIndex={editor.selectedMainIndex}
      selectedSubIndex={editor.selectedSubIndex}
      selectedRoot={editor.selectedRoot}
      selectedNode={editor.selectedNode}
      selectedNodePath={editor.selectedNodePath}
      handleSelectMain={editor.handleSelectMain}
      handleSelectSub={editor.handleSelectSub}
      handleSelectAggregator={editor.handleSelectAggregator}
      sidebarRef={editor.sidebarRef}
      sidebar={editor.sidebar}
      handleParserCreate={editor.handleParserCreate}
      handleParserModify={editor.handleParserModify}
      handleEngineChipClick={editor.handleEngineChipClick}
      handleGenerateAll={editor.handleGenerateAll}
      isAggregatedAtomic={editor.isAggregatedAtomic}
      sidebarManualWidth={editor.sidebarManualWidth}
      isDraggingSidebar={editor.isDraggingSidebar}
      showMessageReview={editor.showMessageReview}
      showSynonyms={editor.showSynonyms}
      selectedIntentIdForTraining={editor.selectedIntentIdForTraining}
      setSelectedIntentIdForTraining={editor.setSelectedIntentIdForTraining}
      pendingEditorOpen={editor.pendingEditorOpen}
      contractChangeRef={editor.contractChangeRef}
      taskType={editor.taskType}
      handleProfileUpdate={editor.handleProfileUpdate}
      updateSelectedNode={editor.updateSelectedNode}
      leftPanelMode={editor.leftPanelMode}
      testPanelMode={editor.testPanelMode}
      tasksPanelMode={editor.tasksPanelMode}
      rightWidth={editor.rightWidth}
      testPanelWidth={editor.testPanelWidth}
      tasksPanelWidth={editor.tasksPanelWidth}
      draggingPanel={editor.draggingPanel}
      setDraggingPanel={editor.setDraggingPanel}
      setRightWidth={editor.setRightWidth}
      setTestPanelWidth={editor.setTestPanelWidth}
      setTasksPanelWidth={editor.setTasksPanelWidth}
      tasksStartWidthRef={editor.tasksStartWidthRef}
      tasksStartXRef={editor.tasksStartXRef}
      replaceSelectedTaskTree={editor.replaceSelectedTaskTree}
      serviceUnavailable={editor.serviceUnavailable}
      setServiceUnavailable={editor.setServiceUnavailable}
      showContractDialog={editor.showContractDialog}
      pendingContractChange={editor.pendingContractChange}
      contractDialogHandlers={editor.contractDialogHandlers}
      taskWizardMode={editor.taskWizardMode}
      setTaskWizardMode={editor.setTaskWizardMode} // ✅ ARCHITECTURE: For Context single source of truth
      needsTaskContextualization={editor.needsTaskContextualization}
      needsTaskBuilder={editor.needsTaskBuilder}
      contextualizationTemplateId={editor.contextualizationTemplateId}
      // ✅ REMOVED: taskLabel duplicate (already passed above)
      onTaskContextualizationComplete={editor.onTaskContextualizationComplete}
      onTaskBuilderComplete={editor.onTaskBuilderComplete}
      onTaskBuilderCancel={editor.onTaskBuilderCancel}
      onToolbarUpdate={onToolbarUpdate}
      // ✅ REMOVED: shouldBeGeneral, generalizedLabel, generalizedMessages, generalizationReason - now from WizardContext
      saveDecisionMade={effectiveSaveDecisionMade}
      onOpenSaveDialog={handleOpenSaveDialog}
      showSaveDialog={showSaveDialog}
      setShowSaveDialog={setShowSaveDialog}
      setSaveDecisionMade={setEffectiveSaveDecisionMade}
      wizardIntegration={wizardIntegration}
      originalLabel={editor.headerTitle} // ✅ SINGLE SOURCE: Use headerTitle from editor (node row label)
      // ✅ FIX: Pass ref per il pulsante save-to-library
      saveToLibraryButtonRef={saveToLibraryButtonRef}
    />
  );

  // ✅ B1: Wrap with WizardContext.Provider if wizard is active
  if (wizardContextValue) {
    return (
      <WizardContext.Provider value={wizardContextValue}>
        {layoutContent}
      </WizardContext.Provider>
    );
  }

  return layoutContent;
}

export default function ResponseEditor({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose, saveDecisionMade, onOpenSaveDialog }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void, saveDecisionMade?: boolean, onOpenSaveDialog?: () => void }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FontProvider>
        <ResponseEditorInner taskTree={taskTree} onClose={onClose} onWizardComplete={onWizardComplete} task={task} isTaskTreeLoading={isTaskTreeLoading} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} tabId={tabId} setDockTree={setDockTree} registerOnClose={registerOnClose} saveDecisionMade={saveDecisionMade} onOpenSaveDialog={onOpenSaveDialog} />
      </FontProvider>
    </div>
  );
}