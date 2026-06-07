import React from 'react';
import type { Task } from '@types/taskTypes';
import type { Message } from '@components/ChatSimulator/UserMessage';
import {
  isOrchestratorExecutionError,
  normalizeOrchestratorSseErrorPayload,
  type OrchestratorSseErrorPayload,
} from '@components/DialogueEngine/orchestratorAdapter';
import { compileSingleAiAgentTask } from '@domain/compiledTaskRunner/compileSingleAiAgentTask';
import { buildKbDialogAgentTaskSnapshotForRuntime } from '@domain/compiledTaskRunner/buildKbDialogAgentTaskSnapshot';
import { prepareKbDialogCompiledTaskTestSession } from '@domain/compiledTaskRunner/prepareKbDialogCompiledTaskTestSession';
import {
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
} from '@domain/convai/agentConvaiDeployMode';
import { fetchInvocationsForAgentTaskTurnWithRetry } from '@domain/convaiObservability/fetchInvocationsForAgentTaskTurn';

const VB_BASE_URL = 'http://localhost:5000';

export type UseCompiledTaskChatOptions = {
  autoStart?: boolean;
  onMessage?: (message: Message) => void;
  executionLaunchLabel?: string;
  /** Log slot-filling omnia_dialog_step sotto bolla bot (Test agente KB). */
  convaiRuntimeLogEnabled?: boolean;
};

function parseJsonResponse<T>(text: string, label: string): T {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      `${label}: risposta vuota dal backend VB (:5000). Verifica che ApiServer sia avviato e ricompilato.`
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`${label}: JSON non valido (${trimmed.slice(0, 160)})`);
  }
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Chat simulator per un singolo CompiledTask (TaskExecutor VB, senza FlowOrchestrator).
 */
