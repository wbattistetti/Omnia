// Presentation layer: TabRenderer component
// Renders different tab types (flow, responseEditor, conditionEditor, taskEditor, nonInteractive)

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import type {
  DockTab,
  DockTabFlow,
  DockTabResponseEditor,
  DockTabTaskEditor,
  DockTabConditionEditor,
  DockTabChat,
  DockTabErrorReport,
  DockTabFlowMapping,
  ToolbarButton,
} from '@dock/types';
import type { DockNode } from '@dock/types';
import { TaskType } from '@types/taskTypes';
import { resolveEditorKind } from '@taskEditor/EditorHost/resolveKind';
import { mapNode, closeTab, upsertAddNextTo } from '@dock/ops';
import { taskRepository } from '@services/TaskRepository';
import { FlowCanvasHost } from '../../FlowWorkspace/FlowCanvasHost';
import ResponseEditor from '../../TaskEditor/ResponseEditor';
import NonInteractiveResponseEditor from '../../TaskEditor/ResponseEditor/NonInteractiveResponseEditor';
import ConditionEditor from '../../conditions/ConditionEditor';
import { mergeConditionEditorVariablesWithLiveFlowchart } from '../../conditions/conditionEditorLiveVariables';
import TaskEditorHost from '../../TaskEditor/EditorHost/TaskEditorHost';
import { AssistantPanel } from '@components/ChatPanel/AssistantPanel';
import { ErrorReportPanel } from '@components/ChatPanel/ErrorReportPanel';
import { UnifiedFlowMappingPanel } from '@components/FlowMappingPanel';

export interface TabRendererProps {
  tab: DockTab;
  currentPid?: string;
  /** @deprecated Kept for compatibility; flow canvas always uses FlowWorkspaceStore (draft = in-memory). */
  isDraft?: boolean;
  setDockTree: React.Dispatch<React.SetStateAction<DockNode>>;
  editorCloseRefsMap: React.MutableRefObject<Map<string, () => Promise<boolean>>>;
  pdUpdate: any;
  testSingleNode?: (nodeId: string, nodeRows?: any[]) => Promise<void>;
  onFlowCreateTaskFlow?: (tabId: string, newFlowId: string, title: string, nodes: any[], edges: any[]) => void;
  onFlowOpenTaskFlow?: (tabId: string, taskFlowId: string, title: string) => void;
  /** Opens a subflow tab for a Flow-type row; creates flow if existingFlowId not provided. Title = row label for tab. */
  onOpenSubflowForTask?: (
    tabId: string,
    taskId: string,
    existingFlowId?: string,
    title?: string,
    canvasNodeId?: string,
    sourceFlowId?: string
  ) => void;
}

/**
 * Custom comparator for React.memo
 * Ignores toolbarButtons and headerColor changes for responseEditor to avoid unnecessary re-renders
 */
function tabContentComparator(prev: { tab: DockTab }, next: { tab: DockTab }): boolean {
  const prevTab = prev.tab;
  const nextTab = next.tab;

  // If id or type changes, always re-render
  if (prevTab.id !== nextTab.id || prevTab.type !== nextTab.type) {
    return false; // Re-render
  }

  // For responseEditor: if taskTree changes, re-render
  if (prevTab.type === 'responseEditor' && nextTab.type === 'responseEditor') {
    if (prevTab.taskTree !== nextTab.taskTree) {
      return false; // Re-render (taskTree changed)
    }

    // If task (id or instanceId) changes, re-render
    if (
      prevTab.task?.id !== nextTab.task?.id ||
      prevTab.task?.instanceId !== nextTab.task?.instanceId
    ) {
      return false; // Re-render
    }

    // Ignore toolbarButtons and headerColor - don't cause re-render
    return true; // NO re-render
  }

  if (prevTab.type === 'flow' && nextTab.type === 'flow') {
    if (prevTab.flowId !== nextTab.flowId || prevTab.title !== nextTab.title) {
      return false;
    }
    return true;
  }

  if (prevTab.type === 'flowMapping' && nextTab.type === 'flowMapping') {
    return prevTab.id === nextTab.id && prevTab.initialMode === nextTab.initialMode && prevTab.title === nextTab.title;
  }

  // For other tab types, use default behavior (re-render if any prop changes)
  return false; // Re-render
}

