import React from 'react';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { ContractUpdateDialog } from './ContractUpdateDialog';
import EditorHeader from '../../common/EditorHeader';
import TaskDragLayer from './TaskDragLayer';
import { FontProvider, useFontContext } from '../../../context/FontContext';
import { ToolbarButton } from '../../../dock/types';
import { ResponseEditorContent } from './components/ResponseEditorContent';
import { ResponseEditorNormalLayout } from './components/ResponseEditorNormalLayout';
import { ServiceUnavailableModal } from './components/ServiceUnavailableModal';
import { GeneralizabilityBanner } from './components/GeneralizabilityBanner';
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

      {/* Generalizability Banner */}
      {isGeneralizable && (
        <GeneralizabilityBanner
          isGeneralizable={isGeneralizable}
          generalizationReason={generalizationReason}
          onSaveToFactory={() => {
            // TODO: Implement save to factory logic
            console.log('[GeneralizabilityBanner] Save to Factory clicked');
          }}
          onIgnore={() => {
            // Banner will be dismissed automatically
            console.log('[GeneralizabilityBanner] Ignore clicked');
          }}
        />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <ResponseEditorContent
          showContractWizard={showContractWizard}
          needsIntentMessages={needsIntentMessages}
          task={taskMeta}
          taskTree={taskTree}
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
              replaceSelectedTaskTree={replaceSelectedTaskTreeFromInit}
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