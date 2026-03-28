import React, { useState, useRef, useCallback } from 'react';
import BehaviourEditor from '@responseEditor/BehaviourEditor';
import StepsStrip from '@responseEditor/StepsStrip';
import { StepTreeView } from '@responseEditor/features/step-management/tree-view/StepTreeView';
import RightPanel, { RightPanelMode } from '@responseEditor/RightPanel';
import type { TaskTree, Task } from '@types/taskTypes';
import { getNodeStepKeys } from '@responseEditor/core/domain';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { useResponseEditorNavigation } from '@responseEditor/context/ResponseEditorNavigationContext';

interface BehaviourContainerProps {
  // BehaviourEditor props
  node: any;
  translations: Record<string, string>;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  selectedRoot?: boolean;
  selectedSubIndex?: number | null;
  selectedPath?: number[];

  // TaskPanel props
  tasksPanelMode: RightPanelMode;
  tasksPanelWidth: number;
  setTasksPanelWidth: (width: number) => void;
  taskTree: TaskTree | null | undefined;
  task: Task | null | undefined;
  projectId: string | null;
  selectedNode: any;
  onUpdateDDT?: (updater: (tree: TaskTree) => TaskTree) => void;
  escalationTasks?: any[]; // ✅ Tasks da mostrare nel TaskPanel

  // ✅ NEW: View mode (tabs o tree)
  viewMode?: 'tabs' | 'tree';
  onViewModeChange?: (mode: 'tabs' | 'tree') => void;
}

/**
 * Container per BehaviourEditor con split container orizzontale:
 * - StepsStrip in alto (tutta la larghezza)
 * - Split container sotto: StepEditor (sx) | TaskPanel (dx, se visibile)
 */
export default function BehaviourContainer({
  node,
  translations,
  updateSelectedNode,
  selectedRoot,
  selectedSubIndex,
  selectedPath,
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
  onViewModeChange
}: BehaviourContainerProps) {
  // ✅ View mode: usa esterno se fornito, altrimenti stato interno
  const [internalViewMode, setInternalViewMode] = useState<'tabs' | 'tree'>('tabs');
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const { taskId } = useResponseEditorContext();

  // ✅ Calcola step keys per StepsStrip
  const stepKeys = React.useMemo(() => {
    if (selectedRoot) {
      return ['introduction'];
    }
    const steps = node ? getNodeStepKeys(node) : [];
    return steps;
  }, [node, selectedRoot, selectedSubIndex]);

  // ✅ Append V2 notConfirmed for main node if present
  const uiStepKeys = React.useMemo(() => {
    let result: string[];
    if (selectedRoot) {
      result = stepKeys;
    } else if ((selectedPath && selectedPath.length > 1) || selectedSubIndex != null) {
      result = stepKeys;
    } else if (stepKeys.length === 0) {
      // Manual (or legacy) node with no steps yet — do not show only notConfirmed.
      result = stepKeys;
    } else if (!stepKeys.includes('notConfirmed')) {
      result = [...stepKeys, 'notConfirmed'];
    } else {
      result = stepKeys;
    }
    return result;
  }, [stepKeys, selectedSubIndex, selectedPath, selectedRoot]);

  // ✅ Stato per step selezionato (sincronizzato con BehaviourEditor)
  const [selectedStepKey, setSelectedStepKey] = React.useState<string>(() => {
    if (uiStepKeys.length > 0) {
      return uiStepKeys[0];
    }
    return 'start';
  });

  const handleStepChange = React.useCallback((newStepKey: string) => {
    setSelectedStepKey(newStepKey);
  }, []);

  // ── Programmatic navigation from navigateToStep() ──────────────────────
  // BehaviourEditor only pushes (writes) to the context, never reads back.
  // BehaviourContainer is the owner of selectedStepKey, so it is the only
  // component that should apply external navigation requests.
  const navigation = useResponseEditorNavigation();
  React.useEffect(() => {
    if (
      navigation.currentStepKey &&
      navigation.currentStepKey !== selectedStepKey &&
      uiStepKeys.includes(navigation.currentStepKey)
    ) {
      setSelectedStepKey(navigation.currentStepKey);
    }
  // selectedStepKey intentionally omitted: we only want to react when the
  // navigation context changes (programmatic navigation), not on every local update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.currentStepKey, uiStepKeys]);
  const [isResizing, setIsResizing] = useState(false);
  const tasksStartWidthRef = useRef<number>(tasksPanelWidth);
  const tasksStartXRef = useRef<number>(0);

  // TaskPanel è visibile solo se tasksPanelMode === 'actions'
  const hasTasksPanel = tasksPanelMode === 'actions' && tasksPanelWidth > 1;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    tasksStartWidthRef.current = tasksPanelWidth;
    tasksStartXRef.current = e.clientX;
  }, [tasksPanelWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = tasksStartXRef.current - e.clientX; // Invertito: drag a sx aumenta width
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

  // ✅ StepsStrip visibile solo in vista tabs
  const showStepsStrip = viewMode === 'tabs';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* StepsStrip in alto (tutta la larghezza) - solo per vista tabs */}
      {showStepsStrip && uiStepKeys.length > 0 && (
        <div style={{
          borderBottom: '1px solid #1f2340',
          background: '#0f1422',
          flexShrink: 0
        }}>
          <StepsStrip
            stepKeys={uiStepKeys}
            selectedStepKey={selectedStepKey}
            onSelectStep={handleStepChange}
            node={node}
            taskId={taskId}
          />
        </div>
      )}

      {/* Split container: StepEditor | TaskPanel */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Vista Tab o Albero (sinistra) */}
        <div style={{
          flex: hasTasksPanel ? `0 0 calc(100% - ${tasksPanelWidth}px - 4px)` : '1 1 0%',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {viewMode === 'tabs' ? (
            // ✅ Vista Tab: BehaviourEditor (con StepEditor interno)
            <BehaviourEditor
              node={node}
              translations={translations}
              updateSelectedNode={updateSelectedNode}
              selectedRoot={selectedRoot}
              selectedSubIndex={selectedSubIndex}
              selectedPath={selectedPath}
              hideStepsStrip={showStepsStrip} // ✅ Nascondi StepsStrip in BehaviourEditor (mostrato sopra)
              selectedStepKey={selectedStepKey} // ✅ Passa step selezionato
              onStepChange={handleStepChange} // ✅ Callback per cambio step
            />
          ) : (
            // ✅ Vista Albero: StepTreeView (senza StepsStrip)
            <StepTreeView
              stepKeys={uiStepKeys}
              node={node}
              translations={translations}
              updateSelectedNode={updateSelectedNode}
              taskId={taskId}
            />
          )}
        </div>

        {/* Splitter (solo se TaskPanel è visibile) */}
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
              transition: isResizing ? 'none' : 'background-color 0.2s'
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

        {/* TaskPanel (destra, se visibile) */}
        {hasTasksPanel && (
          <div style={{
            width: `${tasksPanelWidth}px`,
            flexShrink: 0,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
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
              tasks={escalationTasks} // ✅ Tasks da mostrare nel pannello
            />
          </div>
        )}
      </div>
    </div>
  );
}
