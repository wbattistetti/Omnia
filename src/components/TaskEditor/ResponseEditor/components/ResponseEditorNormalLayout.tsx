/**
 * ResponseEditorNormalLayout
 *
 * Component that renders the normal editor layout with Sidebar, Content, and RightPanels.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 */

import React from 'react';
import Sidebar from '../Sidebar';
import BehaviourEditor from '../BehaviourEditor';
import RightPanel, { RightPanelMode } from '../RightPanel';
import MessageReviewView from '../MessageReview/MessageReviewView';
import DataExtractionEditor from '../DataExtractionEditor';
import IntentListEditorWrapper from './IntentListEditorWrapper';
import { getdataList, getSubDataList } from '../ddtSelectors';
import { getIsTesting } from '../testingState';
import type { Task, TaskTree } from '../../../../types/taskTypes';

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
  selectedNodePath: { mainIndex: number; subIndex?: number } | null;
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
  handleSidebarResizeStart: (e: React.MouseEvent) => void;

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
  replaceSelectedDDT: (taskTree: TaskTree) => void;
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
  selectedNodePath,
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
  replaceSelectedDDT,
}: ResponseEditorNormalLayoutProps) {
  return (
    <>
      {/* Left navigation - IntentListEditor quando kind === "intent", Sidebar altrimenti */}
      {mainList[0]?.kind === 'intent' && task && (
        <IntentListEditorWrapper
          act={task as any}
          onIntentSelect={(intentId) => {
            setSelectedIntentIdForTraining(intentId);
          }}
        />
      )}
      {mainList[0]?.kind !== 'intent' && (
        <>
          <Sidebar
            ref={sidebarRef}
            mainList={mainList}
            selectedMainIndex={selectedMainIndex}
            onSelectMain={handleSelectMain}
            selectedSubIndex={selectedSubIndex}
            onSelectSub={handleSelectSub}
            aggregated={isAggregatedAtomic}
            rootLabel={taskTree?.label || 'Data'}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
        {/* Content */}
        <div style={{ display: 'flex', minHeight: 0, flex: 1, height: '100%', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: showMessageReview ? '8px' : '8px 8px 0 8px', height: '100%', overflow: 'hidden' }}>
            {showMessageReview ? (
              <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <MessageReviewView node={selectedNode} translations={localTranslations} updateSelectedNode={updateSelectedNode} />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {showSynonyms ? (
                  <div style={{ padding: 6, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <DataExtractionEditor
                      node={selectedNode}
                      taskType={taskType}
                      locale={'it-IT'}
                      intentSelected={mainList[0]?.kind === 'intent' ? selectedIntentIdForTraining || undefined : undefined}
                      task={task}
                      updateSelectedNode={updateSelectedNode}
                      contractChangeRef={contractChangeRef}
                      initialEditor={
                        pendingEditorOpen &&
                        selectedNode &&
                        (selectedNode.id === pendingEditorOpen.nodeId ||
                         selectedNode.templateId === pendingEditorOpen.nodeId)
                          ? pendingEditorOpen.editorType
                          : undefined
                      }
                      onChange={(profile) => {
                        if (getIsTesting()) {
                          return;
                        }
                        handleProfileUpdate({
                          ...profile,
                          ...(profile.kind && profile.kind !== 'auto' ? { _kindManual: profile.kind } : {}),
                        });
                      }}
                    />
                  </div>
                ) : (
                  <BehaviourEditor
                    node={selectedNode}
                    translations={localTranslations}
                    updateSelectedNode={updateSelectedNode}
                    selectedRoot={selectedRoot}
                    selectedSubIndex={selectedSubIndex}
                  />
                )}
              </div>
            )}
          </div>
          {/* Pannello sinistro: Behaviour/Personality/Recognition */}
          {!showSynonyms && !showMessageReview && leftPanelMode !== 'none' && leftPanelMode !== 'chat' && leftPanelMode !== 'actions' && rightWidth > 1 && (
            <RightPanel
              mode={leftPanelMode}
              width={rightWidth}
              onWidthChange={setRightWidth}
              onStartResize={() => setDraggingPanel('left')}
              dragging={draggingPanel === 'left'}
              taskTree={taskTree}
              task={task && 'templateId' in task ? task : null}
              projectId={currentProjectId}
              translations={localTranslations}
              selectedNode={selectedNode}
              onUpdateDDT={(updater) => {
                const updated = updater(taskTree);
                try { replaceSelectedTaskTree(updated); } catch { }
              }}
              tasks={escalationTasks}
            />
          )}
          {/* Pannello destro: Test */}
          {testPanelMode === 'chat' && testPanelWidth > 1 && (
            <>
              <RightPanel
                mode="chat"
                width={testPanelWidth}
                onWidthChange={setTestPanelWidth}
                onStartResize={() => setDraggingPanel('test')}
                dragging={draggingPanel === 'test'}
                hideSplitter={tasksPanelMode === 'actions' && tasksPanelWidth > 1}
                taskTree={taskTree}
                task={task && 'templateId' in task ? task : null}
                projectId={currentProjectId}
                translations={localTranslations}
                selectedNode={selectedNode}
                onUpdateDDT={(updater) => {
                  const updated = updater(taskTree);
                  try { replaceSelectedTaskTree(updated); } catch { }
                }}
                tasks={escalationTasks}
              />
              {/* Splitter condiviso tra Test e Tasks */}
              {tasksPanelMode === 'actions' && tasksPanelWidth > 1 && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggingPanel('shared');
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '#fb923c55';
                  }}
                  onMouseLeave={(e) => {
                    if (draggingPanel !== 'shared') {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                  style={{
                    width: 6,
                    cursor: 'col-resize',
                    background: draggingPanel === 'shared' ? '#fb923c55' : 'transparent',
                    transition: 'background 0.1s ease',
                    flexShrink: 0,
                    zIndex: draggingPanel === 'shared' ? 10 : 1,
                  }}
                  aria-label="Resize test and tasks panels"
                  role="separator"
                />
              )}
            </>
          )}
          {/* Splitter esterno tra contenuto principale e pannello Tasks */}
          {tasksPanelMode === 'actions' && tasksPanelWidth > 1 && (
            <>
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  tasksStartWidthRef.current = tasksPanelWidth;
                  tasksStartXRef.current = e.clientX;
                  setDraggingPanel('tasks');
                }}
                style={{
                  width: 8,
                  cursor: 'col-resize',
                  background: draggingPanel === 'tasks' ? '#fb923c' : '#fb923c22',
                  transition: 'background 0.15s ease',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: draggingPanel === 'tasks' ? 100 : 10,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                }}
                aria-label="Resize tasks panel"
                role="separator"
              />
              <RightPanel
                mode="actions"
                width={tasksPanelWidth}
                onWidthChange={setTasksPanelWidth}
                onStartResize={() => setDraggingPanel('tasks')}
                dragging={draggingPanel === 'tasks'}
                hideSplitter={true}
                taskTree={taskTree}
                tasks={escalationTasks}
                translations={localTranslations}
                selectedNode={selectedNode}
                onUpdateDDT={(updater) => {
                  const updated = updater(taskTree);
                  try { replaceSelectedTaskTree(updated); } catch { }
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
