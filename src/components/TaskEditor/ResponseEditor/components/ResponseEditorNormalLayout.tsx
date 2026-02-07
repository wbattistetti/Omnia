/**
 * ResponseEditorNormalLayout
 *
 * Component that renders the normal editor layout with Sidebar, Content, and RightPanels.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 */

import React from 'react';
import Sidebar from '@responseEditor/Sidebar';
import { RightPanelMode } from '@responseEditor/RightPanel';
import IntentListEditorWrapper from '@responseEditor/components/IntentListEditorWrapper';
import { MainContentArea } from '@responseEditor/components/MainContentArea';
import { PanelContainer } from '@responseEditor/components/PanelContainer';
import type { Task, TaskTree } from '@types/taskTypes';

export interface ResponseEditorNormalLayoutProps {
  // Data
  mainList: any[];
  taskTree: TaskTree | null | undefined;
  task: Task | null | undefined;
  currentProjectId: string | null;
  localTranslations: Record<string, string>;
  escalationTasks: any[];

  // Node selection
  selectedMainIndex: number;
  selectedSubIndex: number | null | undefined;
  selectedRoot: boolean;
  selectedNode: any;
  handleSelectMain: (idx: number) => void;
  handleSelectSub: (idx: number | undefined, mainIdx?: number) => void;
  handleSelectAggregator: () => void;
  sidebarRef: React.RefObject<HTMLDivElement>;

  // Sidebar handlers
  onChangeSubRequired: (mIdx: number, sIdx: number, required: boolean) => void;
  onReorderSub: (mIdx: number, fromIdx: number, toIdx: number) => void;
  onAddMain: (label: string) => void;
  onRenameMain: (mIdx: number, label: string) => void;
  onDeleteMain: (mIdx: number) => void;
  onAddSub: (mIdx: number, label: string) => void;
  onRenameSub: (mIdx: number, sIdx: number, label: string) => void;
  onDeleteSub: (mIdx: number, sIdx: number) => void;
  handleParserCreate: (nodeId: string, node: any) => void;
  handleParserModify: (nodeId: string, node: any) => void;
  handleEngineChipClick: (nodeId: string, node: any, editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  handleGenerateAll: () => void;

  // Sidebar state
  isAggregatedAtomic: boolean;
  sidebarManualWidth: number | null;
  isDraggingSidebar: boolean;
  handleSidebarResizeStart: (e: React.MouseEvent) => void; // ✅ FASE 2.1: Now comes from sidebar composito hook

  // Content state
  showMessageReview: boolean;
  showSynonyms: boolean;
  selectedIntentIdForTraining: string | null;
  setSelectedIntentIdForTraining: React.Dispatch<React.SetStateAction<string | null>>;
  pendingEditorOpen: { editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'; nodeId: string } | null;
  contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;
  taskType: number;
  handleProfileUpdate: (partialProfile: any) => void;
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;

  // Panel state
  leftPanelMode: RightPanelMode;
  testPanelMode: RightPanelMode;
  tasksPanelMode: RightPanelMode;
  rightWidth: number;
  testPanelWidth: number;
  tasksPanelWidth: number;
  draggingPanel: 'left' | 'test' | 'tasks' | 'shared' | null;
  setDraggingPanel: React.Dispatch<React.SetStateAction<'left' | 'test' | 'tasks' | 'shared' | null>>;
  setRightWidth: (width: number) => void;
  setTestPanelWidth: (width: number) => void;
  setTasksPanelWidth: (width: number) => void;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;

  // Tree operations
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
}

/**
 * Component that renders the normal editor layout
 */
export function ResponseEditorNormalLayout({
  mainList,
  taskTree,
  task,
  currentProjectId,
  localTranslations,
  escalationTasks,
  selectedMainIndex,
  selectedSubIndex,
  selectedRoot,
  selectedNode,
  handleSelectMain,
  handleSelectSub,
  handleSelectAggregator,
  sidebarRef,
  onChangeSubRequired,
  onReorderSub,
  onAddMain,
  onRenameMain,
  onDeleteMain,
  onAddSub,
  onRenameSub,
  onDeleteSub,
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
}: ResponseEditorNormalLayoutProps) {
  // ✅ Determina la struttura del grid in base alle condizioni
  const hasIntentEditor = mainList[0]?.kind === 'intent' && task;
  const hasSidebar = mainList[0]?.kind !== 'intent';

  // ✅ Calcola gridTemplateColumns in base alle condizioni
  const gridTemplateColumns = hasSidebar
    ? 'auto 8px 1fr'  // Sidebar + Resizer + Content
    : hasIntentEditor
      ? 'auto 1fr'     // IntentEditor + Content
      : '1fr';         // Solo Content

  // ✅ Container principale con CSS Grid
  const gridContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns,
    gridTemplateRows: '1fr',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    flex: 1,
  };

  // ✅ Stile per l'area del contenuto centrale (MainContentArea + PanelContainer)
  const contentAreaStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
    gridColumn: hasSidebar ? '3' : hasIntentEditor ? '2' : '1',
  };

