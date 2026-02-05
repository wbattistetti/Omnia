import React from 'react';
import { useTaskTreeManager } from '../../../context/DDTManagerContext';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { ContractUpdateDialog } from './ContractUpdateDialog';
import EditorHeader from '../../common/EditorHeader';
import TaskDragLayer from './TaskDragLayer';
import { useNodeSelection } from './hooks/useNodeSelection';
import { useResponseEditorToolbar } from './ResponseEditorToolbar';
import { FontProvider, useFontContext } from '../../../context/FontContext';
import { useAIProvider } from '../../../context/AIProviderContext';
import { useDDTTranslations } from '../../../hooks/useDDTTranslations';
import { ToolbarButton } from '../../../dock/types';
import { useResponseEditorSideEffects } from './hooks/useResponseEditorSideEffects';
import { useResponseEditorState } from './hooks/useResponseEditorState';
import { useResponseEditorInitialization } from './hooks/useResponseEditorInitialization';
import { ResponseEditorContent } from './components/ResponseEditorContent';
import { ResponseEditorNormalLayout } from './components/ResponseEditorNormalLayout';
import { useSidebarHandlers } from './hooks/useSidebarHandlers';
import { useUpdateSelectedNode } from './modules/ResponseEditor/core/node/useUpdateSelectedNode';
import { useResponseEditorClose } from './hooks/useResponseEditorClose';
import { useNodeLoading } from './hooks/useNodeLoading';
import { usePanelModes } from './hooks/usePanelModes';
import { useParserHandlers } from './hooks/useParserHandlers';
import { useProfileUpdate } from './hooks/useProfileUpdate';
import { useNodeFinder } from './hooks/useNodeFinder';
import { useIntentMessagesHandler } from './hooks/useIntentMessagesHandler';
import { useSidebarResize } from './hooks/useSidebarResize';
import { useTaskTreeDerived } from './hooks/useTaskTreeDerived';
import { useResponseEditorDerived } from './hooks/useResponseEditorDerived';
import { useContractUpdateDialog } from './hooks/useContractUpdateDialog';
import { useResponseEditorRefs } from './hooks/useResponseEditorRefs';
import { usePanelWidths } from './hooks/usePanelWidths';
import { getStepsAsArray, getStepsForNode, getTaskMeta } from './utils/responseEditorUtils';
import { ServiceUnavailableModal } from './components/ServiceUnavailableModal';

