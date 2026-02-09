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

import type { TaskMeta } from '@taskEditor/EditorHost/types';
import type { Task, TaskTree } from '@types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose, shouldBeGeneral, saveDecisionMade, onOpenSaveDialog }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void, shouldBeGeneral?: boolean, saveDecisionMade?: boolean, onOpenSaveDialog?: () => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();

  // ✅ 1️⃣ Chiama useWizardIntegration UNA SOLA VOLTA qui
  // Determina taskWizardMode e parametri per il wizard
  const taskWizardMode = (task as any)?.taskWizardMode || 'none';
  const taskLabel = (task as any)?.label || (task as any)?.taskLabel || '';
  const taskLabelForWizard = taskWizardMode === 'full' ? taskLabel : undefined;
  const taskIdForWizard = taskWizardMode === 'full' && task ? (task as any).id : undefined;
  const rowIdForWizard = taskWizardMode === 'full' && task ? (task as any).id : undefined;
  const projectIdForWizard = taskWizardMode === 'full' ? currentProjectId || undefined : undefined;
  const localeForWizard = 'it';

  console.log('[ResponseEditorInner] 🔍 useWizardIntegration chiamato', {
    taskWizardMode,
    taskLabel,
    taskLabelForWizard,
    taskId: taskIdForWizard,
    rowId: rowIdForWizard,
    projectId: projectIdForWizard,
    willCallHook: taskWizardMode === 'full',
  });

  const wizardIntegrationRaw = useWizardIntegration(
    taskLabelForWizard,
    taskIdForWizard,
    rowIdForWizard,
    projectIdForWizard,
    localeForWizard,
    onWizardComplete // ✅ CORRETTO: usa onWizardComplete dalla prop
  );

  // ✅ FIX: Mantieni wizardIntegration anche dopo completamento se shouldBeGeneral è true
  const wizardIntegration = (taskWizardMode === 'full' || wizardIntegrationRaw?.shouldBeGeneral) ? wizardIntegrationRaw : null;

  // ✅ 2️⃣ Calcola tutti i valori qui
  const effectiveShouldBeGeneral = shouldBeGeneral ?? wizardIntegration?.shouldBeGeneral ?? false;
  const generalizedLabel = wizardIntegration?.generalizedLabel || null;
  const generalizedMessages = wizardIntegration?.generalizedMessages || null;
  const generalizationReason = wizardIntegration?.generalizationReason || null;

  // ✅ State per save location dialog
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [effectiveSaveDecisionMade, setEffectiveSaveDecisionMade] = React.useState(saveDecisionMade || false);
  const [saveDecision, setSaveDecision] = React.useState<'factory' | 'project' | null>(null);

  // ✅ Handler per aprire dialog
  const handleOpenSaveDialog = React.useCallback(() => {
    console.log('[ResponseEditorInner] 🔔 Opening save dialog');
    setShowSaveDialog(true);
  }, []);

  console.log('[ResponseEditorInner] 🔍 Wizard integration computed', {
    taskWizardMode,
    wizardMode: wizardIntegrationRaw?.wizardMode,
    shouldBeGeneral: wizardIntegrationRaw?.shouldBeGeneral,
    effectiveShouldBeGeneral,
    wizardIntegrationExists: !!wizardIntegration,
    generalizedLabel,
    generalizedMessagesCount: generalizedMessages?.length || 0,
  });

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

  // ✅ FASE 3.1: Use main composite hook
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
    // ✅ NEW: Pass generalization params
    shouldBeGeneral: effectiveShouldBeGeneral,
    saveDecisionMade: effectiveSaveDecisionMade,
    onOpenSaveDialog: handleOpenSaveDialog,
  });

  // ✅ ARCHITECTURE: Pass only necessary props (no monolithic editor object)
  return (
    <ResponseEditorLayout
      combinedClass={combinedClass}
      hideHeader={hideHeader}
      taskTree={taskTree}
      currentProjectId={currentProjectId}
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
      taskMeta={editor.taskMeta}
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
      taskLabel={editor.taskLabel}
      onTaskContextualizationComplete={editor.onTaskContextualizationComplete}
      onTaskBuilderComplete={editor.onTaskBuilderComplete}
      onTaskBuilderCancel={editor.onTaskBuilderCancel}
      onToolbarUpdate={onToolbarUpdate}
      // ✅ 3️⃣ Passa valori del Wizard come props
      shouldBeGeneral={effectiveShouldBeGeneral}
      generalizedLabel={generalizedLabel}
      generalizedMessages={generalizedMessages}
      generalizationReason={generalizationReason}
      saveDecisionMade={effectiveSaveDecisionMade}
      onOpenSaveDialog={handleOpenSaveDialog}
      showSaveDialog={showSaveDialog}
      setShowSaveDialog={setShowSaveDialog}
      setSaveDecisionMade={setEffectiveSaveDecisionMade}
      wizardIntegration={wizardIntegration}
      originalLabel={taskLabel || 'Task'}
    />
  );
}

export default function ResponseEditor({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose, shouldBeGeneral, saveDecisionMade, onOpenSaveDialog }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void, shouldBeGeneral?: boolean, saveDecisionMade?: boolean, onOpenSaveDialog?: () => void }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FontProvider>
        <ResponseEditorInner taskTree={taskTree} onClose={onClose} onWizardComplete={onWizardComplete} task={task} isTaskTreeLoading={isTaskTreeLoading} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} tabId={tabId} setDockTree={setDockTree} registerOnClose={registerOnClose} shouldBeGeneral={shouldBeGeneral} saveDecisionMade={saveDecisionMade} onOpenSaveDialog={onOpenSaveDialog} />
      </FontProvider>
    </div>
  );
}