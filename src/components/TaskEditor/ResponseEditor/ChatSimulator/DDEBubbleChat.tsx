import React from 'react';
import type { Task, TaskTree } from 'types/taskTypes';
import { AlertTriangle, Workflow, RotateCcw, Save, X } from 'lucide-react';
import UserMessage, { type Message } from '@components/ChatSimulator/UserMessage';
import BotMessage from '@responseEditor/ChatSimulator/BotMessage';
import { getStepColor } from '@responseEditor/ChatSimulator/chatSimulatorUtils';
import { useFontContext } from '@context/FontContext';
import { useMessageEditing } from '@responseEditor/ChatSimulator/hooks/useMessageEditing';
import {
  useFlowModeChat,
  type UseFlowModeChatOptions,
} from '@responseEditor/ChatSimulator/hooks/useFlowModeChat';
import {
  createDebuggerActions,
  DebuggerLog,
  DebuggerStateMachine,
  FlowBotTurnLabel,
  UserTurnCard,
  DebuggerToolbar,
  DebuggerErrorList,
  type DebuggerSessionState,
  type DebuggerStep,
} from '../../../../features/debugger';
import { useCompilationErrors } from '@context/CompilationErrorsContext';
import { useFlowWorkspaceOptional } from '@flows/FlowStore';
import type { Flow } from '@flows/FlowTypes';
import { FlowWorkspaceSnapshot } from '@flows/FlowWorkspaceSnapshot';
import type { Node, Edge } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { isCompileErrorReportUxCode } from '@domain/compileErrors/compileUxMessages';
import DialogueTaskService from '@services/DialogueTaskService';
import { buildTaskTreeFromRepository } from '@utils/taskUtils';
import { translationKeyFromStoredValue } from '@utils/translationKeys';
import type { DebuggerRuntimeBridge } from '../../../../features/useCases/runtime/DebuggerRuntimeBridge';
import { UseCasesPanelIcon } from '../../../../features/useCases/ui/UseCaseIcons';
import { chatFocusDebug, describeElement } from '@responseEditor/ChatSimulator/utils/chatFocusDebug';
import { getFlowFocusManager } from '@features/focus';

/** Flow graph for error grouping when DDEBubbleChat is outside FlowWorkspaceProvider (global debugger). */
function buildFlowsRecordFromWorkspaceSnapshot(): Record<string, Flow<Node<FlowNode>, Edge>> {
  const out: Record<string, Flow<Node<FlowNode>, Edge>> = {};
  for (const fid of FlowWorkspaceSnapshot.getAllFlowIds()) {
    const s = FlowWorkspaceSnapshot.getFlowById(fid);
    if (!s) continue;
    out[fid] = {
      id: fid,
      title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : fid,
      nodes: (s.nodes ?? []) as Node<FlowNode>[],
      edges: (s.edges ?? []) as Edge[],
      ...(s.tasks !== undefined ? { tasks: s.tasks } : {}),
      ...(s.meta !== undefined ? { meta: s.meta } : {}),
      ...(s.variables !== undefined ? { variables: s.variables } : {}),
      ...(s.bindings !== undefined ? { bindings: s.bindings } : {}),
    };
  }
  return out;
}

/** Maps browser/network error messages to user-facing Italian copy for the chat simulator header. */
function userFacingChatErrorMessage(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const t = raw.trim();
  if (/^failed to fetch$/i.test(t)) return 'Il motore non è disponibile';
  /** Orchestrator/ProblemDetails messages are already user-oriented */
  return t;
}

/** Clicks inside portaled dialogs/menus should not count as "outside chat" for focus policy. */
function isLikelyModalOrPortalTarget(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  if (!el) return false;
  return (
    !!el.closest('[role="dialog"]') ||
    !!el.closest('[role="menu"]') ||
    !!el.closest('[role="listbox"]') ||
    !!el.closest('[data-radix-popper-content-wrapper]') ||
    !!el.closest('[data-radix-portal]')
  );
}

/**
 * Estrae tutti i GUID dai step (utterance, invalid, nomatch, noinput, escalation, constraint)
 * Formato steps: { "templateId": { "start": { escalations: [...] }, "noMatch": { escalations: [...] }, ... } }
 * GUID pattern: ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
 */
function extractGuidsFromSteps(
  steps: Record<string, any>,
  guids: Set<string>
): void {
  let extractedCount = 0;
  let debugInfo: any[] = [];

  // ✅ Log rimosso: troppo verboso

  // ✅ Formato: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
  for (const [templateId, stepDict] of Object.entries(steps)) {
    if (!stepDict || typeof stepDict !== 'object') {
      debugInfo.push({ templateId, reason: 'stepDict is null or not object', stepDict });
      continue;
    }

    // ✅ Gestisci anche il caso legacy: stepDict potrebbe essere un array
    if (Array.isArray(stepDict)) {
      for (const step of stepDict) {
        if (step?.escalations && Array.isArray(step.escalations)) {
          for (const escalation of step.escalations) {
            if (escalation.tasks && Array.isArray(escalation.tasks)) {
              for (const taskItem of escalation.tasks) {
                if (taskItem.parameters && Array.isArray(taskItem.parameters)) {
                  const textParam = taskItem.parameters.find((p: any) =>
                    p?.parameterId === 'text' || p?.key === 'text'
                  );
                  const tk = textParam?.value ? translationKeyFromStoredValue(String(textParam.value)) : null;
                  if (tk) {
                    guids.add(tk);
                    extractedCount++;
                    debugInfo.push({ templateId, source: 'array-step-parameter', guid: tk });
                  } else if (textParam?.value) {
                    debugInfo.push({ templateId, source: 'array-step-parameter', value: textParam.value, isGuid: false });
                  }
                }
              }
            }
          }
        }
      }
      continue;
    }

    // ✅ Itera su ogni tipo di step (start, noMatch, noInput, ecc.)
    for (const [stepType, stepRaw] of Object.entries(stepDict)) {
      if (!stepRaw || typeof stepRaw !== 'object') {
        debugInfo.push({ templateId, stepType, reason: 'step is null or not object' });
        continue;
      }
      const step = stepRaw as { escalations?: unknown };

      // ✅ Estrai GUID dalle escalation
      if (step.escalations && Array.isArray(step.escalations)) {
        for (const escalation of step.escalations) {
          if (escalation.tasks && Array.isArray(escalation.tasks)) {
            for (const taskItem of escalation.tasks) {
              // ✅ GUID da taskItem.parameters (parametro con parameterId='text')
              if (taskItem.parameters && Array.isArray(taskItem.parameters)) {
                const textParam = taskItem.parameters.find((p: any) =>
                  p?.parameterId === 'text' || p?.key === 'text'
                );
                const tk = textParam?.value ? translationKeyFromStoredValue(String(textParam.value)) : null;
                if (tk) {
                  guids.add(tk);
                  extractedCount++;
                  debugInfo.push({ templateId, stepType, source: 'step-parameter', guid: tk });
                } else if (textParam?.value) {
                  debugInfo.push({ templateId, stepType, source: 'step-parameter', value: textParam.value, isGuid: false });
                } else if (textParam) {
                  debugInfo.push({ templateId, stepType, source: 'step-parameter', textParam, hasValue: !!textParam.value });
                }
              } else {
                debugInfo.push({ templateId, stepType, source: 'taskItem', hasParameters: !!taskItem.parameters, parametersType: Array.isArray(taskItem.parameters) ? 'array' : typeof taskItem.parameters });
              }
            }
          } else {
            debugInfo.push({ templateId, stepType, source: 'escalation', hasTasks: !!escalation.tasks, tasksType: Array.isArray(escalation.tasks) ? 'array' : typeof escalation.tasks });
          }
        }
      } else {
        debugInfo.push({ templateId, stepType, source: 'step', hasEscalations: !!step.escalations, escalationsType: Array.isArray(step.escalations) ? 'array' : typeof step.escalations });
      }
    }
  }

  // ✅ Log rimosso: troppo verboso

  if (extractedCount === 0) {
    console.warn(`[extractGuidsFromSteps] ⚠️ No GUIDs extracted from steps`, {
      stepsKeys: Object.keys(steps),
      debugInfo: debugInfo.slice(0, 20)
    });
  }
}

/**
 * Filtra le traduzioni per includere solo quelle runtime.
 * `allTranslations` must be the workspace **compiled** map (`compiledTranslations` from context:
 * global + all `flows[*].meta.translations`), not global-only.
 * Runtime translations sono:
 * 1. Chiavi che iniziano con "runtime." (pattern: runtime.DDT_<ID>.<step>#<n>.<action>.text)
 * 2. GUID che sono referenziati nei step dell'ISTANZA (non del template!)
 *
 * ✅ CRITICAL: Il runtime deve usare SOLO i GUID dell'istanza, non quelli del template.
 * Quando un'istanza viene clonata da un template, riceve nuovi GUID per le traduzioni.
 * Il runtime deve risolvere solo questi GUID dell'istanza, non quelli del template originale.
 *
 * ✅ ARCHITECTURAL FIX: Usa materializedTree.steps invece di taskInstance.steps
 * Questo garantisce che i GUID estratti siano identici a quelli usati dall'editor,
 * eliminando la classe di bug "editor vede X, runtime vede Y".
 *
 * Traduzioni IDE (escluse):
 * - Label, description, help text, metadata UI
 * - Stringhe di configurazione, pannelli, wizard, menu, debug
 * - VariableReadableName, VariableDottedName, Synonyms
 */
