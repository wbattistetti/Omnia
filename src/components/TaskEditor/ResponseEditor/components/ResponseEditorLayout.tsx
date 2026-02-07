// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * ResponseEditorLayout
 *
 * Component that renders the main layout structure of ResponseEditor.
 * Extracted from index.tsx to reduce complexity.
 *
 * ✅ FASE 3.1: Extracted from index.tsx
 */

import React from 'react';
import EditorHeader from '@components/common/EditorHeader';
import TaskDragLayer from '@responseEditor/TaskDragLayer';
import { ResponseEditorContent } from '@responseEditor/components/ResponseEditorContent';
import { ResponseEditorNormalLayout } from '@responseEditor/components/ResponseEditorNormalLayout';
import { ServiceUnavailableModal } from '@responseEditor/components/ServiceUnavailableModal';
import { GeneralizabilityBanner } from '@responseEditor/components/GeneralizabilityBanner';
import { ContractUpdateDialog } from '@responseEditor/ContractUpdateDialog';
import type { TaskTree } from '@types/taskTypes';
import type { UseResponseEditorResult } from '@responseEditor/hooks/useResponseEditor';

export interface ResponseEditorLayoutProps {
  editor: UseResponseEditorResult;
  combinedClass: string;
  hideHeader?: boolean;
  taskTree: TaskTree | null | undefined;
  currentProjectId: string | null;
}

/**
 * Main layout component for ResponseEditor.
 */
export function ResponseEditorLayout(props: ResponseEditorLayoutProps) {
  const { editor, combinedClass, hideHeader, taskTree, currentProjectId } = props;

  // Extract values from editor
  const {
    rootRef,
    icon: Icon,
    iconColor,
    headerTitle,
    toolbarButtons,
    handleEditorClose,
    isGeneralizable,
    generalizationReason,
    showContractWizard,
    needsIntentMessages,
    taskMeta: task,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    handleIntentMessagesComplete,
    mainList,
    localTranslations,
    escalationTasks,
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    selectedNode,
    selectedNodePath,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
    sidebarRef,
    sidebar, // ✅ FASE 2.1: Consolidated sidebar hook
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleGenerateAll,
    isAggregatedAtomic,
    sidebarManualWidth,
    isDraggingSidebar,
    showMessageReview,
    showSynonyms,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    pendingEditorOpen,
    contractChangeRef,
    taskType,
    handleProfileUpdate,
    updateSelectedNode,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    rightWidth,
    testPanelWidth,
    tasksPanelWidth,
    draggingPanel,
    setDraggingPanel,
    setRightWidth,
    setTestPanelWidth,
    setTasksPanelWidth,
    tasksStartWidthRef,
    tasksStartXRef,
    replaceSelectedTaskTree,
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    pendingContractChange,
    contractDialogHandlers,
  } = editor;

  return (
    <div
      ref={rootRef}
      className={combinedClass}
      style={{
        background: '#0b0f17',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        height: '100%',
      }}
    >
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
          task={task}
          taskTree={taskTree}
          handleContractWizardClose={handleContractWizardClose}
          handleContractWizardNodeUpdate={handleContractWizardNodeUpdate}
          handleContractWizardComplete={handleContractWizardComplete}
          onIntentMessagesComplete={handleIntentMessagesComplete}
          normalEditorLayout={
            <ResponseEditorNormalLayout
              mainList={mainList}
              taskTree={taskTree}
              task={task}
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
              onChangeSubRequired={sidebar.onChangeSubRequired}
              onReorderSub={sidebar.onReorderSub}
              onAddMain={sidebar.onAddMain}
              onRenameMain={sidebar.onRenameMain}
              onDeleteMain={sidebar.onDeleteMain}
              onAddSub={sidebar.onAddSub}
              onRenameSub={sidebar.onRenameSub}
              onDeleteSub={sidebar.onDeleteSub}
              handleParserCreate={handleParserCreate}
              handleParserModify={handleParserModify}
              handleEngineChipClick={handleEngineChipClick}
              handleGenerateAll={handleGenerateAll}
              isAggregatedAtomic={isAggregatedAtomic}
              sidebarManualWidth={sidebarManualWidth}
              isDraggingSidebar={isDraggingSidebar}
              handleSidebarResizeStart={sidebar.handleSidebarResizeStart}
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
