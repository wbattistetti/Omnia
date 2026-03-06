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
import { useProjectTranslations } from '../context/ProjectTranslationsContext';
import { Node, Edge } from 'reactflow';
import { FlowNode, EdgeData } from './Flowchart/types/flowTypes';
import { ProjectInfo } from '../types/project';
import { useEffect } from 'react';
import { ProjectService } from '../services/ProjectService';
import { ProjectData } from '../types/project';
import { SidebarThemeProvider } from './Sidebar/SidebarThemeContext';
import { FlowEditor } from './Flowchart/FlowEditor';
import { FlowWorkspace } from './FlowWorkspace/FlowWorkspace';
import { DockWorkspace } from './FlowWorkspace/DockWorkspace';
import { DockManager } from './Dock/DockManager';
import { DockNode, DockTab, DockTabResponseEditor, DockTabTaskEditor, DockTabChat, ToolbarButton } from '../dock/types'; // ✅ RINOMINATO: DockTabActEditor → DockTabTaskEditor
import { FlowCanvasHost } from './FlowWorkspace/FlowCanvasHost';
import { FlowWorkspaceProvider, useFlowWorkspace } from '../flows/FlowStore.tsx';
import { useFlowActions } from '../flows/FlowStore.tsx';
import { upsertAddNextTo, closeTab, activateTab, splitWithTab } from '../dock/ops';
import { findRootTabset, tabExists } from './AppContent/domain/dockTree';
import { openBottomDockedTab, openLateralChatPanel } from './AppContent/infrastructure/docking/DockingHelpers';
import { EditorCoordinator } from './AppContent/application/coordinators/EditorCoordinator';
import { ProjectManager } from './AppContent/application/services/ProjectManager';
import { TabRenderer } from './AppContent/presentation/TabRenderer';
import { resolveEditorKind } from './TaskEditor/EditorHost/resolveKind'; // ✅ RINOMINATO: ActEditor → TaskEditor
import BackendBuilderStudio from '../BackendBuilder/ui/Studio';
import { createSingleNodeFlow } from '../utils/flowTestHelpers';
import { FlowTestProvider } from '../context/FlowTestContext';
import ResizableResponseEditor from './TaskEditor/ResponseEditor/ResizableResponseEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import ResizableNonInteractiveEditor from './TaskEditor/ResponseEditor/ResizableNonInteractiveEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import ResizableTaskEditorHost from './TaskEditor/EditorHost/ResizableTaskEditorHost'; // ✅ RINOMINATO: ActEditor → TaskEditor, ResizableActEditorHost → ResizableTaskEditorHost
import { useTaskEditor } from './TaskEditor/EditorHost/TaskEditorContext'; // ✅ RINOMINATO: ActEditor → TaskEditor, useActEditor → useTaskEditor
import ConditionEditor from './conditions/ConditionEditor';
import DDEBubbleChat from './TaskEditor/ResponseEditor/ChatSimulator/DDEBubbleChat';
import { useTaskTreeContext } from '../context/DDTContext';
// ✅ REMOVED: Imports moved to handlers (SIDEBAR_TYPE_COLORS, flowchartVariablesService, getNodesWithFallback)
// FASE 2: InstanceRepository import removed - using TaskRepository instead
// TaskRepository automatically syncs with InstanceRepository for backward compatibility
import ResponseEditor from './TaskEditor/ResponseEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import NonInteractiveResponseEditor from './TaskEditor/ResponseEditor/NonInteractiveResponseEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import { taskRepository } from '../services/TaskRepository';
import { getTemplateId } from '../utils/taskHelpers';
import { TaskType } from '../types/taskTypes'; // ✅ RIMOSSO: taskIdToTaskType - non più necessario, le fonti emettono direttamente TaskType enum
import type { TaskMeta, TaskWizardMode } from './TaskEditor/EditorHost/types'; // ✅ RINOMINATO: ActEditor → TaskEditor
import type { TaskTree, Task } from '../types/taskTypes';

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

