import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { useFontClasses } from '../hooks/useFontClasses';
import { NewProjectModal } from './NewProjectModal';
import Sidebar from './Sidebar/Sidebar';
import LibraryLabel from './Sidebar/LibraryLabel';
import { ProjectDataService } from '../services/ProjectDataService';
import { useProjectData, useProjectDataUpdate } from '../context/ProjectDataContext';
import { Node, Edge } from 'reactflow';
import { FlowNode, EdgeData } from './Flowchart/types/flowTypes';
import { ProjectInfo } from '../types/project';
import { useEffect } from 'react';
import { ProjectService } from '../services/ProjectService';
import { ProjectData } from '../types/project';
import { SidebarThemeProvider } from './Sidebar/SidebarThemeContext';
// import ActEditor from './ActEditor';
// import { DockablePanelsHandle } from './DockablePanels';
// import DockablePanels from './DockablePanels';
import { FlowEditor } from './Flowchart/FlowEditor';
import { FlowWorkspace } from './FlowWorkspace/FlowWorkspace';
import { DockWorkspace } from './FlowWorkspace/DockWorkspace';
import { DockManager } from './Dock/DockManager';
import { DockNode, DockTab, DockTabResponseEditor, DockTabActEditor, ToolbarButton } from '../dock/types';
import { FlowCanvasHost } from './FlowWorkspace/FlowCanvasHost';
import { FlowWorkspaceProvider } from '../flows/FlowStore.tsx';
import { useFlowActions } from '../flows/FlowStore.tsx';
import { upsertAddNextTo, closeTab, activateTab, splitWithTab } from '../dock/ops';
import { resolveEditorKind } from './ActEditor/EditorHost/resolveKind';
import BackendBuilderStudio from '../BackendBuilder/ui/Studio';
import ResizableResponseEditor from './ActEditor/ResponseEditor/ResizableResponseEditor';
import ResizableNonInteractiveEditor from './ActEditor/ResponseEditor/ResizableNonInteractiveEditor';
import ResizableActEditorHost from './ActEditor/EditorHost/ResizableActEditorHost';
import { useActEditor } from './ActEditor/EditorHost/ActEditorContext';
import ConditionEditor from './conditions/ConditionEditor';
import DDEBubbleChat from './ChatSimulator/DDEBubbleChat';
import { useDDTContext } from '../context/DDTContext';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS } from './Sidebar/sidebarTheme';
// FASE 2: InstanceRepository import removed - using TaskRepository instead
// TaskRepository automatically syncs with InstanceRepository for backward compatibility
import { flowchartVariablesService } from '../services/FlowchartVariablesService';
import ResponseEditor from './ActEditor/ResponseEditor';
import NonInteractiveResponseEditor from './ActEditor/ResponseEditor/NonInteractiveResponseEditor';
import { taskRepository } from '../services/TaskRepository';
import { getTemplateId } from '../utils/taskHelpers';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

// Helper function to map over dock tree nodes
function mapNode(n: DockNode, f: (n: DockNode) => DockNode): DockNode {
  let mapped: DockNode;
  if (n.kind === 'split') {
    const children = n.children.map(c => mapNode(c, f));
    mapped = { ...n, children };
  } else {
    mapped = { ...n };
  }
  const res = f(mapped);
  return res;
}

interface AppContentProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  currentProject: ProjectData | null;
  setCurrentProject: (project: ProjectData | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  testPanelOpen: boolean;
  setTestPanelOpen: (open: boolean) => void;
  testNodeId: string | null;
  setTestNodeId: (id: string | null) => void;
  onPlayNode: (nodeId: string) => void;
}