import type { TaskMeta } from '../EditorHost/types';
import type { Task } from '../../../types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();
  const { provider: selectedProvider, model: selectedModel } = useAIProvider();

  const state = useResponseEditorState();
  const {
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    setShowContractDialog,
    pendingContractChange,
    setPendingContractChange,
    escalationTasks,
    setEscalationTasks,
    pendingEditorOpen,
    setPendingEditorOpen,
    showSynonyms,
    setShowSynonyms,
    showMessageReview,
    setShowMessageReview,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    showContractWizard,
    setShowContractWizard,
    selectedNode,
    setSelectedNode,
    selectedNodePath,
    setSelectedNodePath,
    taskTreeVersion,
    setTaskTreeVersion,
    leftPanelMode,
    setLeftPanelMode,
    testPanelMode,
    setTestPanelMode,
    tasksPanelMode,
    setTasksPanelMode,
    sidebarManualWidth,
    setSidebarManualWidth,
    isDraggingSidebar,
    setIsDraggingSidebar,
    draggingPanel,
    setDraggingPanel,
  } = state;

  const {
    taskTreeRef,
    prevInstanceRef,
    contractChangeRef,
    rootRef,
    preAssembledTaskTreeCache,
    wizardOwnsDataRef,
    sidebarStartWidthRef,
    sidebarStartXRef,
    tasksStartWidthRef,
    tasksStartXRef,
  } = useResponseEditorRefs({ taskTree, task });

  const { replaceSelectedTaskTree: replaceSelectedTaskTreeFromContext } = useTaskTreeManager();
  const replaceSelectedTaskTree = React.useCallback((taskTree: any) => {
    replaceSelectedTaskTreeFromContext(taskTree);
  }, [replaceSelectedTaskTreeFromContext]);
  const {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    setSelectedMainIndex,
    setSelectedSubIndex,
    setSelectedRoot,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
  } = useNodeSelection(0);
  const findAndSelectNodeById = useNodeFinder({
    taskTree,
    taskTreeRef,
    handleSelectMain,
    handleSelectSub,
  });

  const {
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
  } = useParserHandlers({
    findAndSelectNodeById,
    setShowSynonyms,
    setPendingEditorOpen,
  });

  const taskMeta = getTaskMeta(task);
  const handleIntentMessagesComplete = useIntentMessagesHandler({
    task: taskMeta,
    taskTree,
    currentProjectId,
    onWizardComplete,
    replaceSelectedTaskTree,
  });

  const localTranslations = useDDTTranslations(taskTree, task);

  const {
    mainList,
    isAggregatedAtomic,
    introduction,
  } = useTaskTreeDerived({
    taskTree,
    taskTreeRef,
    taskTreeVersion,
    isTaskTreeLoading,
  });
  const {
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
  } = usePanelWidths();

  const sidebarHandlers = useSidebarHandlers({
    taskTree,
    replaceSelectedTaskTree,
  });

  const handleSidebarResizeStart = useSidebarResize({
    sidebarRef,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setIsDraggingSidebar,
  });

  const {
    needsIntentMessages,
    taskType,
    headerTitle,
    icon: Icon,
    iconColor,
    rightMode,
  } = useResponseEditorDerived({
    task: taskMeta,
    taskTree,
    mainList,
    leftPanelMode,
    testPanelMode,
  });

  const {
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    saveLeftPanelMode,
    saveTestPanelMode,
    saveTasksPanelMode,
    saveRightMode,
    toolbarButtons,
  } = useResponseEditorInitialization({
    task: taskMeta,
    taskTree,
    taskTreeRef,
    showContractWizard,
    setShowContractWizard,
    setTaskTreeVersion,
    setLeftPanelMode,
    setTestPanelMode,
    setTasksPanelMode,
    replaceSelectedTaskTree: replaceSelectedTaskTree,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    showSynonyms,
    setShowSynonyms,
    showMessageReview,
    setShowMessageReview,
    rightMode,
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
  });

  const handleEditorClose = useResponseEditorClose({
    contractChangeRef,
    setPendingContractChange,
    setShowContractDialog,
    selectedNode,
    selectedNodePath,
    selectedRoot,
    task,
    taskTreeRef,
    currentProjectId,
    tabId,
    setDockTree,
    onClose,
    replaceSelectedTaskTree,
  });

  useNodeLoading({
          selectedMainIndex,
          selectedSubIndex,
          selectedRoot,
    introduction,
    task,
    taskTree,
    taskTreeRef,
    setSelectedNode,
    setSelectedNodePath,
    getStepsForNode,
    getStepsAsArray,
  });

  const updateSelectedNode = useUpdateSelectedNode({
    selectedNodePath,
    selectedRoot,
    taskTreeRef,
    taskTree,
    task,
    currentProjectId,
    tabId,
    setDockTree,
    setSelectedNode,
    setTaskTreeVersion,
  });

  const handleProfileUpdate = useProfileUpdate({ updateSelectedNode });
  const contractDialogHandlers = useContractUpdateDialog({
    showContractDialog,
    setShowContractDialog,
    pendingContractChange,
    setPendingContractChange,
    contractChangeRef,
    tabId,
    setDockTree,
    onClose,
  });

  useResponseEditorSideEffects({
    task,
    taskTree,
    taskTreeRef,
    currentProjectId,
    setTaskTreeVersion,
    prevInstanceRef,
    setServiceUnavailable,
    setEscalationTasks,
    pendingEditorOpen,
    showSynonyms,
    selectedNode,
    setPendingEditorOpen,
    replaceSelectedTaskTree,
    sidebarRef,
    isDraggingSidebar,
    setIsDraggingSidebar,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setSidebarManualWidth,
    handleEditorClose,
    registerOnClose,
    draggingPanel,
    setDraggingPanel,
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
    tasksPanelMode,
    testPanelMode,
    tasksStartWidthRef,
    tasksStartXRef,
    hideHeader,
    onToolbarUpdate,
    toolbarButtons,
  });

  return (
    <div ref={rootRef} className={combinedClass} style={{ background: '#0b0f17', display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0, height: '100%' }}>

      {!hideHeader && (
        <EditorHeader
          icon={<Icon size={18} style={{ color: iconColor }} />}
          title={headerTitle}
          toolbarButtons={toolbarButtons}
          onClose={handleEditorClose}
          color="orange"
        />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <ResponseEditorContent
          showContractWizard={showContractWizard}
          needsIntentMessages={needsIntentMessages}
          task={taskMeta}
          taskTree={taskTree}
          taskTreeRef={taskTreeRef}
          handleContractWizardClose={handleContractWizardClose}
          handleContractWizardNodeUpdate={handleContractWizardNodeUpdate}
          handleContractWizardComplete={handleContractWizardComplete}
          onIntentMessagesComplete={handleIntentMessagesComplete}
          normalEditorLayout={
            <ResponseEditorNormalLayout
              mainList={mainList}
              taskTree={taskTree}
              task={taskMeta}
              currentProjectId={currentProjectId}
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
              onChangeSubRequired={sidebarHandlers.onChangeSubRequired}
              onReorderSub={sidebarHandlers.onReorderSub}
              onAddMain={sidebarHandlers.onAddMain}
              onRenameMain={sidebarHandlers.onRenameMain}
              onDeleteMain={sidebarHandlers.onDeleteMain}
              onAddSub={sidebarHandlers.onAddSub}
              onRenameSub={sidebarHandlers.onRenameSub}
              onDeleteSub={sidebarHandlers.onDeleteSub}
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
              replaceSelectedTaskTree={replaceSelectedTaskTree}
            />
          }
        />
      </div>

      <TaskDragLayer />
      {serviceUnavailable && (
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={() => setServiceUnavailable(null)}
        />
      )}

      {showContractDialog && pendingContractChange && (
        <ContractUpdateDialog
          open={showContractDialog}
          templateLabel={pendingContractChange.templateLabel}
          onKeep={contractDialogHandlers.handleKeep}
          onDiscard={contractDialogHandlers.handleDiscard}
          onCancel={contractDialogHandlers.handleCancel}
        />
      )}
    </div>
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