// ✅ ARCHITECTURAL FIX: Component that accesses FlowWorkspaceProvider and populates flowsRef
// This allows handleSaveProject to access flows without using window.__flows
const DockManagerWithFlows: React.FC<{
  root: DockNode;
  setRoot: (updater: (prev: DockNode) => DockNode) => void;
  renderTabContent: (tab: DockTab) => React.ReactNode;
  flowsRef: React.MutableRefObject<Record<string, any>>;
}> = ({ root, setRoot, renderTabContent, flowsRef }) => {
  const flowWorkspace = useFlowWorkspace<Node<FlowNode>, Edge<EdgeData>>();

  // ✅ CRITICAL: Update flowsRef immediately (not just in useEffect)
  // This ensures flowsRef is always up-to-date when handleSaveProject is called
  flowsRef.current = flowWorkspace.flows;

  // ✅ Also update in useEffect for safety (in case flows change during render)
  React.useEffect(() => {
    flowsRef.current = flowWorkspace.flows;
  }, [flowWorkspace.flows]);

  // ✅ Adapt setRoot to match DockManager's expected signature
  const adaptedSetRoot = React.useCallback((n: DockNode | ((prev: DockNode) => DockNode)) => {
    if (typeof n === 'function') {
      setRoot(n);
    } else {
      setRoot(() => n);
    }
  }, [setRoot]);

  return (
    <DockManager
      root={root}
      setRoot={adaptedSetRoot}
      renderTabContent={renderTabContent}
    />
  );
};

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
  onPlayNode?: (nodeId: string) => void; // ✅ Optional: AppContent uses internal handleTestSingleNode
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

  // ✅ REFACTOR: Map globale per tenere traccia di tutti i refs di chiusura per tutti i tab
  // Questo risolve il problema delle closure stale: quando tab.onClose viene chiamato,
  // legge sempre il valore più recente dal Map invece di una closure catturata
  const editorCloseRefsMap = React.useRef<Map<string, () => Promise<boolean>>>(new Map());

  // ✅ ARCHITECTURAL FIX: Ref per accedere ai flows dal FlowWorkspaceProvider
  // Popolato da DockManagerWithFlows che è dentro FlowWorkspaceProvider
  const flowsRef = React.useRef<Record<string, any>>({});

  // ✅ Get translations for chat panel (needed for handleTestSingleNode)
  const { translations: globalTranslations, isReady: translationsReady, isLoading: translationsLoading, loadAllTranslations } = useProjectTranslations();

  // ✅ Handler to test a single node (creates flow with only that node)
  // This is the default implementation if onPlayNode prop is not provided
  // Signature matches FlowEditor's onPlayNode: (nodeId: string, nodeRows: any[]) => void
  // ✅ MOVED: Defined before renderTabContent to avoid "Cannot access before initialization" error
  const handleTestSingleNodeRetryCountRef = React.useRef(0);
  const handleTestSingleNode = React.useCallback(async (nodeId: string, nodeRows?: any[]) => {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🎬 [AppContent] handleTestSingleNode CALLED');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[AppContent] 📋 handleTestSingleNode parameters:', {
      nodeId,
      nodeRows: nodeRows ? `Array(${nodeRows.length})` : 'undefined',
      stackTrace: new Error().stack?.split('\n').slice(0, 5).join('\n')
    });
    console.log('[AppContent] 📋 Parameters:', {
      nodeId,
      nodeRows: nodeRows ? `Array(${nodeRows.length})` : 'undefined',
      hasSetDockTree: !!setDockTree,
      currentPid,
      translationsReady,
      translationsLoading,
    });

    // Reset retry count after successful execution
    handleTestSingleNodeRetryCountRef.current = 0;

    // Get all flow data
    const allNodes = (window as any).__flowNodes || [];
    const allEdges = (window as any).__flowEdges || [];
    const allTasks = (window as any).__flowTasks || [];

    // Find the node to test
    const node = allNodes.find((n: any) => n.id === nodeId);
    if (!node) {
      console.error('[AppContent] ❌ Node not found:', nodeId);
      alert(`Node ${nodeId} not found in flow.`);
      return;
    }

    // ✅ Create single-node flow using helper
    const { nodes, edges, tasks } = createSingleNodeFlow(nodeId, allNodes, allEdges, allTasks);

    console.log('[AppContent] 📊 Single-node flow created:', {
      nodeId,
      nodeLabel: node.data?.label || nodeId,
      rowsCount: node.data?.rows?.length || 0,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      tasksCount: tasks.length,
    });

    // Ensure translations are loaded (same logic as handleRunFlow)
    if (!translationsReady && !translationsLoading && loadAllTranslations) {
      console.log('[AppContent] ⏳ Translations not ready, loading...');
      await loadAllTranslations();
    }

    // Prevent infinite retry loop (max 10 retries)
    if (translationsLoading) {
      if (handleTestSingleNodeRetryCountRef.current >= 10) {
        console.error('[AppContent] ❌ Max retries reached waiting for translations');
        return;
      }
      handleTestSingleNodeRetryCountRef.current += 1;
      console.log(`[AppContent] ⏳ Translations loading, retry ${handleTestSingleNodeRetryCountRef.current}/10`);
      setTimeout(() => {
        handleTestSingleNode(nodeId);
      }, 500);
      return;
    }

    // Get translations
    const allTranslations = globalTranslations || {};
    if (!allTranslations || Object.keys(allTranslations).length === 0) {
      console.error('[AppContent] ❌ Translations are empty - aborting');
      alert('Translations are not available. Please ensure the project has translations loaded.');
      return;
    }

    // Create chat tab for single node test
    const nodeLabel = node.data?.label || nodeId;
    const chatTabId = `chat_node_${nodeId}`;
    const chatTab: DockTabChat = {
      id: chatTabId,
      title: `Test: ${nodeLabel}`,
      type: 'chat',
      task: null,
      projectId: currentPid || null,
      translations: allTranslations,
      taskTree: null,
      mode: 'interactive',
      flowNodes: nodes,
      flowEdges: edges,
      flowTasks: tasks,
    };

    console.log('[AppContent] 📦 Created single-node test chat tab:', {
      id: chatTab.id,
      title: chatTab.title,
      nodeId,
      nodeLabel,
      flowNodesCount: chatTab.flowNodes?.length || 0,
      flowEdgesCount: chatTab.flowEdges?.length || 0,
      flowTasksCount: chatTab.flowTasks?.length || 0,
    });

    // Open as right lateral panel
    console.log('[AppContent] 🚪 Opening lateral chat panel...', {
      chatTabId,
      chatTabTitle: chatTab.title,
      hasSetDockTree: !!setDockTree,
    });

    if (!setDockTree) {
      console.error('[AppContent] ❌ setDockTree is not available - cannot open chat panel');
      alert('Cannot open chat panel: dock tree manager not available');
      return;
    }

    try {
      setDockTree(prev => {
        console.log('[AppContent] 📦 setDockTree called with prev tree:', {
          prevTreeKind: prev?.kind,
          prevTreeId: prev?.id,
        });
        const newTree = openLateralChatPanel(prev, {
          tabId: chatTabId,
          newTab: chatTab,
          position: 'right',
        });
        console.log('[AppContent] ✅ openLateralChatPanel returned new tree:', {
          newTreeKind: newTree?.kind,
          newTreeId: newTree?.id,
        });
        return newTree;
      });
      console.log('[AppContent] ✅ setDockTree completed');
    } catch (error) {
      console.error('[AppContent] ❌ Error opening chat panel:', error);
      alert(`Failed to open chat panel: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return;
    }

    console.log('[AppContent] ✅ handleTestSingleNode COMPLETED');
    console.log('═══════════════════════════════════════════════════════════════════════════');
  }, [setDockTree, currentPid, globalTranslations, translationsReady, translationsLoading, loadAllTranslations]);

  // ✅ REFACTOR: TabRenderer component estratto in presentation/TabRenderer.tsx
  // UnifiedTabContent completamente rimosso - ora usiamo TabRenderer

  // ✅ REFACTOR: Use TabRenderer component
  // Note: FlowCanvasHost handles useFlowActions internally, we only need to update dock tree
  const renderTabContent = React.useCallback(
    (tab: DockTab) => {
      return (
        <TabRenderer
          tab={tab}
          currentPid={currentPid}
          setDockTree={setDockTree}
          editorCloseRefsMap={editorCloseRefsMap}
          pdUpdate={pdUpdate}
          testSingleNode={handleTestSingleNode}
          onFlowCreateTaskFlow={(tabId, newFlowId, title) => {
            // FlowCanvasHost already handles upsertFlow and openFlowBackground
            // We just need to update the dock tree
            setDockTree(prev =>
              upsertAddNextTo(prev, tabId, {
                id: `tab_${newFlowId}`,
                title: title || 'Task',
                type: 'flow',
                flowId: newFlowId,
              })
            );
          }}
          onFlowOpenTaskFlow={(tabId, taskFlowId, title) => {
            // FlowCanvasHost already handles openFlowBackground
            // We just need to update the dock tree
            setDockTree(prev =>
              upsertAddNextTo(prev, tabId, {
                id: `tab_${taskFlowId}`,
                title: title || 'Task',
                type: 'flow',
                flowId: taskFlowId,
              })
            );
          }}
        />
      );
    },
    [currentPid, setDockTree, pdUpdate, handleTestSingleNode]
  );
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
  const taskTreeContext = useTaskTreeContext();
  const getTranslationsForTaskTree = taskTreeContext.getTranslationsForTaskTree;
  // const setTranslationsForTaskTree = taskTreeContext.setTranslationsForTaskTree;

  // Usa ActEditor context invece di selectedDDT per unificare l'apertura editor
  const taskEditorCtx = useTaskEditor(); // ✅ RINOMINATO: actEditorCtx → taskEditorCtx, useActEditor → useTaskEditor

  // ✅ REFACTOR: Initialize ProjectManager
  const projectManager = React.useMemo(() => {
    return new ProjectManager({
      pdUpdate,
      setCurrentProject,
      refreshData,
      setAppState,
    });
  }, [pdUpdate, setCurrentProject, refreshData, setAppState]);

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

      // ❌ RIMOSSO: const template = task.text || '' - task.text non deve esistere
      // TODO: Usare translations[textKey] dove textKey viene da task.parameters
      const template = '';

      // Open as docking tab instead of fixed panel
      const tabId = `ni_${instanceId}`;
      setDockTree(prev => {
        // ✅ REFACTOR: Use extracted domain function
        if (tabExists(prev, tabId)) return prev; // Already open, don't duplicate

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

  // ✅ REFACTOR: Initialize EditorCoordinator
  const editorCoordinator = React.useMemo(() => {
    return new EditorCoordinator({
      currentProjectId: currentPid,
      projectData,
      pdUpdate,
    });
  }, [currentPid, projectData, pdUpdate]);

  // Listen for TaskEditor open events (open as docking tab)
  React.useEffect(() => {
    const h = async (e: any) => {
      try {
        const d = (e && e.detail) || {};
        // ✅ FIX: Verifica esplicitamente undefined/null invece di falsy (0 è falsy ma valido per TaskType.SayMessage)
        if (!d || !d.id || (d.type === undefined || d.type === null)) {
          return;
        }

        // ✅ REFACTOR: Use EditorCoordinator (async)
        setDockTree(prev => {
          // Start async operation
          editorCoordinator.openTaskEditor(prev, d)
            .then(result => setDockTree(result))
            .catch(err => console.error('[TaskEditor] Error in coordinator', err));
          // Return current state immediately (async update will happen via setDockTree in then)
          return prev;
        });
      } catch (err) {
        console.error('[TaskEditor] Failed to open', err);
      }
    };
    document.addEventListener('taskEditor:open', h as any);
    return () => document.removeEventListener('taskEditor:open', h as any);
  }, [editorCoordinator]);

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

  // ✅ REMOVED: Duplicate handleTestSingleNode definition - already defined before renderTabContent

  // ✅ DEBUG: Verify handleTestSingleNode is stable
  React.useEffect(() => {
    console.log('[AppContent] handleTestSingleNode defined:', {
      hasHandleTestSingleNode: !!handleTestSingleNode,
      handleTestSingleNodeName: handleTestSingleNode?.name,
    });
  }, [handleTestSingleNode]);

  // ✅ Handler to open flow chat as dockable panel (same logic as Response Editor Test button)
  const handleRunFlowRetryCountRef = React.useRef(0);
  const handleRunFlow = React.useCallback(() => {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [AppContent] handleRunFlow CALLED');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[AppContent] 🔍 handleRunFlow function check:', {
      functionName: handleRunFlow.name,
      functionType: typeof handleRunFlow,
      isFunction: typeof handleRunFlow === 'function',
      retryCount: handleRunFlowRetryCountRef.current,
    });

    // Reset retry count after successful execution
    handleRunFlowRetryCountRef.current = 0;

    // Check if flow has nodes/edges
    const nodes = (window as any).__flowNodes || [];
    const edges = (window as any).__flowEdges || [];
    const tasks = (window as any).__flowTasks || [];

    console.log('[AppContent] 📊 Flow data check:', {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      tasksCount: tasks.length,
      nodesAvailable: !!nodes.length,
      edgesAvailable: !!edges.length,
      windowHasFlowNodes: !!(window as any).__flowNodes,
      windowHasFlowEdges: !!(window as any).__flowEdges,
      windowHasFlowTasks: !!(window as any).__flowTasks,
    });

    // ✅ ARCHITECTURAL: Richiede solo nodes (edges sono opzionali - un flow con un solo nodo è valido)
    if (nodes.length === 0) {
      console.error('[AppContent] ❌ No flow nodes found - aborting');
      alert('No flow data found. Please create a flow with at least one node.');
      return;
    }

    // ✅ Un flow con un solo nodo è valido (non servono edges)
    if (nodes.length === 1 && edges.length === 0) {
      console.log('[AppContent] ℹ️ Flow with single node (no edges) - this is valid');
    }

    // Ensure translations are loaded
    console.log('[AppContent] 🔤 Translations state:', {
      translationsReady,
      translationsLoading,
      hasLoadAllTranslations: !!loadAllTranslations,
      globalTranslationsKeys: globalTranslations ? Object.keys(globalTranslations).length : 0,
    });

    if (!translationsReady && !translationsLoading && loadAllTranslations) {
      console.log('[AppContent] ⏳ Translations not ready, loading...');
      loadAllTranslations().then(() => {
        console.log('[AppContent] ✅ Translations loaded, retrying handleRunFlow');
        handleRunFlow();
      }).catch((err) => {
        console.error('[AppContent] ❌ Failed to load translations', err);
      });
      return;
    }

    // Prevent infinite retry loop (max 10 retries)
    if (translationsLoading) {
      if (handleRunFlowRetryCountRef.current >= 10) {
        console.error('[AppContent] ❌ Max retries reached waiting for translations');
        return;
      }
      handleRunFlowRetryCountRef.current += 1;
      console.log(`[AppContent] ⏳ Translations loading, retry ${handleRunFlowRetryCountRef.current}/10`);
      setTimeout(() => {
        handleRunFlow();
      }, 500);
      return;
    }

    // Get translations (for flow mode, use all available translations)
    const allTranslations = globalTranslations || {};

    console.log('[AppContent] 🔤 Final translations check:', {
      hasTranslations: !!allTranslations,
      translationsCount: Object.keys(allTranslations).length,
      translationsSample: Object.keys(allTranslations).slice(0, 5),
    });

    if (!allTranslations || Object.keys(allTranslations).length === 0) {
      console.error('[AppContent] ❌ Translations are empty - aborting');
      alert('Translations are not available. Please ensure the project has translations loaded.');
      return;
    }

    // Create chat tab for flow mode
    const chatTabId = 'chat_flow_main';
    // ✅ ARCHITECTURAL: Pass flow data as props instead of reading from window in child components
    const chatTab: DockTabChat = {
      id: chatTabId,
      title: 'Flow Chat',
      type: 'chat',
      task: null, // Flow mode, no specific task
      projectId: currentPid || null,
      translations: allTranslations, // All translations for flow mode
      taskTree: null, // Flow mode
      mode: 'interactive',
      // ✅ NEW: Pass flow data as props
      flowNodes: nodes,
      flowEdges: edges,
      flowTasks: tasks,
    };

    console.log('[AppContent] 📦 Created DockTabChat:', {
      id: chatTab.id,
      title: chatTab.title,
      type: chatTab.type,
      mode: chatTab.mode,
      projectId: chatTab.projectId,
      flowNodesCount: chatTab.flowNodes?.length || 0,
      flowEdgesCount: chatTab.flowEdges?.length || 0,
      flowTasksCount: chatTab.flowTasks?.length || 0,
      translationsCount: chatTab.translations ? Object.keys(chatTab.translations).length : 0,
      // ✅ DEBUG: Verifica se gli edges sono stati passati correttamente
      edgesArray: edges,
      edgesFirstItem: edges[0],
      nodesArray: nodes,
      nodesFirstItem: nodes[0],
    });

    if (edges.length === 0) {
      console.error('[AppContent] ❌ CRITICAL: No edges passed to DockTabChat!', {
        windowEdges: (window as any).__flowEdges,
        edgesVariable: edges,
        edgesLength: edges.length,
      });
    }

    // Open as right lateral panel (same as Response Editor Test button)
    console.log('[AppContent] 🚪 Opening lateral chat panel...');
    setDockTree(prev => {
      const newTree = openLateralChatPanel(prev, {
        tabId: chatTabId,
        newTab: chatTab,
        position: 'right',
      });
      console.log('[AppContent] ✅ Lateral chat panel opened, new tree:', {
        hasTree: !!newTree,
        treeKind: newTree?.kind,
      });
      return newTree;
    });

    console.log('[AppContent] ✅ handleRunFlow COMPLETED');
    console.log('═══════════════════════════════════════════════════════════════════════════');
  }, [setDockTree, currentPid, globalTranslations, translationsReady, translationsLoading, loadAllTranslations]);

  // Listen to Sidebar wrench
  React.useEffect(() => {
    const handler = () => setShowBackendBuilder(true);
    document.addEventListener('backendBuilder:open', handler);
    return () => document.removeEventListener('backendBuilder:open', handler);
  }, []);

  // Open ConditionEditor as docking tab
  React.useEffect(() => {
    const handler = async (e: any) => {
      const d = (e && e.detail) || {};
      try {
        // ✅ REFACTOR: Use EditorCoordinator (async)
        setDockTree(prev => {
          // Start async operation
          editorCoordinator.openConditionEditor(prev, d)
            .then(result => setDockTree(result))
            .catch(err => console.error('[ConditionEditor] Error in coordinator', err));
          // Return current state immediately (async update will happen via setDockTree in then)
          return prev;
        });
      } catch (err) {
        console.error('[ConditionEditor] Failed to open', err);
      }
    };
    document.addEventListener('conditionEditor:open', handler as any);
    return () => document.removeEventListener('conditionEditor:open', handler as any);
  }, [editorCoordinator]);

  // Stato per gestione progetti
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [showAllProjectsModal, setShowAllProjectsModal] = useState(false);
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ✅ REMOVED: Service unavailable listener - now handled in ResponseEditor with centered overlay
  const [searchTerm, setSearchTerm] = useState('');

  // Stato per finestre editor TaskTree aperte (ora con react-mosaic)
  // const [mosaicNodes, setMosaicNodes] = useState<any>(null);

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
  //       taskTree: { label: 'Test Panel' },
  //       translations: {},
  //       lang: 'it'
  //     });
  //   }
  // }, []);

  // ✅ REFACTOR: Use ProjectManager
  const fetchRecentProjects = React.useCallback(async () => {
    const result = await projectManager.fetchRecentProjects();
    setRecentProjects(result.projects);
    setProjectsLoadError(result.error);
  }, [projectManager]);

  const fetchAllProjects = React.useCallback(async () => {
    const result = await projectManager.fetchAllProjects();
    setAllProjects(result.projects);
    setProjectsLoadError(result.error);
    return result.projects; // Return projects for checking if any remain
  }, [projectManager]);

  // ✅ REFACTOR: Use ProjectManager
  const handleDeleteProject = useCallback(async (id: string) => {
    await projectManager.deleteProject(id);
    await fetchRecentProjects();
    const updatedProjects = await fetchAllProjects();
    // Mostra toast solo se ci sono ancora progetti dopo l'eliminazione
    if (updatedProjects && updatedProjects.length > 0) {
      setToast('Progetto eliminato!');
      setTimeout(() => setToast(null), 2000);
    }
  }, [projectManager, fetchRecentProjects, fetchAllProjects]);

  const handleDeleteAllProjects = useCallback(async () => {
    await projectManager.deleteAllProjects();
    await fetchRecentProjects();
    await fetchAllProjects();
  }, [projectManager, fetchRecentProjects, fetchAllProjects]);

  // Callback per LandingPage
  const handleLandingNewProject = useCallback(() => setAppState('creatingProject'), [setAppState]);
  // const handleLandingLoadProject = useCallback(async () => { await fetchRecentProjects(); }, [fetchRecentProjects]);
  // const handleLandingShowAllProjects = useCallback(async () => { await fetchAllProjects(); setShowAllProjectsModal(true); }, [fetchAllProjects]);

  // const handleOpenNewProjectModal = useCallback(() => setAppState('creatingProject'), [setAppState]);

  // ✅ REFACTOR: Use ProjectManager
  const handleCreateProject = useCallback(async (projectInfo: ProjectInfo): Promise<boolean> => {
    setCreateError(null);
    setIsCreatingProject(true);
    try {
      const result = await projectManager.createProject(projectInfo);
      if (!result.success) {
        setCreateError(result.error || 'Errore nella creazione del progetto');
      }
      return result.success;
    } finally {
      setIsCreatingProject(false);
    }
  }, [projectManager]);

  const handleCloseNewProjectModal = useCallback(() => setAppState('landing'), [setAppState]);

  // const handleSaveProject = useCallback(async () => { /* legacy save */ }, [currentProject, nodes, edges]);

  // ✅ REFACTOR: Use ProjectManager (simplified - complex error handling kept in AppContent for now)
  const handleOpenProjectById = useCallback(async (id: string) => {
    if (!id) return;
    const result = await projectManager.openProjectById(id);
    if (!result.success) {
      alert('Errore: ' + (result.error || 'Errore nell\'apertura del progetto'));
    }
  }, [projectManager]);

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
      // Log rimosso: non essenziale per flusso motore
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
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded shadow-lg z-50 animate-fade-in ${toast.includes('⚠️') ? 'bg-yellow-600' : 'bg-emerald-700'
          } text-white`}>
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
            loadError={projectsLoadError}
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
            currentProjectId={currentPid || null}
            onCloseProject={() => {
              // Chiudi progetto e torna alla home
              setCurrentProject(null);
              setAppState('landing');
              // Pulisci localStorage del progetto corrente
              localStorage.removeItem('currentProjectId');
            }}
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

                // ✅ ARCHITECTURAL FIX: Cleanup orphan tasks BEFORE saving to database
                // This ensures the database only receives coherent data
                const cleanupStart = performance.now();
                console.log('[Save][Cleanup] 🔍 START - Detecting orphan tasks from in-memory state');

                // Get all flows and tasks from in-memory state
                const allFlows = flowsRef.current;
                const allTasksInMemory = taskRepository.getAllTasks();

                // Extract all task IDs referenced in flows
                const referencedTaskIds = new Set<string>();
                Object.values(allFlows).forEach((flow: any) => {
                  if (flow && flow.nodes && Array.isArray(flow.nodes)) {
                    flow.nodes.forEach((node: any) => {
                      const nodeData = node.data as FlowNode;
                      if (nodeData.rows && Array.isArray(nodeData.rows)) {
                        nodeData.rows.forEach((row: any) => {
                          // row.id is the taskId (unified model: row.id === task.id)
                          if (row.id) {
                            referencedTaskIds.add(row.id);
                          }
                        });
                      }
                    });
                  }
                });

                // Filter orphan tasks: tasks not referenced in any flow
                const orphanTasks = allTasksInMemory.filter(task => !referencedTaskIds.has(task.id));
                const tasksToSave = allTasksInMemory.filter(task => referencedTaskIds.has(task.id));

                const cleanupEnd = performance.now();
                console.log('[Save][Cleanup] ✅ DONE', {
                  ms: Math.round(cleanupEnd - cleanupStart),
                  totalTasks: allTasksInMemory.length,
                  referencedTaskIds: referencedTaskIds.size,
                  orphanTasks: orphanTasks.length,
                  tasksToSave: tasksToSave.length,
                  orphanTaskIds: orphanTasks.map(t => t.id)
                });

                if (orphanTasks.length > 0) {
                  console.warn('[Save][Cleanup] ⚠️ Orphan tasks excluded from save', {
                    count: orphanTasks.length,
                    ids: orphanTasks.map(t => t.id)
                  });
                }

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

                  // 3. Save flow (SPOSTATO PRIMA dei tasks per evitare cleanup degli orphan tasks)
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][3-flow] 🚀 START');
                      const svc = await import('../services/FlowPersistService');
                      const tFlush = performance.now();
                      await svc.flushFlowPersist();
                      const tFlushEnd = performance.now();
                      console.log('[Save][3-flow][flush] ✅ DONE', { ms: Math.round(tFlushEnd - tFlush) });

                      // Final PUT immediate (explicit Save)
                      const tPut = performance.now();
                      const putRes = await fetch(`/api/projects/${encodeURIComponent(pid)}/flow?flowId=main`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(((window as any).__flows && (window as any).__flows.main) ? { nodes: (window as any).__flows.main.nodes, edges: (window as any).__flows.main.edges } : { nodes: (window as any).__flowNodes || [], edges: (window as any).__flowEdges || [] })
                      });
                      const tPutEnd = performance.now();
                      if (!putRes.ok) {
                        console.error('[Save][3-flow][put] ❌ ERROR', { ms: Math.round(tPutEnd - tPut), status: putRes.status, statusText: putRes.statusText });
                      } else {
                        console.log('[Save][3-flow][put] ✅ DONE', { ms: Math.round(tPutEnd - tPut) });
                      }

                      const tEnd = performance.now();
                      console.log('[Save][3-flow] ✅ DONE', {
                        totalMs: Math.round(tEnd - tStart),
                        flushMs: Math.round(tFlushEnd - tFlush),
                        putMs: Math.round(tPutEnd - tPut)
                      });
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][3-flow] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 4. Save tasks (SPOSTATO DOPO il flow)
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][4-tasks] 🚀 START');
                      const { taskRepository } = await import('../services/TaskRepository');
                      const tasksCount = taskRepository.getInternalTasksCount();

                      // ✅ NEW: Log dettagliato PRIMA del salvataggio
                      const allTasksBefore = taskRepository.getAllTasks();
                      const instancesBefore = allTasksBefore.filter(t => t.templateId);
                      console.log('[Save][4-tasks] 🔍 REPOSITORY STATE BEFORE SAVE', {
                        projectId: pid,
                        totalTasks: allTasksBefore.length,
                        instancesCount: instancesBefore.length,
                        allTaskIds: allTasksBefore.map(t => t.id),
                        allInstances: instancesBefore.map(t => ({
                          id: t.id,
                          templateId: t.templateId,
                          type: t.type,
                          hasSteps: t.steps ? Object.keys(t.steps).length > 0 : false,
                        })),
                      });

                      // ✅ ARCHITECTURAL FIX: Use tasksToSave (filtered orphan tasks) instead of all tasks
                      console.log('[Save][4-tasks] 📊 Tasks to save', {
                        count: tasksToSave.length,
                        orphanTasksExcluded: orphanTasks.length
                      });
                      const saved = await taskRepository.saveAllTasksToDatabase(pid, tasksToSave);
                      const tEnd = performance.now();
                      if (saved) {
                        console.log('[Save][4-tasks] ✅ DONE', { ms: Math.round(tEnd - tStart), tasksCount });
                      } else {
                        console.warn('[Save][4-tasks] ⚠️ FAILED', { ms: Math.round(tEnd - tStart), tasksCount });
                      }
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][4-tasks] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 5. Save variable mappings
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][5-mappings] 🚀 START');
                      const { flowchartVariablesService } = await import('../services/FlowchartVariablesService');
                      const stats = flowchartVariablesService.getStats();
                      console.log('[Save][5-mappings] 📊 Mappings to save', stats);
                      const mappingsSaved = await flowchartVariablesService.saveToDatabase(pid);
                      const tEnd = performance.now();
                      if (mappingsSaved) {
                        console.log('[Save][5-mappings] ✅ DONE', { ms: Math.round(tEnd - tStart), stats });
                      } else {
                        console.warn('[Save][5-mappings] ⚠️ FAILED', { ms: Math.round(tEnd - tStart), stats });
                      }
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][5-mappings] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 6. Save modified templates (templates with modified contracts)
                  (async () => {
                    if (!pid) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][6-templates] 🚀 START');
                      const { DialogueTaskService } = await import('../services/DialogueTaskService');
                      const modifiedIds = DialogueTaskService.getModifiedTemplateIds();
                      console.log('[Save][6-templates] 📊 Templates to save', { count: modifiedIds.length, templateIds: modifiedIds });

                      if (modifiedIds.length === 0) {
                        const tEnd = performance.now();
                        console.log('[Save][6-templates] ✅ DONE (no modified templates)', { ms: Math.round(tEnd - tStart) });
                        return;
                      }

                      const result = await DialogueTaskService.saveModifiedTemplates(pid);
                      const tEnd = performance.now();
                      if (result.failed === 0) {
                        console.log('[Save][6-templates] ✅ DONE', {
                          ms: Math.round(tEnd - tStart),
                          saved: result.saved,
                          total: modifiedIds.length
                        });
                      } else {
                        console.warn('[Save][6-templates] ⚠️ PARTIAL', {
                          ms: Math.round(tEnd - tStart),
                          saved: result.saved,
                          failed: result.failed,
                          total: modifiedIds.length
                        });
                      }
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][6-templates] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // 7. Save acts and conditions
                  (async () => {
                    if (!pid || !projectData) return;
                    const tStart = performance.now();
                    try {
                      console.log('[Save][7-conditions] 🚀 START');
                      const conditionsCount = projectData?.conditions?.flatMap((cat: any) => cat.items || []).length || 0;
                      console.log('[Save][7-conditions] 📊 Items to save', { conditionsCount });

                      // ✅ REMOVED: saveProjectActsToDb - acts migrati a tasks, salvati via taskRepository

                      const tCond = performance.now();
                      await (ProjectDataService as any).saveProjectConditionsToDb?.(pid, projectData);
                      const tCondEnd = performance.now();
                      console.log('[Save][7-conditions] ✅ DONE', { ms: Math.round(tCondEnd - tCond), conditionsCount });

                      // ✅ REMOVED: Reload completo non necessario - i dati sono già in memoria e aggiornati
                      // - task.problem è già nel TaskRepository dopo il salvataggio
                      // - Non serve ricaricare tutto il progetto dal database
                      // - Evita re-render inutili e perdita di stato in memoria (wizardIntegrationProp, template cache, etc.)

                      const tEnd = performance.now();
                      console.log('[Save][7-acts-conditions] ✅ DONE', {
                        totalMs: Math.round(tEnd - tStart),
                        conditionsMs: Math.round(tCondEnd - tCond)
                      });
                    } catch (e) {
                      const tEnd = performance.now();
                      console.error('[Save][7-acts-conditions] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                    }
                  })(),

                  // ✅ REMOVED: Cleanup orphan tasks endpoint - cleanup now happens in frontend BEFORE save
                  // Orphan tasks are filtered out before sending to backend, so no cleanup needed
                  (async () => {
                    // No-op: cleanup is done in frontend before Promise.allSettled
                    return Promise.resolve();
                  })()
                ]);

                const saveEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const totalMs = Math.round(saveEnd - saveStart);

                console.log('[Save] ═══════════════════════════════════════════════════════');
                console.log('[Save] ✅ ALL OPERATIONS COMPLETED', {
                  totalMs,
                  timestamp: new Date().toISOString(),
                  results: saveResults.map((r, i) => ({
                    operation: ['catalog', 'translations', 'flow', 'tasks', 'mappings', 'templates', 'conditions'][i],
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
            onRun={handleRunFlow}
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
                          <DockManagerWithFlows
                            root={dockTree}
                            setRoot={setDockTree}
                            renderTabContent={renderTabContent}
                            flowsRef={flowsRef}
                          />
                        </FlowWorkspaceProvider>
                      ) : (
                        <FlowTestProvider testSingleNode={handleTestSingleNode}>
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
                            testPanelOpen={testPanelOpen}
                            setTestPanelOpen={setTestPanelOpen}
                            testNodeId={testNodeId}
                            setTestNodeId={setTestNodeId}
                          />
                        </FlowTestProvider>
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

      {/* ✅ Old TaskTree Wizard Modal removed - now using new TaskBuilderAIWizard integrated in ResponseEditor */}
    </div>
  );
};