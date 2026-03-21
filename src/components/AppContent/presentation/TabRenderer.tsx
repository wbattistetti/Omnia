// Presentation layer: TabRenderer component
// Renders different tab types (flow, responseEditor, conditionEditor, taskEditor, nonInteractive)

import React, { useMemo, useCallback, useEffect } from 'react';
import type { DockTab, DockTabResponseEditor, DockTabTaskEditor, DockTabConditionEditor, DockTabChat, DockTabErrorReport, DockTabFlowMapping, ToolbarButton } from '@dock/types';
import type { DockNode } from '@dock/types';
import { TaskType } from '@types/taskTypes';
import { resolveEditorKind } from '@taskEditor/EditorHost/resolveKind';
import { mapNode, closeTab, upsertAddNextTo } from '@dock/ops';
import { taskRepository } from '@services/TaskRepository';
import { FlowCanvasHost } from '../../FlowWorkspace/FlowCanvasHost';
import ResponseEditor from '../../TaskEditor/ResponseEditor';
import NonInteractiveResponseEditor from '../../TaskEditor/ResponseEditor/NonInteractiveResponseEditor';
import ConditionEditor from '../../conditions/ConditionEditor';
import TaskEditorHost from '../../TaskEditor/EditorHost/TaskEditorHost';
import { AssistantPanel } from '@components/ChatPanel/AssistantPanel';
import { ErrorReportPanel } from '@components/ChatPanel/ErrorReportPanel';
import { UnifiedFlowMappingPanel } from '@components/FlowMappingPanel';

export interface TabRendererProps {
  tab: DockTab;
  currentPid?: string;
  /** When true, flow tab is shown with empty canvas (no project in backend until first Save). */
  isDraft?: boolean;
  setDockTree: React.Dispatch<React.SetStateAction<DockNode>>;
  editorCloseRefsMap: React.MutableRefObject<Map<string, () => Promise<boolean>>>;
  pdUpdate: any;
  testSingleNode?: (nodeId: string, nodeRows?: any[]) => Promise<void>;
  onFlowCreateTaskFlow?: (tabId: string, newFlowId: string, title: string, nodes: any[], edges: any[]) => void;
  onFlowOpenTaskFlow?: (tabId: string, taskFlowId: string, title: string) => void;
  /** Opens a subflow tab for a Flow-type row; creates flow if existingFlowId not provided. Title = row label for tab. */
  onOpenSubflowForTask?: (tabId: string, taskId: string, existingFlowId?: string, title?: string) => void;
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

  if (prevTab.type === 'flowMapping' && nextTab.type === 'flowMapping') {
    return prevTab.id === nextTab.id && prevTab.initialMode === nextTab.initialMode && prevTab.title === nextTab.title;
  }

  // For other tab types, use default behavior (re-render if any prop changes)
  return false; // Re-render
}

