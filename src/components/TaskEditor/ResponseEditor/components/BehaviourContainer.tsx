import React, { useState, useRef, useCallback, useEffect } from 'react';
import BehaviourEditor from '@responseEditor/BehaviourEditor';
import StepsStrip from '@responseEditor/StepsStrip';
import { StepTreeView } from '@responseEditor/features/step-management/tree-view/StepTreeView';
import RightPanel, { RightPanelMode } from '@responseEditor/RightPanel';
import type { TaskTree, Task } from '@types/taskTypes';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { useResponseEditorNavigation } from '@responseEditor/context/ResponseEditorNavigationContext';
import { BehaviourUiProvider, useBehaviourUi } from '@responseEditor/behaviour/BehaviourUiContext';
import { logBehaviourSteps, summarizeStepsShape } from '@responseEditor/behaviour/behaviourStepsDebug';

interface BehaviourContainerProps {
  node: any;
  translations: Record<string, string>;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  selectedRoot?: boolean;
  selectedSubIndex?: number | null;
  selectedPath?: number[];
  tasksPanelMode: RightPanelMode;
  tasksPanelWidth: number;
  setTasksPanelWidth: (width: number) => void;
  taskTree: TaskTree | null | undefined;
  task: Task | null | undefined;
  projectId: string | null;
  selectedNode: any;
  onUpdateDDT?: (updater: (tree: TaskTree) => TaskTree) => void;
  escalationTasks?: any[];
  viewMode?: 'tabs' | 'tree';
  onViewModeChange?: (mode: 'tabs' | 'tree') => void;
}

/**
 * Wraps Behaviour UI with BehaviourUiProvider (step tabs + parameter focus).
 * StepsStrip is mounted only here in tabs mode.
 */
export default function BehaviourContainer(props: BehaviourContainerProps) {
  const { node, selectedRoot, selectedSubIndex, selectedPath } = props;
  return (
    <BehaviourUiProvider
      node={node}
      selectedRoot={selectedRoot}
      selectedSubIndex={selectedSubIndex}
      selectedPath={selectedPath}
    >
      <BehaviourContainerInner {...props} />
    </BehaviourUiProvider>
  );
}

function BehaviourContainerInner({
  node,
  translations,
  updateSelectedNode,
  selectedRoot,
  selectedPath,
  selectedSubIndex,
  tasksPanelMode,
  tasksPanelWidth,
  setTasksPanelWidth,
  taskTree,
  task,
  projectId,
  selectedNode,
  onUpdateDDT,
  escalationTasks = [],
  viewMode: externalViewMode,
  onViewModeChange: _onViewModeChange,
}: BehaviourContainerProps) {
  const [internalViewMode] = useState<'tabs' | 'tree'>('tabs');
  void _onViewModeChange;
  const viewMode = externalViewMode ?? internalViewMode;
  const { taskId } = useResponseEditorContext();
  const navigation = useResponseEditorNavigation();
  const { uiStepKeys, selectedStepKey, setSelectedStepKey, requestFocusParameter } = useBehaviourUi();

  useEffect(() => {
    logBehaviourSteps('BehaviourContainer:stripVisibility', {
      viewMode,
      showStepsStrip: viewMode === 'tabs',
      uiStepKeysCount: uiStepKeys.length,
      willRenderStepsStrip: viewMode === 'tabs' && uiStepKeys.length > 0,
      nodeSteps: summarizeStepsShape(node?.steps),
    });
  }, [viewMode, uiStepKeys.length, node]);

  /** Map navigation auto-edit to BehaviourUi parameter focus (tabs + tree). */
  useEffect(() => {
    const t = navigation.autoEditTarget;
    if (!t) return;
    requestFocusParameter({
      kind: 'parameter',
      escalationIdx: t.escIdx,
      taskIdx: t.taskIdx,
      parameterId: 'text',
    });
    navigation.setAutoEditTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrow deps; full navigation object unstable when context uses no-op fallback
  }, [navigation.autoEditTarget, navigation.setAutoEditTarget, requestFocusParameter]);

  const [isResizing, setIsResizing] = useState(false);
  const tasksStartWidthRef = useRef<number>(tasksPanelWidth);
  const tasksStartXRef = useRef<number>(0);

  const hasTasksPanel = tasksPanelMode === 'actions' && tasksPanelWidth > 1;
  const showStepsStrip = viewMode === 'tabs';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      tasksStartWidthRef.current = tasksPanelWidth;
      tasksStartXRef.current = e.clientX;
    },
    [tasksPanelWidth]
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = tasksStartXRef.current - e.clientX;
    const newWidth = Math.max(200, Math.min(600, tasksStartWidthRef.current + deltaX));
    setTasksPanelWidth(newWidth);
  }, [isResizing, setTasksPanelWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {showStepsStrip && uiStepKeys.length > 0 && (
        <div
          style={{
            borderBottom: '1px solid #1f2340',
            background: '#0f1422',
            flexShrink: 0,
          }}
        >
          <StepsStrip
            stepKeys={uiStepKeys}
            selectedStepKey={selectedStepKey}
            onSelectStep={setSelectedStepKey}
            node={node}
            taskId={taskId}
            updateSelectedNode={updateSelectedNode}
            selectedRoot={selectedRoot}
            selectedPath={selectedPath}
            selectedSubIndex={selectedSubIndex}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: hasTasksPanel ? `0 0 calc(100% - ${tasksPanelWidth}px - 4px)` : '1 1 0%',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {viewMode === 'tabs' ? (
            <BehaviourEditor
              node={node}
              translations={translations}
              updateSelectedNode={updateSelectedNode}
            />
          ) : (
            <StepTreeView
              stepKeys={uiStepKeys}
              node={node}
              translations={translations}
              updateSelectedNode={updateSelectedNode}
            />
          )}
        </div>

        {hasTasksPanel && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              width: '4px',
              cursor: 'col-resize',
              backgroundColor: isResizing ? '#38bdf8' : 'transparent',
              flexShrink: 0,
              position: 'relative',
              zIndex: 10,
              transition: isResizing ? 'none' : 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(56, 189, 248, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }
            }}
            aria-label="Resize tasks panel"
            role="separator"
          />
        )}

        {hasTasksPanel && (
          <div
            style={{
              width: `${tasksPanelWidth}px`,
              flexShrink: 0,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <RightPanel
              mode="actions"
              width={tasksPanelWidth}
              onWidthChange={setTasksPanelWidth}
              onStartResize={() => setIsResizing(true)}
              dragging={isResizing}
              taskTree={taskTree}
              task={task}
              projectId={projectId}
              translations={translations}
              selectedNode={selectedNode}
              onUpdateDDT={onUpdateDDT}
              hideSplitter={true}
              tasks={escalationTasks}
            />
          </div>
        )}
      </div>
    </div>
  );
}
