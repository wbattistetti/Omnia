// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useRef } from 'react';
import { DockNode, DockTabChat } from '../dock/types';
import { openLateralChatPanel } from '../components/AppContent/infrastructure/docking/DockingHelpers';
import { scheduleDockLayoutRefresh } from '../utils/scheduleDockLayoutRefresh';
import { createSingleNodeFlow } from '../utils/flowTestHelpers';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';

/**
 * Chat orchestration hook - Phase 2 Refactoring
 *
 * Extracts chat panel opening logic from AppContent.tsx.
 * Provides stable, reusable functions for opening chat panels.
 *
 * RESPONSIBILITIES:
 * - Creating DockTabChat objects
 * - Handling translation loading/retry
 * - Opening lateral chat panels
 *
 * DOES NOT HANDLE:
 * - Dock tree state (passed via props)
 * - Translations context (passed via props)
 */

export interface ChatOrchestratorDeps {
  /** Function to update dock tree */
  setDockTree: (updater: (prev: DockNode) => DockNode) => void;
  /** Current project ID */
  currentPid: string | null | undefined;
  /** Translations object */
  translations: Record<string, string> | null;
  /** Whether translations are ready */
  translationsReady: boolean;
  /** Whether translations are loading */
  translationsLoading: boolean;
  /** Function to load all translations */
  loadAllTranslations?: () => Promise<void>;
}

export interface ChatOrchestratorResult {
  /** Open chat panel for full flow execution */
  openFlowChat: () => void;
  /** Open chat panel for single node test */
  openSingleNodeChat: (nodeId: string, nodeRows?: any[]) => Promise<void>;
}

/**
 * Hook to orchestrate chat panel operations.
 * Extracted from AppContent.tsx to reduce complexity.
 */