  return (
    <div style={gridContainerStyle}>
      {/* Left navigation - IntentListEditor quando kind === "intent" */}
      {hasIntentEditor && (
        <IntentListEditorWrapper
          act={task as any}
          onIntentSelect={(intentId) => {
            setSelectedIntentIdForTraining(intentId);
          }}
        />
      )}

      {/* Sidebar quando kind !== "intent" */}
      {hasSidebar && (
        <>
          <Sidebar
            ref={sidebarRef}
            mainList={mainList}
            selectedMainIndex={selectedMainIndex}
            onSelectMain={handleSelectMain}
            selectedSubIndex={selectedSubIndex}
            onSelectSub={handleSelectSub}
            aggregated={isAggregatedAtomic}
            rootLabel={taskTree?.label ?? 'Data'}
            style={sidebarManualWidth ? { width: sidebarManualWidth, flexShrink: 0 } : { flexShrink: 0 }}
            onChangeSubRequired={onChangeSubRequired}
            onReorderSub={onReorderSub}
            onAddMain={onAddMain}
            onRenameMain={onRenameMain}
            onDeleteMain={onDeleteMain}
            onAddSub={onAddSub}
            onRenameSub={onRenameSub}
            onDeleteSub={onDeleteSub}
            onSelectAggregator={handleSelectAggregator}
            onParserCreate={handleParserCreate}
            onParserModify={handleParserModify}
            onEngineChipClick={handleEngineChipClick}
            onGenerateAll={handleGenerateAll}
          />
          {/* Resizer verticale tra Sidebar e contenuto principale */}
          <div
            onMouseDown={handleSidebarResizeStart}
            style={{
              width: 8,
              cursor: 'col-resize',
              background: isDraggingSidebar ? '#fb923c' : '#fb923c22',
              transition: 'background 0.15s ease',
              flexShrink: 0,
              position: 'relative',
              zIndex: isDraggingSidebar ? 100 : 10,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'none',
            }}
            aria-label="Resize sidebar"
            role="separator"
          />
        </>
      )}

      {/* Content Area: MainContentArea + PanelContainer */}
      <div style={contentAreaStyle}>
        <MainContentArea
          showMessageReview={showMessageReview}
          showSynonyms={showSynonyms}
          selectedNode={selectedNode}
          selectedRoot={selectedRoot}
          selectedSubIndex={selectedSubIndex}
          localTranslations={localTranslations}
          task={task}
          taskType={taskType}
          mainList={mainList}
          selectedIntentIdForTraining={selectedIntentIdForTraining}
          updateSelectedNode={updateSelectedNode}
          handleProfileUpdate={handleProfileUpdate}
          contractChangeRef={contractChangeRef}
          pendingEditorOpen={pendingEditorOpen}
        />
        <PanelContainer
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
          showSynonyms={showSynonyms}
          showMessageReview={showMessageReview}
          taskTree={taskTree}
          task={task}
          currentProjectId={currentProjectId}
          translations={localTranslations}
          selectedNode={selectedNode}
          escalationTasks={escalationTasks}
          replaceSelectedTaskTree={replaceSelectedTaskTree}
        />
      </div>
    </div>
  );
}
