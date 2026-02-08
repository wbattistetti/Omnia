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

import type { TaskMeta } from '@taskEditor/EditorHost/types';
import type { Task, TaskTree } from '@types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();

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
    />
  );
}

export default function ResponseEditor({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FontProvider>
        <ResponseEditorInner taskTree={taskTree} onClose={onClose} onWizardComplete={onWizardComplete} task={task} isTaskTreeLoading={isTaskTreeLoading} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} tabId={tabId} setDockTree={setDockTree} registerOnClose={registerOnClose} />
      </FontProvider>
    </div>
  );
}