/**
 * Condition editor: merge dock-tab variable snapshot with live VariableCreationService names
 * and re-merge when task save syncs utterance variables (`variableStore:updated`).
 */
/** Flow canvas in dock: Variables / Interfaces toggles live in the dock tab bar (not fixed edge tabs). */
const FlowTabWithDockToolbar: React.FC<{
  tab: DockTabFlow;
  currentPid?: string;
  setDockTree: TabRendererProps['setDockTree'];
  testSingleNode?: TabRendererProps['testSingleNode'];
  onFlowCreateTaskFlow?: TabRendererProps['onFlowCreateTaskFlow'];
  onFlowOpenTaskFlow?: TabRendererProps['onFlowOpenTaskFlow'];
  onOpenSubflowForTask?: TabRendererProps['onOpenSubflowForTask'];
}> = ({
  tab,
  currentPid,
  setDockTree,
  testSingleNode,
  onFlowCreateTaskFlow,
  onFlowOpenTaskFlow,
  onOpenSubflowForTask,
}) => {
  const onToolbarUpdate = useCallback(
    (toolbar: ToolbarButton[], color: string) => {
      setDockTree((prev) =>
        mapNode(prev, (n) => {
          if (n.kind !== 'tabset') return n;
          const idx = n.tabs.findIndex((t) => t.id === tab.id);
          if (idx === -1 || n.tabs[idx].type !== 'flow') return n;
          const updatedTab = {
            ...n.tabs[idx],
            toolbarButtons: toolbar,
            headerColor: color,
          } as DockTabFlow;
          return {
            ...n,
            tabs: [...n.tabs.slice(0, idx), updatedTab, ...n.tabs.slice(idx + 1)],
          };
        })
      );
    },
    [tab.id, setDockTree]
  );

  return (
    <FlowCanvasHost
      projectId={currentPid ?? undefined}
      flowId={tab.flowId}
      onToolbarUpdate={onToolbarUpdate}
      testSingleNode={testSingleNode}
      onCreateTaskFlow={
        onFlowCreateTaskFlow
          ? (newFlowId, title, nodes, edges) => onFlowCreateTaskFlow(tab.id, newFlowId, title, nodes, edges)
          : undefined
      }
      onOpenTaskFlow={
        onFlowOpenTaskFlow ? (taskFlowId, title) => onFlowOpenTaskFlow(tab.id, taskFlowId, title) : undefined
      }
      onOpenSubflowForTask={
        onOpenSubflowForTask
          ? (taskId, existingFlowId, title, canvasNodeId) =>
              onOpenSubflowForTask(tab.id, taskId, existingFlowId, title, canvasNodeId, tab.flowId)
          : undefined
      }
    />
  );
};