function filterRuntimeTranslations(
  allTranslations: Record<string, string>,
  materializedTree: TaskTree, // ✅ CAMBIATO: Accetta TaskTree invece di Task
  _referencedTemplates: any[] // ⚠️ Mantenuto per retrocompatibilità ma NON più usato
): Record<string, string> {
  const runtimeTranslations: Record<string, string> = {};

  // 1. Estrai SOLO i GUID referenziati nei step dell'ISTANZA
  // ✅ CRITICAL: NON processare template referenziati - hanno GUID diversi (del template)
  // L'istanza ha i suoi GUID clonati, e il runtime deve usare solo quelli
  const runtimeGuids = new Set<string>();

  // ✅ ARCHITECTURAL FIX: Estrai GUID da materializedTree.steps (stesso TaskTree dell'editor)
  // Questo garantisce che i GUID siano identici a quelli usati dall'editor
  if (materializedTree.steps && typeof materializedTree.steps === 'object') {
    extractGuidsFromSteps(materializedTree.steps, runtimeGuids);
  }

  // 🔍 DEBUG: Verifica quali GUID vengono estratti dalla struttura materializzata
  console.log('[filterRuntimeTranslations] 🔍 DEBUG GUIDs extracted from materializedTree', {
    materializedTreeId: materializedTree.labelKey,
    runtimeGuidsCount: runtimeGuids.size,
    runtimeGuids: Array.from(runtimeGuids),
    allTranslationsCount: Object.keys(allTranslations).length,
    allTranslationsSample: Object.entries(allTranslations).slice(0, 5).map(([k, v]) => ({ guid: k, text: String(v).substring(0, 50) }))
  });

  // ❌ RIMOSSO: Non processare template referenziati
  // I template hanno GUID diversi (del template), l'istanza ha i suoi GUID (clonati)
  // Il runtime deve usare SOLO i GUID dell'istanza!

  // 2. Filtra traduzioni: solo quelle che sono GUID referenziati nell'istanza O chiavi runtime.*
  for (const [guid, text] of Object.entries(allTranslations)) {
    // Pattern runtime.* (es: runtime.DDT_xxx.start#1.SayMessage_1.text)
    if (guid.startsWith('runtime.')) {
      runtimeTranslations[guid] = text;
    }
    // ✅ GUID referenziati nei step dell'istanza (non del template!)
    else if (runtimeGuids.has(guid)) {
      runtimeTranslations[guid] = text;
    }
    // ❌ Tutte le altre (IDE) vengono escluse
  }

  // 🔍 DEBUG: Verifica quali traduzioni vengono filtrate e inviate al runtime
  console.log('[filterRuntimeTranslations] 🔍 DEBUG Runtime translations filtered', {
    runtimeTranslationsCount: Object.keys(runtimeTranslations).length,
    runtimeTranslationsGuids: Object.keys(runtimeTranslations),
    runtimeTranslationsSample: Object.entries(runtimeTranslations).slice(0, 10).map(([k, v]) => ({
      guid: k,
      text: String(v).substring(0, 100),
      isRuntimePattern: k.startsWith('runtime.'),
      isInstanceGuid: runtimeGuids.has(k)
    })),
    missingGuids: Array.from(runtimeGuids).filter(guid => !runtimeTranslations[guid])
  });

  return runtimeTranslations;
}