export const TabRenderer: React.FC<TabRendererProps> = React.memo(
  ({ tab, currentPid, isDraft, setDockTree, editorCloseRefsMap, pdUpdate, testSingleNode, onFlowCreateTaskFlow, onFlowOpenTaskFlow, onOpenSubflowForTask }) => {
    // Flow tab - FlowCanvasHost handles useFlowActions internally
    if (tab.type === 'flow') {
      if (!currentPid && !isDraft) {
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            Waiting for project...
          </div>
        );
      }
      return (
        <FlowCanvasHost
          projectId={currentPid ?? undefined}
          flowId={tab.flowId}
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
            onOpenSubflowForTask ? (taskId, existingFlowId, title) => onOpenSubflowForTask(tab.id, taskId, existingFlowId, title) : undefined
          }
        />
      );
    }

    // Response Editor tab
    if (tab.type === 'responseEditor') {
      useEffect(() => {
        return () => {
          editorCloseRefsMap.current.delete(tab.id);
        };
      }, [tab.id, editorCloseRefsMap]);

      const editorKey = useMemo(() => {
        const instanceKey = tab.task?.instanceId || tab.task?.id || tab.id;
        return `response-editor-${instanceKey}`;
      }, [tab.task?.instanceId, tab.task?.id, tab.id]);

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

      const handleRegisterOnClose = useCallback(
        (fn: () => Promise<boolean>) => {
          if (!tab.id || !setDockTree) return;

          editorCloseRefsMap.current.set(tab.id, fn);

          setDockTree(prev =>
            mapNode(prev, n => {
              if (n.kind === 'tabset') {
                const idx = n.tabs.findIndex(t => t.id === tab.id);
                if (idx !== -1 && n.tabs[idx].type === 'responseEditor') {
                  const updatedTab = {
                    ...n.tabs[idx],
                    onClose: async (tab: DockTabResponseEditor) => {
                      const fn = editorCloseRefsMap.current.get(tab.id);
                      if (fn) {
                        try {
                          return await fn();
                        } catch (err) {
                          console.error('[TabRenderer] ❌ Error in editorCloseRef.current()', err);
                          return true;
                        }
                      }
                      return true;
                    },
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
        [tab.id, setDockTree, editorCloseRefsMap]
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
      useEffect(() => {
        return () => {
          // ✅ Cleanup: remove close handler when tab unmounts
          editorCloseRefsMap.current.delete(tab.id);
        };
      }, [tab.id, editorCloseRefsMap]);

      // ✅ SIMPLIFIED: Only update the map — DockManager reads directly from editorCloseRefsMap.
      // No setDockTree needed (avoids state-update race condition on fast close).
      const handleRegisterOnClose = useCallback(
        (fn: () => Promise<boolean>) => {
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
            backgroundColor: '#1e1e1e',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ConditionEditor
            open={true}
            onClose={() => {
              console.log('[TabRenderer] 🚪 [TRACE] ConditionEditor onClose called', {
                tabId: tab.id,
                edgeId: tab.edgeId,
                conditionId: tab.conditionId
              });
              setDockTree(prev => closeTab(prev, tab.id));
              try {
                requestAnimationFrame(() => {
                  document.dispatchEvent(
                    new CustomEvent('flowchart:restoreViewport', { bubbles: true })
                  );
                });
              } catch (err) {
                console.warn('[ConditionEditor] Failed to emit restore viewport event', err);
              }
            }}
            variables={tab.variables}
            initialScript={tab.script}
            variablesTree={tab.variablesTree}
            label={tab.label}
            dockWithinParent={false}
            isGenerating={tab.isGenerating} // ✅ Pass isGenerating flag
            edgeId={tab.edgeId} // ✅ Pass edgeId for error removal
            conditionId={tab.conditionId} // ✅ Pass conditionId (if edge is linked)
            flowId={tab.flowId}
            registerOnClose={handleRegisterOnClose} // ✅ NEW: Register close handler for dock tab
            onRename={(next) => {
              setDockTree(prev =>
                mapNode(prev, n => {
                  if (n.kind === 'tabset') {
                    const idx = n.tabs.findIndex(t => t.id === tab.id);
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
                (async () => {
                  (await import('../../../ui/events')).emitConditionEditorRename(next);
                })();
              } catch { }
            }}
            onSave={(script) => {
              setDockTree(prev =>
                mapNode(prev, n => {
                  if (n.kind === 'tabset') {
                    const idx = n.tabs.findIndex(t => t.id === tab.id);
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
                (async () => {
                  (await import('../../../ui/events')).emitConditionEditorSave(script);
                })();
              } catch { }
            }}
          />
        </div>
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

      const handleRegisterOnClose = useCallback(
        (fn: () => Promise<boolean>) => {
          if (!isTaskTreeEditor || !tab.id || !setDockTree) {
            return;
          }

          editorCloseRefsMap.current.set(tab.id, fn);

          setDockTree(prev =>
            mapNode(prev, n => {
              if (n.kind === 'tabset') {
                const idx = n.tabs.findIndex(t => t.id === tab.id);
                if (idx !== -1 && n.tabs[idx].type === 'taskEditor') {
                  const updatedTab = {
                    ...n.tabs[idx],
                    onClose: async (tab: DockTabTaskEditor) => {
                      const fn = editorCloseRefsMap.current.get(tab.id);
                      if (fn) {
                        try {
                          return await fn();
                        } catch (err) {
                          console.error('[TabRenderer][taskEditor] ❌ Error in editorCloseRef.current()', err);
                          return true;
                        }
                      }
                      return true;
                    },
                  } as DockTabTaskEditor;
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
        [tab.id, setDockTree, isTaskTreeEditor, editorCloseRefsMap]
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
            task={tab.task || { id: '', type: TaskType.SayMessage, label: '' }}
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
        />
      );
    }

    // Error Report Panel tab
    if (tab.type === 'errorReport') {
      return (
        <ErrorReportPanel
          onClose={() => {
            // Handle close if needed (e.g., remove tab from dock)
          }}
        />
      );
    }

    return <div>Unknown tab type</div>;
  },
  tabContentComparator
);
