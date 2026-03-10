import React from 'react';
import { useDialogueEngine } from '@components/DialogueEngine/useDialogueEngine';
import type { Message } from '@components/ChatSimulator/UserMessage';

/**
 * Hook dedicated to flow mode chat functionality
 * ✅ ARCHITECTURAL: Stable state pattern (same as useDialogueEngine)
 *
 * This hook maintains stable state across React Strict Mode remounts by:
 * 1. Storing critical state (isWaitingForInput, error) in refs
 * 2. Using useState only for triggering re-renders
 * 3. Stabilizing all callbacks with refs
 * 4. Ensuring state survives remounts
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
  // ✅ CRITICAL: Store onMessage in ref for stable access
  const onMessageRef = React.useRef(onMessage);
  React.useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const messageIdCounter = React.useRef(0);
  const sentMessageIds = React.useRef<Set<string>>(new Set());
  const hasStartedRef = React.useRef(false);
  const previousNodesKeyRef = React.useRef<string>('');

  // ✅ CRITICAL: Store critical state in ref (survives remount)
  const stateRef = React.useRef<{
    isWaitingForInput: boolean;
    error: string | null;
  }>({
    isWaitingForInput: false,
    error: null,
  });

  // ✅ STATE: UI-reactive state (triggers re-renders)
  // These are synchronized with stateRef via wrapper functions
  const [isWaitingForInput, setIsWaitingForInputState] = React.useState(false);
  const [error, setErrorState] = React.useState<string | null>(null);

  // ✅ STABLE: Wrapper functions that update both ref and state
  // This ensures state survives remounts AND triggers re-renders
  const setIsWaitingForInput = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function'
      ? value(stateRef.current.isWaitingForInput)
      : value;

    // ✅ Update ref first (survives remount)
    stateRef.current.isWaitingForInput = newValue;

    // ✅ Update state (triggers re-render)
    setIsWaitingForInputState(newValue);

    console.log('[useFlowModeChat] ⏳ setIsWaitingForInput called', {
      newValue,
      refValue: stateRef.current.isWaitingForInput,
    });
  }, []);

  const setError = React.useCallback((value: string | null) => {
    // ✅ Update ref first (survives remount)
    stateRef.current.error = value;

    // ✅ Update state (triggers re-render)
    setErrorState(value);
  }, []);

  // ✅ DEBUG: Log when isWaitingForInput changes
  React.useEffect(() => {
    console.log('[useFlowModeChat] ⏳ isWaitingForInput state changed:', {
      stateValue: isWaitingForInput,
      refValue: stateRef.current.isWaitingForInput,
    });
    if (!isWaitingForInput) {
      console.trace('[useFlowModeChat] 🔍 isWaitingForInput reset to false - stack trace:');
    }
  }, [isWaitingForInput]);

  // ✅ CRITICAL: Store setter refs for use in callbacks
  // These refs are stable and don't change between renders
  const setIsWaitingForInputRef = React.useRef(setIsWaitingForInput);
  const setErrorRef = React.useRef(setError);

  // ✅ Update setter refs when they change
  React.useEffect(() => {
    setIsWaitingForInputRef.current = setIsWaitingForInput;
    setErrorRef.current = setError;
  }, [setIsWaitingForInput, setError]);

  // ✅ STABLE: Restore state from ref on mount (handles remount)
  React.useEffect(() => {
    // ✅ On mount/remount, restore state from ref
    if (stateRef.current.isWaitingForInput !== isWaitingForInput) {
      setIsWaitingForInputState(stateRef.current.isWaitingForInput);
    }
    if (stateRef.current.error !== error) {
      setErrorState(stateRef.current.error);
    }
  }, []); // ✅ Empty deps - only run on mount

  // ✅ ARCHITECTURAL: Memoize engine options with stable callbacks
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
    onTaskExecute: async (task) => {
      return { success: true };
    },
    translations: translations || {},
    onMessage: (message) => {
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('[useFlowModeChat] 🔵 onMessage callback called');
      console.log('[useFlowModeChat] 🔵 Message received:', {
        id: message.id,
        text: message.text?.substring(0, 50),
        stepType: message.stepType,
        timestamp: message.id,
        taskId: message.taskId
      });
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

      // ✅ Use ref for stable access
      const currentOnMessage = onMessageRef.current;
      console.log('[useFlowModeChat] 🔵 onMessage prop exists?', !!currentOnMessage);
      if (currentOnMessage) {
        console.log('[useFlowModeChat] 🔵 Calling onMessage prop...');
        currentOnMessage(newMessage);
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
      console.log('[useFlowModeChat] ⚠️ onComplete called - resetting isWaitingForInput');
      // ✅ Use ref for stable setter
      if (setIsWaitingForInputRef.current) {
        setIsWaitingForInputRef.current(false);
      }
    },
    onError: (error) => {
      console.error('[useFlowModeChat] Flow error', error);
      // ✅ Use ref for stable setter
      if (setErrorRef.current) {
        setErrorRef.current(error.message || 'Flow execution error');
      }
      if (setIsWaitingForInputRef.current) {
        setIsWaitingForInputRef.current(false);
      }
    },
    onWaitingForInput: (data?: { taskId: string; nodeId?: string }) => {
      console.log('[useFlowModeChat] ⏳ onWaitingForInput called - setting isWaitingForInput to true', {
        taskId: data?.taskId,
        nodeId: data?.nodeId,
        hasData: !!data,
        fullData: data,
        currentRefValue: stateRef.current.isWaitingForInput,
      });

      // ✅ CRITICAL: Use ref for stable setter (survives remount)
      if (setIsWaitingForInputRef.current) {
        setIsWaitingForInputRef.current(prev => {
          console.log('[useFlowModeChat] 🔍 setIsWaitingForInput called', {
            prev,
            settingTo: true,
            refValueBefore: stateRef.current.isWaitingForInput,
          });
          return true;
        });
      } else {
        console.error('[useFlowModeChat] ❌ setIsWaitingForInputRef.current is null!');
      }
    },
  }), [nodes, edges, tasks, translations]); // ✅ No callbacks in deps - use refs

  // ✅ ARCHITECTURAL: Call hook at top level (not inside useMemo)
  // This respects React's Rules of Hooks
  const flowEngine = useDialogueEngine(engineOptions);

  // ✅ ARCHITECTURAL: Start when data is ready
  const translationsKey = React.useMemo(() => {
    if (!translations) return '';
    return Object.keys(translations).sort().join(',');
  }, [translations]);

  React.useEffect(() => {
    // ✅ Create stable key based on node IDs to detect actual flow changes
    const nodesKey = nodes.map(n => n.id).sort().join(',');

    // ✅ Reset guard when nodes actually change
    if (nodesKey !== previousNodesKeyRef.current) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = nodesKey;
    }

    if (hasStartedRef.current && nodes.length === 0) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = '';
    }

    if (hasStartedRef.current) {
      return; // Already started
    }

    if (nodes.length === 0) {
      console.error('[useFlowModeChat] ❌ Cannot start: no nodes found');
      if (setErrorRef.current) {
        setErrorRef.current('Cannot start flow: no nodes found');
      }
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
      if (setErrorRef.current) {
        setErrorRef.current(error.message || 'Failed to start flow orchestrator');
      }
      hasStartedRef.current = false; // Allow retry on error
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, translationsKey, flowEngine]);

  // ✅ Handle user input in flow mode
  const handleUserInput = React.useCallback(async (input: string) => {
    if (!flowEngine) return;

    try {
      await flowEngine.provideInput(input);
    } catch (error) {
      console.error('[useFlowModeChat] Error providing input to flow engine', error);
      if (setErrorRef.current) {
        setErrorRef.current(error instanceof Error ? error.message : 'Error providing input');
      }
    }
  }, [flowEngine]);

  // ✅ Clear state when needed
  const clearMessages = React.useCallback(() => {
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    if (setIsWaitingForInputRef.current) {
      setIsWaitingForInputRef.current(false);
    }
    if (setErrorRef.current) {
      setErrorRef.current(null);
    }
  }, []);

  return {
    isWaitingForInput,
    error,
    handleUserInput,
    clearMessages,
  };
}
