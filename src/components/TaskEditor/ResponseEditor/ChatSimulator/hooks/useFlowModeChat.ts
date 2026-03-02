import React from 'react';
import { useDialogueEngine } from '@components/DialogueEngine/useDialogueEngine';
import type { Message } from '@components/ChatSimulator/UserMessage';

/**
 * Hook dedicated to flow mode chat functionality
 * ✅ ARCHITECTURAL: Receives flow data as props (not from window globals)
 * This makes the hook testable, predictable, and follows React best practices
 *
 * @param nodes - Flow nodes (from props, not window)
 * @param edges - Flow edges (from props, not window)
 * @param tasks - Flow tasks (from props, not window)
 * @param translations - Translations for the flow
 * @param onMessage - Callback when a new message is received
 * @returns Flow mode chat state and handlers
 */
export function useFlowModeChat(
  nodes: any[], // Node<FlowNode>[] - using any[] to avoid circular dependency
  edges: any[], // Edge<EdgeData>[] - using any[] to avoid circular dependency
  tasks: any[],
  translations: Record<string, string> | undefined,
  onMessage?: (message: Message) => void
) {
  const messageIdCounter = React.useRef(0);
  const [isWaitingForInput, setIsWaitingForInput] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // ✅ Don't store messages internally - let parent component manage them
  // We only track messages to avoid duplicates when calling onMessage
  const sentMessageIds = React.useRef<Set<string>>(new Set());
  // ✅ Guard to prevent multiple start() calls
  const hasStartedRef = React.useRef(false);

  // ✅ ARCHITECTURAL: Memoize engine options (not the engine itself)
  // This ensures the engine is recreated only when data actually changes
  const engineOptions = React.useMemo(() => ({
    nodes,
    edges,
    getTask: (taskId: string) => {
      return tasks.find((t: any) => t.id === taskId) || null;
    },
    getDDT: (taskId: string) => {
      const task = tasks.find((t: any) => t.id === taskId);
      if (!task || task.templateId !== 'GetData') return null;
      return task.data ? { label: task.label, data: task.data, steps: task.steps } : null;
    },
    // ✅ FIX: Add required onTaskExecute (not used with backend orchestrator, but required by interface)
    onTaskExecute: async (task) => {
      // Backend orchestrator handles task execution, this is just a placeholder
      console.log('[useFlowModeChat] onTaskExecute called (backend orchestrator handles execution)', task.id);
      return { success: true };
    },
    translations: translations || {},
    onMessage: (message) => {
      const messageId = `msg_${messageIdCounter.current++}`;
      // Avoid duplicates
      if (sentMessageIds.current.has(messageId)) return;
      sentMessageIds.current.add(messageId);

      const newMessage: Message = {
        id: messageId,
        text: message.text || '',
        sender: 'bot',
        timestamp: new Date(),
      };
      onMessage?.(newMessage);
    },
    onDDTStart: (data) => {
      console.log('[useFlowModeChat] DDT started', data);
    },
    onDDTComplete: () => {
      console.log('[useFlowModeChat] DDT completed');
    },
    onComplete: () => {
      console.log('[useFlowModeChat] Flow completed');
      setIsWaitingForInput(false);
    },
    onError: (error) => {
      console.error('[useFlowModeChat] Flow error', error);
      setError(error.message || 'Flow execution error');
      setIsWaitingForInput(false);
    },
    onWaitingForInput: (data) => {
      setIsWaitingForInput(true);
      console.log('[useFlowModeChat] Waiting for input', data);
    },
  }), [nodes, edges, tasks, translations, onMessage]);

  // ✅ ARCHITECTURAL: Call hook at top level (not inside useMemo)
  // This respects React's Rules of Hooks
  const flowEngine = useDialogueEngine(engineOptions);

  // ✅ ARCHITECTURAL: Start when data is ready (depend on data, not engine object)
  // This prevents infinite loops and ensures the engine starts only when data is actually ready
  // Use a stable key for translations to detect changes without including the whole object
  const translationsKey = React.useMemo(() => {
    if (!translations) return '';
    return Object.keys(translations).sort().join(',');
  }, [translations]);

  // ✅ Log rimosso dal render - troppo rumoroso, solo nei punti critici

  React.useEffect(() => {
    console.log('[useFlowModeChat] ⚙️ useEffect triggered:', {
      nodesLength: nodes.length,
      edgesLength: edges.length,
      translationsKey: translationsKey.substring(0, 50),
      hasStarted: hasStartedRef.current,
    });

    // Reset guard if data changes (allows retry after data update)
    // ✅ ARCHITECTURAL: Richiede solo nodes (edges sono opzionali - un flow con un solo nodo è valido)
    if (hasStartedRef.current && nodes.length === 0) {
      console.log('[useFlowModeChat] 🔄 Resetting hasStartedRef because nodes are empty');
      hasStartedRef.current = false;
    }

    if (hasStartedRef.current) {
      console.log('[useFlowModeChat] ⏭️ Already started, skipping');
      return; // Already started
    }

    // ✅ ARCHITECTURAL: Richiede solo nodes (edges sono opzionali)
    if (nodes.length === 0) {
      console.error('[useFlowModeChat] ❌ Cannot start: no nodes found', {
        nodesLength: nodes.length,
      });
      setError('Cannot start flow: no nodes found');
      return;
    }

    // ✅ Un flow con un solo nodo è valido (non servono edges)
    if (nodes.length === 1 && edges.length === 0) {
      console.log('[useFlowModeChat] ℹ️ Flow with single node (no edges) - this is valid');
    }

    if (!translations || Object.keys(translations).length === 0) {
      console.warn('[useFlowModeChat] ❌ No translations found - aborting start', {
        hasTranslations: !!translations,
        translationsCount: translations ? Object.keys(translations).length : 0,
      });
      return;
    }

    if (!flowEngine) {
      console.error('[useFlowModeChat] ❌ flowEngine is not available - aborting start');
      return;
    }

    if (typeof flowEngine.start !== 'function') {
      console.error('[useFlowModeChat] ❌ flowEngine.start is not a function - aborting start', {
        flowEngineType: typeof flowEngine,
        flowEngineKeys: Object.keys(flowEngine || {}),
      });
      return;
    }

    console.log('[useFlowModeChat] 🚀 Starting flow orchestrator', {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      tasksCount: tasks.length,
      translationsCount: Object.keys(translations).length,
      engineType: typeof flowEngine,
      startType: typeof flowEngine.start,
    });

    hasStartedRef.current = true;
    flowEngine.start().then(() => {
      console.log('[useFlowModeChat] ✅ flowEngine.start() completed successfully');
    }).catch((error) => {
      console.error('[useFlowModeChat] ❌ Failed to start flow orchestrator', {
        error,
        errorMessage: error?.message,
        errorStack: error?.stack,
      });
      setError(error.message || 'Failed to start flow orchestrator');
      hasStartedRef.current = false; // Allow retry on error
    });
    // ✅ Depend on nodes length and translations key (edges are optional)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, translationsKey]);

  // ✅ Handle user input in flow mode
  const handleUserInput = React.useCallback(async (input: string) => {
    if (!flowEngine) return;

    try {
      await flowEngine.provideInput(input);
    } catch (error) {
      console.error('[useFlowModeChat] Error providing input to flow engine', error);
      setError(error instanceof Error ? error.message : 'Error providing input');
    }
  }, [flowEngine]);

  // ✅ Clear state when needed
  const clearMessages = React.useCallback(() => {
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    setIsWaitingForInput(false);
    setError(null);
  }, []);

  return {
    isWaitingForInput,
    error,
    handleUserInput,
    clearMessages,
  };
}
