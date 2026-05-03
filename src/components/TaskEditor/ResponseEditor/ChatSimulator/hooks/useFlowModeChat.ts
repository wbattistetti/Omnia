import React from 'react';
import { useDialogueEngine } from '@components/DialogueEngine/useDialogueEngine';
import type { ExecutionState } from '@components/FlowCompiler/types';
import { looksLikeTechnicalTranslationOrId } from '@utils/translationKeys';
import type { Message } from '@components/ChatSimulator/UserMessage';
import type { CompilationError } from '@components/FlowCompiler/types';
import { FlowHighlighter } from '../../../../../features/debugger/FlowHighlighter';
import { DebuggerController } from '../../../../../features/debugger/controller/DebuggerController';
import type { DebuggerStep } from '../../../../../features/debugger/core/DebuggerStep';
import { useDebuggerSession } from '../../../../../features/debugger/useDebuggerSession';
import {
  cancelPendingDebuggerSave,
  flushPendingDebuggerSave,
  loadDebuggerConversation,
  removeDebuggerSnapshot,
  scheduleSaveDebuggerConversation,
} from '../../../../../features/debugger/persistence/debuggerConversationPersistence';
import { chatFocusDebug, describeElement } from '../utils/chatFocusDebug';
import { getFlowFocusManager } from '@features/focus';
import type { OrchestratorSseErrorPayload } from '@components/DialogueEngine/orchestratorAdapter';
import {
  isOrchestratorExecutionError,
} from '@components/DialogueEngine/orchestratorAdapter';

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
  /** Payload SSE per errore runtime startAgent / ConvAI (card dedicata in DDEBubbleChat). */
  const [startAgentRuntimeError, setStartAgentRuntimeError] =
    React.useState<OrchestratorSseErrorPayload | null>(null);
  /** Ultimo task orchestrator in attesa input (hint per scope fix ConvAI sul task corretto). */
  const [orchestratorTaskIdHint, setOrchestratorTaskIdHint] = React.useState<string | null>(null);
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
    const prev = stateRef.current.isWaitingForInput;
    const newValue = typeof value === 'function' ? value(prev) : value;
    if (newValue !== prev) {
      chatFocusDebug('flowMode:setWaiting', {
        from: prev,
        to: newValue,
        active: describeElement(document.activeElement),
      });
    }
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

  const { session, dispatchEvent, getState } = useDebuggerSession();
  const flowEngineRef = React.useRef<{
    provideInput?: (s: string) => Promise<void>;
    reset?: () => Promise<void>;
    start?: () => Promise<void>;
    getSessionId?: () => string | null;
  } | null>(null);

  const debuggerController = React.useMemo(
    () =>
      new DebuggerController({
        getState,
        dispatch: dispatchEvent,
        getNodes: () => nodesRef.current,
        getTasks: () => tasksRef.current,
        resolveNodeLabel,
        provideInput: async (text: string) => {
          const engine = flowEngineRef.current;
          if (!engine?.provideInput) {
            throw new Error('Flow engine is not available.');
          }
          await engine.provideInput(text);
        },
      }),
    [dispatchEvent, getState, resolveNodeLabel]
  );

  const persistencePid = String(options?.projectId ?? '').trim();
  const persistenceFid = String(options?.flowId ?? '').trim();

  React.useEffect(() => {
    if (!persistencePid || !persistenceFid) return;
    const saved = loadDebuggerConversation(persistencePid, persistenceFid);
    if (saved.length > 0) {
      dispatchEvent({ type: 'DebuggerStepsReplaced', steps: saved });
    }
    return () => {
      flushPendingDebuggerSave();
    };
  }, [persistencePid, persistenceFid, dispatchEvent]);

  const atomicClearDebuggerSession = React.useCallback(() => {
    cancelPendingDebuggerSave();
    const pid = String(projectIdRef.current || '').trim();
    const fid = String(flowIdRef.current || '').trim();
    if (pid && fid) {
      removeDebuggerSnapshot(pid, fid);
    }
    debuggerController.clearRuntime();
    dispatchEvent({ type: 'SessionCleared' });
  }, [debuggerController, dispatchEvent]);

  const resetDebuggerSessionArtifacts = React.useCallback(() => {
    atomicClearDebuggerSession();
    FlowHighlighter.reset();
  }, [atomicClearDebuggerSession]);

  React.useEffect(() => {
    if (!persistencePid || !persistenceFid) return;
    scheduleSaveDebuggerConversation(session.steps, persistencePid, persistenceFid);
    return () => {
      flushPendingDebuggerSave();
    };
  }, [session.steps, persistencePid, persistenceFid]);

  React.useEffect(() => {
    if (session.steps.length === 0) return;
    FlowHighlighter.apply(session.steps[session.steps.length - 1]);
  }, [session.steps]);

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
        compilationFixError?: CompilationError;
      }) => {
        const messageId =
          message.id != null && String(message.id) !== ''
            ? String(message.id)
            : `msg_${messageIdCounter.current++}`;
        if (sentMessageIds.current.has(messageId)) return;
        sentMessageIds.current.add(messageId);
        debuggerController.onBotMessage({
          messageId,
          text: message.text,
          textKey: message.textKey,
          stepType: message.stepType,
          taskId: message.taskId,
        });
        const newMessage: Message = {
          id: messageId,
          text: message.text || '',
          type: 'bot',
          textKey: message.textKey,
          stepType: message.stepType,
          compilationFixError: message.compilationFixError,
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
        debuggerController.notifyOrchestratorEnded();
        lifecycleRef.current.onOrchestratorEnded?.();
      },
      onError: (err: Error) => {
        console.error('[DebuggerFlow] orchestrator onError', err);
        const sa =
          isOrchestratorExecutionError(err) && err.payload.phase === 'startAgent' ? err.payload : null;
        if (sa) {
          setStartAgentRuntimeError(sa);
          if (setErrorRef.current) setErrorRef.current(null);
        } else {
          setStartAgentRuntimeError(null);
          if (setErrorRef.current) setErrorRef.current(err.message || 'Flow execution error');
        }
        debuggerController.notifyExecutionError(
          isOrchestratorExecutionError(err) ? err.payload.error || err.message : err.message || 'Flow execution error',
        );
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
        const tid = String(data?.taskId ?? '').trim();
        if (tid) setOrchestratorTaskIdHint(tid);
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
        debuggerController.onWaitingForInput({
          taskId: data?.taskId,
          nodeId: data?.nodeId,
        });
        lifecycleRef.current.onOrchestratorWaiting?.();
      },
      onExecutionStateUpdate: (state: ExecutionState) => {
        debuggerController.onExecutionStateUpdate(state);
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
      debuggerController,
      setStartAgentRuntimeError,
      setOrchestratorTaskIdHint,
    ]
  );

  const flowEngine = useDialogueEngine(engineOptions);
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
      return;
    }
    if (startInFlightRef.current) {
      await startInFlightRef.current;
      return;
    }

    const startPromise = (async () => {
      hasStartedRef.current = true;
      try {
        setOrchestratorTaskIdHint(null);
        await engine.start();
        setSessionActive(true);
        debuggerController.notifySessionStarted(
          (flowEngineRef.current as { getSessionId?: () => string | null } | null)?.getSessionId?.() ?? null
        );
        lifecycleRef.current.onSessionStarted?.();
      } catch (err) {
        hasStartedRef.current = false;
        setSessionActive(false);
        console.error('[DebuggerFlow] executeStart failed', err);
        throw err;
      } finally {
        startInFlightRef.current = null;
      }
    })();

    startInFlightRef.current = startPromise;
    await startPromise;
  }, [getOrchestratorSessionId, debuggerController]);

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
      if (!flowEngineRef.current) {
        console.warn('[DebuggerFlow] provideInput: no engine');
        return;
      }
      const sid = getOrchestratorSessionId();
      try {
        await debuggerController.onUserInput(String(input || '').trim(), String(clientMessageId || ''));
      } catch (err) {
        console.error('[DebuggerFlow] provideInput error', err);
        if (setErrorRef.current) {
          setErrorRef.current(err instanceof Error ? err.message : 'Error providing input');
        }
      }
    },
    [getOrchestratorSessionId, debuggerController]
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
      resetDebuggerSessionArtifacts();

      getFlowFocusManager().setReplayActive(true);
      try {
        await engine.reset();
        hasStartedRef.current = false;
        startInFlightRef.current = null;
        await executeStart();

        debuggerController.onReplayStart('backend', turns.length);

        for (let i = 0; i < turns.length; i++) {
          const t = turns[i];
          onUserTurnAppended?.(t);
          await debuggerController.runReplayTurn(String(t.text || '').trim(), String(t.clientMessageId || ''));
          if (i < turns.length - 1) {
            try {
              await waitUntilWaitingForInput(25000);
            } catch {
              /* ultimo turno o flusso terminato prima del prossimo input */
            }
          }
        }
        debuggerController.onReplayStop();
      } finally {
        getFlowFocusManager().setReplayActive(false);
      }
    },
    [executeStart, waitUntilWaitingForInput, debuggerController, resetDebuggerSessionArtifacts]
  );

  const clearMessages = React.useCallback(() => {
    messageIdCounter.current = 0;
    sentMessageIds.current.clear();
    if (setIsWaitingForInputRef.current) setIsWaitingForInputRef.current(false);
    if (setErrorRef.current) setErrorRef.current(null);
    setStartAgentRuntimeError(null);
    setOrchestratorTaskIdHint(null);
  }, []);

  const clearSession = React.useCallback(async () => {
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
    setStartAgentRuntimeError(null);
    setOrchestratorTaskIdHint(null);
    lifecycleRef.current.onOrchestratorEnded?.();

    const engine = flowEngineRef.current;
    if (engine && typeof engine.reset === 'function') {
      await engine.reset();
    }
  }, [getOrchestratorSessionId, resetDebuggerSessionArtifacts]);

  const restartFlow = React.useCallback(async () => {
    if (isRestartingRef.current) {
      return;
    }
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
    setStartAgentRuntimeError(null);
    setOrchestratorTaskIdHint(null);

    try {
      const engine = flowEngineRef.current;
      if (engine && typeof engine.reset === 'function') {
        await engine.reset();
      }
      await executeStart();
    } catch (err) {
      hasStartedRef.current = false;
      setSessionActive(false);
      console.error('[DebuggerFlow] restartFlow failed', err);
      if (setErrorRef.current) {
        setErrorRef.current(err instanceof Error ? err.message : 'Failed to restart flow execution');
      }
    } finally {
      isRestartingRef.current = false;
      setIsRestarting(false);
    }
  }, [executeStart, getOrchestratorSessionId, resetDebuggerSessionArtifacts]);

  const updateDebuggerStep = React.useCallback(
    (id: string, patch: Partial<DebuggerStep>) => {
      dispatchEvent({ type: 'DebuggerStepPatched', stepId: id, patch });
    },
    [dispatchEvent]
  );

  const debuggerSteps = React.useMemo(() => [...session.steps], [session.steps]);

  const replayDebuggerHighlight = React.useCallback((step: DebuggerStep) => {
    FlowHighlighter.apply(step);
  }, []);

  return {
    isWaitingForInput,
    error,
    startAgentRuntimeError,
    orchestratorTaskIdHint,
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
