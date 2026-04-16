import React from 'react';
import { useDialogueEngine } from '@components/DialogueEngine/useDialogueEngine';
import type { ExecutionState } from '@components/FlowCompiler/types';
import { looksLikeTechnicalTranslationOrId } from '@utils/translationKeys';
import type { Message } from '@components/ChatSimulator/UserMessage';
import { FlowHighlighter } from '../../../../../features/debugger/FlowHighlighter';
import { buildDebuggerStepFromTurn } from '../../../../../features/debugger/core/buildDebuggerStepFromTurn';
import { extractNluFromVariableStore } from '../../../../../features/debugger/core/extractNluFromVariableStore';
import type { DebuggerStep } from '../../../../../features/debugger/core/DebuggerStep';
import {
  clearDebuggerConversation,
  loadDebuggerConversation,
  saveDebuggerConversation,
} from '../../../../../features/debugger/persistence/debuggerConversationPersistence';

const DBG = '[DebuggerFlow]';

/** Map compiled task ids to React Flow node ids (rows on canvas). */
function buildTaskIdToNodeIdMap(nodes: any[], tasks: any[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of nodes || []) {
    const rows = (n?.data as { rows?: Array<{ taskId?: string; id?: string }> })?.rows ?? [];
    for (const row of rows) {
      const tid = String(row?.taskId || row?.id || '').trim();
      if (tid) m.set(tid, String(n.id));
    }
  }
  for (const t of tasks || []) {
    const tid = String(t?.id || '').trim();
    const nodeId = t?.nodeId != null ? String(t.nodeId).trim() : '';
    if (tid && nodeId) m.set(tid, nodeId);
  }
  return m;
}

