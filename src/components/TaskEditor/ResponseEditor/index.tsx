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
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

import type { TaskMeta } from '@taskEditor/EditorHost/types';
import type { Task, TaskTree } from '@types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose, saveDecisionMade, onOpenSaveDialog }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void, saveDecisionMade?: boolean, onOpenSaveDialog?: () => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();

  // ✅ 1️⃣ Chiama useWizardIntegration UNA SOLA VOLTA qui
  // Determina taskWizardMode e parametri per il wizard
  const taskWizardModeFromTask = (task as any)?.taskWizardMode || 'none';

  // ✅ A1: Stato locale con sincronizzazione controllata
  const [effectiveTaskWizardMode, setEffectiveTaskWizardMode] = React.useState<TaskWizardMode>(taskWizardModeFromTask);
  const hasLocalOverrideRef = React.useRef<boolean>(false);

  // ✅ A1: Sincronizzazione unidirezionale: taskMeta → effective (solo se non c'è override)
  React.useEffect(() => {
    if (!hasLocalOverrideRef.current && taskWizardModeFromTask !== effectiveTaskWizardMode) {
      setEffectiveTaskWizardMode(taskWizardModeFromTask);
    }
  }, [taskWizardModeFromTask]); // NOTA: effectiveTaskWizardMode NON in dipendenze per evitare loop

  // ✅ A1: Usa effectiveTaskWizardMode invece di taskWizardModeFromTask
  const taskWizardMode = effectiveTaskWizardMode;

  // ✅ FIX: Ref per il pulsante save-to-library - creato qui e passato a useResponseEditor
  const saveToLibraryButtonRef = React.useRef<HTMLButtonElement>(null);

  // ✅ State per save location dialog
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [effectiveSaveDecisionMade, setEffectiveSaveDecisionMade] = React.useState(saveDecisionMade || false);

  // ✅ Handler per aprire dialog
  const handleOpenSaveDialog = React.useCallback(() => {
    console.log('[ResponseEditorInner] 🔔 Opening save dialog');
    setShowSaveDialog(true);
  }, []);

  // Validate TaskTree structure on mount/update
  useEffect(() => {
    if (taskTree) {
      try {
        validateTaskTreeStructure(taskTree, 'ResponseEditor');
      } catch (error) {
        console.error('[ResponseEditor] Invalid TaskTree structure:', error);
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

  // ✅ For wizard, use taskLabel from editor (which comes from useResponseEditorCore)
  // If empty, pass undefined (wizard will handle it)
  const taskLabelForWizard = taskWizardMode === 'full' ? (taskLabel || undefined) : undefined;
  const taskIdForWizard = taskWizardMode === 'full' && task ? (task as any).id : undefined;
  const rowIdForWizard = taskWizardMode === 'full' && task ? (task as any).id : undefined;
  const projectIdForWizard = taskWizardMode === 'full' ? currentProjectId || undefined : undefined;
  const localeForWizard = 'it';

  const wizardIntegrationRaw = useWizardIntegration(
    taskLabelForWizard, // ✅ From editor.taskLabel (single source of truth)
    taskIdForWizard,
    rowIdForWizard,
    projectIdForWizard,
    localeForWizard,
    onWizardComplete // ✅ CORRETTO: usa onWizardComplete dalla prop
  );

  // ✅ FIX: Mantieni wizardIntegration anche dopo completamento se shouldBeGeneral è true
  const wizardIntegration = (taskWizardMode === 'full' || wizardIntegrationRaw?.shouldBeGeneral) ? wizardIntegrationRaw : null;

  // ✅ REMOVED: effectiveShouldBeGeneral, generalizedLabel, generalizedMessages, generalizationReason
  // ✅ These are now read from WizardContext in components that need them

  // ✅ A1 + A3: Monitora completamento wizard e sovrascrivi effectiveTaskWizardMode a 'none'
  const shouldTransitionToNone = useWizardModeTransition(
    taskWizardMode,
    wizardIntegration?.wizardMode,
    taskTree,
    wizardIntegration?.pipelineSteps
  );

  React.useEffect(() => {
    if (
      shouldTransitionToNone &&
      effectiveTaskWizardMode === 'full' &&
      !hasLocalOverrideRef.current
    ) {
      hasLocalOverrideRef.current = true;
      setEffectiveTaskWizardMode('none');
      console.log('[ResponseEditorInner] ✅ A1: Resetting taskWizardMode to "none" after wizard completion');
    }
  }, [shouldTransitionToNone, effectiveTaskWizardMode]);

  // ✅ B1: WizardContext value (only when wizard is active) - calculated here to avoid race condition
  const wizardContextValue = React.useMemo(() => {
    if (!wizardIntegration || taskWizardMode !== 'full') {
      return null;
    }

    return {
      wizardMode: wizardIntegration.wizardMode || WizardMode.START,
      currentStep: wizardIntegration.currentStep || 'idle', // DEPRECATED
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
    wizardIntegration?.wizardMode,
    wizardIntegration?.showStructureConfirmation,
    wizardIntegration?.structureConfirmed,
    wizardIntegration?.currentStep,
    wizardIntegration?.pipelineSteps,
    wizardIntegration?.dataSchema,
    wizardIntegration?.availableModules,
    wizardIntegration?.foundModuleId,
    wizardIntegration?.showCorrectionMode,
    wizardIntegration?.correctionInput,
    wizardIntegration?.currentParserSubstep,
    wizardIntegration?.currentMessageSubstep,
    wizardIntegration?.handleStructureConfirm,
    wizardIntegration?.handleStructureReject,
    wizardIntegration?.onProceedFromEuristica,
    wizardIntegration?.onShowModuleList,
    wizardIntegration?.onSelectModule,
    wizardIntegration?.onPreviewModule,
    wizardIntegration?.setCorrectionInput,
    wizardIntegration?.shouldBeGeneral,
    wizardIntegration?.generalizedLabel,
    wizardIntegration?.generalizedMessages,
    wizardIntegration?.generalizationReason,
    wizardIntegration?.runGenerationPipeline,
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