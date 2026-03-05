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
  // ✅ Track nodes identity to detect when flow actually changes (not just length)
  // This allows starting a new flow when testing a different node
  const previousNodesKeyRef = React.useRef<string>('');

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
      return { success: true };
    },
    translations: translations || {},
    onMessage: (message) => {
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('[useFlowModeChat] 🔵 onMessage callback called');
      console.log('[useFlowModeChat] 🔵 Message received:', message);
      console.log('[useFlowModeChat] 🔵 Message text:', message.text);
      const messageId = `msg_${messageIdCounter.current++}`;
      console.log('[useFlowModeChat] 🔵 Generated messageId:', messageId);
      // Avoid duplicates
      if (sentMessageIds.current.has(messageId)) {
        console.log('[useFlowModeChat] ⚠️ Message already sent, skipping:', messageId);
        return;
      }
      sentMessageIds.current.add(messageId);
      console.log('[useFlowModeChat] 🔵 MessageId added to sentMessageIds');

      const newMessage: Message = {
        id: messageId,
        text: message.text || '',
        type: 'bot',
        timestamp: new Date(),
      };
      console.log('[useFlowModeChat] 🔵 Created newMessage object:', newMessage);
      console.log('[useFlowModeChat] 🔵 onMessage prop exists?', !!onMessage);
      if (onMessage) {
        console.log('[useFlowModeChat] 🔵 Calling onMessage prop...');
        onMessage(newMessage);
        console.log('[useFlowModeChat] ✅ onMessage prop completed');
      } else {
        console.warn('[useFlowModeChat] ⚠️ onMessage prop not provided!');
      }
      console.log('═══════════════════════════════════════════════════════════════════════════');
    },
    onDDTStart: () => {
      // DDT started - no log needed
    },
    onDDTComplete: () => {
      // DDT completed - no log needed
    },
    onComplete: () => {
      setIsWaitingForInput(false);
    },
    onError: (error) => {
      console.error('[useFlowModeChat] Flow error', error);
      setError(error.message || 'Flow execution error');
      setIsWaitingForInput(false);
    },
    onWaitingForInput: () => {
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🔵 [useFlowModeChat] 🔍 BREAKPOINT: onWaitingForInput called');
      console.log('🔵 [useFlowModeChat] 🔍 Current isWaitingForInput state:', isWaitingForInput);
      console.log('🔵 [useFlowModeChat] 🔍 About to set isWaitingForInput to true');
      setIsWaitingForInput(true);
      console.log('✅ [useFlowModeChat] 🔍 BREAKPOINT: setIsWaitingForInput(true) called');
      console.log('═══════════════════════════════════════════════════════════════════════════');
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
    // ✅ Create stable key based on node IDs to detect actual flow changes
    // This allows starting a new flow when testing a different node
    const nodesKey = nodes.map(n => n.id).sort().join(',');

    // ✅ FIX: Reset guard when nodes actually change (not just when empty)
    // This allows starting a new flow when opening a different node or flow
    if (nodesKey !== previousNodesKeyRef.current) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = nodesKey;
    }

    // ✅ ARCHITECTURAL: Richiede solo nodes (edges sono opzionali - un flow con un solo nodo è valido)
    if (hasStartedRef.current && nodes.length === 0) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = '';
    }

    if (hasStartedRef.current) {
      return; // Already started
    }

    // ✅ ARCHITECTURAL: Richiede solo nodes (edges sono opzionali)
    if (nodes.length === 0) {
      console.error('[useFlowModeChat] ❌ Cannot start: no nodes found');
      setError('Cannot start flow: no nodes found');
      return;
    }

    if (!translations || Object.keys(translations).length === 0) {
      console.warn('[useFlowModeChat] ❌ No translations found - aborting start');
      return;
    }

    if (!flowEngine) {
      console.error('[useFlowModeChat] ❌ flowEngine is not available - aborting start');
      return;
    }

    if (typeof flowEngine.start !== 'function') {
      console.error('[useFlowModeChat] ❌ flowEngine.start is not a function - aborting start');
      return;
    }

    hasStartedRef.current = true;
    flowEngine.start().catch((error) => {
      console.error('[useFlowModeChat] ❌ Failed to start flow orchestrator', error);
      setError(error.message || 'Failed to start flow orchestrator');
      hasStartedRef.current = false; // Allow retry on error
    });
    // ✅ Depend on nodes (full array to detect ID changes), translations key, and flowEngine
    // This ensures the effect runs when nodes actually change (different IDs), not just when length changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, translationsKey, flowEngine]);

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
