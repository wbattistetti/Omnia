import React from 'react';
import { useDialogueEngine } from '@components/DialogueEngine/useDialogueEngine';
import type { Message } from '@components/ChatSimulator/UserMessage';

/**
 * Hook dedicated to flow mode chat functionality
 * Encapsulates all flow mode logic, isolating DDEBubbleChat from window globals
 *
 * @param translations - Translations for the flow
 * @param onMessage - Callback when a new message is received
 * @returns Flow mode chat state and handlers
 */
export function useFlowModeChat(
  translations: Record<string, string> | undefined,
  onMessage?: (message: Message) => void
) {
  const messageIdCounter = React.useRef(0);
  const [isWaitingForInput, setIsWaitingForInput] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // ✅ Don't store messages internally - let parent component manage them
  // We only track messages to avoid duplicates when calling onMessage
  const sentMessageIds = React.useRef<Set<string>>(new Set());

  // ✅ Encapsulate access to window globals
  const flowNodes = React.useMemo(() => {
    return (window as any).__flowNodes || [];
  }, []);

  const flowEdges = React.useMemo(() => {
    return (window as any).__flowEdges || [];
  }, []);

  const flowTasks = React.useMemo(() => {
    return (window as any).__flowTasks || [];
  }, []);

  // ✅ Use dialogue engine for flow mode
  const flowEngine = useDialogueEngine({
    nodes: flowNodes,
    edges: flowEdges,
    getTask: (taskId: string) => {
      return flowTasks.find((t: any) => t.id === taskId) || null;
    },
    getDDT: (taskId: string) => {
      const task = flowTasks.find((t: any) => t.id === taskId);
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
  });

  // ✅ Start flow orchestrator when ready
  React.useEffect(() => {
    if (flowNodes.length === 0 || flowEdges.length === 0) {
      console.warn('[useFlowModeChat] No nodes/edges found');
      return;
    }
    if (!translations || Object.keys(translations).length === 0) {
      console.warn('[useFlowModeChat] No translations found');
      return;
    }

    console.log('[useFlowModeChat] 🚀 Starting flow orchestrator', {
      nodesCount: flowNodes.length,
      edgesCount: flowEdges.length,
      translationsCount: Object.keys(translations).length
    });

    flowEngine.start().catch((error) => {
      console.error('[useFlowModeChat] Failed to start flow orchestrator', error);
      setError(error.message || 'Failed to start flow orchestrator');
    });
  }, [flowNodes, flowEdges, translations, flowEngine]);

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
