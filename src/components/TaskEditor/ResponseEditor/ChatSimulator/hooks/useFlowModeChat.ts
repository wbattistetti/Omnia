import React from 'react';
import { useDialogueEngine } from '@components/DialogueEngine/useDialogueEngine';
import { looksLikeTechnicalTranslationOrId } from '@utils/translationKeys';
import type { Message } from '@components/ChatSimulator/UserMessage';

const DBG = '[DebuggerFlow]';

/** Optional debugger lifecycle hooks + auto-start (default: manual Play only). */
export type UseFlowModeChatOptions = {
  /** When true: auto-start when nodes/translations/engine are ready (legacy). */
  autoStart?: boolean;
  onSessionStarted?: () => void;
  onOrchestratorWaiting?: () => void;
  onOrchestratorEnded?: () => void;
};

/**
 * Hook dedicated to flow mode chat (orchestrator SSE + input).
 */
export function useFlowModeChat(
  nodes: any[],
  edges: any[],
  tasks: any[],
  translations: Record<string, string> | undefined,
  onMessage?: (message: Message) => void,
  executionFlowName?: string,
  options?: UseFlowModeChatOptions
) {
  const toReadableLabel = React.useCallback((value: unknown): string => {
    const text = String(value || '').trim();
    if (!text || looksLikeTechnicalTranslationOrId(text)) {
      return '';
    }
    return text;
  }, []);

  const onMessageRef = React.useRef(onMessage);
  React.useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const lifecycleRef = React.useRef({
    onSessionStarted: undefined as (() => void) | undefined,
    onOrchestratorWaiting: undefined as (() => void) | undefined,
    onOrchestratorEnded: undefined as (() => void) | undefined,
  });
  lifecycleRef.current.onSessionStarted = options?.onSessionStarted;
  lifecycleRef.current.onOrchestratorWaiting = options?.onOrchestratorWaiting;
  lifecycleRef.current.onOrchestratorEnded = options?.onOrchestratorEnded;

  const messageIdCounter = React.useRef(0);
  const sentMessageIds = React.useRef<Set<string>>(new Set());
  const hasStartedRef = React.useRef(false);
  const startInFlightRef = React.useRef<Promise<void> | null>(null);
  const previousNodesKeyRef = React.useRef<string>('');
  const isRestartingRef = React.useRef(false);

  const stateRef = React.useRef<{
    isWaitingForInput: boolean;
    error: string | null;
  }>({
    isWaitingForInput: false,
    error: null,
  });

  const [isWaitingForInput, setIsWaitingForInputState] = React.useState(false);
  const [error, setErrorState] = React.useState<string | null>(null);
  const [isRestarting, setIsRestarting] = React.useState(false);
  const [sessionActive, setSessionActive] = React.useState(false);
  const [currentExecutionLabel, setCurrentExecutionLabel] = React.useState<string>('');
  const [currentExecutionType, setCurrentExecutionType] = React.useState<'flow' | 'rowTask' | 'node'>('flow');

  const resolveTaskLabel = React.useCallback(
    (taskId?: string) => {
      if (!taskId) return '';
      const task = tasks.find((t: any) => t?.id === taskId);
      return toReadableLabel(task?.label || task?.title);
    },
    [tasks, toReadableLabel]
  );

  const resolveNodeLabel = React.useCallback(
    (nodeId?: string) => {
      if (!nodeId) return '';
      const node = nodes.find((n: any) => n?.id === nodeId);
      return toReadableLabel(node?.data?.label || node?.label || node?.title);
    },
    [nodes, toReadableLabel]
  );

  const setIsWaitingForInput = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue =
      typeof value === 'function' ? value(stateRef.current.isWaitingForInput) : value;
    stateRef.current.isWaitingForInput = newValue;
    setIsWaitingForInputState(newValue);
  }, []);

  const setError = React.useCallback((value: string | null) => {
    stateRef.current.error = value;
    setErrorState(value);
  }, []);

  const setIsWaitingForInputRef = React.useRef(setIsWaitingForInput);
  const setErrorRef = React.useRef(setError);

  React.useEffect(() => {
    setIsWaitingForInputRef.current = setIsWaitingForInput;
    setErrorRef.current = setError;
  }, [setIsWaitingForInput, setError]);

  React.useEffect(() => {
    if (stateRef.current.isWaitingForInput !== isWaitingForInput) {
      setIsWaitingForInputState(stateRef.current.isWaitingForInput);
    }
    if (stateRef.current.error !== error) {
      setErrorState(stateRef.current.error);
    }
  }, []);

  const engineOptions = React.useMemo(
    () => ({
      nodes,
      edges,
      getTask: (taskId: string) => tasks.find((t: any) => t.id === taskId) || null,
      getDDT: (taskId: string) => {
        const task = tasks.find((t: any) => t.id === taskId);
        if (!task || task.templateId !== 'GetData') return null;
        return task.data ? { label: task.label, data: task.data, steps: task.steps } : null;
      },
      onTaskExecute: async (_task: unknown) => ({ success: true }),
      translations: translations || {},
      onMessage: (message: { text?: string }) => {
        const messageId = `msg_${messageIdCounter.current++}`;
        if (sentMessageIds.current.has(messageId)) return;
        sentMessageIds.current.add(messageId);
        const newMessage: Message = {
          id: messageId,
          text: message.text || '',
          type: 'bot',
          timestamp: new Date(),
        };
        const currentOnMessage = onMessageRef.current;
        if (currentOnMessage) currentOnMessage(newMessage);
        else console.warn('[useFlowModeChat] onMessage prop not provided');
      },
      onDDTStart: () => {},
      onDDTComplete: () => {},
      onComplete: () => {
        if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(false);
        setSessionActive(false);
        console.info(`${DBG} orchestrator onComplete → session inactive`);
        lifecycleRef.current.onOrchestratorEnded?.();
      },
      onError: (err: Error) => {
        console.error(`${DBG} orchestrator onError`, err.message);
        if (setErrorRef.current) setErrorRef.current(err.message || 'Flow execution error');
        if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(false);
        setSessionActive(false);
        lifecycleRef.current.onOrchestratorEnded?.();
      },
      onWaitingForInput: (data?: {
        taskId: string;
        nodeId?: string;
        taskLabel?: string;
        nodeLabel?: string;
      }) => {
        if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(true);
        const flowName = (executionFlowName || 'MAIN').trim() || 'MAIN';
        const taskLabel = toReadableLabel(data?.taskLabel) || resolveTaskLabel(data?.taskId);
        const nodeLabel = toReadableLabel(data?.nodeLabel) || resolveNodeLabel(data?.nodeId);
        if (taskLabel) {
          setCurrentExecutionType('rowTask');
          setCurrentExecutionLabel(`${flowName}: ${taskLabel}`);
        } else if (nodeLabel) {
          setCurrentExecutionType('node');
          setCurrentExecutionLabel(`${flowName}: Nodo(${nodeLabel})`);
        }
        console.info(`${DBG} waitingForInput`, { taskId: data?.taskId, nodeId: data?.nodeId });
        lifecycleRef.current.onOrchestratorWaiting?.();
      },
    }),
    [nodes, edges, tasks, translations, executionFlowName, resolveTaskLabel, resolveNodeLabel, toReadableLabel]
  );

  const flowEngine = useDialogueEngine(engineOptions);
  const flowEngineRef = React.useRef(flowEngine);
  React.useEffect(() => {
    flowEngineRef.current = flowEngine;
  }, [flowEngine]);

  const getOrchestratorSessionId = React.useCallback((): string | null => {
    const engine = flowEngineRef.current as { getSessionId?: () => string | null } | null;
    return engine?.getSessionId?.() ?? null;
  }, []);

  const executeStart = React.useCallback(async () => {
    const engine = flowEngineRef.current;
    if (!engine || typeof engine.start !== 'function') {
      throw new Error('Flow engine is not available.');
    }
    if (hasStartedRef.current) {
      console.info(`${DBG} executeStart skipped (already started)`);
      return;
    }
    if (startInFlightRef.current) {
      await startInFlightRef.current;
      return;
    }

    const startPromise = (async () => {
      hasStartedRef.current = true;
      try {
        console.info(`${DBG} executeStart → engine.start()`);
        await engine.start();
        setSessionActive(true);
        console.info(`${DBG} executeStart OK`, { sessionId: getOrchestratorSessionId() });
        lifecycleRef.current.onSessionStarted?.();
      } catch (err) {
        hasStartedRef.current = false;
        setSessionActive(false);
        console.error(`${DBG} executeStart failed`, err);
        throw err;
      } finally {
        startInFlightRef.current = null;
      }
    })();

    startInFlightRef.current = startPromise;
    await startPromise;
  }, [getOrchestratorSessionId]);

  const startSession = React.useCallback(async () => {
    await executeStart();
  }, [executeStart]);

  const translationsKey = React.useMemo(() => {
    if (!translations) return '';
    return Object.keys(translations).sort().join(',');
  }, [translations]);

  React.useEffect(() => {
    if (options?.autoStart !== true) return;
    if (isRestartingRef.current) return;

    const nodesKey = nodes.map((n) => n.id).sort().join(',');
    if (nodesKey !== previousNodesKeyRef.current) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = nodesKey;
    }
    if (hasStartedRef.current && nodes.length === 0) {
      hasStartedRef.current = false;
      previousNodesKeyRef.current = '';
    }
    if (hasStartedRef.current) return;
    if (nodes.length === 0) {
      if (setErrorRef.current) setErrorRef.current('Cannot start flow: no nodes found');
      return;
    }
    if (!translations || Object.keys(translations).length === 0) return;
    if (!flowEngine || typeof flowEngine.start !== 'function') return;

    void executeStart().catch((err) => {
      if (setErrorRef.current) {
        setErrorRef.current(err instanceof Error ? err.message : 'Failed to start flow orchestrator');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, translationsKey, flowEngine, executeStart, options?.autoStart]);

  const handleUserInput = React.useCallback(
    async (input: string) => {
      const engine = flowEngineRef.current;
      if (!engine) {
        console.warn(`${DBG} provideInput: no engine`);
        return;
      }
      const sid = getOrchestratorSessionId();
      console.info(`${DBG} provideInput`, {
        sessionId: sid,
        inputLength: input.length,
        waitingUI: stateRef.current.isWaitingForInput,
      });
      try {
        await engine.provideInput(input);
        console.info(`${DBG} provideInput OK`, { sessionId: sid });
      } catch (err) {
        console.error(`${DBG} provideInput error`, err);
        if (setErrorRef.current) {
          setErrorRef.current(err instanceof Error ? err.message : 'Error providing input');
        }
      }
    },
    [getOrchestratorSessionId]
  );

  const clearMessages = React.useCallback(() => {
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(false);
    if (setErrorRef.current) setErrorRef.current(null);
  }, []);

  const clearSession = React.useCallback(async () => {
    console.info(`${DBG} clearSession (soft) begin`, { sessionId: getOrchestratorSessionId() });
    startInFlightRef.current = null;
    hasStartedRef.current = false;
    setSessionActive(false);
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    setCurrentExecutionLabel('');
    setCurrentExecutionType('flow');
    if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(false);
    if (setErrorRef.current) setErrorRef.current(null);
    lifecycleRef.current.onOrchestratorEnded?.();

    const engine = flowEngineRef.current;
    if (engine && typeof engine.reset === 'function') {
      await engine.reset();
    }
    console.info(`${DBG} clearSession (soft) done`);
  }, [getOrchestratorSessionId]);

  const restartFlow = React.useCallback(async () => {
    if (isRestartingRef.current) {
      console.info(`${DBG} restartFlow skipped (already restarting)`);
      return;
    }
    console.info(`${DBG} restartFlow (hard) begin`, { sessionId: getOrchestratorSessionId() });

    try {
      const { clearCompilationErrorsGlobal } = await import('@context/CompilationErrorsContext');
      clearCompilationErrorsGlobal();
    } catch {
      /* noop */
    }

    isRestartingRef.current = true;
    setIsRestarting(true);
    startInFlightRef.current = null;
    hasStartedRef.current = false;
    setSessionActive(false);
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    setCurrentExecutionLabel('');
    setCurrentExecutionType('flow');
    if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(false);
    if (setErrorRef.current) setErrorRef.current(null);

    try {
      const engine = flowEngineRef.current;
      if (engine && typeof engine.reset === 'function') {
        await engine.reset();
      }
      await executeStart();
      console.info(`${DBG} restartFlow (hard) done`, { sessionId: getOrchestratorSessionId() });
    } catch (err) {
      hasStartedRef.current = false;
      setSessionActive(false);
      console.error(`${DBG} restartFlow failed`, err);
      if (setErrorRef.current) {
        setErrorRef.current(err instanceof Error ? err.message : 'Failed to restart flow execution');
      }
    } finally {
      isRestartingRef.current = false;
      setIsRestarting(false);
    }
  }, [executeStart, getOrchestratorSessionId]);

  return {
    isWaitingForInput,
    error,
    sessionActive,
    currentExecutionLabel,
    currentExecutionType,
    isRestarting,
    handleUserInput,
    clearMessages,
    startSession,
    clearSession,
    restartFlow,
    getOrchestratorSessionId,
  };
}