export const AppContent: React.FC<AppContentProps> = ({
  appState,
  setAppState,
  currentProject,
  setCurrentProject,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  testPanelOpen,
  setTestPanelOpen,
  testNodeId,
  setTestNodeId,
  onPlayNode
}) => {
  const pdUpdate = useProjectDataUpdate();
  const currentPid = (() => { try { return pdUpdate.getCurrentProjectId(); } catch { return undefined; } })();

  // Dock tree (new dock manager)
  const [dockTree, setDockTree] = useState<DockNode>({
    kind: 'tabset',
    id: 'ts_main',
    tabs: [{ id: 'tab_main', title: 'Main', type: 'flow', flowId: 'main' }],
    active: 0
  });

  // ✅ Unified tab content renderer - Memoizzato con comparatore per evitare re-render inutili
  const UnifiedTabContent: React.FC<{ tab: DockTab }> = React.memo(
    ({ tab }) => {
      // 🔴 LOG CHIRURGICO 3: UnifiedTabContent render
      console.log('[DEBUG_UNIFIED_RENDER]', {
        tabId: tab.id,
        type: tab.type,
        toolbarButtons: tab.toolbarButtons,
        headerColor: tab.headerColor
      });

      const { upsertFlow, openFlowBackground } = useFlowActions();

      // Flow tab
      if (tab.type === 'flow') {
        // Check projectId is valid before rendering
        if (!currentPid) {
          return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>Waiting for project...</div>;
        }
        return (
          <FlowCanvasHost
            projectId={currentPid}
            flowId={tab.flowId}
            onCreateTaskFlow={(newFlowId, title, nodes, edges) => {
              // 1) upsert nel workspace per avere contenuto immediato
              upsertFlow({ id: newFlowId, title: title || newFlowId, nodes, edges });
              openFlowBackground(newFlowId);
              // 2) aggiungi tab accanto a quella corrente nel dock tree
              setDockTree(prev => upsertAddNextTo(prev, tab.id, { id: `tab_${newFlowId}`, title: title || 'Task', type: 'flow', flowId: newFlowId }));
            }}
            onOpenTaskFlow={(taskFlowId, title) => {
              // Apri la tab del task accanto a quella corrente (senza duplicati)
              setDockTree(prev => upsertAddNextTo(prev, tab.id, { id: `tab_${taskFlowId}`, title: title || 'Task', type: 'flow', flowId: taskFlowId }));
              openFlowBackground(taskFlowId);
            }}
          />
        );
      }

      // Response Editor tab
      if (tab.type === 'responseEditor') {
        // ✅ Stabilizza key, act, ddt, onToolbarUpdate per evitare re-mount
        const editorKey = useMemo(() => {
          const instanceKey = tab.act?.instanceId || tab.act?.id || tab.id;
          const key = `response-editor-${instanceKey}`;
          console.log('[DEBUG_MEMO] editorKey calculated', {
            instanceKey,
            key,
            tabId: tab.id,
            actInstanceId: tab.act?.instanceId,
            actId: tab.act?.id
          });
          return key;
        }, [tab.act?.instanceId, tab.act?.id, tab.id]);

        const stableAct = useMemo(() => {
          if (!tab.act) return undefined;
          return {
            id: tab.act.id,
            type: tab.act.type,
            label: tab.act.label,
            instanceId: tab.act.instanceId
          };
        }, [tab.act?.id, tab.act?.type, tab.act?.label, tab.act?.instanceId]);

        const stableDDT = useMemo(() => {
          const startStepTasksCount = (tab as any).ddt?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;
          console.log('[STABLE_DDT] Memoizing DDT', {
            tabId: tab.id,
            mainDataLength: (tab as any).ddt?.mainData?.length,
            startStepTasksCount
          });
          return tab.ddt;
        }, [tab.ddt, tab.id]);

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
                      headerColor: color
                    } as DockTabResponseEditor;
                    return {
                      ...n,
                      tabs: [
                        ...n.tabs.slice(0, idx),
                        updatedTab,
                        ...n.tabs.slice(idx + 1)
                      ]
                    };
                  }
                }
                return n;
              })
            );
          },
          [tab.id, setDockTree]
        );

        console.log('[DEBUG_MEMO] Rendering ResponseEditor', {
          editorKey,
          tabId: tab.id,
          stableDDTMainDataLength: stableDDT?.mainData?.length,
          stableActInstanceId: stableAct?.instanceId
        });

        return (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#0b1220' }}>
            <ResponseEditor
              key={editorKey}
              ddt={stableDDT}
              act={stableAct}
              tabId={tab.id}
              setDockTree={setDockTree}
              hideHeader={true}
              onToolbarUpdate={stableOnToolbarUpdate}
              onClose={() => {
                // ✅ Salvataggio gestito da tab.onClose (chiamato da DockManager)
                // Qui chiudiamo solo il tab
                setDockTree(prev => closeTab(prev, tab.id));
              }}
            />
          </div>
        );
      }

      // Non-Interactive Editor tab
      if (tab.type === 'nonInteractive') {
        return (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#0b1220' }}>
            <NonInteractiveResponseEditor
              title={tab.title}
              value={tab.value}
              instanceId={tab.instanceId}
              onChange={(next) => {
                // Update tab data in place
                setDockTree(prev => mapNode(prev, n => {
                  if (n.kind === 'tabset') {
                    const idx = n.tabs.findIndex(t => t.id === tab.id);
                    if (idx !== -1) {
                      const updated = [...n.tabs];
                      updated[idx] = { ...tab, value: next };
                      return { ...n, tabs: updated };
                    }
                  }
                  return n;
                }));
              }}
              onClose={async () => {
                const t0 = performance.now();
                try {
                  const svc = await import('../services/ProjectDataService');
                  const dataSvc: any = (svc as any).ProjectDataService;
                  const pid = pdUpdate.getCurrentProjectId() || undefined;
                  if (pid && tab.instanceId) {
                    const text = tab.value?.template || '';
                    void dataSvc.updateInstance(pid, tab.instanceId, { message: { text } })
                      .then(() => {
                        try {
                          console.log('[NI][close][PUT ok]', { instanceId: tab.instanceId, text });
                          taskRepository.updateTask(tab.instanceId, { text }, pid);
                        } catch { }
                      })
                      .catch((e: any) => { try { console.warn('[NI][close][PUT fail]', e); } catch { } });
                    try { document.dispatchEvent(new CustomEvent('rowMessage:update', { detail: { instanceId: tab.instanceId, text } })); } catch { }
                  }
                } catch (e) { try { console.warn('[NI][close] background persist setup failed', e); } catch { } }
                setDockTree(prev => closeTab(prev, tab.id));
                const t1 = performance.now();
                try { console.log('[NI][close] panel closed in', Math.round(t1 - t0), 'ms'); } catch { }
              }}
              accentColor={tab.accentColor}
            />
          </div>
        );
      }

      // Condition Editor tab
      if (tab.type === 'conditionEditor') {
        return (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#1e1e1e' }}>
            <ConditionEditor
              open={true}
              onClose={() => {
                setDockTree(prev => closeTab(prev, tab.id));
                // Restore previous viewport position
                setTimeout(() => {
                  try {
                    document.dispatchEvent(new CustomEvent('flowchart:restoreViewport', { bubbles: true }));
                  } catch (err) {
                    console.warn('[ConditionEditor] Failed to emit restore viewport event', err);
                  }
                }, 100);
              }}
              variables={tab.variables}
              initialScript={tab.script}
              variablesTree={tab.variablesTree}
              label={tab.label}
              dockWithinParent={false}
              onRename={(next) => {
                // Update tab title and label
                setDockTree(prev => mapNode(prev, n => {
                  if (n.kind === 'tabset') {
                    const idx = n.tabs.findIndex(t => t.id === tab.id);
                    if (idx !== -1) {
                      const updated = [...n.tabs];
                      updated[idx] = { ...tab, title: next, label: next };
                      return { ...n, tabs: updated };
                    }
                  }
                  return n;
                }));
                try { (async () => { (await import('../ui/events')).emitConditionEditorRename(next); })(); } catch { }
              }}
              onSave={(script) => {
                // Update tab script
                setDockTree(prev => mapNode(prev, n => {
                  if (n.kind === 'tabset') {
                    const idx = n.tabs.findIndex(t => t.id === tab.id);
                    if (idx !== -1) {
                      const updated = [...n.tabs];
                      updated[idx] = { ...tab, script };
                      return { ...n, tabs: updated };
                    }
                  }
                  return n;
                }));
                try { (async () => { (await import('../ui/events')).emitConditionEditorSave(script); })(); } catch { }
              }}
            />
          </div>
        );
      }

      // Act Editor tab (BackendCall, etc.)
      if (tab.type === 'actEditor') {
        const actEditorTab = tab as DockTabActEditor;
        return (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#0b1220' }}>
            <ResizableActEditorHost
              act={tab.act ? {
                id: tab.act.id,
                type: tab.act.type,
                label: tab.act.label,
                instanceId: tab.act.instanceId
              } : { id: '', type: 'Message', label: '' }}
              onClose={() => {
                setDockTree(prev => closeTab(prev, tab.id));
              }}
              onToolbarUpdate={(toolbar, color) => {
                // Update tab with toolbar and color
                setDockTree(prev => {
                  return mapNode(prev, n => {
                    if (n.kind === 'tabset') {
                      const idx = n.tabs.findIndex(t => t.id === tab.id);
                      if (idx !== -1 && n.tabs[idx].type === 'actEditor') {
                        const updatedTab = { ...n.tabs[idx], toolbarButtons: toolbar, headerColor: color } as DockTabActEditor;
                        return { ...n, tabs: [...n.tabs.slice(0, idx), updatedTab, ...n.tabs.slice(idx + 1)] };
                      }
                    }
                    return n;
                  });
                });
              }}
              hideHeader={true}
            />
          </div>
        );
      }

      return <div>Unknown tab type</div>;
    },
    // ✅ Comparatore personalizzato: ignora toolbarButtons e headerColor per responseEditor
    (prev, next) => {
      // 🔴 LOG CHIRURGICO CRITICO: Comparatore
      console.log('[DEBUG_MEMO] UnifiedTabContent compare', {
        prevId: prev.tab.id,
        nextId: next.tab.id,
        prevToolbar: prev.tab.toolbarButtons,
        nextToolbar: next.tab.toolbarButtons,
        prevHeader: prev.tab.headerColor,
        nextHeader: next.tab.headerColor,
        prevDDT: prev.tab.ddt,
        nextDDT: next.tab.ddt,
        sameTabObject: prev.tab === next.tab
      });

      const prevTab = prev.tab;
      const nextTab = next.tab;

      // 🔴 LOG CHIRURGICO 1: Comparatore (dettagli)
      console.log('[DEBUG_MEMO] Comparatore chiamato', {
        prevId: prevTab.id,
        nextId: nextTab.id,
        prevType: prevTab.type,
        nextType: nextTab.type,
        prevDDTRef: prevTab.ddt,
        nextDDTRef: nextTab.ddt,
        ddtRefChanged: prevTab.ddt !== nextTab.ddt,
        prevActId: prevTab.act?.id,
        nextActId: nextTab.act?.id,
        prevInstanceId: prevTab.act?.instanceId,
        nextInstanceId: nextTab.act?.instanceId,
        prevDDTMainDataLength: prevTab.ddt?.mainData?.length,
        nextDDTMainDataLength: nextTab.ddt?.mainData?.length,
        prevDDTMainDataFirstLabel: prevTab.ddt?.mainData?.[0]?.label,
        nextDDTMainDataFirstLabel: nextTab.ddt?.mainData?.[0]?.label
      });

      // Se cambia id o type, re-render sempre
      if (prevTab.id !== nextTab.id || prevTab.type !== nextTab.type) {
        console.log('[DEBUG_MEMO] DECISIONE: re-render (id/type changed)');
        return false; // Re-render
      }

      // ✅ Per responseEditor: dockTree è la fonte di verità - se ddt cambia, re-render
      if (prevTab.type === 'responseEditor' && nextTab.type === 'responseEditor') {
        // ✅ Se ddt cambia reference, re-render SEMPRE (dockTree è stato aggiornato)
        if (prevTab.ddt !== nextTab.ddt) {
          const prevStartTasksCount = prevTab.ddt?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;
          const nextStartTasksCount = nextTab.ddt?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;
          console.log('[DEBUG_MEMO] DECISIONE: re-render (ddt changed from dockTree)', {
            prevStartTasksCount,
            nextStartTasksCount,
            ddtRefChanged: true
          });
          return false; // Re-render (ddt cambiato dal dockTree)
        }

        // Se cambia act (id o instanceId), re-render
        if (
          prevTab.act?.id !== nextTab.act?.id ||
          prevTab.act?.instanceId !== nextTab.act?.instanceId
        ) {
          console.log('[DEBUG_MEMO] DECISIONE: re-render (act changed)');
          return false; // Re-render
        }

        // ✅ Ignora toolbarButtons e headerColor - non causano re-render
        console.log('[DEBUG_MEMO] DECISIONE: SKIP re-render (only toolbar/color changed or no significant change)');
        return true; // NO re-render
      }

      // Per altri tipi di tab, usa il comportamento di default (re-render se qualsiasi prop cambia)
      return false; // Re-render
    }
  );

  // ✅ Memoize renderTabContent - senza dipendere da setDockTree
  const renderTabContent = React.useCallback((tab: DockTab) => {
    // 🔴 LOG CHIRURGICO 2: renderTabContent
    console.log('[DEBUG_RENDER_TAB_CONTENT]', {
      tabId: tab.id,
      tabType: tab.type,
      renderTabContentCalled: true
    });
    return <UnifiedTabContent tab={tab} />;
  }, [currentPid]); // ✅ Rimossa dipendenza da setDockTree
  // Safe access: avoid calling context hook if provider not mounted (e.g., during hot reload glitches)
  let refreshData: () => Promise<void> = async () => { };
  try {
    const ctx = useProjectDataUpdate();
    refreshData = ctx.refreshData;
  } catch (e) {
    // Provider not available yet; use no-op and rely on provider after mount
    refreshData = async () => { };
  }
  // Access full project data for static variables extraction
  let projectData: any = null;
  try {
    projectData = useProjectData().data;
  } catch { }
  const ddtContext = useDDTContext();
  const getTranslationsForDDT = ddtContext.getTranslationsForDDT;
  // const setTranslationsForDDT = ddtContext.setTranslationsForDDT;

  // Usa ActEditor context invece di selectedDDT per unificare l'apertura editor
  const actEditorCtx = useActEditor();

  // Listen to open event for non-interactive acts (open as docking tab)
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      const instanceId = d.instanceId;

      // Read message text from Task (must exist)
      if (!instanceId) return;

      const task = taskRepository.getTask(instanceId);

      if (!task) {
        // Task doesn't exist, don't open editor
        return;
      }

      const template = task.text || '';

      // Open as docking tab instead of fixed panel
      const tabId = `ni_${instanceId}`;
      setDockTree(prev => {
        // Check if already open
        const existing = (function findTab(n: DockNode): boolean {
          if (n.kind === 'tabset') return n.tabs.some(t => t.id === tabId);
          if (n.kind === 'split') return n.children.some(findTab);
          return false;
        })(prev);

        if (existing) return prev; // Already open, don't duplicate

        // Add next to active tab
        return upsertAddNextTo(prev, 'tab_main', {
          id: tabId,
          title: d.title || 'Agent message',
          type: 'nonInteractive',
          instanceId: instanceId,
          value: { template, samples: {}, vars: [] },
          accentColor: d.accentColor
        });
      });
    };
    document.addEventListener('nonInteractiveEditor:open', handler as any);
    return () => document.removeEventListener('nonInteractiveEditor:open', handler as any);
  }, []);

  // Listen for ActEditor open events (open as docking tab)
  React.useEffect(() => {
    const h = async (e: any) => {
      console.log('📥 [AppContent] Evento actEditor:open ricevuto', {
        hasDetail: !!e?.detail,
        detail: e?.detail,
        timestamp: new Date().toISOString()
      });
      try {
        const d = (e && e.detail) || {};
        if (!d || !d.id || !d.type) {
          console.warn('⚠️ [AppContent] Evento actEditor:open ignorato - dettagli mancanti', {
            hasD: !!d,
            hasId: !!d?.id,
            hasType: !!d?.type
          });
          return;
        }

        // Get instanceId from event
        const instanceId = d.instanceId || d.id;

        console.log('✅ [AppContent] Processando evento actEditor:open', {
          id: d.id,
          type: d.type,
          label: d.label,
          instanceId,
          hasDDT: !!d.ddt,
          ddtMainDataLength: d.ddt?.mainData?.length || 0,
          templateId: d.templateId
        });

        // Determine editor kind based on act type
        const editorKind = resolveEditorKind({ type: d.type, id: d.id, label: d.label || d.name });

        console.log('🔍 [AppContent] Editor kind determinato', {
          editorKind,
          type: d.type
        });

        // Open as docking tab in bottom split (1/3 height)
        const tabId = `act_${d.id}`;

        // ✅ Prepare DDT BEFORE calling setDockTree (all async work here)
        let preparedDDT: any = null;

        if (editorKind === 'ddt') {
          // Open ResponseEditor for DDT types (DataRequest, ProblemClassification, etc.)
          // ✅ PRIORITÀ: Usa DDT dall'evento se presente (copia del template già costruita)
          let ddt = d.ddt; // ✅ Usa DDT dall'evento (se presente)

          if (ddt) {
            // ✅ DDT presente nell'evento: salvalo nel task per persistenza
            // Assicurati che il task esista
            let task = taskRepository.getTask(instanceId);
            if (!task) {
              const action = d.type === 'DataRequest' ? 'GetData' :
                d.type === 'Message' ? 'SayMessage' :
                  d.type === 'ProblemClassification' ? 'ClassifyProblem' :
                    d.type === 'BackendCall' ? 'callBackend' : 'SayMessage';
              task = taskRepository.createTask(action, undefined, instanceId);
            }
            // ✅ Salva DDT nel task (campi diretti, niente wrapper)
            taskRepository.updateTask(instanceId, {
              ...ddt,  // Spread: label, mainData, stepPrompts, ecc.
              templateId: d.templateId || task.templateId  // Mantieni templateId se presente
            }, pdUpdate?.getCurrentProjectId());
            preparedDDT = ddt;
          } else {
            // Se non presente nell'evento, carica dal task
            let task = taskRepository.getTask(instanceId);

            if (!task) {
              // Task doesn't exist, create it with empty DDT
              const action = d.type === 'DataRequest' ? 'GetData' :
                d.type === 'Message' ? 'SayMessage' :
                  d.type === 'ProblemClassification' ? 'ClassifyProblem' :
                    d.type === 'BackendCall' ? 'callBackend' : 'SayMessage';
              // ✅ Crea task con DDT vuoto (campi diretti, niente wrapper)
              task = taskRepository.createTask(action, {
                label: d.label || 'New DDT',
                mainData: []
              }, instanceId);
            }

            // ✅ Load DDT async (if task has templateId, build from template)
            if (task && task.templateId) {
              try {
                const { buildDDTFromTemplate } = await import('../utils/ddtMergeUtils');
                ddt = await buildDDTFromTemplate(task);
              } catch (err) {
                console.error('[AppContent] Error loading DDT from template:', err);
              }
            }

            // ✅ Fallback: if no DDT loaded, build from task or create empty
            if (!ddt) {
              if (task?.mainData && task.mainData.length > 0) {
                // Task has mainData (old format or standalone)
                ddt = {
                  label: task.label || d.label || 'New DDT',
                  mainData: task.mainData,
                  stepPrompts: task.stepPrompts,
                  constraints: task.constraints,
                  examples: task.examples
                };
              } else {
                // DDT doesn't exist, create empty one
                ddt = { label: d.label || 'New DDT', mainData: [] };
                // Update task with empty DDT (campi diretti)
                taskRepository.updateTask(instanceId, {
                  label: ddt.label,
                  mainData: ddt.mainData
                }, pdUpdate?.getCurrentProjectId());
              }
            }

            preparedDDT = ddt;
          }
        }

        // ✅ Now call setDockTree with prepared data (synchronous function)
        setDockTree(prev => {
          // Check if already open
          const existing = (function findTab(n: DockNode): boolean {
            if (n.kind === 'tabset') return n.tabs.some(t => t.id === tabId);
            if (n.kind === 'split') return n.children.some(findTab);
            return false;
          })(prev);

          if (existing) {
            // Tab already open: ALWAYS update DDT if editorKind is 'ddt' and preparedDDT is available
            // This synchronizes dockTree with taskRepository when reopening the editor
            if (editorKind === 'ddt' && preparedDDT) {
              // Get current DDT from existing tab for comparison
              let currentTabDDT: any = null;
              mapNode(prev, n => {
                if (n.kind === 'tabset') {
                  const tab = n.tabs.find(t => t.id === tabId);
                  if (tab && tab.type === 'responseEditor') {
                    currentTabDDT = (tab as any).ddt;
                  }
                }
                return n;
              });

              const currentStartStepTasksCount = currentTabDDT?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;
              const newStartStepTasksCount = preparedDDT?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;

              console.log('[DOCK_SYNC] 🔄 Updating existing tab DDT from taskRepository', {
                tabId,
                currentStartStepTasksCount,
                newStartStepTasksCount,
                mainDataLength: preparedDDT?.mainData?.length,
                willUpdate: currentStartStepTasksCount !== newStartStepTasksCount || JSON.stringify(currentTabDDT) !== JSON.stringify(preparedDDT)
              });

              // Update tab.ddt with preparedDDT, then activate
              const updated = mapNode(prev, n => {
                if (n.kind === 'tabset') {
                  const idx = n.tabs.findIndex(t => t.id === tabId);
                  if (idx !== -1 && n.tabs[idx].type === 'responseEditor') {
                    const existingTab = n.tabs[idx] as DockTabResponseEditor;
                    // ✅ Create/update onClose callback - will read tab.ddt when called (which is updated during editing)
                    const handleTabClose = async (tab: DockTabResponseEditor) => {
                      const key = tab.act?.instanceId || tab.act?.id;
                      if (!key) return;

                      // ✅ Read DDT from tab (which is updated by updateSelectedNode during editing)
                      const ddtToSave = tab.ddt;
                      const hasDDT = ddtToSave && Object.keys(ddtToSave).length > 0 && ddtToSave.mainData && ddtToSave.mainData.length > 0;

                      if (hasDDT) {
                        const startStepTasksCount = ddtToSave?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;
                        console.log('[DOCK_CLOSE] 💾 Saving DDT to taskRepository (SYNC - blocking close)', {
                          key,
                          startStepTasksCount,
                          mainDataLength: ddtToSave?.mainData?.length
                        });

                        try {
                          let task = taskRepository.getTask(key);
                          if (!task) {
                            const action = tab.act?.type === 'DataRequest' ? 'GetData' :
                              tab.act?.type === 'Message' ? 'SayMessage' :
                                tab.act?.type === 'ProblemClassification' ? 'ClassifyProblem' :
                                  tab.act?.type === 'BackendCall' ? 'callBackend' : 'GetData';
                            task = taskRepository.createTask(action, undefined, key);
                          }

                          const currentTemplateId = getTemplateId(task);

                          if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'getdata') {
                            await taskRepository.updateTask(key, {
                              templateId: 'GetData',
                              label: ddtToSave.label,
                              mainData: ddtToSave.mainData,
                              constraints: ddtToSave.constraints,
                              examples: ddtToSave.examples,
                              nlpContract: ddtToSave.nlpContract,
                              introduction: ddtToSave.introduction
                            }, pdUpdate?.getCurrentProjectId());
                          } else {
                            await taskRepository.updateTask(key, {
                              label: ddtToSave.label,
                              mainData: ddtToSave.mainData,
                              constraints: ddtToSave.constraints,
                              examples: ddtToSave.examples,
                              nlpContract: ddtToSave.nlpContract,
                              introduction: ddtToSave.introduction
                            }, pdUpdate?.getCurrentProjectId());
                          }

                          console.log('[DOCK_CLOSE] ✅ Save completed - repository is now up to date', {
                            key,
                            startStepTasksCount
                          });
                        } catch (err) {
                          console.error('[DOCK_CLOSE] ❌ Failed to save to taskRepository', err);
                        }
                      }
                    };

                    const updatedTab = { ...existingTab, ddt: preparedDDT, onClose: handleTabClose };
                    console.log('[DOCK_SYNC] ✅ Tab DDT synchronized', {
                      tabId,
                      updatedStartStepTasksCount: updatedTab.ddt?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0
                    });
                    return {
                      ...n,
                      tabs: [
                        ...n.tabs.slice(0, idx),
                        updatedTab,
                        ...n.tabs.slice(idx + 1)
                      ]
                    };
                  }
                }
                return n;
              });
              return activateTab(updated, tabId);
            }
            // Tab already open, just activate it (for non-DDT editors or when preparedDDT is not available)
            console.log('[DOCK_SYNC] ⚠️ Tab exists but preparedDDT not available or not DDT editor', {
              tabId,
              editorKind,
              hasPreparedDDT: !!preparedDDT
            });
            return activateTab(prev, tabId);
          }

          // Find the root tabset (main canvas)
          const findRootTabset = (n: DockNode): string | null => {
            if (n.kind === 'tabset') return n.id;
            if (n.kind === 'split') {
              // Prefer the first child (usually the main canvas)
              if (n.children.length > 0) {
                const found = findRootTabset(n.children[0]);
                if (found) return found;
              }
            }
            return null;
          };

          const rootTabsetId = findRootTabset(prev) || 'ts_main';

          // Open correct editor based on editorKind
          if (editorKind === 'message') {
            // Open NonInteractiveResponseEditor for Message type
            const task = taskRepository.getTask(instanceId);

            if (!task) {
              // Task doesn't exist, don't open editor
              return prev;
            }

            // Load message text from task value
            const messageText = task.text || '';

            return splitWithTab(prev, rootTabsetId, 'bottom', {
              id: tabId,
              title: d.label || d.name || 'Message',
              type: 'nonInteractive',
              instanceId: instanceId,
              value: { template: messageText },
              accentColor: '#059669'
            });
          } else if (editorKind === 'ddt') {
            // ✅ Use prepared DDT (all async work done above)
            const startStepTasksCount = preparedDDT?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;
            console.log('[DOCK_CREATE] 🆕 Creating new tab with DDT from taskRepository', {
              tabId,
              instanceId,
              mainDataLength: preparedDDT?.mainData?.length,
              startStepTasksCount,
              hasPreparedDDT: !!preparedDDT
            });

            // ✅ Create onClose callback for saving before closing
            // NOTE: DockManager will pass the tab to onClose, so we can read tab.ddt (which is updated during editing)
            const handleTabClose = async (tab: DockTabResponseEditor) => {
              const key = tab.act?.instanceId || tab.act?.id;
              if (!key) return;

              // ✅ Read DDT from tab (which is updated by updateSelectedNode during editing)
              const ddtToSave = tab.ddt;
              const hasDDT = ddtToSave && Object.keys(ddtToSave).length > 0 && ddtToSave.mainData && ddtToSave.mainData.length > 0;

              if (hasDDT) {
                const startStepTasksCount = ddtToSave?.mainData?.[0]?.steps?.start?.escalations?.[0]?.tasks?.length || 0;
                console.log('[DOCK_CLOSE] 💾 Saving DDT to taskRepository (SYNC - blocking close)', {
                  key,
                  startStepTasksCount,
                  mainDataLength: ddtToSave?.mainData?.length
                });

                try {
                  let task = taskRepository.getTask(key);
                  if (!task) {
                    const action = tab.act?.type === 'DataRequest' ? 'GetData' :
                      tab.act?.type === 'Message' ? 'SayMessage' :
                        tab.act?.type === 'ProblemClassification' ? 'ClassifyProblem' :
                          tab.act?.type === 'BackendCall' ? 'callBackend' : 'GetData';
                    task = taskRepository.createTask(action, undefined, key);
                  }

                  const currentTemplateId = getTemplateId(task);

                  if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'getdata') {
                    await taskRepository.updateTask(key, {
                      templateId: 'GetData',
                      label: ddtToSave.label,
                      mainData: ddtToSave.mainData,
                      constraints: ddtToSave.constraints,
                      examples: ddtToSave.examples,
                      nlpContract: ddtToSave.nlpContract,
                      introduction: ddtToSave.introduction
                    }, pdUpdate?.getCurrentProjectId());
                  } else {
                    await taskRepository.updateTask(key, {
                      label: ddtToSave.label,
                      mainData: ddtToSave.mainData,
                      constraints: ddtToSave.constraints,
                      examples: ddtToSave.examples,
                      nlpContract: ddtToSave.nlpContract,
                      introduction: ddtToSave.introduction
                    }, pdUpdate?.getCurrentProjectId());
                  }

                  console.log('[DOCK_CLOSE] ✅ Save completed - repository is now up to date', {
                    key,
                    startStepTasksCount
                  });
                } catch (err) {
                  console.error('[DOCK_CLOSE] ❌ Failed to save to taskRepository', err);
                }
              }
            };

            return splitWithTab(prev, rootTabsetId, 'bottom', {
              id: tabId,
              title: d.label || d.name || 'Response Editor',
              type: 'responseEditor',
              ddt: preparedDDT,
              act: {
                id: String(d.id),
                type: d.type,
                label: d.label || d.name,
                instanceId: d.instanceId || d.id
              },
              headerColor: '#9a4f00', // Orange color from ResponseEditor header
              toolbarButtons: [], // Will be updated via callback
              onClose: handleTabClose // ✅ Callback for saving before closing
            });
          } else if (editorKind === 'backend') {
            // Open BackendCallEditor for BackendCall type
            return splitWithTab(prev, rootTabsetId, 'bottom', {
              id: tabId,
              title: d.label || d.name || 'Backend Call',
              type: 'actEditor',
              act: {
                id: String(d.id),
                type: d.type,
                label: d.label || d.name,
                instanceId: d.instanceId || d.id
              },
              headerColor: '#94a3b8', // Gray color for BackendCall
              toolbarButtons: []
            } as DockTabActEditor);
          } else {
            // For other types, don't open editor if not supported
            return prev;
          }
        });
      } catch (err) {
        console.error('[ActEditor] Failed to open', err);
      }
    };
    document.addEventListener('actEditor:open', h as any);
    return () => document.removeEventListener('actEditor:open', h as any);
  }, [actEditorCtx, getTranslationsForDDT]);

  // Note: nodes/edges are read directly from window.__flowNodes by DDEBubbleChat in flow mode
  // No local state needed to avoid flickering and synchronization issues
  // Stato per feedback salvataggio
  // const [isSaving, setIsSaving] = useState(false);
  // const [saveSuccess, setSaveSuccess] = useState(false);
  // const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showBackendBuilder, setShowBackendBuilder] = useState(false);
  const [showGlobalDebugger, setShowGlobalDebugger] = useState(false);
  const [debuggerWidth, setDebuggerWidth] = useState(380); // Larghezza dinamica invece di fissa
  const [isResizing, setIsResizing] = useState(false);

  // Handler per il resize del pannello di debug
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleResize = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const container = document.getElementById('flow-canvas-host');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newWidth = rect.right - e.clientX;

    // Limiti: minimo 200px, massimo 800px
    const clampedWidth = Math.max(200, Math.min(800, newWidth));
    setDebuggerWidth(clampedWidth);
  }, [isResizing]);

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  // Listen to Sidebar wrench
  React.useEffect(() => {
    const handler = () => setShowBackendBuilder(true);
    document.addEventListener('backendBuilder:open', handler);
    return () => document.removeEventListener('backendBuilder:open', handler);
  }, []);

  // Open ConditionEditor as docking tab
  React.useEffect(() => {
    // Helper: build static variables from all Agent Acts' DDT structure
    const buildStaticVars = (): Record<string, any> => {
      const vars: Record<string, any> = {};
      const data = projectData as any;
      try {
        const categories: any[] = (data?.taskTemplates || []) as any[];
        for (const cat of categories) {
          const items: any[] = (cat?.items || []) as any[];
          for (const it of items) {
            const actName: string = String(it?.name || it?.label || '').trim();
            if (!actName) continue;
            const ddt: any = it?.ddt;
            if (!ddt) continue;
            // Support assembled shape (mainData) and snapshot shape (mains)
            const mains: any[] = Array.isArray(ddt?.mainData)
              ? ddt.mainData
              : (ddt?.mainData ? [ddt.mainData] : (Array.isArray(ddt?.mains) ? ddt.mains : []));
            for (const m of (mains || [])) {
              const mainLabel: string = String(m?.labelKey || m?.label || m?.name || 'Data').trim();
              const mainKey = `${actName}.${mainLabel}`;
              vars[mainKey] = vars[mainKey] ?? '';
              const subsArr: any[] = Array.isArray(m?.subData) ? m.subData : (Array.isArray(m?.subs) ? m.subs : []);
              for (const s of (subsArr || [])) {
                const subLabel: string = String(s?.labelKey || s?.label || s?.name || 'Field').trim();
                const subKey = `${actName}.${mainLabel}.${subLabel}`;
                vars[subKey] = vars[subKey] ?? '';
              }
            }
          }
        }
      } catch { }
      return vars;
    };

    // Helper: build a hierarchical tree with icons/colors for Intellisense
    const buildVarsTree = (): any[] => {
      const acts: any[] = [];
      const data = projectData as any;
      try {
        const categories: any[] = (data?.taskTemplates || []) as any[];
        const actColor = (SIDEBAR_TYPE_COLORS as any)?.taskTemplates?.color || '#34d399';
        const iconKey = (SIDEBAR_TYPE_ICONS as any)?.taskTemplates;
        const Icon = (SIDEBAR_ICON_COMPONENTS as any)?.[iconKey];
        for (const cat of categories) {
          const items: any[] = (cat?.items || []) as any[];
          for (const it of items) {
            const actName: string = String(it?.name || it?.label || '').trim();
            if (!actName) continue;
            const ddt: any = it?.ddt;
            if (!ddt) continue;
            const mains: any[] = Array.isArray(ddt?.mainData)
              ? ddt.mainData
              : (ddt?.mainData ? [ddt.mainData] : (Array.isArray(ddt?.mains) ? ddt.mains : []));
            const mainsOut: any[] = [];
            for (const m of (mains || [])) {
              const mainLabel: string = String(m?.labelKey || m?.label || m?.name || 'Data').trim();
              const subsArr: any[] = Array.isArray(m?.subData) ? m.subData : (Array.isArray(m?.subs) ? m.subs : []);
              const subsOut = (subsArr || []).map((s: any) => ({ label: String(s?.labelKey || s?.label || s?.name || 'Field').trim(), kind: String(s?.kind || s?.type || '') }));
              mainsOut.push({ label: mainLabel, kind: String(m?.kind || m?.type || ''), subs: subsOut });
            }
            acts.push({ label: actName, color: actColor, Icon, mains: mainsOut });
          }
        }
      } catch { }
      return acts;
    };

    // ✅ NEW: Build flowchart variables
    const buildFlowchartVars = async (): Promise<Record<string, any>> => {
      const vars: Record<string, any> = {};
      try {
        const projectId = pdUpdate?.getCurrentProjectId();
        if (projectId) {
          await flowchartVariablesService.init(projectId);
          const varNames = flowchartVariablesService.getAllReadableNames();
          varNames.forEach(name => {
            vars[name] = ''; // Empty value, just for autocomplete
          });
        }
      } catch { }
      return vars;
    };

    const handler = async (e: any) => {
      const d = (e && e.detail) || {};
      const provided = d.variables || {};
      const hasProvided = provided && Object.keys(provided).length > 0;
      const staticVars = buildStaticVars();
      const flowchartVars = await buildFlowchartVars(); // ✅ NEW
      const varsTree = buildVarsTree();

      // Merge static vars with flowchart vars
      const allVars = { ...staticVars, ...flowchartVars }; // ✅ NEW

      const finalVars = hasProvided ? provided : allVars;
      const conditionLabel = d.label || d.name || 'Condition';
      const conditionScript = d.script || '';

      // Scroll to node using ReactFlow viewport (if nodeId is provided)
      if (d.nodeId) {
        setTimeout(() => {
          try {
            document.dispatchEvent(new CustomEvent('flowchart:scrollToNode', {
              detail: { nodeId: d.nodeId },
              bubbles: true
            }));
          } catch (err) {
            console.warn('[ConditionEditor] Failed to emit scroll event', err);
          }
        }, 100);
      }

      // Open as docking tab instead of fixed panel
      const tabId = `cond_${d.nodeId || Date.now()}`;
      setDockTree(prev => {
        // Check if already open
        const existing = (function findTab(n: DockNode): boolean {
          if (n.kind === 'tabset') return n.tabs.some(t => t.id === tabId);
          if (n.kind === 'split') return n.children.some(findTab);
          return false;
        })(prev);

        if (existing) return prev; // Already open, don't duplicate

        // Add next to active tab
        return upsertAddNextTo(prev, 'tab_main', {
          id: tabId,
          title: conditionLabel,
          type: 'conditionEditor',
          variables: finalVars,
          script: conditionScript,
          variablesTree: (d as any).variablesTree || varsTree,
          label: conditionLabel
        });
      });
    };
    document.addEventListener('conditionEditor:open', handler as any);

    return () => {
      document.removeEventListener('conditionEditor:open', handler as any);
    };
  }, [projectData, pdUpdate]);

  // Stato per gestione progetti
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [showAllProjectsModal, setShowAllProjectsModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Stato per finestre editor DDT aperte (ora con react-mosaic)
  // const [mosaicNodes, setMosaicNodes] = useState<any>(null);
  // const dockablePanelsRef = React.useRef<DockablePanelsHandle>(null);

  // Rimuovi questi stati che ora sono nel hook
  // const [selectedDDT, setSelectedDDT] = useState<any | null>(null);
  // const [selectedDDTLanguage, setSelectedDDTLanguage] = useState<string>('it');
  // const [openedDDTId, setOpenedDDTId] = useState<string>('');
  // const [dialogueTemplates, setDialogueTemplates] = useState<any[]>([]);

  // Rimuovi questi handler che ora sono nel hook
  // const handleOpenDDTEditor = useCallback(...);
  // const handleCloseDDTEditor = useCallback(...);
  // const handleDeleteDDT = useCallback(...);

  // Pannello di test in alto a sinistra all'avvio
  // React.useEffect(() => {
  //   if (dockablePanelsRef.current) {
  //     dockablePanelsRef.current.openPanel({
  //       id: 'test-panel',
  //       title: 'Test Panel',
  //       ddt: { label: 'Test Panel' },
  //       translations: {},
  //       lang: 'it'
  //     });
  //   }
  // }, []);

  // Carica progetti recenti (ultimi 10)
  const fetchRecentProjects = React.useCallback(async () => {
    try {
      setRecentProjects(await ProjectService.getRecentProjects());
    } catch (e) {
      setRecentProjects([]);
    }
  }, []);
  // Carica tutti i progetti
  const fetchAllProjects = React.useCallback(async () => {
    try {
      setAllProjects(await ProjectService.getAllProjects());
    } catch (e) {
      setAllProjects([]);
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    await ProjectService.deleteProject(id);
    setToast('Progetto eliminato!');
    await fetchRecentProjects();
    await fetchAllProjects();
    setTimeout(() => setToast(null), 2000);
  }, [fetchRecentProjects, fetchAllProjects]);

  const handleDeleteAllProjects = useCallback(async () => {
    await ProjectService.deleteAllProjects();
    setToast('Tutti i progetti eliminati!');
    await fetchRecentProjects();
    await fetchAllProjects();
    setTimeout(() => setToast(null), 2000);
  }, [fetchRecentProjects, fetchAllProjects]);

  // Callback per LandingPage
  const handleLandingNewProject = useCallback(() => setAppState('creatingProject'), [setAppState]);
  // const handleLandingLoadProject = useCallback(async () => { await fetchRecentProjects(); }, [fetchRecentProjects]);
  // const handleLandingShowAllProjects = useCallback(async () => { await fetchAllProjects(); setShowAllProjectsModal(true); }, [fetchAllProjects]);

  // const handleOpenNewProjectModal = useCallback(() => setAppState('creatingProject'), [setAppState]);

  const handleCreateProject = useCallback(async (projectInfo: ProjectInfo): Promise<boolean> => {
    setCreateError(null);
    setIsCreatingProject(true);
    try {
      // Bootstrap immediato: crea DB e catalog subito
      const resp = await fetch('/api/projects/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: projectInfo.clientName || null,
          projectName: projectInfo.name || 'Project',
          industry: projectInfo.industry || 'utility_gas',
          language: projectInfo.language || 'pt',
          ownerCompany: projectInfo.ownerCompany || null,
          ownerClient: projectInfo.ownerClient || null,
          version: projectInfo.version || '1.0',
          versionQualifier: projectInfo.versionQualifier || 'alpha',
          tenantId: 'tenant_default'
        })
      });
      if (!resp.ok) throw new Error('bootstrap_failed');
      const boot = await resp.json();
      const projectId = boot.projectId;

      // Carica atti dal progetto appena creato
      try {
        await ProjectDataService.loadActsFromProject(projectId);
      } catch (error) {
      }

      const data = await ProjectDataService.loadProjectData();

      // Inizializza stato UI
      const newProject: ProjectData & ProjectInfo = {
        ...projectInfo,
        id: projectId,
        industry: projectInfo.industry || 'utility_gas',
        ownerCompany: projectInfo.ownerCompany || null,
        ownerClient: projectInfo.ownerClient || null,
        taskTemplates: data.taskTemplates,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: [], // Deprecated: tasks migrated to macrotasks
        macrotasks: data.macrotasks
      };
      setCurrentProject(newProject);
      try { localStorage.setItem('project.lang', String(projectInfo.language || 'pt')); } catch { }
      try { localStorage.setItem('current.projectId', projectId); } catch { }
      pdUpdate.setCurrentProjectId(projectId);
      try {
        (window as any).__flowNodes = [];
        (window as any).__flowEdges = [];
      } catch { }
      await refreshData();
      setAppState('mainApp');
      return true;
    } catch (e) {
      setCreateError('Errore nella creazione del progetto');
      return false;
    } finally {
      setIsCreatingProject(false);
    }
  }, [refreshData, setAppState, pdUpdate]);

  const handleCloseNewProjectModal = useCallback(() => setAppState('landing'), [setAppState]);

  // const handleSaveProject = useCallback(async () => { /* legacy save */ }, [currentProject, nodes, edges]);

  const handleOpenProjectById = useCallback(async (id: string) => {
    if (!id) return;
    const startTime = performance.now();
    console.log(`[PERF][${new Date().toISOString()}] 🚀 START handleOpenProjectById`, { projectId: id });

    try {
      // Modalità persisted: apri da catalogo e carica acts dal DB progetto
      const catStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 📋 START fetch catalog`);
      const catRes = await fetch('/api/projects/catalog');
      if (!catRes.ok) throw new Error('Errore nel recupero catalogo');
      const list = await catRes.json();
      const meta = (list || []).find((x: any) => x._id === id || x.projectId === id) || {};
      console.log(`[PERF][${new Date().toISOString()}] ✅ END fetch catalog`, {
        duration: `${(performance.now() - catStart).toFixed(2)}ms`,
        found: !!meta
      });

      pdUpdate.setCurrentProjectId(id);
      try { localStorage.setItem('current.projectId', id); } catch { }

      // ✅ OPTIMIZATION: Load acts, tasks, flow, and variable mappings in parallel (they are independent)
      const parallelStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 🔄 START parallel load (acts, tasks, flow, mappings)`);

      const [actsResult, tasksResult, flowResult, mappingsResult] = await Promise.allSettled([
        ProjectDataService.loadActsFromProject(id),
        (async () => {
          try {
            const { taskRepository } = await import('../services/TaskRepository');
            return await taskRepository.loadAllTasksFromDatabase(id);
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR loadAllTasksFromDatabase`, {
              projectId: id,
              error: String(e)
            });
            return false;
          }
        })(),
        (async () => {
          try {
            const flowRes = await fetch(`/api/projects/${encodeURIComponent(id)}/flow`);
            if (flowRes.ok) {
              const flow = await flowRes.json();
              return {
                nodes: Array.isArray(flow.nodes) ? flow.nodes : [],
                edges: Array.isArray(flow.edges) ? flow.edges : []
              };
            }
            return { nodes: [], edges: [] };
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR load flow`, e);
            return { nodes: [], edges: [] };
          }
        })(),
        (async () => {
          try {
            const { flowchartVariablesService } = await import('../services/FlowchartVariablesService');
            await flowchartVariablesService.init(id);
            return true;
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR load variable mappings`, e);
            return false;
          }
        })()
      ]);

      console.log(`[PERF][${new Date().toISOString()}] ✅ END parallel load`, {
        duration: `${(performance.now() - parallelStart).toFixed(2)}ms`
      });

      // Process results
      if (actsResult.status === 'rejected') {
        throw actsResult.reason;
      }

      let loadedNodes: any[] = [];
      let loadedEdges: any[] = [];
      if (flowResult.status === 'fulfilled') {
        loadedNodes = flowResult.value.nodes;
        loadedEdges = flowResult.value.edges;
        const elseEdgesCount = loadedEdges.filter(e => e.data?.isElse === true).length;
        if (elseEdgesCount > 0) {
          console.log('[AppContent][loadFlow] ✅ Found Else edges', { count: elseEdgesCount });
        }
      }

      if (tasksResult.status === 'fulfilled') {
        const { taskRepository } = await import('../services/TaskRepository');
        console.log(`[PERF][${new Date().toISOString()}] ✅ Tasks loaded`, {
          success: tasksResult.value,
          tasksCount: taskRepository.getInternalTasksCount(),
          tasksWithValue: taskRepository.getAllTasks().filter(t => t.value && Object.keys(t.value).length > 0).length
        });
      }

      const dataStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 📊 START loadProjectData`);
      const data = await ProjectDataService.loadProjectData();
      console.log(`[PERF][${new Date().toISOString()}] ✅ END loadProjectData`, {
        duration: `${(performance.now() - dataStart).toFixed(2)}ms`
      });

      const newProject: any = {
        id,
        name: meta.projectName || 'Project',
        clientName: meta.clientName || null,
        template: meta.industry || 'utility_gas',
        industry: meta.industry || 'utility_gas',
        ownerCompany: meta.ownerCompany || null,
        ownerClient: meta.ownerClient || null,
        taskTemplates: data.taskTemplates,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: [], // Deprecated: tasks migrated to macrotasks
        macrotasks: data.macrotasks
      };
      setCurrentProject(newProject);
      try { if (meta && meta.language) localStorage.setItem('project.lang', String(meta.language)); } catch { }
      try {
        (window as any).__flowNodes = loadedNodes as any;
        (window as any).__flowEdges = loadedEdges as any;
      } catch { }

      const refreshStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 🔄 START refreshData`);
      await refreshData();
      console.log(`[PERF][${new Date().toISOString()}] ✅ END refreshData`, {
        duration: `${(performance.now() - refreshStart).toFixed(2)}ms`
      });

      setAppState('mainApp');

      const totalDuration = performance.now() - startTime;
      console.log(`[PERF][${new Date().toISOString()}] 🎉 COMPLETE handleOpenProjectById`, {
        projectId: id,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        totalDurationSeconds: `${(totalDuration / 1000).toFixed(2)}s`
      });
    } catch (err) {
      const totalDuration = performance.now() - startTime;
      console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR handleOpenProjectById`, {
        projectId: id,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        error: err instanceof Error ? err.message : err
      });
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  }, [refreshData, setAppState]);

  const handleShowRecentProjects = useCallback(async (id?: string) => {
    if (id) {
      await handleOpenProjectById(id);
      setAppState('mainApp');
      return;
    }
    try {
      const response = await fetch('/projects');
      if (!response.ok) throw new Error('Errore nel recupero progetti');
      const projects = await response.json();
      if (!projects.length) {
        alert('Nessun progetto recente trovato.');
        return;
      }
      const choices = projects.map((p: any, i: number) => `${i + 1}. ${p.name || '(senza nome)'} [${p._id}]`).join('\n');
      const idx = prompt(`Progetti recenti:\n${choices}\n\nInserisci il numero del progetto da caricare:`);
      const selected = parseInt(idx || '', 10);
      if (!selected || selected < 1 || selected > projects.length) return;
      const selId = projects[selected - 1]._id;
      await handleOpenProjectById(selId);
      setAppState('mainApp');
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  }, [handleOpenProjectById, setAppState]);

  // Passa una funzione a NewProjectModal per azzerare l'errore duplicato quando cambia il nome
  const handleProjectNameChange = useCallback(() => {
    if (createError) setCreateError(null);
  }, [createError]);

  // Carica progetti recenti e tutti i progetti ogni volta che si entra nella landing
  useEffect(() => {
    if (appState === 'landing') {
      fetchRecentProjects();
      fetchAllProjects(); // Carica anche tutti i progetti per la vista "tutti"
    }
  }, [appState, fetchRecentProjects, fetchAllProjects]);

  // ✅ Applica font globali dallo store
  const { combinedClass } = useFontClasses();

  return (
    <div className={`min-h-screen ${combinedClass}`} style={{ position: 'relative' }}>
      {/* overlay ricarico rimosso per test */}
      {/* Toast feedback */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-emerald-700 text-white px-6 py-3 rounded shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
      {/* Landing Page + New Project Modal */}
      {(appState === 'landing' || appState === 'creatingProject') && (
        <>
          <LandingPage
            onNewProject={handleLandingNewProject}
            recentProjects={recentProjects}
            allProjects={allProjects}
            onDeleteProject={handleDeleteProject}
            onDeleteAllProjects={handleDeleteAllProjects}
            showAllProjectsModal={showAllProjectsModal}
            setShowAllProjectsModal={setShowAllProjectsModal}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSelectProject={async (id: string) => {
              await handleOpenProjectById(id);
              setAppState('mainApp');
            }}
          />
          <NewProjectModal
            isOpen={appState === 'creatingProject'}
            onClose={handleCloseNewProjectModal}
            onCreateProject={handleCreateProject}
            onLoadProject={handleShowRecentProjects}
            duplicateNameError={createError}
            onProjectNameChange={handleProjectNameChange}
            isLoading={isCreatingProject}
            onFactoryTemplatesLoaded={() => { /* templates loaded; proxied via 8000 now */ }}
          />
        </>
      )}
      {/* Main App: Toolbar a tutta larghezza + Sidebar collassabile + FlowEditor */}
      {appState === 'mainApp' && (
        <div className="flex flex-col h-screen">
          {/* Toolbar a tutta larghezza */}
          <Toolbar
            onHome={() => setAppState('landing')}
            isSaving={isCreatingProject}
            currentProject={currentProject}
            onSave={async () => {
              try {
                // show spinner in toolbar while saving
                setIsCreatingProject(true);
                const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const pid = pdUpdate.getCurrentProjectId();
                if (!pid) {
                  console.warn('[Save] No project ID available');
                  return;
                }
                console.log('[Save] ═══════════════════════════════════════════════════════');
                console.log('[Save] 🚀 START SAVE PROJECT', { projectId: pid, timestamp: new Date().toISOString() });
                console.log('[Save] ═══════════════════════════════════════════════════════');

                // FIX: Emetti evento per salvare modifiche in corso negli editor aperti
                window.dispatchEvent(new CustomEvent('project:save', {
                  detail: { projectId: pid }
                }));

                // ✅ OPTIMIZATION: Parallelize all independent save operations
                const saveStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

                const saveResults = await Promise.allSettled([
                  // 1. Update catalog timestamp
                  (async () => {
                    const tStart = performance.now();
                    try {
                      console.log('[Save][1-catalog] 🚀 START');
                      await fetch('/api/projects/catalog/update-timestamp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          projectId: pid,
                          ownerCompany: currentProject?.ownerCompany || null,
                          ownerClient: currentProject?.ownerClient || null
                        })
                      });
                      const tEnd = performance.now();
                      console.log('[Save][1-catalog] ✅ DONE', { ms: Math.round(tEnd - tStart) });
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][1-catalog] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 2. Save translations
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][2-translations] 🚀 START');
                      const translationsContext = (window as any).__projectTranslationsContext;
                      if (translationsContext?.saveAllTranslations) {
                        await translationsContext.saveAllTranslations();
                        const tEnd = performance.now();
                        console.log('[Save][2-translations] ✅ DONE', { ms: Math.round(tEnd - tStart) });
                      } else {
                        const tEnd = performance.now();
                        console.warn('[Save][2-translations] ⚠️ Context not available', { ms: Math.round(tEnd - tStart) });
                      }
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][2-translations] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 3. Save tasks
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][3-tasks] 🚀 START');
                      const { taskRepository } = await import('../services/TaskRepository');
                      const tasksCount = taskRepository.getInternalTasksCount();
                      console.log('[Save][3-tasks] 📊 Tasks to save', { count: tasksCount });
                      const saved = await taskRepository.saveAllTasksToDatabase(pid);
                      const tEnd = performance.now();
                      if (saved) {
                        console.log('[Save][3-tasks] ✅ DONE', { ms: Math.round(tEnd - tStart), tasksCount });
                      } else {
                        console.warn('[Save][3-tasks] ⚠️ FAILED', { ms: Math.round(tEnd - tStart), tasksCount });
                      }
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][3-tasks] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 4. Save variable mappings
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][4-mappings] 🚀 START');
                      const { flowchartVariablesService } = await import('../services/FlowchartVariablesService');
                      const stats = flowchartVariablesService.getStats();
                      console.log('[Save][4-mappings] 📊 Mappings to save', stats);
                      const mappingsSaved = await flowchartVariablesService.saveToDatabase(pid);
                      const tEnd = performance.now();
                      if (mappingsSaved) {
                        console.log('[Save][4-mappings] ✅ DONE', { ms: Math.round(tEnd - tStart), stats });
                      } else {
                        console.warn('[Save][4-mappings] ⚠️ FAILED', { ms: Math.round(tEnd - tStart), stats });
                      }
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][4-mappings] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 5. Save acts and conditions
                  (async () => {
                    if (!pid || !projectData) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][5-acts-conditions] 🚀 START');
                      const actsCount = projectData?.taskTemplates?.flatMap((cat: any) => cat.items || []).length || 0;
                      const conditionsCount = projectData?.conditions?.flatMap((cat: any) => cat.items || []).length || 0;
                      console.log('[Save][5-acts-conditions] 📊 Items to save', { actsCount, conditionsCount });

                      const tActs = performance.now();
                      await (ProjectDataService as any).saveProjectActsToDb?.(pid, projectData);
                      const tActsEnd = performance.now();
                      console.log('[Save][5-acts] ✅ DONE', { ms: Math.round(tActsEnd - tActs), actsCount });

                      const tCond = performance.now();
                      await (ProjectDataService as any).saveProjectConditionsToDb?.(pid, projectData);
                      const tCondEnd = performance.now();
                      console.log('[Save][5-conditions] ✅ DONE', { ms: Math.round(tCondEnd - tCond), conditionsCount });

                      // Reload fresh project data so act.problem is populated from DB
                      const tReload = performance.now();
                      let tReloadEnd = tReload;
                      try {
                        const fresh = await (ProjectDataService as any).loadProjectData?.();
                        tReloadEnd = performance.now();
                        console.log('[Save][5-reload] ✅ DONE', { ms: Math.round(tReloadEnd - tReload) });
                        if (fresh) {
                          try { pdUpdate.setData && (pdUpdate as any).setData(fresh); } catch { }
                        }
                      } catch (e) {
                        tReloadEnd = performance.now();
                        console.error('[Save][5-reload] ❌ ERROR', { ms: Math.round(tReloadEnd - tReload), error: e });
                      }

                      const tEnd = performance.now();
                      console.log('[Save][5-acts-conditions] ✅ DONE', {
                        totalMs: Math.round(tEnd - tStart),
                        actsMs: Math.round(tActsEnd - tActs),
                        conditionsMs: Math.round(tCondEnd - tCond),
                        reloadMs: Math.round(tReloadEnd - tReload)
                      });
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][5-acts-conditions] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 6. Save flow
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][6-flow] 🚀 START');
                      const svc = await import('../services/FlowPersistService');
                      const tFlush = performance.now();
                      await svc.flushFlowPersist();
                      const tFlushEnd = performance.now();
                      console.log('[Save][6-flow][flush] ✅ DONE', { ms: Math.round(tFlushEnd - tFlush) });

                      // Final PUT immediate (explicit Save)
                      const tPut = performance.now();
                      const putRes = await fetch(`/api/projects/${encodeURIComponent(pid)}/flow?flowId=main`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(((window as any).__flows && (window as any).__flows.main) ? { nodes: (window as any).__flows.main.nodes, edges: (window as any).__flows.main.edges } : { nodes: (window as any).__flowNodes || [], edges: (window as any).__flowEdges || [] })
                      });
                      const tPutEnd = performance.now();
                      if (!putRes.ok) {
                        console.error('[Save][6-flow][put] ❌ ERROR', { ms: Math.round(tPutEnd - tPut), status: putRes.status, statusText: putRes.statusText });
                      } else {
                        console.log('[Save][6-flow][put] ✅ DONE', { ms: Math.round(tPutEnd - tPut) });
                      }

                      const tEnd = performance.now();
                      console.log('[Save][6-flow] ✅ DONE', {
                        totalMs: Math.round(tEnd - tStart),
                        flushMs: Math.round(tFlushEnd - tFlush),
                        putMs: Math.round(tPutEnd - tPut)
                      });
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][6-flow] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })()
                ]);

                const saveEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const totalMs = Math.round(saveEnd - saveStart);

                console.log('[Save] ═══════════════════════════════════════════════════════');
                console.log('[Save] ✅ ALL OPERATIONS COMPLETED', {
                  totalMs,
                  timestamp: new Date().toISOString(),
                  results: saveResults.map((r, i) => ({
                    operation: ['catalog', 'translations', 'tasks', 'mappings', 'acts-conditions', 'flow'][i],
                    status: r.status,
                    error: r.status === 'rejected' ? String(r.reason) : undefined
                  }))
                });
                console.log('[Save] ═══════════════════════════════════════════════════════');
                const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                // Removed noisy meta POST; language is already stored during bootstrap
              } catch (e) {
                console.error('[SaveProject] commit error', e);
              } finally {
                setIsCreatingProject(false);
              }
            }}
            onRun={() => setShowGlobalDebugger(s => !s)}
            onSettings={() => setShowBackendBuilder(true)}
          />

          {/* Area principale: Library Label + Sidebar + Canvas */}
          <div className="flex flex-1 relative overflow-hidden">
            {/* Library Label quando sidebar chiusa */}
            {isSidebarCollapsed && (
              <LibraryLabel onOpen={() => setIsSidebarCollapsed(false)} />
            )}

            {/* Sidebar con animazione slide */}
            <div
              className={`
                transition-transform duration-300 ease-in-out
                ${isSidebarCollapsed
                  ? 'transform -translate-x-full absolute left-0 h-full pointer-events-none'
                  : 'transform translate-x-0 relative pointer-events-auto'
                }
              `}
              style={{ zIndex: 40 }}
            >
              <SidebarThemeProvider>
                <Sidebar onClose={() => setIsSidebarCollapsed(true)} />
              </SidebarThemeProvider>
            </div>

            {/* Canvas */}
            <div className="flex-1 flex flex-col min-w-0">
              <div id="flow-canvas-host" style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: showGlobalDebugger ? 'row' : 'column',
                position: 'relative'
              }}>
                {showBackendBuilder ? (
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <BackendBuilderStudio onClose={() => setShowBackendBuilder(false)} />
                  </div>
                ) : (
                  <>
                    {/* Canvas - occupa tutto lo spazio disponibile */}
                    <div style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0 }}>
                      {currentPid ? (
                        <FlowWorkspaceProvider>
                          <DockManager
                            root={dockTree}
                            setRoot={setDockTree}
                            renderTabContent={renderTabContent}
                          />
                        </FlowWorkspaceProvider>
                      ) : (
                        <FlowEditor
                          nodes={(window as any).__flowNodes || []}
                          setNodes={(updater: any) => {
                            try {
                              const current = (window as any).__flowNodes || [];
                              const updated = typeof updater === 'function' ? updater(current) : updater;
                              (window as any).__flowNodes = updated;
                            } catch { }
                          }}
                          edges={(window as any).__flowEdges || []}
                          setEdges={(updater: any) => {
                            try {
                              const current = (window as any).__flowEdges || [];
                              const updated = typeof updater === 'function' ? updater(current) : updater;
                              (window as any).__flowEdges = updated;
                            } catch { }
                          }}
                          currentProject={currentProject}
                          setCurrentProject={setCurrentProject}
                          onPlayNode={onPlayNode}
                          testPanelOpen={testPanelOpen}
                          setTestPanelOpen={setTestPanelOpen}
                          testNodeId={testNodeId}
                          setTestNodeId={setTestNodeId}
                        />
                      )}
                    </div>
                  </>
                )}
                {showGlobalDebugger && (
                  <>
                    {/* Resizer verticale */}
                    <div
                      onMouseDown={handleResizeStart}
                      style={{
                        width: '8px',
                        cursor: 'col-resize',
                        backgroundColor: isResizing ? '#3b82f6' : 'transparent',
                        zIndex: 10,
                        userSelect: 'none',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        if (!isResizing) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = '#e5e7eb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isResizing) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        }
                      }}
                    />

                    {/* Pannello di debug */}
                    <div
                      style={{
                        width: `${debuggerWidth}px`,
                        position: 'relative',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        borderLeft: '1px solid #e5e7eb',
                        flexShrink: 0
                      }}
                    >
                      <DDEBubbleChat
                        mode="flow"
                      // nodes and edges are read directly from window.__flowNodes in flow mode
                      />
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};