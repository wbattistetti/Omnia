import React, { useEffect } from 'react';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import EditorHeader from '@components/common/EditorHeader';
import TaskDragLayer from '@responseEditor/TaskDragLayer';
import { FontProvider, useFontContext } from '@context/FontContext';
import { ToolbarButton } from '@dock/types';
import { ResponseEditorLayout } from '@responseEditor/components/ResponseEditorLayout';
import { useResponseEditor } from '@responseEditor/hooks/useResponseEditor';
import { validateTaskTreeStructure } from '@responseEditor/core/domain/validators';
// ✅ REMOVED: Legacy hooks - use useWizard instead
// import { useWizardIntegration } from '@responseEditor/hooks/useWizardIntegration';
// import { useWizardIntegrationNew } from '@responseEditor/hooks/useWizardIntegrationNew';
// import { useWizardIntegrationOrchestrated } from '@responseEditor/hooks/useWizardIntegrationOrchestrated';
import { useWizard } from '@TaskBuilderAIWizard/hooks/useWizard';
import { wizardResultToContextValue } from '@responseEditor/context/WizardContext';
import { WizardContext } from '@responseEditor/context/WizardContext';
import { WizardMode } from '../../../../TaskBuilderAIWizard/types/WizardMode';
import { useWizardModeTransition } from '@responseEditor/hooks/useWizardModeTransition';
import { useTaskTreeFromStore, useTaskTreeVersion } from '@responseEditor/core/state';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import { closeTab } from '@dock/ops';
import { flushWizardToManualPipeline } from '@utils/wizard/flushWizardToManual';