/** Optional debugger lifecycle hooks + auto-start (default: manual Play only). */
export type UseFlowModeChatOptions = {
  /** When true: auto-start when nodes/translations/engine are ready (legacy). */
  autoStart?: boolean;
  onSessionStarted?: () => void;
  onOrchestratorWaiting?: () => void;
  onOrchestratorEnded?: () => void;
  /** Primary flow id for compile/session (subflow canvas when debugging a sub-dialog in isolation). */
  orchestratorCompileRootFlowId?: string | null;
  /** Persist debugger steps (same key as compile root when isolating a subflow). */
  projectId?: string | null;
  flowId?: string | null;
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
  /** After toolbar Clear (gomma), block auto-start until the user clicks Play. Restart clears this. */
  const suppressAutoStartAfterClearRef = React.useRef(false);

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

  const nodesRef = React.useRef(nodes);
  const tasksRef = React.useRef(tasks);
  React.useEffect(() => {
    nodesRef.current = nodes;
    tasksRef.current = tasks;
  }, [nodes, tasks]);

  const projectIdRef = React.useRef(options?.projectId ?? null);
  const flowIdRef = React.useRef(options?.flowId ?? null);
  React.useEffect(() => {
    projectIdRef.current = options?.projectId ?? null;
    flowIdRef.current = options?.flowId ?? null;
  }, [options?.projectId, options?.flowId]);

  const pendingDebuggerUtteranceRef = React.useRef<{ text: string; clientMessageId: string } | null>(null);
  const latestExecutionStateRef = React.useRef<ExecutionState | null>(null);
  const [debuggerSteps, setDebuggerSteps] = React.useState<DebuggerStep[]>([]);
  const debuggerFlushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const pid = String(options?.projectId ?? '').trim();
    const fid = String(options?.flowId ?? '').trim();
    if (!pid || !fid) return;
    const loaded = loadDebuggerConversation(pid, fid);
    if (loaded && loaded.length > 0) {
      setDebuggerSteps(loaded);
    }
  }, [options?.projectId, options?.flowId]);

  const resetDebuggerSessionArtifacts = React.useCallback(() => {
    setDebuggerSteps([]);
    pendingDebuggerUtteranceRef.current = null;
    latestExecutionStateRef.current = null;
    if (debuggerFlushTimerRef.current) {
      clearTimeout(debuggerFlushTimerRef.current);
      debuggerFlushTimerRef.current = null;
    }
    const pid = String(projectIdRef.current || '').trim();
    const fid = String(flowIdRef.current || '').trim();
    if (pid && fid) {
      clearDebuggerConversation(pid, fid);
    }
    FlowHighlighter.reset();
  }, []);

  const flushDebuggerStepFromOrchestratorState = React.useCallback(() => {
    const pending = pendingDebuggerUtteranceRef.current;
    const state = latestExecutionStateRef.current;
    if (!pending?.text || !state) return;

    const utterance = pending.text;
    const clientMessageId = pending.clientMessageId || '';

    pendingDebuggerUtteranceRef.current = null;
    if (debuggerFlushTimerRef.current) {
      clearTimeout(debuggerFlushTimerRef.current);
      debuggerFlushTimerRef.current = null;
    }

    const taskToNode = buildTaskIdToNodeIdMap(nodesRef.current, tasksRef.current);
    const activeNodeId = state.currentNodeId || '';
    const st = state as unknown as { executedTaskIds?: string[] | Set<string> };
    const executed =
      st.executedTaskIds instanceof Set
        ? Array.from(st.executedTaskIds)
        : Array.isArray(st.executedTaskIds)
          ? st.executedTaskIds
          : [];
    const passedNodeIdsSet = new Set<string>();
    for (const tid of executed) {
      const nid = taskToNode.get(String(tid));
      if (nid) passedNodeIdsSet.add(nid);
    }
    const priorPassedNodeIds = [...passedNodeIdsSet].filter((id) => id !== activeNodeId);

    const slotLabel =
      resolveNodeLabel(activeNodeId).trim() ||
      (activeNodeId ? String(activeNodeId) : '');

    const store = (state.variableStore || {}) as Record<string, unknown>;
    const nlu = extractNluFromVariableStore(store, utterance);

    const step = buildDebuggerStepFromTurn({
      utterance,
      semanticValue: nlu.semantic,
      linguisticValue: nlu.linguistic,
      grammarType: 'orchestrator',
      grammarContract: 'GrammarFlow',
      elapsedMs: 0,
      slotLabel: slotLabel || undefined,
      activeNodeId,
      priorPassedNodeIds,
      noMatchNodeIds: [],
      activeEdgeId: '',
      clientMessageId: clientMessageId || undefined,
    });

    FlowHighlighter.apply(step);
    setDebuggerSteps((prev) => {
      const next = [...prev, step];
      const pid = String(projectIdRef.current || '').trim();
      const fid = String(flowIdRef.current || '').trim();
      if (pid && fid) {
        saveDebuggerConversation(pid, fid, next);
      }
      return next;
    });
  }, [resolveNodeLabel]);

  const scheduleDebuggerStepFlush = React.useCallback(() => {
    if (debuggerFlushTimerRef.current) clearTimeout(debuggerFlushTimerRef.current);
    debuggerFlushTimerRef.current = setTimeout(() => {
      debuggerFlushTimerRef.current = null;
      flushDebuggerStepFromOrchestratorState();
    }, 120);
  }, [flushDebuggerStepFromOrchestratorState]);

  /** Se il VariableStore si popola dopo il flush, aggiorna semantic/linguistic sull’ultimo step. */
  const patchLastDebuggerStepWithNlu = React.useCallback((state: ExecutionState) => {
    setDebuggerSteps((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const store = (state.variableStore || {}) as Record<string, unknown>;
      const nlu = extractNluFromVariableStore(store, last.utterance);
      if (last.semanticValue === nlu.semantic && last.linguisticValue === nlu.linguistic) return prev;
      if (!nlu.semantic && !nlu.linguistic) return prev;
      const patched: DebuggerStep = {
        ...last,
        semanticValue: nlu.semantic || last.semanticValue,
        linguisticValue: nlu.linguistic || last.linguisticValue,
      };
      const next = [...prev.slice(0, -1), patched];
      const pid = String(projectIdRef.current || '').trim();
      const fid = String(flowIdRef.current || '').trim();
      if (pid && fid) {
        saveDebuggerConversation(pid, fid, next);
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    return () => {
      if (debuggerFlushTimerRef.current) clearTimeout(debuggerFlushTimerRef.current);
    };
  }, []);

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
      onMessage: (message: {
        text?: string;
        textKey?: string;
        stepType?: string;
        taskId?: string;
        id?: string;
      }) => {
        const messageId =
          message.id != null && String(message.id) !== ''
            ? String(message.id)
            : `msg_${messageIdCounter.current++}`;
        if (sentMessageIds.current.has(messageId)) return;
        sentMessageIds.current.add(messageId);
        const newMessage: Message = {
          id: messageId,
          text: message.text || '',
          type: 'bot',
          textKey: message.textKey,
          stepType: message.stepType,
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
      orchestratorCompileRootFlowId: options?.orchestratorCompileRootFlowId ?? null,
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
      onExecutionStateUpdate: (state: ExecutionState) => {
        latestExecutionStateRef.current = state;
        if (pendingDebuggerUtteranceRef.current) {
          scheduleDebuggerStepFlush();
        }
        patchLastDebuggerStepWithNlu(state);
      },
    }),
    [
      nodes,
      edges,
      tasks,
      translations,
      executionFlowName,
      resolveTaskLabel,
      resolveNodeLabel,
      toReadableLabel,
      options?.orchestratorCompileRootFlowId,
      scheduleDebuggerStepFlush,
      patchLastDebuggerStepWithNlu,
    ]
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
    if (suppressAutoStartAfterClearRef.current) return;

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

  const waitUntilWaitingForInput = React.useCallback(async (timeoutMs: number): Promise<void> => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (stateRef.current.isWaitingForInput) return;
      await new Promise<void>((r) => setTimeout(r, 70));
    }
    throw new Error('Timeout waiting for orchestrator to accept input.');
  }, []);

  const handleUserInput = React.useCallback(
    async (input: string, clientMessageId: string) => {
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
        pendingDebuggerUtteranceRef.current = {
          text: String(input || '').trim(),
          clientMessageId: String(clientMessageId || ''),
        };
        await engine.provideInput(input);
        console.info(`${DBG} provideInput OK`, { sessionId: sid });
      } catch (err) {
        pendingDebuggerUtteranceRef.current = null;
        if (debuggerFlushTimerRef.current) {
          clearTimeout(debuggerFlushTimerRef.current);
          debuggerFlushTimerRef.current = null;
        }
        console.error(`${DBG} provideInput error`, err);
        if (setErrorRef.current) {
          setErrorRef.current(err instanceof Error ? err.message : 'Error providing input');
        }
      }
    },
    [getOrchestratorSessionId]
  );

  const replayUserInputs = React.useCallback(
    async (
      turns: readonly { text: string; clientMessageId: string }[],
      onUserTurnAppended?: (t: { text: string; clientMessageId: string }) => void
    ) => {
      const engine = flowEngineRef.current as { provideInput: (s: string) => Promise<void>; reset: () => Promise<void> } | null;
      if (!engine?.provideInput || !engine?.reset) {
        throw new Error('Flow engine is not available for replay.');
      }
      if (turns.length === 0) return;

      sentMessageIds.current.clear();
      setDebuggerSteps([]);
      pendingDebuggerUtteranceRef.current = null;
      if (debuggerFlushTimerRef.current) {
        clearTimeout(debuggerFlushTimerRef.current);
        debuggerFlushTimerRef.current = null;
      }
      const pid = String(projectIdRef.current || '').trim();
      const fid = String(flowIdRef.current || '').trim();
      if (pid && fid) {
        clearDebuggerConversation(pid, fid);
      }
      FlowHighlighter.reset();

      await engine.reset();
      hasStartedRef.current = false;
      startInFlightRef.current = null;
      await executeStart();

      for (let i = 0; i < turns.length; i++) {
        const t = turns[i];
        onUserTurnAppended?.(t);
        pendingDebuggerUtteranceRef.current = {
          text: String(t.text || '').trim(),
          clientMessageId: String(t.clientMessageId || ''),
        };
        await engine.provideInput(t.text);
        if (i < turns.length - 1) {
          try {
            await waitUntilWaitingForInput(25000);
          } catch {
            /* ultimo turno o flusso terminato prima del prossimo input */
          }
        }
      }
    },
    [executeStart, waitUntilWaitingForInput]
  );

  const clearMessages = React.useCallback(() => {
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(false);
    if (setErrorRef.current) setErrorRef.current(null);
  }, []);

  const clearSession = React.useCallback(async () => {
    console.info(`${DBG} clearSession (soft) begin`, { sessionId: getOrchestratorSessionId() });
    resetDebuggerSessionArtifacts();
    suppressAutoStartAfterClearRef.current = true;
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
  }, [getOrchestratorSessionId, resetDebuggerSessionArtifacts]);

  const restartFlow = React.useCallback(async () => {
    if (isRestartingRef.current) {
      console.info(`${DBG} restartFlow skipped (already restarting)`);
      return;
    }
    console.info(`${DBG} restartFlow (hard) begin`, { sessionId: getOrchestratorSessionId() });
    suppressAutoStartAfterClearRef.current = false;
    resetDebuggerSessionArtifacts();

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
  }, [executeStart, getOrchestratorSessionId, resetDebuggerSessionArtifacts]);

  const updateDebuggerStep = React.useCallback((id: string, patch: Partial<DebuggerStep>) => {
    setDebuggerSteps((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const pid = String(projectIdRef.current || '').trim();
      const fid = String(flowIdRef.current || '').trim();
      if (pid && fid) {
        saveDebuggerConversation(pid, fid, next);
      }
      return next;
    });
  }, []);

  const replayDebuggerHighlight = React.useCallback((step: DebuggerStep) => {
    FlowHighlighter.apply(step);
  }, []);

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
    debuggerSteps,
    updateDebuggerStep,
    replayDebuggerHighlight,
    replayUserInputs,
    waitUntilWaitingForInput,
  };
}