export function useCompiledTaskChat(
  task: Task | null,
  projectId: string | null,
  options?: UseCompiledTaskChatOptions
) {
  const onMessageRef = React.useRef(options?.onMessage);
  React.useEffect(() => {
    onMessageRef.current = options?.onMessage;
  }, [options?.onMessage]);

  const [isWaitingForInput, setIsWaitingForInput] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [startAgentRuntimeError, setStartAgentRuntimeError] =
    React.useState<OrchestratorSseErrorPayload | null>(null);
  const [sessionActive, setSessionActive] = React.useState(false);
  const [isRestarting, setIsRestarting] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);

  const sessionIdRef = React.useRef<string | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const startInFlightRef = React.useRef<Promise<void> | null>(null);
  const hasStartedRef = React.useRef(false);
  const messageIdCounter = React.useRef(0);
  const convaiRuntimeFetchSinceRef = React.useRef<string>(new Date().toISOString());
  const convaiRuntimeLogEnabledRef = React.useRef(options?.convaiRuntimeLogEnabled === true);
  const kbDialogNativeOrchestrationRef = React.useRef(
    task
      ? isKbDeterministicDeployMode(normalizeAgentConvaiDeployMode(task.agentConvaiDeployMode))
      : false
  );

  React.useEffect(() => {
    convaiRuntimeLogEnabledRef.current = options?.convaiRuntimeLogEnabled === true;
    kbDialogNativeOrchestrationRef.current = task
      ? isKbDeterministicDeployMode(normalizeAgentConvaiDeployMode(task.agentConvaiDeployMode))
      : false;
  }, [options?.convaiRuntimeLogEnabled, task]);

  const reportStartError = React.useCallback((err: unknown) => {
    setError(toErrorMessage(err));
  }, []);

  const generateMessageId = React.useCallback((prefix: string) => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  }, []);

  const closeEventSource = React.useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const deleteSession = React.useCallback(async (sessionId: string | null) => {
    if (!sessionId) return;
    try {
      await fetch(`${VB_BASE_URL}/api/runtime/compiled-task/session/${sessionId}`, {
        method: 'DELETE',
      });
    } catch {
      /* best effort */
    }
  }, []);

  const appendBotMessage = React.useCallback(
    async (text: string, taskId?: string) => {
      const trimmed = String(text ?? '').trim();
      if (!trimmed) return;

      let convaiRuntimeInvocations: Message['convaiRuntimeInvocations'];
      if (
        convaiRuntimeLogEnabledRef.current &&
        !kbDialogNativeOrchestrationRef.current
      ) {
        const pid = String(projectId ?? '').trim();
        const agentTaskId = String(taskId ?? task?.id ?? '').trim();
        if (pid && agentTaskId) {
          try {
            const items = await fetchInvocationsForAgentTaskTurnWithRetry({
              projectId: pid,
              agentTaskId,
              since: convaiRuntimeFetchSinceRef.current,
              kind: 'omnia_dialog_step',
            });
            convaiRuntimeFetchSinceRef.current = new Date().toISOString();
            if (items.length > 0) convaiRuntimeInvocations = items;
          } catch (fetchErr) {
            console.warn('[useCompiledTaskChat] ConvAI runtime log fetch skipped', fetchErr);
          }
        }
      }

      const msg: Message = {
        id: generateMessageId('bot'),
        type: 'bot',
        text: trimmed,
        matchStatus: 'match',
        ...(taskId ? { sourceTaskId: taskId } : {}),
        ...(convaiRuntimeInvocations ? { convaiRuntimeInvocations } : {}),
      };
      onMessageRef.current?.(msg);
    },
    [generateMessageId, projectId, task?.id]
  );

  const connectStream = React.useCallback(
    (sessionId: string) => {
      closeEventSource();
      const eventSource = new EventSource(
        `${VB_BASE_URL}/api/runtime/compiled-task/session/${sessionId}/stream`
      );
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('message', (e: MessageEvent) => {
        void (async () => {
          try {
            const msg = JSON.parse(e.data) as { text?: string; taskId?: string };
            await appendBotMessage(msg.text ?? '', msg.taskId);
          } catch {
            /* ignore malformed */
          }
        })();
      });

      eventSource.addEventListener('waitingForInput', () => {
        setIsWaitingForInput(true);
      });

      eventSource.addEventListener('complete', () => {
        setIsWaitingForInput(false);
        setSessionActive(false);
      });

      eventSource.addEventListener('error', (e: Event) => {
        const messageEvent = e as MessageEvent;
        if (messageEvent.data) {
          try {
            const payload = normalizeOrchestratorSseErrorPayload(JSON.parse(messageEvent.data));
            if (isOrchestratorExecutionError(payload)) {
              setStartAgentRuntimeError(payload);
            }
            setError(payload.error || 'Errore runtime task.');
          } catch {
            setError('Errore runtime task.');
          }
        }
        setIsWaitingForInput(false);
        setSessionActive(false);
      });

      eventSource.onopen = () => {
        setSessionActive(true);
      };
    },
    [appendBotMessage, closeEventSource]
  );

  const startSession = React.useCallback(async () => {
    const tid = String(task?.id ?? '').trim();
    const pid = String(projectId ?? '').trim();
    if (!tid || !pid || !task) {
      throw new Error('Task e projectId obbligatori per avviare la sessione.');
    }

    setError(null);
    setStartAgentRuntimeError(null);
    setIsWaitingForInput(false);
    convaiRuntimeFetchSinceRef.current = new Date().toISOString();

    let { compiledTask, locale } = await compileSingleAiAgentTask(task, pid);
    const prepared = await prepareKbDialogCompiledTaskTestSession({
      task,
      projectId: pid,
      compiledTask,
    });
    compiledTask = prepared.compiledTask;

    const agentTaskSnapshot = buildKbDialogAgentTaskSnapshotForRuntime(task);

    const startResponse = await fetch(`${VB_BASE_URL}/api/runtime/compiled-task/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: pid,
        locale,
        compiledTask,
        ...(agentTaskSnapshot ? { agentTaskSnapshot } : {}),
      }),
    });

    const startText = await startResponse.text();
    if (!startResponse.ok) {
      throw new Error(startText || startResponse.statusText);
    }

    const startData = parseJsonResponse<{ sessionId?: string }>(
      startText,
      'compiled-task/session/start'
    );
    const sessionId = String(startData.sessionId ?? '').trim();
    if (!sessionId) {
      throw new Error('sessionId mancante nella risposta di session/start.');
    }

    await deleteSession(sessionIdRef.current);
    sessionIdRef.current = sessionId;
    connectStream(sessionId);
  }, [task, projectId, connectStream, deleteSession]);

  const ensureStarted = React.useCallback(async () => {
    if (startInFlightRef.current) {
      await startInFlightRef.current;
      return;
    }

    setIsStarting(true);
    const run = startSession()
      .then(() => {
        hasStartedRef.current = true;
      })
      .catch((err: unknown) => {
        hasStartedRef.current = false;
        sessionIdRef.current = null;
        closeEventSource();
        throw err;
      })
      .finally(() => {
        setIsStarting(false);
      });

    startInFlightRef.current = run;
    try {
      await run;
    } finally {
      startInFlightRef.current = null;
    }
  }, [startSession, closeEventSource]);

  React.useEffect(() => {
    if (options?.autoStart !== true) return;
    if (!task?.id) return;
    if (!projectId) {
      setError('projectId mancante: impossibile avviare il test agente.');
      return;
    }
    if (hasStartedRef.current) return;
    void ensureStarted().catch(reportStartError);
  }, [task?.id, projectId, options?.autoStart, ensureStarted, reportStartError]);

  React.useEffect(() => {
    return () => {
      closeEventSource();
      void deleteSession(sessionIdRef.current);
      sessionIdRef.current = null;
    };
  }, [closeEventSource, deleteSession]);

  const handleUserInput = React.useCallback(async (text: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      throw new Error('Sessione non avviata.');
    }
    setIsWaitingForInput(false);
    const response = await fetch(
      `${VB_BASE_URL}/api/runtime/compiled-task/session/${sessionId}/input`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || response.statusText);
    }
  }, []);

  const restart = React.useCallback(async () => {
    setIsRestarting(true);
    try {
      closeEventSource();
      await deleteSession(sessionIdRef.current);
      sessionIdRef.current = null;
      hasStartedRef.current = false;
      setError(null);
      setStartAgentRuntimeError(null);
      setIsWaitingForInput(false);
      await ensureStarted();
    } catch (err) {
      reportStartError(err);
    } finally {
      setIsRestarting(false);
    }
  }, [closeEventSource, deleteSession, ensureStarted, reportStartError]);

  const play = React.useCallback(async () => {
    if (hasStartedRef.current && sessionIdRef.current) return;
    try {
      await ensureStarted();
    } catch (err) {
      reportStartError(err);
    }
  }, [ensureStarted, reportStartError]);

  return {
    isWaitingForInput,
    error,
    startAgentRuntimeError,
    sessionActive,
    isRestarting,
    isStarting,
    handleUserInput,
    restart,
    play,
    executionLabel: options?.executionLaunchLabel ?? task?.label ?? 'Task',
    executionType: 'rowTask' as const,
  };
}