import type { TaskMeta } from '@taskEditor/EditorHost/types';
import type { Task, TaskTree } from '@types/taskTypes';
import '@responseEditor/styles/errorHighlight.css';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose, saveDecisionMade, onOpenSaveDialog: onOpenSaveDialogFromHost, authoringFlowCanvasId }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void, saveDecisionMade?: boolean, onOpenSaveDialog?: () => void, authoringFlowCanvasId?: string | null }) {
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
  /** Set true after a successful publish to Factory from SaveLocationDialog (handleSaveToFactory). */
  const [, setFactoryLibrarySaveCompleted] = React.useState(saveDecisionMade || false);

  /** Opens the save-location popover; optional host callback (e.g. analytics) runs after open. */
  const handleOpenSaveDialog = React.useCallback(() => {
    setShowSaveDialog(true);
    onOpenSaveDialogFromHost?.();
  }, [onOpenSaveDialogFromHost]);

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

  // ✅ Close Response Editor if the task/row it's open on is deleted
  useEffect(() => {
    if (!task?.id || !tabId || !setDockTree) {
      return;
    }

    const handleTaskDeleted = (e: CustomEvent<{ taskId: string }>) => {
      const deletedTaskId = e.detail?.taskId;
      if (deletedTaskId === task.id) {
        console.log('[ResponseEditor] Task deleted, closing editor', { taskId: task.id, tabId });
        setDockTree(prev => closeTab(prev, tabId!));
      }
    };

    document.addEventListener('taskEditor:closeIfOpen', handleTaskDeleted as EventListener);
    return () => {
      document.removeEventListener('taskEditor:closeIfOpen', handleTaskDeleted as EventListener);
    };
  }, [task?.id, tabId, setDockTree]);

  // ✅ CRITICAL: Reset wizard state when component unmounts (cleanup)
  useEffect(() => {
    return () => {
      // Cleanup: reset wizard state when ResponseEditor unmounts
      import('../../../../TaskBuilderAIWizard/store/wizardStore').then(({ useWizardStore }) => {
        useWizardStore.getState().reset();
      });
    };
  }, []);

  // ✅ FASE 3.1: Use main composite hook FIRST
  // This hook calls useResponseEditorCore which is the SINGLE SOURCE OF TRUTH for taskLabel
  const editor = useResponseEditor({
    taskTree,
    task,
    isTaskTreeLoading,
    onWizardComplete,
    currentProjectId,
    authoringFlowCanvasId,
    tabId,
    setDockTree,
    onClose,
    hideHeader,
    onToolbarUpdate,
    registerOnClose,
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

  // ✅ Get contextualizationTemplateId from editor (comes from taskMeta)
  const contextualizationTemplateId = editor.contextualizationTemplateId;

  const taskLabelForWizard = (taskWizardMode === 'full' || taskWizardMode === 'adaptation' || shouldPreserveWizardIntegration)
    ? (taskLabel || undefined)
    : undefined;
  // ✅ FIX: Usa sempre task.id (che è sempre row.id) quando task esiste
  // Quando taskWizardMode === 'full' o 'adaptation', task può essere TaskMeta (che ha id = row.id)
  // Per costruzione: task.id = row.id (sempre)
  // ✅ CRITICAL: rowId MUST be available when wizard mode is 'full' or 'adaptation'
  const rowIdForWizard = (taskWizardMode === 'full' || taskWizardMode === 'adaptation' || shouldPreserveWizardIntegration) && task
    ? task.id  // ✅ ALWAYS equals row.id (task can be TaskMeta or Task, both have id)
    : undefined;

  const projectIdForWizard = (taskWizardMode === 'full' || taskWizardMode === 'adaptation' || shouldPreserveWizardIntegration)
    ? currentProjectId || undefined
    : undefined;
  const localeForWizard = 'it';

  // Determine wizard mode and templateId for adaptation
  const wizardMode = taskWizardMode === 'adaptation' ? 'adaptation' : taskWizardMode === 'full' ? 'full' : undefined;
  const templateIdForWizard = taskWizardMode === 'adaptation' ? contextualizationTemplateId : undefined;

  // ✅ NEW: Use unified wizard hook
  const wizardResult = useWizard({
    taskLabel: taskLabelForWizard,
    rowId: rowIdForWizard,
    projectId: projectIdForWizard,
    locale: localeForWizard,
    onTaskBuilderComplete: onWizardComplete,
    replaceSelectedTaskTree: editor.replaceSelectedTaskTree,
    mode: wizardMode,
    templateId: templateIdForWizard,
  });

  // ✅ Backward compatibility: Convert to old format for now
  // TODO: Remove this once all components are migrated to use WizardContext
  const wizardIntegrationRaw = wizardResult ? {
    wizardMode: wizardResult.wizardMode,
    currentStep: wizardResult.currentStep,
    pipelineSteps: wizardResult.pipelineSteps,
    dataSchema: wizardResult.dataSchema,
    phaseCounters: wizardResult.phaseCounters,
    showStructureConfirmation: wizardResult.showStructureConfirmation,
    structureConfirmed: wizardResult.structureConfirmed,
    showCorrectionMode: wizardResult.showCorrectionMode,
    correctionInput: wizardResult.correctionInput,
    setCorrectionInput: wizardResult.setCorrectionInput,
    handleStructureConfirm: wizardResult.confirmStructure,
    handleStructureReject: wizardResult.rejectStructure,
    runGenerationPipeline: wizardResult.startFull,
    handleCorrectionSubmit: wizardResult.handleCorrectionSubmit,
    messages: wizardResult.messages,
    messagesGeneralized: wizardResult.messagesGeneralized,
    messagesContextualized: wizardResult.messagesContextualized,
    shouldBeGeneral: wizardResult.shouldBeGeneral,
    generalizedLabel: wizardResult.generalizedLabel,
    generalizationReason: wizardResult.generalizationReason,
    generalizedMessages: wizardResult.generalizedMessages,
    constraints: wizardResult.constraints,
    nlpContract: wizardResult.nlpContract,
    currentParserSubstep: wizardResult.currentParserSubstep,
    currentMessageSubstep: wizardResult.currentMessageSubstep,
    onProceedFromEuristica: wizardResult.onProceedFromEuristica,
    onShowModuleList: wizardResult.onShowModuleList,
    onSelectModule: wizardResult.onSelectModule,
    setActiveNodeId: wizardResult.onPreviewModule,
    selectedModuleId: wizardResult.foundModuleId,
    availableModules: wizardResult.availableModules,
    foundModuleId: wizardResult.foundModuleId,
  } : null;

  // ✅ FIX: Mantieni riferimento al wizardResult precedente per preservare shouldBeGeneral
  // ✅ IMPORTANTE: Aggiorna il ref SEMPRE quando wizardResult ha shouldBeGeneral === true
  React.useEffect(() => {
    if (wizardResult?.shouldBeGeneral) {
      previousWizardIntegrationRef.current = wizardIntegrationRaw;
    }
  }, [wizardResult, wizardIntegrationRaw]);

  // ✅ FIX: Mantieni wizardIntegration anche dopo completamento se shouldBeGeneral è true
  // ✅ Simplified: Use wizardResult directly, fallback to wizardIntegrationRaw for backward compatibility
  const wizardIntegration = React.useMemo(() => {
    // ✅ PRIORITÀ 1: Se wizardResult esiste, usalo (nuovo sistema)
    if (wizardResult) {
      return wizardIntegrationRaw; // wizardIntegrationRaw è già convertito da wizardResult
    }

    // ✅ PRIORITÀ 2: Se wizardIntegrationRaw ha shouldBeGeneral === true, mantienilo
    if (wizardIntegrationRaw?.shouldBeGeneral) {
      previousWizardIntegrationRef.current = wizardIntegrationRaw;
      return wizardIntegrationRaw;
    }

    // ✅ PRIORITÀ 3: Se il ref precedente aveva shouldBeGeneral === true, usalo
    if (previousWizardIntegrationRef.current?.shouldBeGeneral) {
      return previousWizardIntegrationRef.current;
    }

    // ✅ Altrimenti, null
    return null;
  }, [taskWizardMode, wizardResult, wizardIntegrationRaw]);

  // ✅ ARCHITECTURE: Monitor wizard completion and update Context (SINGLE SOURCE OF TRUTH)
  // No local state, no derives - update Context directly via editor.setTaskWizardMode
  // ✅ CRITICAL: Use taskTreeFromStore instead of taskTree prop
  // The taskTree in store is updated when onTaskBuilderComplete is called
  const taskTreeFromStore = useTaskTreeFromStore();
  const taskTreeVersion = useTaskTreeVersion(); // ✅ NEW: Force re-render when store updates
  const shouldTransitionToNone = useWizardModeTransition(
    taskWizardMode,
    wizardResult?.wizardMode,
    taskTreeFromStore, // ✅ Use taskTreeFromStore instead of taskTree prop
    wizardResult?.pipelineSteps,
    taskTreeVersion // ✅ NEW: Pass version to force recalculation when store updates
  );

  React.useEffect(() => {
    if (shouldTransitionToNone && taskWizardMode === 'full') {
      // ✅ ARCHITECTURE: Update Context directly (updates state in useResponseEditorCore)
      editor.setTaskWizardMode('none');
    }
  }, [shouldTransitionToNone, taskWizardMode, editor]);

  // ✅ OPTIMIZATION: Stabilize callbacks OUTSIDE useMemo to prevent recreation
  // These are stable and only change when wizardIntegration handlers change
  // ✅ OPTIMIZATION: Stabilize callbacks from wizardResult
  // These are stable and only change when wizardResult handlers change
  const setCorrectionInputStable = React.useCallback(
    (value: string) => {
      wizardResult?.setCorrectionInput?.(value);
    },
    [wizardResult?.setCorrectionInput]
  );

  const handleStructureConfirmStable = React.useCallback(
    async () => {
      await wizardResult?.confirmStructure?.();
    },
    [wizardResult?.confirmStructure]
  );

  const handleStructureRejectStable = React.useCallback(
    () => {
      wizardResult?.rejectStructure?.();
    },
    [wizardResult?.rejectStructure]
  );

  const runGenerationPipelineStable = React.useCallback(
    async () => {
      await wizardResult?.startFull?.();
    },
    [wizardResult?.startFull]
  );

  const onProceedFromEuristicaStable = React.useCallback(
    async () => {
      await wizardResult?.onProceedFromEuristica?.();
    },
    [wizardResult?.onProceedFromEuristica]
  );

  const onShowModuleListStable = React.useCallback(
    () => {
      wizardResult?.onShowModuleList?.();
    },
    [wizardResult?.onShowModuleList]
  );

  const onSelectModuleStable = React.useCallback(
    async (moduleId: string) => {
      await wizardResult?.onSelectModule?.(moduleId);
    },
    [wizardResult?.onSelectModule]
  );

  const onPreviewModuleStable = React.useCallback(
    (moduleId: string | null) => {
      wizardResult?.onPreviewModule?.(moduleId);
    },
    [wizardResult?.onPreviewModule]
  );

  const handleCorrectionSubmitStable = React.useCallback(
    async () => {
      if (wizardResult?.handleCorrectionSubmit) {
        try {
          await wizardResult.handleCorrectionSubmit();
        } catch (error) {
          console.error('[index.tsx] ❌ ERROR in handleCorrectionSubmit:', error);
          throw error;
        }
      }
    },
    [wizardResult?.handleCorrectionSubmit]
  );

  // ── Wizard toolbar actions ────────────────────────────────────────────────
  // Marks a deferred-start intent so the next render (when wizardResult is
  // available) can call startFull() rather than auto-starting in useWizard.
  const shouldStartWizardRef = React.useRef(false);

  const handleStartWizard = React.useCallback(() => {
    shouldStartWizardRef.current = true;
    editor.setTaskWizardMode('full');
  }, [editor.setTaskWizardMode]);

  const handleSwitchToManual = React.useCallback(() => {
    void (async () => {
      try {
        if (task?.id) {
          await flushWizardToManualPipeline({
            taskId: task.id,
            projectId: currentProjectId,
            task: task as Task | TaskMeta,
            replaceSelectedTaskTree: editor.replaceSelectedTaskTree,
          });
        }
      } catch (err) {
        console.error('[ResponseEditor] PR3 flushWizardToManualPipeline failed:', err);
      } finally {
        wizardResult?.resetOrchestrator?.();
        editor.setTaskWizardMode('none');
      }
    })();
  }, [
    task,
    currentProjectId,
    editor.replaceSelectedTaskTree,
    editor.setTaskWizardMode,
    wizardResult?.resetOrchestrator,
  ]);

  // Trigger startFull() once wizard mode and result are both available.
  React.useEffect(() => {
    if (
      taskWizardMode === 'full' &&
      wizardResult?.startFull &&
      shouldStartWizardRef.current
    ) {
      shouldStartWizardRef.current = false;
      wizardResult.startFull().catch((err) => {
        console.error('[ResponseEditor] startFull failed:', err);
      });
    }
  }, [taskWizardMode, wizardResult?.startFull]);

  // ✅ B1: WizardContext value (only when wizard is active OR shouldBeGeneral is true)
  // ✅ NEW: Use unified wizard hook result
  const wizardContextValue = React.useMemo(() => {
    if (!wizardResult) {
      return null;
    }
    // ✅ FIX: Mantieni WizardContext anche dopo completamento se shouldBeGeneral è true
    if (taskWizardMode !== 'full' && taskWizardMode !== 'adaptation' && !wizardResult.shouldBeGeneral) {
      return null;
    }

    // ✅ Convert wizard result to context value
    return wizardResultToContextValue(wizardResult);
  }, [
    wizardResult,
    taskWizardMode,
    // ✅ Include key fields to trigger re-render when they change
    wizardResult?.dataSchema,
    wizardResult?.pipelineSteps,
    wizardResult?.wizardMode,
    wizardResult?.runMode,
    wizardResult?.phaseCounters,
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
      selectedPath={editor.selectedPath}
      handleSelectByPath={editor.handleSelectByPath}
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
      setLeftPanelMode={editor.setLeftPanelMode} // ✅ NEW: Pass setter for navigation context
      testPanelMode={editor.testPanelMode}
      tasksPanelMode={editor.tasksPanelMode}
      setTasksPanelMode={editor.setTasksPanelMode} // ✅ NEW: Pass setter for navigation context
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
      showSaveDialog={showSaveDialog}
      setShowSaveDialog={setShowSaveDialog}
      setSaveDecisionMade={setFactoryLibrarySaveCompleted}
      wizardIntegration={wizardIntegration}
      onStartWizard={handleStartWizard}
      onSwitchToManual={handleSwitchToManual}
      originalLabel={editor.headerTitle} // ✅ SINGLE SOURCE: Use headerTitle from editor (node row label)
      // ✅ FIX: Pass ref per il pulsante save-to-library
      saveToLibraryButtonRef={saveToLibraryButtonRef}
      // ✅ NEW: Pass viewMode for Behaviour
      viewMode={editor.viewMode}
      onViewModeChange={editor.onViewModeChange}
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

/** `saveDecisionMade`: optional initial value for “already published to Factory” (rare); host `onOpenSaveDialog` runs when opening the Factory popover. */
export default function ResponseEditor({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose, saveDecisionMade, onOpenSaveDialog, authoringFlowCanvasId }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void, saveDecisionMade?: boolean, onOpenSaveDialog?: () => void, authoringFlowCanvasId?: string | null }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FontProvider>
        <ResponseEditorInner taskTree={taskTree} onClose={onClose} onWizardComplete={onWizardComplete} task={task} isTaskTreeLoading={isTaskTreeLoading} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} tabId={tabId} setDockTree={setDockTree} registerOnClose={registerOnClose} saveDecisionMade={saveDecisionMade} onOpenSaveDialog={onOpenSaveDialog} authoringFlowCanvasId={authoringFlowCanvasId} />
      </FontProvider>
    </div>
  );
}