const ConditionEditorDockTab: React.FC<{
  tab: DockTabConditionEditor;
  currentPid?: string;
  setDockTree: TabRendererProps['setDockTree'];
  editorCloseRefsMap: TabRendererProps['editorCloseRefsMap'];
}> = ({ tab, currentPid, setDockTree, editorCloseRefsMap }) => {
  const [variableRefreshSeq, setVariableRefreshSeq] = useState(0);

  useEffect(() => {
    return () => {
      editorCloseRefsMap.current.delete(tab.id);
    };
  }, [tab.id, editorCloseRefsMap]);

  useEffect(() => {
    const bump = () => setVariableRefreshSeq((s) => s + 1);
    document.addEventListener('variableStore:updated', bump);
    document.addEventListener('instanceRepository:updated', bump);
    return () => {
      document.removeEventListener('variableStore:updated', bump);
      document.removeEventListener('instanceRepository:updated', bump);
    };
  }, []);

  const handleRegisterOnClose = useCallback(
    (fn: () => Promise<boolean>) => {
      editorCloseRefsMap.current.set(tab.id, fn);
    },
    [tab.id, editorCloseRefsMap]
  );

  const mergedVariables = useMemo(() => {
    void variableRefreshSeq;
    return mergeConditionEditorVariablesWithLiveFlowchart(
      currentPid,
      tab.flowId,
      tab.variables as Record<string, unknown> | undefined
    );
  }, [currentPid, tab.flowId, tab.variables, variableRefreshSeq, tab.id]);

  return (
    <div
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        backgroundColor: '#1e1e1e',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ConditionEditor
        open={true}
        onClose={() => {
          try {
            console.log('[TabRenderer] ConditionEditor onClose', {
              tabId: tab.id,
              edgeId: tab.edgeId,
              conditionId: tab.conditionId,
            });
          } catch {
            /* noop */
          }
          setDockTree((prev) => closeTab(prev, tab.id));
          try {
            requestAnimationFrame(() => {
              document.dispatchEvent(new CustomEvent('flowchart:restoreViewport', { bubbles: true }));
            });
          } catch (err) {
            console.warn('[ConditionEditor] Failed to emit restore viewport event', err);
          }
        }}
        variables={mergedVariables}
        initialScript={tab.script}
        variablesTree={tab.variablesTree}
        label={tab.label}
        dockWithinParent={false}
        isGenerating={tab.isGenerating}
        edgeId={tab.edgeId}
        conditionId={tab.conditionId}
        flowId={tab.flowId}
        registerOnClose={handleRegisterOnClose}
        onRename={(next) => {
          setDockTree((prev) =>
            mapNode(prev, (n) => {
              if (n.kind === 'tabset') {
                const idx = n.tabs.findIndex((t) => t.id === tab.id);
                if (idx !== -1) {
                  const updated = [...n.tabs];
                  updated[idx] = { ...tab, title: next, label: next };
                  return { ...n, tabs: updated };
                }
              }
              return n;
            })
          );
          try {
            void import('../../../ui/events').then((m) => m.emitConditionEditorRename(next));
          } catch {
            /* noop */
          }
        }}
        onSave={(script) => {
          setDockTree((prev) =>
            mapNode(prev, (n) => {
              if (n.kind === 'tabset') {
                const idx = n.tabs.findIndex((t) => t.id === tab.id);
                if (idx !== -1) {
                  const updated = [...n.tabs];
                  updated[idx] = { ...tab, script };
                  return { ...n, tabs: updated };
                }
              }
              return n;
            })
          );
          try {
            void import('../../../ui/events').then((m) => m.emitConditionEditorSave(script));
          } catch {
            /* noop */
          }
        }}
      />
    </div>
  );
};