export default function DDEBubbleChat({
  task,
  projectId,
  translations,
  taskTree,
  onUpdateTaskTree,
  // ✅ NEW: Preview mode props (optional, default = 'interactive')
  mode = 'interactive',
  previewMessages,
  activeScenario,
  onScenarioChange,
  // ✅ NEW: Flow data props (for flow mode)
  flowNodes,
  flowEdges,
  flowTasks,
  // ✅ NEW: Backend materialization flag
  useBackendMaterialization = false,
  executionFlowName,
  orchestratorCompileRootFlowId,
  flowAutoStart = false,
  executionLaunchType,
  executionLaunchLabel,
  onClosePanel,
  onToggleUseCasePanel,
  onSaveUseCase,
  onRuntimeBridgeReady,
  onMessagesSnapshotChange,
}: {
  task: Task | null;
  projectId: string | null;
  translations?: Record<string, string>;
  taskTree?: TaskTree | null;
  onUpdateTaskTree?: (updater: (taskTree: any) => any) => void;
  // ✅ NEW: Preview mode props
  mode?: 'interactive' | 'preview';
  previewMessages?: Message[];
  activeScenario?: 'happy' | 'partial' | 'error';
  onScenarioChange?: (scenario: 'happy' | 'partial' | 'error') => void;
  // ✅ NEW: Flow data props
  flowNodes?: any[]; // Node<FlowNode>[] - using any[] to avoid circular dependency
  flowEdges?: any[]; // Edge<EdgeData>[] - using any[] to avoid circular dependency
  flowTasks?: any[];
  // ✅ NEW: Backend materialization flag
  useBackendMaterialization?: boolean;
  executionFlowName?: string;
  /** When set, orchestrator compile/session uses this canvas as primary root (required for isolated sub-dialog runs). */
  orchestratorCompileRootFlowId?: string | null;
  /** When true (e.g. global Run): start orchestrator automatically; after Clear, user must press Play. */
  flowAutoStart?: boolean;
  executionLaunchType?: 'flow' | 'rowTask' | 'node';
  executionLaunchLabel?: string;
  onClosePanel?: () => void;
  onToggleUseCasePanel?: () => void;
  onSaveUseCase?: (payload: { suggestedKey: string; messages: Message[] }) => void;
  onRuntimeBridgeReady?: (bridge: DebuggerRuntimeBridge | null) => void;
  onMessagesSnapshotChange?: (messages: Message[]) => void;
}) {
  const { combinedClass } = useFontContext();
  const { errors: compilationErrors } = useCompilationErrors();
  const workspaceOptional = useFlowWorkspaceOptional<Node<FlowNode>, Edge>();
  const [workspaceSnapshotTick, setWorkspaceSnapshotTick] = React.useState(0);
  React.useEffect(() => FlowWorkspaceSnapshot.subscribe(() => setWorkspaceSnapshotTick((n) => n + 1)), []);

  const workspaceFlows = React.useMemo((): Record<string, Flow<Node<FlowNode>, Edge>> => {
    if (workspaceOptional != null) {
      return workspaceOptional.flows as Record<string, Flow<Node<FlowNode>, Edge>>;
    }
    return buildFlowsRecordFromWorkspaceSnapshot();
  }, [workspaceOptional, workspaceSnapshotTick]);

  const reportCompileErrors = React.useMemo(
    () => compilationErrors.filter((e) => isCompileErrorReportUxCode(e.code)),
    [compilationErrors]
  );
  const [messages, setMessages] = React.useState<Message[]>([]);
  const messagesRef = React.useRef<Message[]>([]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [backendError, setBackendError] = React.useState<string | null>(null);
  const [isWaitingForInput, setIsWaitingForInput] = React.useState(false);
  const [resetCounter, setResetCounter] = React.useState(0); // ✅ Counter per forzare riavvio dopo reset
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const sentTextRef = React.useRef<string>('');
  const sessionStartingRef = React.useRef<boolean>(false);
  const lastSessionKeyRef = React.useRef<string | null>(null);
  const onFlowModeMessage = React.useCallback((message: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  React.useEffect(() => {
    messagesRef.current = messages;
    onMessagesSnapshotChange?.([...messages]);
  }, [messages, onMessagesSnapshotChange]);

  const messageIdCounter = React.useRef(0);
  const generateMessageId = (prefix: string = 'msg') => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  };

  // ✅ ARCHITECTURAL: Detect flow mode explicitly
  const isFlowMode = !task && !taskTree && mode === 'interactive';

  const debuggerBlockedByCompile =
    isFlowMode && reportCompileErrors.length > 0;

  const [dbgToolbarState, setDbgToolbarState] = React.useState<DebuggerSessionState>('idle');
  const debuggerMachineRef = React.useRef<DebuggerStateMachine | null>(null);
  if (!debuggerMachineRef.current) {
    debuggerMachineRef.current = new DebuggerStateMachine(setDbgToolbarState);
  }

  const flowDebuggerHookOpts = React.useMemo<UseFlowModeChatOptions>(
    () => ({
      onSessionStarted: () => {
        console.info('[DebuggerFlow] lifecycle sessionStarted → running');
        debuggerMachineRef.current?.setState('running');
      },
      onOrchestratorWaiting: () => {
        console.info('[DebuggerFlow] lifecycle waitingForInput');
        debuggerMachineRef.current?.setState('waitingForInput');
      },
      onOrchestratorEnded: () => {
        console.info('[DebuggerFlow] lifecycle ended → idle');
        debuggerMachineRef.current?.setState('idle');
      },
    }),
    []
  );

  // ✅ ARCHITECTURAL: Flow orchestrator (manual Play by default — no autoStart)
  const flowModeChat = useFlowModeChat(
    flowNodes || [],
    flowEdges || [],
    flowTasks || [],
    translations,
    onFlowModeMessage,
    executionFlowName,
    {
      ...flowDebuggerHookOpts,
      orchestratorCompileRootFlowId: orchestratorCompileRootFlowId ?? undefined,
      autoStart: flowAutoStart === true && reportCompileErrors.length === 0,
      projectId: projectId ?? null,
      flowId: orchestratorCompileRootFlowId ?? null,
    }
  );

  const [flowExpandedUserId, setFlowExpandedUserId] = React.useState<string | null>(null);

  const handleFlowUserEditResponse = React.useCallback(
    async (messageId: string, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return;
      const userMsgs = messagesRef.current.filter((m) => m.type === 'user');
      const editIdx = userMsgs.findIndex((m) => m.id === messageId);
      if (editIdx < 0) return;
      const turns = userMsgs.slice(0, editIdx + 1).map((m, i) => ({
        text: i === editIdx ? trimmed : m.text,
        clientMessageId: m.id,
      }));
      setFlowExpandedUserId(null);
      setMessages([]);
      try {
        await flowModeChat.replayUserInputs(turns, (t) => {
          setMessages((prev) => [
            ...prev,
            {
              id: t.clientMessageId,
              type: 'user',
              text: t.text,
              matchStatus: 'match',
            },
          ]);
        });
      } catch (e) {
        setBackendError(e instanceof Error ? e.message : 'Replay fallito');
      }
    },
    [flowModeChat]
  );

  const debuggerActions = React.useMemo(
    () =>
      createDebuggerActions({
        machine: debuggerMachineRef.current!,
        flow: {
          startSession: () => flowModeChat.startSession(),
          clearSession: () => flowModeChat.clearSession(),
          restartFlow: async () => {
            setMessages([]);
            messageIdCounter.current = 0;
            await flowModeChat.restartFlow();
          },
        },
        ui: {
          clearChatLog: () => {
            DebuggerLog.clear({
              setMessages,
              messagesRef,
              resetMessageIdCounter: () => {
                messageIdCounter.current = 0;
              },
            });
          },
        },
      }),
    [flowModeChat.startSession, flowModeChat.clearSession, flowModeChat.restartFlow]
  );

  React.useEffect(() => {
    if (!isFlowMode) return;
    console.info('[DebuggerFlow] toolbarState', dbgToolbarState, {
      sessionId: flowModeChat.getOrchestratorSessionId(),
      waiting: flowModeChat.isWaitingForInput,
    });
  }, [
    isFlowMode,
    dbgToolbarState,
    flowModeChat.isWaitingForInput,
    flowModeChat.getOrchestratorSessionId,
  ]);
  const launchExecutionLabel = React.useMemo(() => {
    const flowName = (executionFlowName || 'MAIN').trim() || 'MAIN';
    const launchLabel = (executionLaunchLabel || '').trim();
    if (executionLaunchType === 'rowTask' && launchLabel) {
      return `${flowName}: ${launchLabel}`;
    }
    if (executionLaunchType === 'node' && launchLabel) {
      return `${flowName}: ${launchLabel}`;
    }
    return `${flowName}: Esecuzione flusso`;
  }, [executionFlowName, executionLaunchType, executionLaunchLabel]);
  const executionLabel = isFlowMode
    ? (flowModeChat.currentExecutionLabel || launchExecutionLabel)
    : '';
  const executionParts = React.useMemo(() => {
    const raw = executionLabel || launchExecutionLabel;
    const idx = raw.indexOf(':');
    const flowName = idx >= 0 ? raw.slice(0, idx).trim() : ((executionFlowName || 'MAIN').trim() || 'MAIN');
    const target = idx >= 0 ? raw.slice(idx + 1).trim() : '';
    const normalizedTarget = target.replace(/^Nodo\((.*)\)$/i, '$1').trim();
    return { flowName, target: normalizedTarget };
  }, [executionLabel, launchExecutionLabel, executionFlowName]);


  // ✅ ARCHITECTURAL: Merge flow mode state with component state
  const effectiveIsWaitingForInput = isFlowMode ? flowModeChat.isWaitingForInput : isWaitingForInput;
  const effectiveWaitingForInputRef = React.useRef(effectiveIsWaitingForInput);
  React.useEffect(() => {
    effectiveWaitingForInputRef.current = effectiveIsWaitingForInput;
  }, [effectiveIsWaitingForInput]);
  const effectiveError = isFlowMode ? flowModeChat.error || backendError : backendError;
  const displayChatError = React.useMemo(
    () => userFacingChatErrorMessage(effectiveError),
    [effectiveError],
  );

  // Message editing state and handlers
  // TODO: Update useMessageEditing to work with TaskTree instead of AssembledDDT
  const {
    hoveredId,
    setHoveredId,
    editingId,
    draftText,
    inlineDraft,
    setInlineDraft,
    scrollContainerRef,
    inlineInputRef,
    ensureInlineFocus,
    handleEdit,
    handleSave,
    handleCancel
  } = useMessageEditing({
    messages,
    setMessages,
    currentDDT: null as any, // TODO: Remove when useMessageEditing is updated
    onUpdateDDT: onUpdateTaskTree as any // TODO: Update when useMessageEditing is updated
  });

  const chatInteractionRootRef = React.useRef<HTMLDivElement | null>(null);
  const flowFocusWaitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Flow mode: pointer outside chat panel → FlowFocusManager (canvas/editor priority). */
  React.useEffect(() => {
    if (!isFlowMode) return;
    const onPointerDownCapture = (e: MouseEvent) => {
      const root = chatInteractionRootRef.current;
      if (!root) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (root.contains(t)) return;
      if (isLikelyModalOrPortalTarget(t)) return;
      getFlowFocusManager().notifyPointerDownOutsideChatRoot();
    };
    document.addEventListener('mousedown', onPointerDownCapture, true);
    return () => document.removeEventListener('mousedown', onPointerDownCapture, true);
  }, [isFlowMode]);

  /**
   * Flow mode: when orchestrator accepts input, attempt focus only via FlowFocusManager
   * (no direct input.focus() here).
   */
  React.useEffect(() => {
    if (!isFlowMode) return;
    if (flowFocusWaitTimerRef.current) {
      clearTimeout(flowFocusWaitTimerRef.current);
      flowFocusWaitTimerRef.current = null;
    }
    if (!effectiveIsWaitingForInput) return;

    getFlowFocusManager().notifyOrchestratorWaitingForInput();

    flowFocusWaitTimerRef.current = setTimeout(() => {
      flowFocusWaitTimerRef.current = null;
      if (!effectiveWaitingForInputRef.current) return;
      getFlowFocusManager().tryFocusChatInput(inlineInputRef.current);
    }, 80);

    return () => {
      if (flowFocusWaitTimerRef.current) {
        clearTimeout(flowFocusWaitTimerRef.current);
        flowFocusWaitTimerRef.current = null;
      }
    };
  }, [effectiveIsWaitingForInput, isFlowMode]);

  // ✅ NEW: In preview mode, use previewMessages instead of SSE
  const displayMessages = mode === 'preview' && previewMessages ? previewMessages : messages;

  // ✅ ARCHITECTURAL: Separate useEffect for preview mode
  React.useEffect(() => {
    if (mode === 'preview') {
      // Clear any existing SSE state
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setBackendError(null);
      setIsWaitingForInput(false);
      sessionStartingRef.current = false;
      lastSessionKeyRef.current = null;
    }
  }, [mode]);

  // ✅ ARCHITECTURAL: Separate useEffect for flow mode (handled by useFlowModeChat hook)
  // Flow mode is handled entirely by useFlowModeChat hook, no SSE needed here

  // ✅ ARCHITECTURAL: Separate useEffect for task mode (SSE)
  React.useEffect(() => {
    // Skip if preview mode
    if (mode === 'preview') {
      return;
    }

    // Skip if flow mode (handled by useFlowModeChat hook)
    if (isFlowMode) {
      return;
    }

    // ✅ EXISTING: Interactive mode with task - normal behavior (unchanged)
    if (!task || !projectId || !task.id) {
      // Clear messages when task is not available - NO frontend logic
      setMessages([]);
      setBackendError(null);
      setIsWaitingForInput(false);
      sessionStartingRef.current = false;
      lastSessionKeyRef.current = null;
      return;
    }

    // ✅ Create a unique key for this task/project combination
    const sessionKey = `${task.id}-${projectId}`;

    // ✅ Prevent duplicate session starts for the same task/project combination
    if (lastSessionKeyRef.current === sessionKey) {
      return;
    }

    lastSessionKeyRef.current = sessionKey;

    // ✅ Prevent multiple simultaneous session starts
    if (sessionStartingRef.current) {
      return;
    }

    // ✅ Mark this combination as started
    lastSessionKeyRef.current = sessionKey;

    // Clear any existing messages when starting a new session - NO frontend logic
    setMessages([]);
    messageIdCounter.current = 0;
    setBackendError(null);
    setIsWaitingForInput(false);
    // ✅ RIMOSSO: sessionStartingRef.current = true; viene settato dentro startSession()

    // ✅ VB.NET backend engine
    const baseUrl = 'http://localhost:5000';   // ✅ VB.NET backend diretto

    const startSession = async () => {
      // ✅ CRITICAL: Set flag here, not before calling startSession()
      // This prevents race conditions where the flag is set but startSession() is never called
      if (sessionStartingRef.current) {
        console.log('[DDEBubbleChat] ⏸️ Session already starting, skipping duplicate call');
        return;
      }
      sessionStartingRef.current = true;

      try {
        console.log('[DDEBubbleChat] 🔄 startSession() called');
        setBackendError(null);
        const translationsData = translations || {};

        console.log('[DDEBubbleChat] 🔍 Translations check before sending', {
          hasTranslations: !!translations,
          translationsCount: translations ? Object.keys(translations).length : 0,
          translationsDataCount: Object.keys(translationsData).length,
          hasTaskTree: !!taskTree,
          taskTreeStepsKeys: taskTree?.steps ? Object.keys(taskTree.steps) : [],
          taskTreeNodesCount: taskTree?.nodes?.length || 0,
          sampleTranslations: Object.entries(translationsData).slice(0, 5).map(([k, v]) => ({ guid: k, text: String(v).substring(0, 50) }))
        });

        // ✅ Safety check: Log if translations are empty (for debugging multi-data tasks)
        if (Object.keys(translationsData).length === 0) {
          console.error('[DDEBubbleChat] ❌ Translations empty before sending', {
            hasTranslations: !!translations,
            translationsCount: translations ? Object.keys(translations).length : 0,
            hasTaskTree: !!taskTree,
            taskTreeStepsKeys: taskTree?.steps ? Object.keys(taskTree.steps) : [],
            taskTreeNodesCount: taskTree?.nodes?.length || 0,
            taskTreeNodes: taskTree?.nodes?.map((n: any) => ({
              id: n.id,
              templateId: n.templateId,
              label: n.label,
              hasSubNodes: !!(n.subNodes && n.subNodes.length > 0),
              subNodesCount: n.subNodes?.length || 0
            })) || []
          });
        }

        // ✅ CRITICAL: TaskTree è OBBLIGATORIO - non inviare solo taskId
        if (!taskTree) {
          throw new Error('[DDEBubbleChat] TaskTree is required. Cannot start session without complete instance.');
        }

        // ✅ Log rimosso: troppo verboso

        // ✅ Recupera lingua e versione del progetto - OBBLIGATORIO, nessun fallback
        if (!projectId) {
          throw new Error('[DDEBubbleChat] ProjectId is required');
        }

        const projectResponse = await fetch(`/api/projects/${projectId}`);

        if (!projectResponse.ok) {
          const errorText = await projectResponse.text();
          console.error(`[DDEBubbleChat] ❌ Failed to load project metadata: ${projectResponse.status}`, {
            status: projectResponse.status,
            statusText: projectResponse.statusText,
            error: errorText
          });
          throw new Error(`Failed to load project metadata: ${projectResponse.statusText} - ${errorText}`);
        }

        const project = await projectResponse.json();

        if (!project.language) {
          throw new Error('[DDEBubbleChat] Project language is required');
        }

        // Converti formato breve (es. 'it', 'en', 'pt') a formato completo (es. 'it-IT', 'en-US', 'pt-BR')
        const langMap: Record<string, string> = {
          'it': 'it-IT',
          'en': 'en-US',
          'pt': 'pt-BR',
          'es': 'es-ES',
          'fr': 'fr-FR'
        };
        const projectLanguage = langMap[project.language] || `${project.language}-${project.language.toUpperCase()}`;

        // ✅ Recupera versione del progetto - OBBLIGATORIO
        if (!project.version) {
          throw new Error('[DDEBubbleChat] Project version is required');
        }
        const projectVersion = project.version;
        const versionQualifier = project.versionQualifier || 'production';
        // Costruisci dialogVersion: "1.0" o "1.0-alpha" se qualifier non è production
        const dialogVersion = versionQualifier !== 'production'
          ? `${projectVersion}-${versionQualifier}`
          : projectVersion;
        console.log(`[DDEBubbleChat] 📋 Dialog version: ${dialogVersion} (from version=${projectVersion}, qualifier=${versionQualifier})`);

        // ✅ Log rimosso: troppo verboso

        // ✅ NUOVO MODELLO: Invia TaskTree completo (working copy) invece di solo taskId
        // L'istanza in memoria è la fonte di verità, non il database
        // ✅ CRITICAL: Steps è già dictionary: { "templateId": { "start": {...}, "noMatch": {...} } }
        // Il backend VB.NET si aspetta questa struttura (stessa del database)

        // ✅ STATELESS: STEP 2: Compila e salva il dialogo nel repository
        // Il dialogo deve essere compilato e salvato prima di avviare la sessione
        if (!task || !taskTree) {
          throw new Error('[DDEBubbleChat] Task and TaskTree are required to compile and save the dialog.');
        }

        // ✅ STEP 2.1: Compila il TaskTree in RuntimeTask
        // ✅ CRITICAL: Il compilatore VB.NET deve ricostruire tutto da zero
        // ✅ NON usare TaskTree della UI - è solo un artefatto grafico, non affidabile
        // ✅ Log rimosso: troppo verboso

        // ✅ ARCHITECTURAL FIX: Materializza usando buildTaskTreeFromRepository (stessa routine dell'editor)
        // Questo garantisce che compilatore e editor usino la stessa struttura logica,
        // eliminando la classe di bug "editor vede X, runtime vede Y"
        // ✅ CRITICAL: buildTaskTreeFromRepository garantisce istanza fresca dal repository (inclusi flag _disabled)
        console.log('[DDEBubbleChat] 🔧 Materializing task structure using buildTaskTreeFromRepository...');
        const materialized = await buildTaskTreeFromRepository(task.id, projectId || undefined);
        if (!materialized) {
          throw new Error(`[DDEBubbleChat] Failed to materialize task tree for instance ${task.id}`);
        }
        const { taskTree: materializedTree, instance: taskInstance } = materialized;

        console.log('[DDEBubbleChat] ✅ Task structure materialized', {
          taskId: taskInstance.id,
          hasSteps: !!materializedTree.steps,
          stepsKeys: materializedTree.steps ? Object.keys(materializedTree.steps) : []
        });

        // ✅ CORRETTO: Costruisci taskForCompilation usando materializedTree
        // Il compilatore VB.NET materializzerà nodes da zero usando template referenziati
        // ✅ CRITICAL INVARIANT: Steps vengono dalla struttura materializzata (stesso TaskTree dell'editor)
        // Se l'istanza non ha steps, il nodo avrà Steps.Count = 0
        // Se ci sono constraints e Steps.Count = 0, la validazione fallisce
        const taskForCompilation = {
          id: taskInstance.id,
          templateId: taskInstance.templateId || taskInstance.id,
          type: taskInstance.type, // ✅ Deve essere presente (verificato sopra)
          label: taskInstance.label || '',
          // ✅ Includi solo campi dell'istanza
          value: taskInstance.value || {},
          parameters: taskInstance.parameters || [],
          subTasksIds: taskInstance.subTasksIds || [],
          constraints: taskInstance.constraints || [],
          // ✅ CRITICAL: dataContract extraction logic
          // - If useBackendMaterialization = false (default): Extract dataContract from template in frontend (old behavior)
          // - If useBackendMaterialization = true: Don't extract dataContract, let TaskDefinitionMaterializer handle it in backend
          dataContract: useBackendMaterialization
            ? undefined // ✅ NEW: Let backend TaskDefinitionMaterializer extract dataContract from allTemplates
            : (() => {
                // ✅ OLD: Frontend materialization - extract dataContract from DialogueTaskService
                // The instance's dataContract never contains subDataMapping (that is written by the wizard/editor into the template).
                // The compiler looks up allTemplates[taskForCompilation.id] and reads its DataContract — so we must supply the template's version here.
                const tplId = taskInstance.templateId || taskInstance.id;
                const tplSource = DialogueTaskService.getTemplate(tplId);
                return tplSource?.dataContract ?? taskInstance.dataContract ?? null;
              })(),
          // ✅ ARCHITECTURAL FIX: Steps vengono dalla struttura materializzata (stesso TaskTree dell'editor)
          // Formato: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
          // Se manca, il nodo avrà Steps.Count = 0 e la validazione fallirà se ci sono constraints
          // ✅ TEMPORARY: Rimuovi completamente 'introduction' e 'disambiguation' da tutti i nodi (da gestire in separata sede)
          // Entrambi vengono mappati a DialogueState.Start nel backend, causando duplicati
          steps: (() => {
            // ✅ Usa materializedTree.steps invece di taskInstance.steps
            const rawSteps = materializedTree.steps || {};
            if (!rawSteps || typeof rawSteps !== 'object') {
              return {};
            }
            const filteredSteps: Record<string, Record<string, any>> = {};
            for (const [nodeId, nodeSteps] of Object.entries(rawSteps)) {
              if (nodeSteps && typeof nodeSteps === 'object') {
                const filteredNodeSteps: Record<string, any> = {};
                for (const [stepType, stepData] of Object.entries(nodeSteps)) {
                  // ✅ Rimuovi step types non validi: disambiguation, violation
                  // ✅ TEMPORARY: Rimuovi anche 'introduction' per ora (da gestire in separata sede)
                  if (stepType === 'disambiguation' || stepType === 'violation' || stepType === 'introduction') {
                    continue;
                  }
                  // ✅ NEW: Rimuovi step disabilitati (_disabled === true)
                  if (stepData?._disabled === true) {
                    continue;
                  }
                  filteredNodeSteps[stepType] = stepData;
                }
                filteredSteps[nodeId] = filteredNodeSteps;
              } else {
                filteredSteps[nodeId] = nodeSteps;
              }
            }
            return filteredSteps;
          })(),
          // ❌ NON includere: nodes (il compilatore VB.NET li materializza da zero)
        };

        // ✅ CORRETTO: Raccogli template referenziati SOLO dall'istanza e dai template (NON da TaskTree)
        const referencedTemplateIds = new Set<string>();

        // 1. Aggiungi templateId del task instance
        if (taskForCompilation.templateId) {
          referencedTemplateIds.add(taskForCompilation.templateId);
        }

        // 2. Raccogli templateId da subTasksIds dell'istanza
        if (taskInstance.subTasksIds && Array.isArray(taskInstance.subTasksIds)) {
          taskInstance.subTasksIds.forEach((id: string) => {
            if (id) referencedTemplateIds.add(id);
          });
        }

        // 3. Raccogli templateId ricorsivamente dai template referenziati
        // ✅ CRITICAL: Carica template e raccogli i loro subTasksIds ricorsivamente
        const collectTemplateIdsRecursively = (templateId: string, visited: Set<string>) => {
          if (visited.has(templateId)) {
            return; // Evita cicli infiniti
          }
          visited.add(templateId);

          try {
            const template = DialogueTaskService.getTemplate(templateId);
            if (template) {
              // Raccogli subTasksIds dal template
              if (template.subTasksIds && Array.isArray(template.subTasksIds)) {
                template.subTasksIds.forEach((id: string) => {
                  if (id && !referencedTemplateIds.has(id)) {
                    referencedTemplateIds.add(id);
                    // Ricorsione: raccogli anche i subTasksIds dei template referenziati
                    collectTemplateIdsRecursively(id, visited);
                  }
                });
              }
            }
          } catch (error) {
            console.warn(`[DDEBubbleChat] ⚠️ Error loading template ${templateId} for recursive collection:`, error);
          }
        };

        const visitedTemplates = new Set<string>();
        // Raccogli ricorsivamente da tutti i template già trovati
        Array.from(referencedTemplateIds).forEach(templateId => {
          collectTemplateIdsRecursively(templateId, visitedTemplates);
        });

        // ✅ Helper function per filtrare step types non validi (disambiguation, violation)
        const filterSteps = (steps: any): any => {
          if (!steps || typeof steps !== 'object') {
            return steps;
          }
          const filteredSteps: Record<string, Record<string, any>> = {};
          for (const [nodeId, nodeSteps] of Object.entries(steps)) {
            if (nodeSteps && typeof nodeSteps === 'object') {
              const filteredNodeSteps: Record<string, any> = {};
              for (const [stepType, stepData] of Object.entries(nodeSteps)) {
                // ✅ Rimuovi step types non validi: disambiguation, violation
                if (stepType === 'disambiguation' || stepType === 'violation') {
                  continue;
                }
                filteredNodeSteps[stepType] = stepData;
              }
              filteredSteps[nodeId] = filteredNodeSteps;
            } else {
              filteredSteps[nodeId] = nodeSteps as Record<string, unknown>;
            }
          }
          return filteredSteps;
        };

        // ✅ Carica template referenziati da DialogueTaskService
        const referencedTemplates: any[] = [];
        referencedTemplateIds.forEach(templateId => {
          // Skip se il template è già il task stesso
          if (templateId === taskInstance.id) {
            return;
          }
          try {
            const template = DialogueTaskService.getTemplate(templateId);
            if (template) {
              // ✅ Filtra anche gli step dei template referenziati
              const filteredTemplate = {
                ...template,
                steps: filterSteps(template.steps)
              };
              referencedTemplates.push(filteredTemplate);
            } else {
              console.warn(`[DDEBubbleChat] ⚠️ Referenced template not found: ${templateId}`);
            }
          } catch (error) {
            console.warn(`[DDEBubbleChat] ⚠️ Error loading template ${templateId}:`, error);
          }
        });

        // ✅ Combina task instance e template referenziati
        const allTasksWithTemplates = [taskForCompilation, ...referencedTemplates];

        // ✅ Log per distinguere le due modalità di materializzazione
        if (useBackendMaterialization) {
          console.log('[DDEBubbleChat] 🔧 Using BACKEND materialization - TaskDefinitionMaterializer will extract dataContract from allTemplates');
          console.log('[DDEBubbleChat] 📋 taskForCompilation.dataContract:', taskForCompilation.dataContract === undefined ? 'undefined (will be materialized by backend)' : 'present (should not happen)');
        } else {
          console.log('[DDEBubbleChat] 🔧 Using FRONTEND materialization - dataContract extracted from DialogueTaskService.getTemplate()');
          console.log('[DDEBubbleChat] 📋 taskForCompilation.dataContract:', taskForCompilation.dataContract ? 'present' : 'null');
        }

        // ✅ NUOVO: Usa endpoint dedicato per TaskInstance (NON FlowCompiler)
        // ✅ Log rimosso: troppo verboso

        // ✅ NUOVO PAYLOAD: taskInstance + allTemplates (NON dummyNode, NON Flow)
        const compileRequestBody = {
          taskInstance: taskForCompilation, // ✅ TaskInstance da compilare
          allTemplates: allTasksWithTemplates // ✅ Tutti i template necessari (istanza + template referenziati)
        };

        const compileResponse = await fetch(`${baseUrl}/api/runtime/compile/task`, { // ✅ CORRETTO: /compile/task (con slash)
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(compileRequestBody)
        });

        // ✅ Log rimosso: troppo verboso (mantenuto solo in caso di errore)

        // ✅ Leggi la risposta
        const responseText = await compileResponse.text();

        // ✅ 3. LOG DIAGNOSTICI IN CASO DI ERRORE
        if (!compileResponse.ok) {
          let errorData: any = null;
          try {
            errorData = JSON.parse(responseText);
          } catch {
            errorData = { rawError: responseText };
          }

          console.error('[DDEBubbleChat] ❌ COMPILATION ERROR', {
            status: compileResponse.status,
            statusText: compileResponse.statusText,
            error: errorData.error || errorData.message || errorData.rawError || 'Unknown error',
            errorData: errorData,
            inputSummary: {
              instanceId: taskForCompilation.id,
              instanceTemplateId: taskForCompilation.templateId,
              instanceType: taskForCompilation.type,
              referencedTemplates: Array.from(referencedTemplateIds),
              referencedTemplatesCount: referencedTemplateIds.size,
              tasksSent: allTasksWithTemplates.map(t => ({
                id: t.id,
                templateId: t.templateId,
                type: t.type
              })),
              tasksSentCount: allTasksWithTemplates.length,
              missingTemplates: Array.from(referencedTemplateIds).filter(tid =>
                !allTasksWithTemplates.some(t => t.id === tid)
              )
              // ❌ RIMOSSO: rowTaskIdMatch (non più necessario, non usiamo più dummyNode)
            },
            diagnostic: {
              hasInstance: !!taskInstance,
              instanceHasType: taskInstance?.type !== undefined && taskInstance?.type !== null,
              instanceHasTemplateId: !!taskInstance?.templateId,
              allTemplatesLoaded: referencedTemplateIds.size === referencedTemplates.length,
              possibleCycles: visitedTemplates.size < referencedTemplateIds.size,
              unresolvedSubTasksIds: taskInstance?.subTasksIds?.filter(id =>
                !referencedTemplateIds.has(id)
              ) || []
            }
          });

          throw new Error(`Failed to compile task: ${compileResponse.statusText} - ${errorData.error || errorData.message || errorData.rawError || 'Unknown error'}`);
        }

        if (!responseText || responseText.trim().length === 0) {
          throw new Error('[DDEBubbleChat] Compilation response is empty');
        }

        let compileResult: any;
        try {
          compileResult = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[DDEBubbleChat] ❌ Failed to parse compilation result as JSON:', parseError);
          console.error('[DDEBubbleChat] ❌ Response text:', responseText);
          throw new Error(`Failed to parse compilation result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        // ✅ Validazione: se c'è un errore nella risposta, fallisci
        if (compileResult.status === 'error' || compileResult.error) {
          console.error('[DDEBubbleChat] ❌ COMPILATION ERROR (in response)', {
            status: compileResult.status,
            error: compileResult.error,
            message: compileResult.message,
            inputSummary: {
              instanceId: taskForCompilation.id,
              instanceTemplateId: taskForCompilation.templateId,
              referencedTemplates: Array.from(referencedTemplateIds)
            }
          });
          throw new Error(`Compilation failed: ${compileResult.error || compileResult.message || 'Unknown error'}`);
        }

        // ✅ NUOVO: La risposta da /api/runtime/compile/task è diversa
        // Non è FlowCompilationResult, ma un oggetto con compiledTask singolo
        console.log('[DDEBubbleChat] 📋 Compilation result (TaskInstance mode):', {
          success: compileResult.success,
          taskId: compileResult.taskId,
          compiledTaskId: compileResult.compiledTask?.id,
          compiledTaskType: compileResult.compiledTaskType,
          idMatch: compileResult.compiledTask?.id === taskForCompilation.id, // ✅ DEVE essere true
          debug: compileResult.compiledTask?.debug,
          originalTaskId: compileResult.compiledTask?.debug?.OriginalTaskId || compileResult.compiledTask?.debug?.originalTaskId,
          timestamp: compileResult.timestamp
        });

        // ✅ VERIFICA CRITICA: compiledTask.Id DEVE essere = taskInstance.id
        if (compileResult.compiledTask?.id !== taskForCompilation.id) {
          console.error('[DDEBubbleChat] ❌ ID MISMATCH:', {
            expectedId: taskForCompilation.id,
            actualId: compileResult.compiledTask?.id,
            compiledTask: compileResult.compiledTask
          });
          throw new Error(
            `[DDEBubbleChat] CompiledTask.Id mismatch: expected ${taskForCompilation.id}, got ${compileResult.compiledTask?.id}. ` +
            `The compiler MUST set compiledTask.Id = taskInstance.id for TaskInstance compilation.`
          );
        }

        // ✅ MODELLO SEMPLICE: Reset totale → Deploy minimo
        // STEP 1: Reset totale (svuota tutto per projectId + locale)
        // STEP 2: Deploy minimo (solo sotto-grafo necessario)
        try {
          // ✅ STEP 1: Reset totale
          console.log('[DDEBubbleChat] 🗑️ Step 1: Resetting all data for projectId + locale...');
          const resetResponse = await fetch(`http://localhost:3100/api/deploy/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projectId,
              locale: projectLanguage,
              environment: 'on-the-fly'
            })
          });

          if (!resetResponse.ok) {
            const errorText = await resetResponse.text();
            throw new Error(`Reset failed: ${resetResponse.statusText} - ${errorText}`);
          }

          const resetResult = await resetResponse.json();
          console.log('[DDEBubbleChat] ✅ Reset completed:', {
            deletedCount: resetResult.deletedCount
          });

          // ✅ STEP 2: Deploy minimo (solo sotto-grafo necessario)
          console.log('[DDEBubbleChat] 📦 Step 2: Deploying minimal subgraph...');

          // ✅ CRITICAL: Always read translations from window.__projectTranslationsContext.translations
          const projectTranslationsContext = (window as any).__projectTranslationsContext;
          const allTranslations = projectTranslationsContext ? projectTranslationsContext.translations : {};

          // ✅ ARCHITECTURAL FIX: Filtra traduzioni usando materializedTree (stesso TaskTree dell'editor)
          // Questo garantisce che i GUID estratti siano identici a quelli usati dall'editor
          const runtimeTranslations = filterRuntimeTranslations(
            allTranslations,
            materializedTree, // ✅ Passa TaskTree invece di Task
            referencedTemplates
          );

          // 🔍 DEBUG: Verifica traduzioni inviate al deploy
          console.log('[DDEBubbleChat] 🔍 DEBUG Translations sent to deploy', {
            taskInstanceId: taskInstance.id,
            runtimeTranslationsCount: Object.keys(runtimeTranslations).length,
            runtimeTranslationsGuids: Object.keys(runtimeTranslations),
            runtimeTranslationsSample: Object.entries(runtimeTranslations).slice(0, 10).map(([k, v]) => ({
              guid: k,
              text: String(v).substring(0, 100)
            }))
          });

          if (Object.keys(runtimeTranslations).length === 0) {
            console.warn('[DDEBubbleChat] ⚠️ No runtime translations found - Redis may be incomplete');
          }

          // ✅ DEPLOY MINIMO: Task + Template + Traduzioni (solo sotto-grafo)
          const deployResponse = await fetch(`http://localhost:3100/api/deploy/sync-subgraph`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projectId,
              locale: projectLanguage,
              environment: 'on-the-fly',
              taskInstance: taskForCompilation,        // ✅ Task instance completa
              referencedTemplates: referencedTemplates, // ✅ Tutti i template referenziati
              translations: runtimeTranslations,        // ✅ Tutte le traduzioni del sotto-grafo
              compiledTask: compileResult.compiledTask  // ✅ CompiledTask risultante
            })
          });

          if (!deployResponse.ok) {
            const errorText = await deployResponse.text();
            throw new Error(`Deployment failed: ${deployResponse.statusText} - ${errorText}`);
          }

          const deployResult = await deployResponse.json();
          console.log('[DDEBubbleChat] ✅ Complete subgraph deployed:', {
            translations: deployResult.translationsDeployed,
            templates: deployResult.templatesDeployed,
            task: deployResult.taskDeployed
          });

          // ✅ CRITICAL: Wait a bit to ensure Redis writes are complete and cache is invalidated
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (deployError) {
          console.error('[DDEBubbleChat] ❌ Deployment failed:', deployError);
          throw new Error(`Failed to deploy complete subgraph: ${deployError instanceof Error ? deployError.message : 'Unknown error'}`);
        }

        // ✅ STEP 2.3: Estrai CompiledTask dalla compilazione e convertilo in RuntimeTask
        // Il backend ha compilato il task e restituito CompiledTask
        // Convertiamo CompiledTask → RuntimeTask (ricorsivo con subTasks)
        // ✅ Log rimosso: troppo verboso

        // ✅ VERIFICA: Il backend DEVE restituire compiledTask
        if (!compileResult.compiledTask) {
          console.error('[DDEBubbleChat] ❌ COMPILATION BUG: compiledTask is missing!', {
            success: compileResult.success,
            taskId: compileResult.taskId,
            compiledTaskType: compileResult.compiledTaskType,
            fullResponse: compileResult
          });
          throw new Error(
            `[DDEBubbleChat] COMPILATION BUG: The VB.NET compiler did not return compiledTask. ` +
            `The compiler MUST return compiledTask in the response. ` +
            `This is a backend bug, not a frontend issue.`
          );
        }

        // ✅ Estrai CompiledTask dalla risposta (già verificato sopra che esiste)
        const compiledTask = compileResult.compiledTask;

        // ✅ LOGGING DETTAGLIATO: Mostra struttura completa del CompiledTask
        console.log('[DDEBubbleChat] 📋 Available tasks in compileResult (TaskInstance mode):', {
          count: 1, // ✅ TaskInstance mode restituisce un solo CompiledTask
          compiledTask: {
            id: compiledTask.id,
            debug: compiledTask.debug, // ✅ AGGIUNGI: mostra tutto debug
            originalTaskId: compiledTask.debug?.originalTaskId,
            OriginalTaskId: compiledTask.debug?.OriginalTaskId, // ✅ AGGIUNGI: prova anche PascalCase
            taskType: compiledTask.taskType,
            fullTask: compiledTask // ✅ AGGIUNGI: mostra task completo per debug
          }
        });

        console.log('[DDEBubbleChat] 📋 Found CompiledTask:', {
          id: compiledTask.id,
          taskType: compiledTask.taskType,
          hasSteps: !!compiledTask.steps,
          stepsCount: compiledTask.steps?.length || 0,
          hasSubTasks: !!compiledTask.subTasks,
          subTasksCount: compiledTask.subTasks?.length || 0,
          debug: compiledTask.debug,
          idMatchesInstance: compiledTask.id === taskForCompilation.id // ✅ DEVE essere true
        });

        // ✅ NEW: Invia direttamente CompiledUtteranceTask (non serve più conversione)
        console.log('[DDEBubbleChat] 📋 SAVING DIALOG (CompiledUtteranceTask):', {
          projectId,
          dialogVersion,
          locale: projectLanguage,
          compiledTaskId: compiledTask.id,
          compiledTaskStepsCount: compiledTask.steps?.length || 0,
          compiledTaskHasSubTasks: !!compiledTask.subTasks && compiledTask.subTasks.length > 0,
          compiledTaskKeys: Object.keys(compiledTask)
        });

        const saveRequestBody = {
          projectId: projectId,
          dialogVersion: dialogVersion,
          runtimeTask: compiledTask // ✅ Backend accetta sia CompiledUtteranceTask che RuntimeTask (retrocompatibilità)
        };

        console.log('[DDEBubbleChat] 📋 SAVE REQUEST BODY:', {
          projectId: saveRequestBody.projectId,
          dialogVersion: saveRequestBody.dialogVersion,
          compiledTaskId: saveRequestBody.runtimeTask.id,
          compiledTaskStepsCount: saveRequestBody.runtimeTask.steps?.length || 0
        });

        const saveResponse = await fetch(`${baseUrl}/api/runtime/dialog/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveRequestBody)
        });

        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.error('[DDEBubbleChat] ❌ Failed to save dialog:', saveResponse.status, errorText);
          throw new Error(`Failed to save dialog: ${saveResponse.statusText} - ${errorText}`);
        }

        // ✅ Check if response has content before parsing JSON
        const saveResponseText = await saveResponse.text();
        if (!saveResponseText || saveResponseText.trim().length === 0) {
          console.warn('[DDEBubbleChat] ⚠️ Empty response from save dialog endpoint, assuming success');
          // Assume success if response is empty (backend might return 200 with no body)
        } else {
          try {
            const saveResult = JSON.parse(saveResponseText);
            console.log('[DDEBubbleChat] 📋 Dialog saved:', {
              success: saveResult.success,
              projectId: saveResult.projectId,
              dialogVersion: saveResult.dialogVersion
            });
          } catch (jsonError) {
            console.error('[DDEBubbleChat] ❌ Failed to parse save response JSON:', jsonError);
            console.error('[DDEBubbleChat] Response text:', saveResponseText.substring(0, 200));
            // Continue anyway - the save might have succeeded even if response parsing failed
          }
        }

        // ✅ STATELESS: STEP 3: Avvia la sessione
        // ✅ CRITICAL: Passa traduzioni nella richiesta per garantire che il backend usi quelle più aggiornate
        const projectTranslationsContext = (window as any).__projectTranslationsContext;
        const allTranslations = projectTranslationsContext ? projectTranslationsContext.translations : {};

        // ✅ ARCHITECTURAL FIX: Filtra traduzioni usando materializedTree (stesso TaskTree dell'editor)
        // Questo garantisce che i GUID estratti siano identici a quelli usati dall'editor
        const runtimeTranslations = filterRuntimeTranslations(
          allTranslations,
          materializedTree, // ✅ Passa TaskTree invece di Task
          referencedTemplates
        );

        // 🔍 DEBUG: Verifica traduzioni inviate al runtime backend
        console.log('[DDEBubbleChat] 🔍 DEBUG Translations sent to runtime backend', {
          taskInstanceId: taskInstance.id,
          runtimeTranslationsCount: Object.keys(runtimeTranslations).length,
          runtimeTranslationsGuids: Object.keys(runtimeTranslations),
          runtimeTranslationsSample: Object.entries(runtimeTranslations).slice(0, 10).map(([k, v]) => ({
            guid: k,
            text: String(v).substring(0, 100),
            isRuntimePattern: k.startsWith('runtime.')
          }))
        });

        const requestBody = {
          projectId: projectId,
          dialogVersion: dialogVersion, // ✅ Versione reale del progetto
          locale: projectLanguage, // ✅ Locale invece di language
          translations: runtimeTranslations // ✅ CRITICAL: Passa traduzioni aggiornate dalla memoria
        };

        // ✅ CRITICAL: Log per debug - verifica traduzioni passate
        console.log('[DDEBubbleChat] 🔍 Request body with translations:', {
          projectId,
          dialogVersion,
          locale: projectLanguage,
          translationsCount: Object.keys(runtimeTranslations).length,
          sampleTranslations: Object.entries(runtimeTranslations).slice(0, 10).map(([k, v]) => ({
            key: k,
            text: String(v).substring(0, 100)
          })),
          requestBodyPreview: JSON.stringify(requestBody).substring(0, 500)
        });

        const startResponse = await fetch(`${baseUrl}/api/runtime/task/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        // ✅ Log rimosso: troppo verboso

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          console.error('[DDEBubbleChat] ❌ Backend error:', {
            status: startResponse.status,
            statusText: startResponse.statusText,
            errorText
          });
          setMessages([]);
          throw new Error(`Backend server not available: ${startResponse.statusText} - ${errorText}`);
        }

        // ✅ Verifica che la risposta abbia contenuto prima di fare parsing JSON
        const startResponseText = await startResponse.text();

        if (!startResponseText || startResponseText.trim().length === 0) {
          console.error('[DDEBubbleChat] ❌ Empty response from backend');
          throw new Error('Backend returned empty response');
        }

        // ✅ Log rimosso: troppo verboso

        let responseData: any;
        try {
          responseData = JSON.parse(startResponseText);
          // ✅ Log rimosso: troppo verboso
        } catch (parseError) {
          console.error('[DDEBubbleChat] Failed to parse JSON response:', parseError);
          console.error('[DDEBubbleChat] Response text:', startResponseText);
          throw new Error(`Failed to parse backend response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        const { sessionId: newSessionId } = responseData;

        // ✅ LOG: Verifica che sessionId sia valido
        if (!newSessionId) {
          console.error('[DDEBubbleChat] ❌ Backend returned empty sessionId');
          throw new Error('Backend returned empty sessionId');
        }

        console.log('[DDEBubbleChat] ✅ Session started successfully:', {
          sessionId: newSessionId,
          sessionIdType: typeof newSessionId,
          sessionIdLength: String(newSessionId).length
        });

        setSessionId(newSessionId);

        // ✅ NUOVO: SSE stream diretto da VB.NET backend
        const eventSource = new EventSource(`${baseUrl}/api/runtime/task/session/${newSessionId}/stream`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          sessionStartingRef.current = false;
        };

        // Handle messages from backend
        // ❌ CRITICAL: ONLY add messages that come from backend - NO frontend logic
        eventSource.addEventListener('message', (e: MessageEvent) => {
          try {
            const msg = JSON.parse(e.data);

            // Only add message if it has actual text from backend
            const messageText = msg.text || msg.message || '';
            if (!messageText.trim()) {
              return;
            }

            // Determine message type from backend data
            const stepType = msg.stepType || 'ask';
            const textKey = msg.textKey || msg.key;

            // ✅ LOG: Messaggio mostrato in chat
            console.log('[Chat] 💬 Message displayed:', {
              text: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
              stepType,
              textKey: textKey || 'N/A'
            });

            // ❌ ONLY backend can determine messages - frontend just displays them
            setMessages((m) => [...m, {
              id: generateMessageId('bot'),
              type: 'bot',
              text: messageText,
              stepType: stepType as any,
              textKey: textKey,
              color: getStepColor(stepType)
            }]);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing message', error);
            // ❌ Do NOT create fallback messages - if backend fails, show nothing
          }
        });

        // Handle waiting for input
        eventSource.addEventListener('waitingForInput', (e: MessageEvent) => {
          try {
            void JSON.parse(e.data);
            console.log('[MOTORE] ⏳ Waiting for input');
            setIsWaitingForInput(true);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing waitingForInput', error);
          }
        });

        // Handle state updates
        eventSource.addEventListener('stateUpdate', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);

            // ✅ LOG: Verifica se stateUpdate contiene dati estratti
            console.log('[DDEBubbleChat] 📊 stateUpdate received:', {
              hasExtractedData: !!data.extractedData,
              hasExtractedValues: !!data.extractedValues,
              hasData: !!data.data
            });

            // ✅ Se stateUpdate contiene dati estratti, aggiorna il messaggio utente più recente
            if (data.extractedData || data.extractedValues || data.data) {
              const extractedData = data.extractedData || data.extractedValues || data.data;

              // Converti i dati estratti nel formato ExtractedValue[]
              const convertToExtractedValues = (value: any): any[] => {
                if (!value || typeof value !== 'object') return [];
                const result: any[] = [];
                Object.entries(value).forEach(([key, val]) => {
                  result.push({
                    variable: key,
                    semanticValue: val,
                    linguisticValue: typeof val === 'string' ? val : undefined
                  });
                });
                return result;
              };

              const extractedValues = convertToExtractedValues(extractedData);

              // ✅ CRITICAL: Aggiorna SOLO se ci sono dati estratti E sono diversi da quelli esistenti
              if (extractedValues.length > 0) {
                setMessages((prev) => {
                  // Trova l'ultimo messaggio utente (compat ES2020: niente findLastIndex)
                  let lastUserIndex = -1;
                  for (let i = prev.length - 1; i >= 0; i--) {
                    const m = prev[i];
                    if (m.type === 'user' && m.text === sentTextRef.current) {
                      lastUserIndex = i;
                      break;
                    }
                  }

                  if (lastUserIndex === -1) {
                    console.log('[DDEBubbleChat] ⚠️ No matching user message found');
                    return prev; // ✅ Non cambiare lo stato se non c'è match
                  }

                  const existingMessage = prev[lastUserIndex];
                  const oldValues = JSON.stringify(existingMessage.extractedValues || []);
                  const newValues = JSON.stringify(extractedValues);

                  // ✅ CRITICAL: Aggiorna SOLO se i valori sono realmente cambiati
                  if (oldValues === newValues) {
                    console.log('[DDEBubbleChat] ⏭️ Extracted values unchanged, skipping update');
                    return prev; // ✅ Non cambiare lo stato → evita re-render
                  }

                  console.log('[DDEBubbleChat] ✅ Updating user message with extracted values:', {
                    messageId: existingMessage.id,
                    extractedValuesCount: extractedValues.length,
                    oldValuesCount: existingMessage.extractedValues?.length || 0
                  });

                  // ✅ Aggiorna solo se i valori sono cambiati
                  const updated = [...prev];
                  updated[lastUserIndex] = {
                    ...existingMessage,
                    extractedValues
                  };
                  return updated;
                });
              }
            }

            // ✅ STATELESS: Log aggiornamento stato
            // State updates are handled by backend
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing stateUpdate', error);
          }
        });

        // Handle completion
        // ❌ CRITICAL: Only show success message if backend sends it - NO frontend-generated messages
        eventSource.addEventListener('complete', (e: MessageEvent) => {
          try {
            const result = JSON.parse(e.data);
            console.log('[MOTORE] 🎉 Task completed');
            // ❌ Only add message if backend explicitly sends a message in the result
            // Do NOT generate frontend messages like "✅ Dati raccolti con successo!"
            if (result.success && result.message) {
              // ✅ LOG: Messaggio di completamento mostrato in chat
              console.log('[Chat] 💬 Completion message displayed:', {
                text: result.message.substring(0, 100) + (result.message.length > 100 ? '...' : ''),
                stepType: 'success'
              });

              setMessages((m) => [...m, {
                id: generateMessageId('bot'),
                type: 'bot',
                text: result.message,
                stepType: 'success',
                color: getStepColor('success')
              }]);
            }
            setIsWaitingForInput(false);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing complete', error);
            // ❌ Do NOT create fallback messages - if backend fails, show nothing
          }
        });

        // Handle errors
        eventSource.addEventListener('error', (e: MessageEvent) => {
          try {
            if (e.data) {
              const errorData = JSON.parse(e.data);
              setBackendError(errorData.error || 'Backend error');
            }
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing error event', error);
          }
        });

        eventSource.onerror = (error) => {
          console.error('[MOTORE] ❌ SSE connection error:', error);
          if (eventSource.readyState === EventSource.CLOSED) {
            // Clear messages when connection is closed - backend is not available
            setMessages([]);
            setBackendError('Connection to backend server closed. Is VB.NET server running on port 5000?');
            setIsWaitingForInput(false);
          }
        };
      } catch (error) {
        console.error('[DDEBubbleChat] Backend session error', error);
        // Clear any existing messages when connection fails
        setMessages([]);
        setBackendError(error instanceof Error ? error.message : 'Failed to connect to backend server. Is VB.NET server running on port 5000?');
        setIsWaitingForInput(false);
        // ✅ Reset sessionStartingRef on error to allow retry
        sessionStartingRef.current = false;
        // ❌ NON resettare lastSessionKeyRef - deve persistere per bloccare duplicati
      }
    };

    // ✅ Only start session if not already starting and conditions are met
    if (!sessionStartingRef.current && task?.id && projectId) {
      console.log('[DDEBubbleChat] 🚀 Starting session', {
        taskId: task?.id,
        projectId: projectId,
        sessionStarting: sessionStartingRef.current
      });
      startSession();
    } else {
      // ✅ Log essenziale: mostra perché la sessione non parte
      if (sessionStartingRef.current) {
        console.log('[DDEBubbleChat] ⏸️ Session already starting, skipping');
      } else if (!task?.id) {
        console.warn('[DDEBubbleChat] ⚠️ Cannot start session: task.id is missing');
      } else if (!projectId) {
        console.warn('[DDEBubbleChat] ⚠️ Cannot start session: projectId is missing');
      }
    }

    // Cleanup on unmount
    return () => {
      // ✅ Reset sessionStartingRef (per permettere nuove sessioni)
      sessionStartingRef.current = false;
      // ❌ NON resettare lastSessionKeyRef qui - deve persistere per bloccare duplicati
      // Il ref verrà resettato solo quando task.id o projectId cambiano realmente
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sessionId) {
        const baseUrl = 'http://localhost:5000';

        // ✅ STATELESS: Log eliminazione sessione
        // Session cleanup

        fetch(`${baseUrl}/api/runtime/task/session/${sessionId}`, {
          method: 'DELETE'
        }).catch(() => { });
      }
    };
  }, [task?.id, projectId, mode, resetCounter, taskTree, translations, isFlowMode]);

  // Clear input when sent text appears as a user message
  React.useEffect(() => {
    if (sentTextRef.current && messages.length > 0) {
      const matchingMessage = [...messages]
        .reverse()
        .find(m => m.type === 'user' && m.text === sentTextRef.current);

      if (matchingMessage) {
        setInlineDraft('');
        sentTextRef.current = '';
        if (isFlowMode) {
          requestAnimationFrame(() => {
            getFlowFocusManager().tryFocusChatInput(inlineInputRef.current);
          });
        } else {
          chatFocusDebug('clearSentDraft:matched', {
            messagesLen: messages.length,
            active: describeElement(document.activeElement),
          });
          requestAnimationFrame(() => ensureInlineFocus());
        }
      }
    }
  }, [messages, setInlineDraft, ensureInlineFocus, isFlowMode]);

  // Task mode: scroll input into view on new messages. Flow mode: no scrollIntoView on input (orchestrator scrolls only when tryFocusChatInput runs).
  React.useEffect(() => {
    if (isFlowMode) return;
    const rafId = requestAnimationFrame(() => {
      chatFocusDebug('messagesScroll:raf', {
        messagesLength: messages.length,
        activeBefore: describeElement(document.activeElement),
      });
      try {
        inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch { }
    });
    return () => cancelAnimationFrame(rafId);
  }, [messages.length, isFlowMode]);

  // ✅ ARCHITECTURAL: Handle user input - branch by mode
  const handleSend = async (text: string) => {
    const trimmed = String(text || '').trim();

    if (!trimmed) {
      console.warn('[DDEBubbleChat] ⚠️ Empty input, ignoring');
      return;
    }

    // ✅ Flow mode: use dedicated hook handler (id stabile per DebuggerStep.clientMessageId)
    if (isFlowMode) {
      const userId = generateMessageId('user');
      setMessages((prev) => [
        ...prev,
        {
          id: userId,
          type: 'user',
          text: trimmed,
          matchStatus: 'match',
        },
      ]);
      sentTextRef.current = trimmed;
      await flowModeChat.handleUserInput(trimmed, userId);
      return;
    }

    // ✅ Task mode: existing SSE logic
    // ✅ LOG: Verifica sessionId prima di inviare
    console.log('[DDEBubbleChat] 🔍 handleSend check:', {
      trimmed,
      sessionId,
      hasSessionId: !!sessionId,
      sessionIdType: typeof sessionId,
      isWaitingForInput
    });

    // Add user message immediately
    setMessages((prev) => [...prev, {
      id: generateMessageId('user'),
      type: 'user',
      text: trimmed,
      matchStatus: 'match'
    }]);

    // Freeze text for input clearing
    sentTextRef.current = trimmed;

    // ✅ VB.NET backend engine
    if (!sessionId) {
      console.error('[DDEBubbleChat] ❌ No sessionId available - session may not be initialized');
      setBackendError('Session not initialized. Please wait for the session to start or click Reset.');
      return;
    }

    try {
      console.log('[MOTORE] 📤 Sending input:', trimmed);

      // ✅ LOG: Messaggio utente mostrato in chat
      console.log('[Chat] 💬 User message displayed:', {
        text: trimmed.substring(0, 100) + (trimmed.length > 100 ? '...' : '')
      });

      // ✅ EXISTING: Send input to backend VB.NET
      // ✅ Runtime: Use compiled task from repository (no recompilation on every input)
      const baseUrl = 'http://localhost:5000';
      const inputUrl = `${baseUrl}/api/runtime/task/session/${sessionId}/input`;

      console.log('[DDEBubbleChat] 📤 Sending input to backend:', {
        url: inputUrl,
        sessionId,
        input: trimmed
      });

      // ✅ Runtime: Send only input - backend will load compiled task from repository
      const requestBody = { input: trimmed };

      const response = await fetch(inputUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send input: ${response.statusText} - ${errorText}`);
      }

      console.log('[MOTORE] ✅ Input sent successfully');

      // ✅ Lo stato isWaitingForInput verrà gestito dall'evento SSE waitingForInput
      // Non impostiamo false qui perché il backend potrebbe ancora processare l'input
      // e inviare un nuovo evento waitingForInput dopo aver eseguito il messaggio di risposta
    } catch (error) {
      console.error('[MOTORE] ❌ Error sending input:', error instanceof Error ? error.message : 'Unknown error');
      setBackendError(error instanceof Error ? error.message : 'Failed to send input to backend');
      // ✅ In caso di errore, riabilita l'input per permettere un nuovo tentativo
      setIsWaitingForInput(true);
    }
  };

  // Reset function - restart session with same task
  const handleReset = async () => {
    // ✅ Flow mode: hard restart via toolbar actions (same as Restart button)
    if (isFlowMode) {
      await debuggerActions.restart();
      return;
    }

    // ✅ Task mode: existing SSE reset logic
    // Close existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Delete session on backend
    if (sessionId) {
      const baseUrl = 'http://localhost:5000';
      fetch(`${baseUrl}/api/runtime/task/session/${sessionId}`, {
        method: 'DELETE'
      }).catch(() => { });
    }

    // Reset all state
    setMessages([]);
    messageIdCounter.current = 0;
    setBackendError(null);
    setIsWaitingForInput(false);
    sentTextRef.current = '';
    setSessionId(null);

    // ✅ CRITICAL: Reset refs to allow useEffect to restart session
    sessionStartingRef.current = false;
    lastSessionKeyRef.current = null; // Reset to allow new session start

    // ✅ CRITICAL: Increment reset counter to trigger useEffect re-run
    setResetCounter(prev => prev + 1);

    // Session will be restarted automatically by useEffect when resetCounter changes
  };

  const waitForNextBotMessage = React.useCallback(
    async (afterBotCount: number, timeoutMs = 12000): Promise<Message | null> => {
      const startedAt = Date.now();
      const poll = async (): Promise<Message | null> => {
        const bots = messagesRef.current.filter((m) => m.type === 'bot');
        if (bots.length > afterBotCount) {
          return bots[bots.length - 1] || null;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
        return poll();
      };
      return poll();
    },
    []
  );

  const sendRef = React.useRef<(text: string) => Promise<void>>(async () => {});
  const resetRef = React.useRef<() => Promise<void>>(async () => {});
  sendRef.current = handleSend;
  resetRef.current = handleReset;

  React.useEffect(() => {
    if (!onRuntimeBridgeReady) return;
    const bridge: DebuggerRuntimeBridge = {
      restart: async () => {
        await resetRef.current();
      },
      waitUntilWaitingForInput: async (timeoutMs = 20000) => {
        const startedAt = Date.now();
        const pollMs = 50;
        while (Date.now() - startedAt < timeoutMs) {
          if (effectiveWaitingForInputRef.current) return;
          await new Promise<void>((resolve) => {
            setTimeout(resolve, pollMs);
          });
        }
        throw new Error(
          'Timeout waiting for session to accept input (waitingForInput not observed).',
        );
      },
      sendUserInput: async (input: string) => {
        await sendRef.current(input);
      },
      getMessages: () => [...messagesRef.current],
      waitForNextBotMessage,
    };
    onRuntimeBridgeReady(bridge);
    return () => onRuntimeBridgeReady(null);
  }, [onRuntimeBridgeReady, waitForNextBotMessage]);

  return (
    <div ref={chatInteractionRootRef} className={`h-full flex flex-col bg-white ${combinedClass}`}>
      <div className="border-b border-lime-800/60 px-3 py-2 pr-10 bg-lime-400/95 text-slate-900 relative">
        {onClosePanel && (
          <button
            type="button"
            onClick={onClosePanel}
            className="absolute top-1.5 right-2 z-10 p-0.5 rounded text-slate-900 hover:bg-lime-500/50 transition-colors"
            title="Chiudi pannello"
            aria-label="Chiudi pannello"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          {isFlowMode ? (
            <div className="min-w-0 flex-1 flex items-center gap-2 text-sm font-semibold leading-5">
              <Workflow size={15} className="text-sky-800 flex-shrink-0" />
              <span className="break-words whitespace-normal">{executionParts.flowName}</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isFlowMode ? (
              <>
                <DebuggerToolbar
                  state={dbgToolbarState}
                  isRestarting={flowModeChat.isRestarting}
                  playDisabled={debuggerBlockedByCompile}
                  onPlay={() => {
                    void debuggerActions.play();
                  }}
                  onClear={() => {
                    void debuggerActions.clear();
                  }}
                  onRestart={() => {
                    void debuggerActions.restart();
                  }}
                />
                <span className="inline-block w-3 shrink-0" aria-hidden />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void handleReset();
                  }}
                  disabled={false}
                  className="p-1.5 rounded bg-slate-900 text-lime-300 hover:bg-slate-800 transition-colors"
                  title="Riavvia esecuzione"
                  aria-label="Riavvia esecuzione"
                >
                  <RotateCcw size={16} />
                </button>
                <span className="inline-block w-3 shrink-0" aria-hidden />
              </>
            )}
            {onToggleUseCasePanel && (
              <button
                type="button"
                onClick={onToggleUseCasePanel}
                className="p-1.5 rounded bg-slate-900 text-lime-300 hover:bg-slate-800 transition-colors"
                title="Show/Hide Use Cases"
                aria-label="Show/Hide Use Cases"
              >
                <UseCasesPanelIcon size={16} className="text-lime-300" />
              </button>
            )}
            {onSaveUseCase && (
              <button
                type="button"
                onClick={() => {
                  const suggestedKey = String(executionParts.flowName || executionFlowName || '')
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, '.');
                  onSaveUseCase({
                    suggestedKey,
                    messages: [...messagesRef.current],
                  });
                }}
                className="p-1.5 rounded bg-slate-900 text-lime-300 hover:bg-slate-800 transition-colors ml-1"
                title="Salva conversazione come use case"
                aria-label="Salva conversazione come use case"
              >
                <Save size={16} />
              </button>
            )}
          </div>
        </div>
        {displayChatError && !(isFlowMode && debuggerBlockedByCompile) && (
          <div className="mt-1 flex items-center gap-2 text-red-900 text-xs min-w-0">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span className="break-words whitespace-normal">{displayChatError}</span>
          </div>
        )}
      </div>
      {/* ✅ NEW: Tabs for preview mode */}
      {mode === 'preview' && activeScenario && onScenarioChange && (
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #334155',
            backgroundColor: '#1e293b',
          }}
        >
          {(['happy', 'partial', 'error'] as const).map((scenario) => (
            <button
              key={scenario}
              onClick={() => onScenarioChange(scenario)}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: activeScenario === scenario ? '#0f172a' : 'transparent',
                color: activeScenario === scenario ? '#e2e8f0' : '#94a3b8',
                border: 'none',
                borderBottom: activeScenario === scenario ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeScenario === scenario ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              {scenario === 'happy' && 'Happy Path'}
              {scenario === 'partial' && 'Frasi Parziali'}
              {scenario === 'error' && 'Errori'}
            </button>
          ))}
        </div>
      )}

      {isFlowMode && debuggerBlockedByCompile ? (
        <DebuggerErrorList errors={reportCompileErrors} flows={workspaceFlows} className="flex-1 min-h-0" />
      ) : (
      <>
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${combinedClass}`} ref={scrollContainerRef}>
        {displayMessages.map((m) => {
          if (isFlowMode && m.type === 'user') {
            const step =
              flowModeChat.debuggerSteps.find((s) => s.clientMessageId === m.id) ??
              [...flowModeChat.debuggerSteps].reverse().find((s) => s.utterance === m.text);
            return (
              <UserTurnCard
                key={m.id}
                message={m}
                step={step}
                expanded={flowExpandedUserId === m.id}
                onToggleExpand={() => setFlowExpandedUserId((prev) => (prev === m.id ? null : m.id))}
                onStepNoteChange={(stepId: string, note: string) =>
                  flowModeChat.updateDebuggerStep(stepId, { note })
                }
                onReplayHighlight={(step: DebuggerStep) => flowModeChat.replayDebuggerHighlight(step)}
                onEditResponse={handleFlowUserEditResponse}
              />
            );
          }
          if (isFlowMode && m.type === 'bot') {
            return <FlowBotTurnLabel key={m.id} message={m} onEditTranslation={handleEdit} />;
          }
          if (m.type === 'user') {
            return (
              <UserMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          if (m.type === 'bot') {
            return (
              <BotMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                hoveredId={hoveredId}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          if (m.type === 'system') {
            return (
              <div key={m.id} className={`flex items-center gap-2 text-yellow-700 ${combinedClass}`}>
                <AlertTriangle size={12} className="flex-shrink-0 text-yellow-600" />
                <span>{m.text}</span>
              </div>
            );
          }

          return null;
        })}
        {mode === 'interactive' &&
          (!isFlowMode || effectiveIsWaitingForInput) &&
          !(isFlowMode && debuggerBlockedByCompile) && (
          <div className={`bg-white border border-gray-300 rounded-lg p-2 shadow-sm max-w-xs lg:max-w-md w-full mt-3 ${combinedClass}`}>
            <style dangerouslySetInnerHTML={{
              __html: `
            .chat-simulator-input-placeholder::placeholder {
              font-family: inherit !important;
              font-size: inherit !important;
            }
          `}} />
            <input
              type="text"
              className={`chat-simulator-input-placeholder w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 ${combinedClass}`}
              style={{
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
              ref={inlineInputRef}
              onFocus={() => {
                if (isFlowMode) {
                  getFlowFocusManager().requestFocus('chat');
                  chatFocusDebug('inlineInput:onFocus', {
                    active: describeElement(document.activeElement),
                  });
                  return;
                }
                chatFocusDebug('inlineInput:onFocus', {
                  active: describeElement(document.activeElement),
                });
                try {
                  inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch {
                  /* noop */
                }
              }}
              placeholder={
                isFlowMode && dbgToolbarState === 'idle'
                  ? 'Premi Play nella toolbar per avviare il debugger…'
                  : effectiveIsWaitingForInput
                    ? 'Type response...'
                    : 'Waiting for backend...'
              }
              value={inlineDraft}
              onChange={(e) => {
                if (isFlowMode) {
                  getFlowFocusManager().requestFocus('chat');
                }
                setInlineDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && effectiveIsWaitingForInput) {
                  const v = inlineDraft.trim();
                  if (!v) return;
                  sentTextRef.current = v;
                  void handleSend(v);
                }
              }}
              disabled={!effectiveIsWaitingForInput}
            />
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
