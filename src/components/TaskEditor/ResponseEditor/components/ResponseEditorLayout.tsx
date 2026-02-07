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
import EditorHeader from '../../../common/EditorHeader';
import TaskDragLayer from '../TaskDragLayer';
import { ResponseEditorContent } from './ResponseEditorContent';
import { ResponseEditorNormalLayout } from './ResponseEditorNormalLayout';
import { ServiceUnavailableModal } from './ServiceUnavailableModal';
import { GeneralizabilityBanner } from './GeneralizabilityBanner';
import { ContractUpdateDialog } from '../ContractUpdateDialog';
import type { TaskMeta, Task } from '../../../../types/taskTypes';
import type { TaskTree } from '../../../../types/taskTypes';

export interface ResponseEditorLayoutProps {
  // Layout props
  rootRef: React.RefObject<HTMLDivElement>;
  combinedClass: string;
  hideHeader?: boolean;

  // Header props
  icon: React.ComponentType<any>;
  iconColor: string;
  headerTitle: string;
  toolbarButtons: any[];
  handleEditorClose: () => Promise<boolean>;

  // Generalizability banner
  isGeneralizable: boolean;
  generalizationReason: string | null;

  // Content props
  showContractWizard: boolean;
  needsIntentMessages: boolean;
  task: TaskMeta | Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  currentProjectId: string | null;
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (node: any) => void;
  handleContractWizardComplete: (taskTree: TaskTree) => void;
  handleIntentMessagesComplete: () => void;

  // Normal layout props
  mainList: any[];
  localTranslations: Record<string, string>;
  escalationTasks: any[];
  selectedMainIndex: number;
  selectedSubIndex: number | null | undefined;
  selectedRoot: boolean;
  selectedNode: any;
  selectedNodePath: { mainIndex: number; subIndex?: number } | null;
  handleSelectMain: (idx: number) => void;
  handleSelectSub: (idx: number | undefined, mainIdx?: number) => void;
  handleSelectAggregator: () => void;
  sidebarRef: React.RefObject<HTMLDivElement>;
  sidebarHandlers: any;
  handleParserCreate: (nodeId: string, node: any) => void;
  handleParserModify: (nodeId: string, node: any) => void;
  handleEngineChipClick: (nodeId: string, node: any, editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  handleGenerateAll: () => void;
  isAggregatedAtomic: boolean;
  sidebarManualWidth: number;
  isDraggingSidebar: boolean;
  handleSidebarResizeStart: (e: React.MouseEvent) => void;
  showMessageReview: boolean;
  showSynonyms: boolean;
  selectedIntentIdForTraining: string | null;
  setSelectedIntentIdForTraining: (id: string | null) => void;
  pendingEditorOpen: boolean;
  contractChangeRef: React.MutableRefObject<any>;
  taskType: string;
  handleProfileUpdate: (node: any) => void;
  updateSelectedNode: (node: any) => void;
  leftPanelMode: any;
  testPanelMode: any;
  tasksPanelMode: any;
  rightWidth: number;
  testPanelWidth: number;
  tasksPanelWidth: number;
  draggingPanel: any;
  setDraggingPanel: (panel: any) => void;
  setRightWidth: (width: number) => void;
  setTestPanelWidth: (width: number) => void;
  setTasksPanelWidth: (width: number) => void;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;

  // Modals
  serviceUnavailable: { service: string; message: string; endpoint?: string; onRetry?: () => void } | null;
  setServiceUnavailable: (value: any) => void;
  showContractDialog: boolean;
  pendingContractChange: { templateId: string; templateLabel: string; modifiedContract: any } | null;
  contractDialogHandlers: {
    handleKeep: () => void;
    handleDiscard: () => void;
    handleCancel: () => void;
  };
}

/**
 * Main layout component for ResponseEditor.
 */
export function ResponseEditorLayout(props: ResponseEditorLayoutProps) {
  const {
    rootRef,
    combinedClass,
    hideHeader,
    icon: Icon,
    iconColor,
    headerTitle,
    toolbarButtons,
    handleEditorClose,
    isGeneralizable,
    generalizationReason,
    showContractWizard,
    needsIntentMessages,
    task,
    taskTree,
    currentProjectId,
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
    sidebarHandlers,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleGenerateAll,
    isAggregatedAtomic,
    sidebarManualWidth,
    isDraggingSidebar,
    handleSidebarResizeStart,
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
  } = props;

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
