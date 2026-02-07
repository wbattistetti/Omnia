import React from 'react';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { ContractUpdateDialog } from './ContractUpdateDialog';
import EditorHeader from '../../common/EditorHeader';
import TaskDragLayer from './TaskDragLayer';
import { FontProvider, useFontContext } from '../../../context/FontContext';
import { ToolbarButton } from '../../../dock/types';
import { ResponseEditorLayout } from './components/ResponseEditorLayout';
import { useResponseEditor } from './hooks/useResponseEditor';

import type { TaskMeta } from '../EditorHost/types';
import type { Task, TaskTree } from '../../../types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();

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

  // Extract all needed values
  const {
    taskMeta,
    localTranslations,
    mainList,
    isAggregatedAtomic,
    needsIntentMessages,
    taskType,
    headerTitle,
    icon: Icon,
    iconColor,
    isGeneralizable,
    generalizationReason,
    sidebarHandlers,
    handleSidebarResizeStart,
    handleEditorClose,
    contractDialogHandlers,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleProfileUpdate,
    handleIntentMessagesComplete,
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
    selectedNode,
    selectedNodePath,
    showContractWizard,
    toolbarButtons,
    rightWidth,
    testPanelWidth,
    tasksPanelWidth,
    draggingPanel,
    setDraggingPanel,
    setRightWidth,
    setTestPanelWidth,
    setTasksPanelWidth,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    sidebarManualWidth,
    isDraggingSidebar,
    showMessageReview,
    showSynonyms,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    pendingEditorOpen,
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    pendingContractChange,
    updateSelectedNode,
    rootRef,
    contractChangeRef,
    tasksStartWidthRef,
    tasksStartXRef,
    replaceSelectedTaskTree,
    escalationTasks,
  } = editor;

  return (
    <ResponseEditorLayout
      rootRef={rootRef}
      combinedClass={combinedClass}
      hideHeader={hideHeader}
      icon={Icon}
      iconColor={iconColor}
      headerTitle={headerTitle}
      toolbarButtons={toolbarButtons}
      handleEditorClose={handleEditorClose}
      isGeneralizable={isGeneralizable}
      generalizationReason={generalizationReason}
      showContractWizard={showContractWizard}
      needsIntentMessages={needsIntentMessages}
      task={taskMeta}
      taskTree={taskTree}
      currentProjectId={currentProjectId}
      handleContractWizardClose={handleContractWizardClose}
      handleContractWizardNodeUpdate={handleContractWizardNodeUpdate}
      handleContractWizardComplete={handleContractWizardComplete}
      handleIntentMessagesComplete={handleIntentMessagesComplete}
      mainList={mainList}
      localTranslations={localTranslations}
      escalationTasks={escalationTasks}
      selectedMainIndex={selectedMainIndex}
      selectedSubIndex={selectedSubIndex}
      selectedRoot={selectedRoot}
      selectedNode={selectedNode}
      selectedNodePath={selectedNodePath}
      handleSelectMain={handleSelectMain}
      handleSelectSub={handleSelectSub}
      handleSelectAggregator={handleSelectAggregator}
      sidebarRef={sidebarRef}
      sidebarHandlers={sidebarHandlers}
      handleParserCreate={handleParserCreate}
      handleParserModify={handleParserModify}
      handleEngineChipClick={handleEngineChipClick}
      handleGenerateAll={handleGenerateAll}
      isAggregatedAtomic={isAggregatedAtomic}
      sidebarManualWidth={sidebarManualWidth}
      isDraggingSidebar={isDraggingSidebar}
      handleSidebarResizeStart={handleSidebarResizeStart}
      showMessageReview={showMessageReview}
      showSynonyms={showSynonyms}
      selectedIntentIdForTraining={selectedIntentIdForTraining}
      setSelectedIntentIdForTraining={setSelectedIntentIdForTraining}
      pendingEditorOpen={pendingEditorOpen}
      contractChangeRef={contractChangeRef}
      taskType={taskType}
      handleProfileUpdate={handleProfileUpdate}
      updateSelectedNode={updateSelectedNode}
      leftPanelMode={leftPanelMode}
      testPanelMode={testPanelMode}
      tasksPanelMode={tasksPanelMode}
      rightWidth={rightWidth}
      testPanelWidth={testPanelWidth}
      tasksPanelWidth={tasksPanelWidth}
      draggingPanel={draggingPanel}
      setDraggingPanel={setDraggingPanel}
      setRightWidth={setRightWidth}
      setTestPanelWidth={setTestPanelWidth}
      setTasksPanelWidth={setTasksPanelWidth}
      tasksStartWidthRef={tasksStartWidthRef}
      tasksStartXRef={tasksStartXRef}
      replaceSelectedTaskTree={replaceSelectedTaskTree}
      serviceUnavailable={serviceUnavailable}
      setServiceUnavailable={setServiceUnavailable}
      showContractDialog={showContractDialog}
      pendingContractChange={pendingContractChange}
      contractDialogHandlers={contractDialogHandlers}
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