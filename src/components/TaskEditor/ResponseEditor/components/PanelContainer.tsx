/**
 * PanelContainer
 *
 * Component that manages all right-side panels and splitters:
 * - Left Panel (Behaviour/Personality/Recognition)
 * - Test Panel (chat mode)
 * - Tasks Panel (actions mode)
 * - Shared splitter between Test and Tasks
 * - External splitter between main content and Tasks
 *
 * Extracted from ResponseEditorNormalLayout to reduce nesting and improve maintainability.
 */

import React from 'react';
import RightPanel, { RightPanelMode } from '@responseEditor/RightPanel';
import type { Task, TaskTree } from '@types/taskTypes';

export interface PanelContainerProps {
  // Panel modes
  leftPanelMode: RightPanelMode;
  testPanelMode: RightPanelMode;
  tasksPanelMode: RightPanelMode;

  // Panel widths
  rightWidth: number;
  testPanelWidth: number;
  tasksPanelWidth: number;

  // Dragging state
  draggingPanel: 'left' | 'test' | 'tasks' | 'shared' | null;
  setDraggingPanel: React.Dispatch<React.SetStateAction<'left' | 'test' | 'tasks' | 'shared' | null>>;

  // Width setters
  setRightWidth: (width: number) => void;
  setTestPanelWidth: (width: number) => void;
  setTasksPanelWidth: (width: number) => void;

  // Tasks panel resize refs
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;

  // Content state (to determine if left panel should be shown)
  showSynonyms: boolean;
  showMessageReview: boolean;

  // Data for panels
  taskTree: TaskTree | null | undefined;
  task: Task | null | undefined;
  currentProjectId: string | null;
  translations: Record<string, string>;
  selectedNode: any;
  escalationTasks: any[];

  // Tree operations
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
}

/**
 * Component that renders all right-side panels and splitters
 */
export function PanelContainer({
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
  showSynonyms,
  showMessageReview,
  taskTree,
  task,
  currentProjectId,
  translations,
  selectedNode,
  escalationTasks,
  replaceSelectedTaskTree,
}: PanelContainerProps) {
  // ✅ Left Panel: mostrato solo se non siamo in Recognition/Personality e se leftPanelMode è valido
  const hasLeftPanel = !showSynonyms && !showMessageReview && leftPanelMode !== 'none' && leftPanelMode !== 'chat' && leftPanelMode !== 'actions' && rightWidth > 1;

  // ✅ Test Panel: mostrato se testPanelMode è 'chat' e width > 1
  const hasTestPanel = testPanelMode === 'chat' && testPanelWidth > 1;

  // ✅ Tasks Panel: mostrato se tasksPanelMode è 'actions' e width > 1
  const hasTasksPanel = tasksPanelMode === 'actions' && tasksPanelWidth > 1;

  // ✅ Shared splitter: mostrato solo se entrambi Test e Tasks sono visibili
  const hasSharedSplitter = hasTestPanel && hasTasksPanel;

  // Se non ci sono pannelli da mostrare, ritorna null
  if (!hasLeftPanel && !hasTestPanel && !hasTasksPanel) {
    return null;
  }

  return (
    <>
      {/* Pannello sinistro: Behaviour/Personality/Recognition */}
      {hasLeftPanel && (
        <RightPanel
          mode={leftPanelMode}
          width={rightWidth}
          onWidthChange={setRightWidth}
          onStartResize={() => setDraggingPanel('left')}
          dragging={draggingPanel === 'left'}
          taskTree={taskTree}
          task={task && 'templateId' in task ? task : null}
          projectId={currentProjectId}
          translations={translations}
          selectedNode={selectedNode}
          onUpdateDDT={(updater) => {
            const updated = updater(taskTree);
            try { replaceSelectedTaskTree(updated); } catch { }
          }}
          tasks={escalationTasks}
        />
      )}

      {/* Pannello destro: Test */}
      {hasTestPanel && (
        <>
          <RightPanel
            mode="chat"
            width={testPanelWidth}
            onWidthChange={setTestPanelWidth}
            onStartResize={() => setDraggingPanel('test')}
            dragging={draggingPanel === 'test'}
            hideSplitter={hasSharedSplitter}
            taskTree={taskTree}
            task={task && 'templateId' in task ? task : null}
            projectId={currentProjectId}
            translations={translations}
            selectedNode={selectedNode}
            onUpdateDDT={(updater) => {
              const updated = updater(taskTree);
              try { replaceSelectedTaskTree(updated); } catch { }
            }}
            tasks={escalationTasks}
          />
          {/* Splitter condiviso tra Test e Tasks */}
          {hasSharedSplitter && (
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
      {hasTasksPanel && (
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
            translations={translations}
            selectedNode={selectedNode}
            onUpdateDDT={(updater) => {
              const updated = updater(taskTree);
              try { replaceSelectedTaskTree(updated); } catch { }
            }}
          />
        </>
      )}
    </>
  );
}
