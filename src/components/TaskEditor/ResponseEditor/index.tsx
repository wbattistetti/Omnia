import React from 'react';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { ContractUpdateDialog } from './ContractUpdateDialog';
import EditorHeader from '../../common/EditorHeader';
import TaskDragLayer from './TaskDragLayer';
import { FontProvider, useFontContext } from '../../../context/FontContext';
import { ToolbarButton } from '../../../dock/types';
import { ResponseEditorLayout } from './components/ResponseEditorLayout';
import { useResponseEditorCore } from './hooks/useResponseEditorCore';
import { useResponseEditorHandlers } from './hooks/useResponseEditorHandlers';

import type { TaskMeta } from '../EditorHost/types';
import type { Task } from '../../../types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();

  // ✅ FASE 3.1: Use composite hooks to reduce complexity
  const core = useResponseEditorCore({
    taskTree,
    task,
    isTaskTreeLoading,
    onWizardComplete,
    currentProjectId,
    tabId,
    setDockTree,
  });

  const {
    state,
    refs,
    taskMeta,
    localTranslations,
    mainList,
    isAggregatedAtomic,
    needsIntentMessages,
    taskType,
    headerTitle,
    icon: Icon,
    iconColor,
    rightMode,
    isGeneralizable,
    generalizationReason,
    nodeSelection,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    updateSelectedNode,
    handleProfileUpdate,
    handleIntentMessagesComplete,
    initialization,
    panelWidths,
  } = core;

  const {
    rootRef,
  } = refs;

  const {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
  } = nodeSelection;

  const {
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    toolbarButtons,
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
  } = initialization;

  const {
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
  } = panelWidths;

  const {
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    pendingContractChange,
    escalationTasks,
    showContractWizard,
    selectedNode,
    selectedNodePath,
    isDraggingSidebar,
    draggingPanel,
    setDraggingPanel,
    sidebarManualWidth,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    showSynonyms,
    showMessageReview,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    pendingEditorOpen,
  } = state;

  const {
    contractChangeRef,
    tasksStartWidthRef,
    tasksStartXRef,
  } = refs;

  // ✅ FASE 3.1: Use composite handlers hook
  const handlers = useResponseEditorHandlers({
    taskTree,
    task,
    currentProjectId,
    state,
    refs,
    nodeSelection,
    panelWidths,
    initialization,
    updateSelectedNode,
    handleProfileUpdate,
    tabId,
    setDockTree,
    onClose,
    hideHeader,
    onToolbarUpdate,
    registerOnClose,
  });

  const {
    sidebarHandlers,
    handleSidebarResizeStart,
    handleEditorClose,
    contractDialogHandlers,
  } = handlers;

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
      replaceSelectedTaskTree={replaceSelectedTaskTreeFromInit}
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