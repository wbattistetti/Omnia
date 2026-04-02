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
  onMessage?: (message: Message) => void,
  executionFlowName?: string
) {
  const isGuidLike = React.useCallback((value: unknown): boolean => {
    const text = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-[a-z0-9_-]+)?$/i.test(text);
  }, []);

  const toReadableLabel = React.useCallback((value: unknown): string => {
    const text = String(value || '').trim();
    if (!text || isGuidLike(text)) {
      return '';
    }
    return text;
  }, [isGuidLike]);

  // ✅ CRITICAL: Store onMessage in ref for stable access
  const onMessageRef = React.useRef(onMessage);
  React.useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const messageIdCounter = React.useRef(0);
  const sentMessageIds = React.useRef<Set<string>>(new Set());
  const hasStartedRef = React.useRef(false);
  const startInFlightRef = React.useRef<Promise<void> | null>(null);
  const previousNodesKeyRef = React.useRef<string>('');
  // Ref-based flag: blocks auto-start useEffect while restart protocol is in flight.
  // Using a ref (not state) ensures the useEffect guard is synchronously visible
  // without triggering an extra render cycle.
  const isRestartingRef = React.useRef(false);

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
  const [isRestarting, setIsRestarting] = React.useState(false);
  const [currentExecutionLabel, setCurrentExecutionLabel] = React.useState<string>('');
  const [currentExecutionType, setCurrentExecutionType] = React.useState<'flow' | 'rowTask' | 'node'>('flow');
  const resolveTaskLabel = React.useCallback((taskId?: string) => {
    if (!taskId) return '';
    const task = tasks.find((t: any) => t?.id === taskId);
    return toReadableLabel(task?.label || task?.title);
  }, [tasks, toReadableLabel]);

  const resolveNodeLabel = React.useCallback((nodeId?: string) => {
    if (!nodeId) return '';
    const node = nodes.find((n: any) => n?.id === nodeId);
    return toReadableLabel(node?.data?.label || node?.label || node?.title);
  }, [nodes, toReadableLabel]);


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
  }, []);

  const setError = React.useCallback((value: string | null) => {
    // ✅ Update ref first (survives remount)
    stateRef.current.error = value;

    // ✅ Update state (triggers re-render)
    setErrorState(value);
  }, []);

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
      const messageId = `msg_${messageIdCounter.current++}`;

      // Avoid duplicates
      if (sentMessageIds.current.has(messageId)) {
        return;
      }
      sentMessageIds.current.add(messageId);

      const newMessage: Message = {
        id: messageId,
        text: message.text || '',
        type: 'bot',
        timestamp: new Date(),
      };

      // ✅ Use ref for stable access
      const currentOnMessage = onMessageRef.current;
      if (currentOnMessage) {
        currentOnMessage(newMessage);
      } else {
        console.warn('[useFlowModeChat] ⚠️ onMessage prop not provided!');
      }
    },
    onDDTStart: () => {
      // DDT started - no log needed
    },
    onDDTComplete: () => {
      // DDT completed - no log needed
    },
    onComplete: () => {
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
    onWaitingForInput: (data?: { taskId: string; nodeId?: string; taskLabel?: string; nodeLabel?: string }) => {
      // ✅ CRITICAL: Use ref for stable setter (survives remount)
      if (setIsWaitingForInputRef.current) {
        setIsWaitingForInputRef.current(true);
      } else {
        console.error('[useFlowModeChat] ❌ setIsWaitingForInputRef.current is null!');
      }

      const flowName = (executionFlowName || 'MAIN').trim() || 'MAIN';
      const taskLabel = toReadableLabel(data?.taskLabel) || resolveTaskLabel(data?.taskId);
      const nodeLabel = toReadableLabel(data?.nodeLabel) || resolveNodeLabel(data?.nodeId);
      if (taskLabel) {
        setCurrentExecutionType('rowTask');
        setCurrentExecutionLabel(`${flowName}: ${taskLabel}`);
      } else if (nodeLabel) {
        setCurrentExecutionType('node');
        setCurrentExecutionLabel(`${flowName}: Nodo(${nodeLabel})`);
      } else {
        // Keep previous launch/runtime label instead of replacing it with generic flow text.
      }
    },
  }), [nodes, edges, tasks, translations, executionFlowName, resolveTaskLabel, resolveNodeLabel, toReadableLabel]); // ✅ No callbacks in deps - use refs

  // ✅ ARCHITECTURAL: Call hook at top level (not inside useMemo)
  // This respects React's Rules of Hooks
  const flowEngine = useDialogueEngine(engineOptions);
  const flowEngineRef = React.useRef(flowEngine);
  React.useEffect(() => {
    flowEngineRef.current = flowEngine;
  }, [flowEngine]);

  const executeStart = React.useCallback(async () => {
    const engine = flowEngineRef.current;
    if (!engine || typeof engine.start !== 'function') {
      throw new Error('Flow engine is not available.');
    }
    if (hasStartedRef.current) {
      return;
    }
    if (startInFlightRef.current) {
      await startInFlightRef.current;
      return;
    }

    const startPromise = (async () => {
      hasStartedRef.current = true;
      try {
        await engine.start();
      } catch (error) {
        hasStartedRef.current = false;
        throw error;
      } finally {
        startInFlightRef.current = null;
      }
    })();

    startInFlightRef.current = startPromise;
    await startPromise;
  }, []);

  // ✅ ARCHITECTURAL: Start when data is ready
  const translationsKey = React.useMemo(() => {
    if (!translations) return '';
    return Object.keys(translations).sort().join(',');
  }, [translations]);

  React.useEffect(() => {
    // Block auto-start while restart protocol is in flight to prevent concurrent sessions.
    if (isRestartingRef.current) {
      return;
    }

    // Create stable key based on node IDs to detect actual flow changes.
    const nodesKey = nodes.map(n => n.id).sort().join(',');

    // Reset guard when nodes actually change.
    if (nodesKey !== previousNodesKeyRef.current) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = nodesKey;
    }

    if (hasStartedRef.current && nodes.length === 0) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = '';
    }

    if (hasStartedRef.current) {
      return;
    }

    if (nodes.length === 0) {
      if (setErrorRef.current) {
        setErrorRef.current('Cannot start flow: no nodes found');
      }
      return;
    }

    if (!translations || Object.keys(translations).length === 0) {
      return;
    }

    if (!flowEngine || typeof flowEngine.start !== 'function') {
      return;
    }

    void executeStart().catch((error) => {
      if (setErrorRef.current) {
        setErrorRef.current(error.message || 'Failed to start flow orchestrator');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, translationsKey, flowEngine, executeStart]);

  // ✅ Handle user input in flow mode
  const handleUserInput = React.useCallback(async (input: string) => {
    const engine = flowEngineRef.current;
    if (!engine) return;

    try {
      await engine.provideInput(input);
    } catch (error) {
      console.error('[useFlowModeChat] Error providing input to flow engine', error);
      if (setErrorRef.current) {
        setErrorRef.current(error instanceof Error ? error.message : 'Error providing input');
      }
    }
  }, []);

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

  const restartFlow = React.useCallback(async () => {
    // Guard against concurrent restarts via both ref (sync) and state (UI).
    if (isRestartingRef.current) {
      return;
    }

    try {
      const { clearCompilationErrorsGlobal } = await import('@context/CompilationErrorsContext');
      clearCompilationErrorsGlobal();
    } catch {
      /* noop */
    }

    // Step 1: Raise the restart flag SYNCHRONOUSLY so useEffect auto-start
    // is blocked for the entire duration of this protocol.
    isRestartingRef.current = true;
    setIsRestarting(true);

    // Step 2: Clear in-flight start promise so executeStart can run fresh.
    startInFlightRef.current = null;
    hasStartedRef.current = false;

    // Step 3: Reset local chat state.
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    setCurrentExecutionLabel('');
    setCurrentExecutionType('flow');
    if (setIsWaitingForInputRef.current) {
      setIsWaitingForInputRef.current(false);
    }
    if (setErrorRef.current) {
      setErrorRef.current(null);
    }

    try {
      // Step 4: Stop existing engine session (closes SSE, deletes backend session).
      // Must complete before starting a new one to avoid two live SSE streams.
      const engine = flowEngineRef.current;
      if (engine && typeof engine.reset === 'function') {
        await engine.reset();
      }

      // Step 5: Start new session now that the old one is fully gone.
      await executeStart();
    } catch (error) {
      hasStartedRef.current = false;
      if (setErrorRef.current) {
        setErrorRef.current(error instanceof Error ? error.message : 'Failed to restart flow execution');
      }
    } finally {
      // Step 6: Lower the restart flag so auto-start useEffect can fire normally again.
      isRestartingRef.current = false;
      setIsRestarting(false);
    }
  }, [executeStart]);

  return {
    isWaitingForInput,
    error,
    currentExecutionLabel,
    currentExecutionType,
    isRestarting,
    handleUserInput,
    clearMessages,
    restartFlow,
  };
}