export const TabRenderer: React.FC<TabRendererProps> = React.memo(
  ({ tab, currentPid, isDraft: _isDraft, setDockTree, editorCloseRefsMap, pdUpdate, testSingleNode, onFlowCreateTaskFlow, onFlowOpenTaskFlow, onOpenSubflowForTask }) => {
    // Flow tab - FlowCanvasHost handles useFlowActions internally
    if (tab.type === 'flow') {
      return (
        <FlowTabWithDockToolbar
          tab={tab}
          currentPid={currentPid}
          setDockTree={setDockTree}
          testSingleNode={testSingleNode}
          onFlowCreateTaskFlow={onFlowCreateTaskFlow}
          onFlowOpenTaskFlow={onFlowOpenTaskFlow}
          onOpenSubflowForTask={onOpenSubflowForTask}
        />
      );
    }

    // Response Editor tab
    if (tab.type === 'responseEditor') {
      const responseEditorTab = tab as DockTabResponseEditor;
      useEffect(() => {
        return () => {
          editorCloseRefsMap.current.delete(tab.id);
        };
      }, [tab.id, editorCloseRefsMap]);

      /** Remount when tab or task identity changes so editor state cannot leak across tasks. */
      const editorKey = useMemo(
        () => `response-editor-${responseEditorTab.id}-${responseEditorTab.task?.id ?? 'no-task'}`,
        [responseEditorTab.id, responseEditorTab.task?.id]
      );

      // ✅ FIX: Restituisci un nuovo oggetto stabile solo con i valori necessari
      // Questo evita che cambi riferimento quando tab.task viene ricreato dal padre
      const stableTask = useMemo(() => {
        if (!tab.task) return undefined;
        // ✅ Restituisci un nuovo oggetto stabile solo con i valori necessari
        // Questo evita che cambi riferimento quando tab.task viene ricreato
        return {
          id: tab.task.id,
          type: tab.task.type,
          label: tab.task.label,
          instanceId: tab.task.instanceId,
          taskWizardMode: (tab.task as any).taskWizardMode,
          contextualizationTemplateId: (tab.task as any).contextualizationTemplateId,
          taskLabel: (tab.task as any).taskLabel,
          needsTaskContextualization: (tab.task as any).needsTaskContextualization,
          needsTaskBuilder: (tab.task as any).needsTaskBuilder,
        };
      }, [
        tab.task?.id,
        tab.task?.type,
        tab.task?.label,
        tab.task?.instanceId,
        (tab.task as any)?.taskWizardMode,
        (tab.task as any)?.contextualizationTemplateId,
        (tab.task as any)?.taskLabel,
        (tab.task as any)?.needsTaskContextualization,
        (tab.task as any)?.needsTaskBuilder,
      ]);

      const stableTaskTree = useMemo(() => {
        return tab.taskTree;
      }, [tab.taskTree, tab.id]);

      const stableOnToolbarUpdate = useCallback(
        (toolbar: ToolbarButton[], color: string) => {
          setDockTree(prev =>
            mapNode(prev, n => {
              if (n.kind === 'tabset') {
                const idx = n.tabs.findIndex(t => t.id === tab.id);
                if (idx !== -1 && n.tabs[idx].type === 'responseEditor') {
                  const updatedTab = {
                    ...n.tabs[idx],
                    toolbarButtons: toolbar,
                    headerColor: color,
                  } as DockTabResponseEditor;
                  return {
                    ...n,
                    tabs: [...n.tabs.slice(0, idx), updatedTab, ...n.tabs.slice(idx + 1)],
                  };
                }
              }
              return n;
            })
          );
        },
        [tab.id, setDockTree]
      );

      /** Ref-only (like conditionEditor): avoids extra setDockTree on mount → dock flash / flicker. */
      const handleRegisterOnClose = useCallback(
        (fn: () => Promise<boolean>) => {
          if (!tab.id) return;
          editorCloseRefsMap.current.set(tab.id, fn);
        },
        [tab.id, editorCloseRefsMap]
      );

      return (
        <div
          style={{
            width: '100%',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ResponseEditor
            key={editorKey}
            taskTree={stableTaskTree}
            task={stableTask}
            tabId={tab.id}
            setDockTree={setDockTree}
            hideHeader={true}
            onToolbarUpdate={stableOnToolbarUpdate}
            registerOnClose={handleRegisterOnClose}
            onClose={() => {
              // Closure is handled by tab.onClose in DockManager
            }}
          />
        </div>
      );
    }

    // Non-Interactive Editor tab
    if (tab.type === 'nonInteractive') {
      return (
        <div
          style={{
            width: '100%',
            flex: 1,
            minHeight: 0,
            backgroundColor: '#0b1220',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <NonInteractiveResponseEditor
            title={tab.title}
            value={tab.value}
            instanceId={tab.instanceId}
            onChange={(next) => {
              setDockTree(prev =>
                mapNode(prev, n => {
                  if (n.kind === 'tabset') {
                    const idx = n.tabs.findIndex(t => t.id === tab.id);
                    if (idx !== -1) {
                      const updated = [...n.tabs];
                      updated[idx] = { ...tab, value: next };
                      return { ...n, tabs: updated };
                    }
                  }
                  return n;
                })
              );
            }}
            onClose={async () => {
              const t0 = performance.now();
              try {
                const pid = pdUpdate.getCurrentProjectId() || undefined;
                if (pid && tab.instanceId) {
                  const text = tab.value?.template || '';
                  try {
                    console.log('[NI][close][PUT ok]', { instanceId: tab.instanceId, text });
                    taskRepository.updateTask(tab.instanceId, { text }, pid);
                    try {
                      document.dispatchEvent(
                        new CustomEvent('rowMessage:update', {
                          detail: { instanceId: tab.instanceId, text },
                        })
                      );
                    } catch { }
                  } catch { }
                }
              } catch (e) {
                try {
                  console.warn('[NI][close] background persist setup failed', e);
                } catch { }
              }
              setDockTree(prev => closeTab(prev, tab.id));
              const t1 = performance.now();
              try {
                console.log('[NI][close] panel closed in', Math.round(t1 - t0), 'ms');
              } catch { }
            }}
            accentColor={tab.accentColor}
          />
        </div>
      );
    }

    // Condition Editor tab
    if (tab.type === 'conditionEditor') {
      return (
        <ConditionEditorDockTab
          tab={tab as DockTabConditionEditor}
          currentPid={currentPid}
          setDockTree={setDockTree}
          editorCloseRefsMap={editorCloseRefsMap}
        />
      );
    }

    // Task Editor tab (BackendCall, etc.)
    if (tab.type === 'taskEditor') {
      const taskEditorTab = tab as DockTabTaskEditor;
      const editorKind = resolveEditorKind(
        tab.task || { id: '', type: TaskType.SayMessage, label: '' }
      );
      const isTaskTreeEditor = editorKind === 'ddt';

      useEffect(() => {
        return () => {
          editorCloseRefsMap.current.delete(tab.id);
        };
      }, [tab.id, editorCloseRefsMap]);

      /** DDT: ref-only; DockManager reads editorCloseRefsMap first (no tab tree patch on mount). */
      const handleRegisterOnClose = useCallback(
        (fn: () => Promise<boolean>) => {
          if (!isTaskTreeEditor || !tab.id) return;
          editorCloseRefsMap.current.set(tab.id, fn);
        },
        [tab.id, isTaskTreeEditor, editorCloseRefsMap]
      );

      return (
        <div
          style={{
            width: '100%',
            flex: 1,
            minHeight: 0,
            backgroundColor: '#0b1220',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <TaskEditorHost
            dockTabId={tab.id}
            task={tab.task || { id: '', type: TaskType.SayMessage, label: '' }}
            authoringFlowCanvasId={(tab as DockTabTaskEditor).flowId}
            onClose={() => {
              // Closure is handled by tab.onClose (only for TaskTree editor)
            }}
            onToolbarUpdate={(toolbar, color) => {
              setDockTree(prev => {
                return mapNode(prev, n => {
                  if (n.kind === 'tabset') {
                    const idx = n.tabs.findIndex(t => t.id === tab.id);
                    if (idx !== -1 && n.tabs[idx].type === 'taskEditor') {
                      const updatedTab = {
                        ...n.tabs[idx],
                        toolbarButtons: toolbar,
                        headerColor: color,
                      } as DockTabTaskEditor;
                      return { ...n, tabs: [...n.tabs.slice(0, idx), updatedTab, ...n.tabs.slice(idx + 1)] };
                    }
                  }
                  return n;
                });
              });
            }}
            hideHeader={true}
            registerOnClose={isTaskTreeEditor ? handleRegisterOnClose : undefined}
            setDockTree={setDockTree}
          />
        </div>
      );
    }

    // Unified flow mapping (backend / interface shell — demo)
    if (tab.type === 'flowMapping') {
      const mTab = tab as DockTabFlowMapping;
      return (
        <div className="h-full w-full min-h-0 flex flex-col bg-[#0c0f14]">
          <UnifiedFlowMappingPanel
            initialVariant={mTab.initialMode ?? 'backend'}
            title={mTab.title || 'Flow mapping'}
          />
        </div>
      );
    }

    // Chat Panel tab (Assistant)
    if (tab.type === 'chat') {
      const chatTab = tab as DockTabChat;

      return (
        <AssistantPanel
          task={chatTab.task || null}
          projectId={chatTab.projectId || currentPid || null}
          translations={chatTab.translations}
          taskTree={chatTab.taskTree}
          onUpdateTaskTree={() => { }}
          mode={chatTab.mode || 'interactive'}
          flowNodes={chatTab.flowNodes}
          flowEdges={chatTab.flowEdges}
          flowTasks={chatTab.flowTasks}
          useBackendMaterialization={chatTab.useBackendMaterialization || false}
          executionFlowName={chatTab.executionFlowName}
          executionLaunchType={chatTab.executionLaunchType}
          executionLaunchLabel={chatTab.executionLaunchLabel}
          onClosePanel={() => {
            setDockTree(prev => closeTab(prev, tab.id));
          }}
        />
      );
    }

    // Error Report Panel tab
    if (tab.type === 'errorReport') {
      return (
        <ErrorReportPanel
          onClose={() => {
            setDockTree(prev => closeTab(prev, tab.id));
          }}
        />
      );
    }

    return <div>Unknown tab type</div>;
  },
  tabContentComparator
);
