// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useRef } from 'react';
import { DockNode, DockTabChat } from '../dock/types';
import { openLateralChatPanel } from '../components/AppContent/infrastructure/docking/DockingHelpers';
import { createSingleNodeFlow } from '../utils/flowTestHelpers';
import { FlowStateBridge } from '../services/FlowStateBridge';

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

  /**
   * Creates a DockTabChat object for chat panel
   */
  const createChatTab = useCallback((options: {
    tabId: string;
    title: string;
    nodes: any[];
    edges: any[];
    tasks: any[];
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
    };
  }, [currentPid, translations]);

  /**
   * Opens chat panel for full flow execution
   */
  const openFlowChat = useCallback(() => {
    console.log('[ChatOrchestrator] openFlowChat called');

    // Reset retry count
    flowChatRetryRef.current = 0;

    // Get flow data via FlowStateBridge (Phase 4: centralized access)
    const { nodes, edges, tasks } = FlowStateBridge.getFlowData();

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

    // Create and open chat tab
    const chatTab = createChatTab({
      tabId: 'chat_flow_main',
      title: 'Flow Chat',
      nodes,
      edges,
      tasks,
    });

    console.log('[ChatOrchestrator] Opening flow chat panel');
    setDockTree(prev => openLateralChatPanel(prev, {
      tabId: chatTab.id,
      newTab: chatTab,
      position: 'right',
    }));

  }, [setDockTree, translations, translationsReady, translationsLoading, loadAllTranslations, createChatTab]);

  /**
   * Opens chat panel for single node test
   */
  const openSingleNodeChat = useCallback(async (nodeId: string, nodeRows?: any[]) => {
    console.log('[ChatOrchestrator] openSingleNodeChat called', { nodeId });

    // Reset retry count
    singleNodeRetryRef.current = 0;

    // Get flow data via FlowStateBridge (Phase 4: centralized access)
    const { nodes: allNodes, edges: allEdges, tasks: allTasks } = FlowStateBridge.getFlowData();

    // Find the node using bridge helper
    const node = FlowStateBridge.findNode(nodeId);
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
    const nodeLabel = node.data?.label || nodeId;
    const chatTab = createChatTab({
      tabId: `chat_node_${nodeId}`,
      title: `Test: ${nodeLabel}`,
      nodes,
      edges,
      tasks,
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
      console.log('[ChatOrchestrator] Chat panel opened successfully');
    } catch (error) {
      console.error('[ChatOrchestrator] Error opening chat panel:', error);
      alert(`Failed to open chat panel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  }, [setDockTree, translations, translationsReady, translationsLoading, loadAllTranslations, createChatTab]);

  return {
    openFlowChat,
    openSingleNodeChat,
  };
}