export function useChatOrchestrator(deps: ChatOrchestratorDeps): ChatOrchestratorResult {
  const {
    setDockTree,
    currentPid,
    translations,
    translationsReady,
    translationsLoading,
    loadAllTranslations,
  } = deps;

  // Retry counters to prevent infinite loops
  const flowChatRetryRef = useRef(0);
  const singleNodeRetryRef = useRef(0);
  const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-[a-z0-9_-]+)?$/i;

  const getReadableLabel = useCallback((value: unknown, fallback: string): string => {
    const text = String(value || '').trim();
    if (!text || GUID_RE.test(text)) {
      return fallback;
    }
    return text;
  }, []);

  const getFirstRowLabel = useCallback((nodeRows?: any[]): string | undefined => {
    if (!Array.isArray(nodeRows) || nodeRows.length === 0) {
      return undefined;
    }
    const candidate = nodeRows.find((r: any) => {
      const text = String(r?.text || r?.label || r?.title || '').trim();
      return text.length > 0 && !GUID_RE.test(text);
    });
    const resolved = String(candidate?.text || candidate?.label || candidate?.title || '').trim();
    return resolved || undefined;
  }, []);

  /**
   * Creates a DockTabChat object for chat panel
   */
  const createChatTab = useCallback((options: {
    tabId: string;
    title: string;
    nodes: any[];
    edges: any[];
    tasks: any[];
    executionFlowName?: string;
    executionLaunchType?: 'flow' | 'rowTask' | 'node';
    executionLaunchLabel?: string;
  }): DockTabChat => {
    return {
      id: options.tabId,
      title: options.title,
      type: 'chat',
      task: null,
      projectId: currentPid || null,
      translations: translations || {},
      taskTree: null,
      mode: 'interactive',
      flowNodes: options.nodes,
      flowEdges: options.edges,
      flowTasks: options.tasks,
      executionFlowName: options.executionFlowName,
      executionLaunchType: options.executionLaunchType,
      executionLaunchLabel: options.executionLaunchLabel,
    };
  }, [currentPid, translations]);

  /**
   * Opens chat panel for full flow execution
   */
  const openFlowChat = useCallback(() => {
    console.log('[ChatOrchestrator] openFlowChat called');

    void import('../context/CompilationErrorsContext').then(({ clearCompilationErrorsGlobal }) => {
      clearCompilationErrorsGlobal();
    });

    // Reset retry count
    flowChatRetryRef.current = 0;

    const nodes = FlowWorkspaceSnapshot.getNodes();
    const edges = FlowWorkspaceSnapshot.getEdges();
    const tasks: any[] = [];

    console.log('[ChatOrchestrator] Flow data:', {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      tasksCount: tasks.length,
    });

    // Validate flow has nodes
    if (nodes.length === 0) {
      console.error('[ChatOrchestrator] No flow nodes found');
      alert('No flow data found. Please create a flow with at least one node.');
      return;
    }

    // Handle translation loading with retry
    if (!translationsReady && !translationsLoading && loadAllTranslations) {
      console.log('[ChatOrchestrator] Loading translations...');
      loadAllTranslations().then(() => {
        openFlowChat();
      }).catch((err) => {
        console.error('[ChatOrchestrator] Failed to load translations', err);
      });
      return;
    }

    // Retry if translations are still loading
    if (translationsLoading) {
      if (flowChatRetryRef.current >= 10) {
        console.error('[ChatOrchestrator] Max retries reached');
        return;
      }
      flowChatRetryRef.current += 1;
      console.log(`[ChatOrchestrator] Retry ${flowChatRetryRef.current}/10`);
      setTimeout(openFlowChat, 500);
      return;
    }

    // Validate translations
    if (!translations || Object.keys(translations).length === 0) {
      console.error('[ChatOrchestrator] Translations empty');
      alert('Translations are not available.');
      return;
    }

    const rootPref = (() => {
      try {
        return localStorage.getItem('flow.orchestratorRoot');
      } catch {
        return null;
      }
    })();
    const activeCanvasId = FlowWorkspaceSnapshot.getActiveFlowId();
    const runLabel =
      rootPref === 'main'
        ? 'MAIN'
        : (FlowWorkspaceSnapshot.getFlowById(activeCanvasId)?.title || activeCanvasId);
    const chatTitle = '';

    // Create and open chat tab
    const chatTab = createChatTab({
      tabId: 'chat_flow_main',
      title: chatTitle,
      nodes,
      edges,
      tasks,
      executionFlowName: runLabel,
      executionLaunchType: 'flow',
    });

    console.log('[ChatOrchestrator] Opening flow chat panel');
    setDockTree(prev => openLateralChatPanel(prev, {
      tabId: chatTab.id,
      newTab: chatTab,
      position: 'right',
    }));
    scheduleDockLayoutRefresh();

  }, [setDockTree, translations, translationsReady, translationsLoading, loadAllTranslations, createChatTab]);

  /**
   * Opens chat panel for single node test
   */
  const openSingleNodeChat = useCallback(async (nodeId: string, nodeRows?: any[]) => {
    console.log('[ChatOrchestrator] openSingleNodeChat called', { nodeId });

    // Reset retry count
    singleNodeRetryRef.current = 0;

    const allNodes = FlowWorkspaceSnapshot.getNodes();
    const allEdges = FlowWorkspaceSnapshot.getEdges();
    const allTasks: any[] = [];

    const node = allNodes.find((n: any) => n.id === nodeId);
    if (!node) {
      console.error('[ChatOrchestrator] Node not found:', nodeId);
      alert(`Node ${nodeId} not found in flow.`);
      return;
    }

    // Create single-node flow
    const { nodes, edges, tasks } = createSingleNodeFlow(nodeId, allNodes, allEdges, allTasks);

    console.log('[ChatOrchestrator] Single-node flow created:', {
      nodeId,
      nodeLabel: node.data?.label || nodeId,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      tasksCount: tasks.length,
    });

    // Handle translation loading with retry
    if (!translationsReady && !translationsLoading && loadAllTranslations) {
      console.log('[ChatOrchestrator] Loading translations...');
      await loadAllTranslations();
    }

    // Retry if translations are still loading
    if (translationsLoading) {
      if (singleNodeRetryRef.current >= 10) {
        console.error('[ChatOrchestrator] Max retries reached');
        return;
      }
      singleNodeRetryRef.current += 1;
      console.log(`[ChatOrchestrator] Retry ${singleNodeRetryRef.current}/10`);
      setTimeout(() => openSingleNodeChat(nodeId, nodeRows), 500);
      return;
    }

    // Validate translations
    if (!translations || Object.keys(translations).length === 0) {
      console.error('[ChatOrchestrator] Translations empty');
      alert('Translations are not available.');
      return;
    }

    // Create and open chat tab
    const nodeLabel = getReadableLabel(node.data?.label, 'Nodo');
    const canvasId = FlowWorkspaceSnapshot.getActiveFlowId();
    const canvasSnap = FlowWorkspaceSnapshot.getFlowById(canvasId);
    const canvasTitle = getReadableLabel(canvasSnap?.title || canvasId, canvasId === 'main' ? 'MAIN' : 'Flow');
    const rowLabel = getFirstRowLabel(nodeRows);
    const launchType: 'rowTask' | 'node' = Array.isArray(nodeRows) && nodeRows.length === 1 ? 'rowTask' : 'node';
    const launchLabel =
      launchType === 'node'
        ? `${rowLabel || nodeLabel}, ecc.`
        : (rowLabel || nodeLabel);
    const chatTab = createChatTab({
      tabId: `chat_node_${nodeId}`,
      title: '',
      nodes,
      edges,
      tasks,
      executionFlowName: canvasTitle,
      executionLaunchType: launchType,
      executionLaunchLabel: launchLabel,
    });

    console.log('[ChatOrchestrator] Opening single-node chat panel');

    if (!setDockTree) {
      console.error('[ChatOrchestrator] setDockTree not available');
      alert('Cannot open chat panel: dock tree manager not available');
      return;
    }

    try {
      setDockTree(prev => openLateralChatPanel(prev, {
        tabId: chatTab.id,
        newTab: chatTab,
        position: 'right',
      }));
      scheduleDockLayoutRefresh();
      console.log('[ChatOrchestrator] Chat panel opened successfully');
    } catch (error) {
      console.error('[ChatOrchestrator] Error opening chat panel:', error);
      alert(`Failed to open chat panel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  }, [setDockTree, translations, translationsReady, translationsLoading, loadAllTranslations, createChatTab, getReadableLabel, getFirstRowLabel]);

  return {
    openFlowChat,
    openSingleNodeChat,
  };
}
