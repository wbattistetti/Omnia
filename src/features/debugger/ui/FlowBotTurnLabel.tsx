/**
 * Messaggio bot in flow mode: icona + testo; hover → matita per aprire l’editor traduzione (se c’è textKey).
 * Errori di compilazione con `compilationFixError`: pulsante Fix come nel debugger Run.
 * Correggi stile (AI Agent): analisi IA vs catalogo + «Esempio di risposta corretta»; il raffinamento JSON/motor resta nel Task Editor (tab Use case).
 * Chiave inglese: apre Task Editor (tab Use case), espande «Correggi stile» e avvia analisi IA vs catalogo use case.
 */
import React from 'react';
import { Bot, ChevronDown, Loader2, Pencil, Wrench } from 'lucide-react';
import { executeNavigationIntent, resolveNavigationIntent } from '@domain/compileErrors';
import { getStepIcon } from '@responseEditor/ChatSimulator/chatSimulatorUtils';
import type { Message } from '@components/ChatSimulator/UserMessage';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';
import { FlowBackendCallInvocationsPanel } from '@features/debugger/ui/FlowBackendCallInvocationsPanel';
import { FlowConvaiWebhookInvocationsPanel } from '@features/debugger/ui/FlowConvaiWebhookInvocationsPanel';
import { DebuggerBotStyleRulePanel } from '@features/debugger/ui/DebuggerBotStyleRulePanel';
import {
  analyzeDebuggerTurnUseCaseApi,
  annotateAIAgentAssistantMessageForJsonApi,
  type AnalyzeDebuggerTurnUseCaseResult,
} from '@services/aiAgentDesignApi';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
} from '@taskEditor/EditorHost/editors/aiAgentEditor/constants';
import { buildTaskSnapshotFromRaw } from '@taskEditor/EditorHost/editors/aiAgentEditor/buildTaskSnapshot';
import { mergeUseCaseGlobalStyleContract } from '@taskEditor/EditorHost/editors/aiAgentEditor/mergeUseCaseGlobalStyleContract';
import { resolveAiAgentOutputLanguage } from '@taskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentOutputLanguage';
import {
  OMNIA_ACTIVATE_AI_AGENT_USE_CASES_TAB,
  OMNIA_AI_AGENT_REHYDRATE_FROM_REPO,
} from '@taskEditor/EditorHost/editors/aiAgentEditor/aiAgentDockPanelIds';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  newAgentUseCaseTurnId,
  parseAgentUseCasesJson,
  serializeUseCases,
} from '@types/aiAgentUseCases';
import { normalizeUseCaseSortOrderLogical } from '@taskEditor/EditorHost/editors/aiAgentEditor/useCaseHierarchy';
import {
  resolveCatalogLabelForTaskUseCase,
  resolveCatalogPayoffForTaskUseCase,
  resolveDebuggerPrefillCorrectReply,
} from '@features/debugger/debuggerAssistCatalogHelpers';

const styleExtensionShell =
  'w-full overflow-hidden rounded-lg border border-sky-400/60 bg-sky-500/[0.07] shadow-inner ' +
  'dark:border-sky-500/45 dark:bg-sky-950/[0.38] ' +
  'backdrop-blur-md supports-[backdrop-filter]:bg-sky-500/[0.06] dark:supports-[backdrop-filter]:bg-sky-950/30';

const PENDING_UC_SELECT_PREFIX = 'omnia.pendingAiAgentUseCaseSelection.';

function emitOpenTaskEditorUseCasesTab(detail: {
  taskId: string;
  type: TaskType;
  templateId: string | null;
  label?: string;
  flowId?: string | null;
}): void {
  document.dispatchEvent(
    new CustomEvent('taskEditor:open', {
      bubbles: true,
      detail: {
        id: detail.taskId,
        type: detail.type,
        templateId: detail.templateId ?? undefined,
        label: detail.label,
        name: detail.label,
        flowId: detail.flowId ?? undefined,
      },
    })
  );
  window.setTimeout(() => {
    document.dispatchEvent(
      new CustomEvent(OMNIA_ACTIVATE_AI_AGENT_USE_CASES_TAB, {
        bubbles: true,
        detail: { taskInstanceId: detail.taskId },
      })
    );
  }, 450);
}

function resolveGlobalStyleContractForTask(task: Parameters<typeof buildTaskSnapshotFromRaw>[0]): string {
  const snap = buildTaskSnapshotFromRaw(task);
  const styleId =
    snap.agentUseCaseGlobalStyleId.trim() || DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID;
  const base =
    AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === styleId)?.contract ??
    AI_AGENT_GLOBAL_USE_CASE_STYLES[0].contract;
  return mergeUseCaseGlobalStyleContract(base, snap.agentUseCaseStyleLearningNotes.trim());
}

/** Titolo compatto del microbadge (stato IA vs catalogo; agente virtuale non espone ancora UC). */
function assistBadgeTitle(o: AnalyzeDebuggerTurnUseCaseResult['outcome']): string {
  switch (o) {
    case 'use_case_recognized':
      return 'Use case riconosciuto';
    case 'exists_but_not_recognized':
      return 'Use case in catalogo — risposta non allineata';
    case 'no_matching_use_case':
      return 'Use case non in catalogo';
    case 'runtime_divergence':
      return 'Divergenza agente / analisi';
    case 'uncertain':
    default:
      return 'Esito incerto';
  }
}

type AssistPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; data: AnalyzeDebuggerTurnUseCaseResult }
  | { phase: 'error'; message: string };

/** Scroll del contenitore chat (`overflow-y-auto`) per mostrare tutto il pannello espanso. */
function scrollPanelIntoOverflowParent(panel: HTMLElement, scrollParent: HTMLElement, marginPx = 12) {
  const p = panel.getBoundingClientRect();
  const c = scrollParent.getBoundingClientRect();
  if (p.bottom > c.bottom - marginPx) {
    scrollParent.scrollTop += p.bottom - c.bottom + marginPx;
  }
  if (p.top < c.top + marginPx) {
    scrollParent.scrollTop += p.top - c.top - marginPx;
  }
}

export function FlowBotTurnLabel(props: {
  message: Message;
  onEditTranslation: (messageId: string, currentText: string) => void;
  /** Flow debugger: save induced rules into TaskRepository for current project. */
  projectId?: string | null;
  /** User utterance immediately before this bot line (flow debugger). */
  priorUserTurnText?: string;
  /** Flow canvas id for taskEditor:open (optional). */
  debuggerFlowId?: string | null;
  /** Ref al contenitore scrollabile della lista messaggi (flow debugger). */
  flowDebuggerScrollParentRef?: React.RefObject<HTMLElement | null>;
}) {
  const {
    message,
    onEditTranslation,
    projectId,
    priorUserTurnText = '',
    debuggerFlowId = null,
    flowDebuggerScrollParentRef,
  } = props;
  const [stylePanelOpen, setStylePanelOpen] = React.useState(false);
  const [styleBlockedHint, setStyleBlockedHint] = React.useState<string | null>(null);
  const [assist, setAssist] = React.useState<AssistPhase>({ phase: 'idle' });
  const [assistDetailOpen, setAssistDetailOpen] = React.useState(false);
  const [addingUseCase, setAddingUseCase] = React.useState(false);
  const text = String(message.text || '').trim() || '(vuoto)';
  const canEdit = Boolean(message.textKey);
  const hasFix = Boolean(message.compilationFixError);

  const styleFixEligible = React.useMemo(() => {
    const tid = message.sourceTaskId?.trim();
    if (!tid) return false;
    const task = taskRepository.getTask(tid);
    return (
      task != null &&
      (task.type === TaskType.AIAgent || templateIdToTaskType(task.templateId) === TaskType.AIAgent)
    );
  }, [message.sourceTaskId]);

  const styleExtended =
    Boolean(stylePanelOpen && styleFixEligible && message.sourceTaskId?.trim());

  const flowPanelRootRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (!styleExtended) return;
    const panel = flowPanelRootRef.current;
    const parent = flowDebuggerScrollParentRef?.current ?? null;
    const run = () => {
      if (!panel) return;
      if (parent) {
        scrollPanelIntoOverflowParent(panel, parent);
      } else {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    const t = window.setTimeout(run, 100);
    return () => window.clearTimeout(t);
  }, [styleExtended, assist.phase, assistDetailOpen, flowDebuggerScrollParentRef]);

  React.useEffect(() => {
    setStylePanelOpen(false);
    setStyleBlockedHint(null);
    setAssist({ phase: 'idle' });
    setAssistDetailOpen(false);
  }, [message.id]);

  React.useEffect(() => {
    if (!styleBlockedHint) return;
    const t = window.setTimeout(() => setStyleBlockedHint(null), 5000);
    return () => window.clearTimeout(t);
  }, [styleBlockedHint]);

  const readProviderModel = React.useCallback(() => {
    const provider = (localStorage.getItem('omnia.aiProvider') || 'groq').toLowerCase();
    const model = localStorage.getItem('omnia.aiModel') || undefined;
    return { provider, model };
  }, []);

  const onRunAssistAnalysis = React.useCallback(async () => {
    const tid = message.sourceTaskId?.trim();
    if (!tid) {
      setAssist({ phase: 'error', message: 'Manca sourceTaskId sul messaggio.' });
      return;
    }
    const task = taskRepository.getTask(tid);
    if (!task) {
      setAssist({ phase: 'error', message: 'Task non trovato nel repository.' });
      return;
    }
    if (!projectId?.trim()) {
      setAssist({ phase: 'error', message: 'Manca projectId — impossibile aggiornare il task dopo Aggiungi.' });
      return;
    }
    setAssist({ phase: 'loading' });
    try {
      const snap = buildTaskSnapshotFromRaw(task);
      const contract = resolveGlobalStyleContractForTask(task);
      const { provider, model } = readProviderModel();
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const data = await analyzeDebuggerTurnUseCaseApi({
        userTurn: priorUserTurnText,
        assistantTurn: message.text || '',
        agentUseCasesJson: snap.agentUseCasesJson || '[]',
        globalStyleContract: contract,
        provider,
        model,
        outputLanguage,
      });
      setAssistDetailOpen(true);
      setAssist({ phase: 'done', data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssist({ phase: 'error', message: msg });
    }
  }, [
    message.sourceTaskId,
    message.text,
    priorUserTurnText,
    projectId,
    readProviderModel,
  ]);

  /** Chiave inglese: espandi Correggi stile, apri Task Editor sul tab Use case, avvia analisi IA. */
  const onWrenchDebuggerAssist = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const tid = message.sourceTaskId?.trim();
      if (!tid) {
        setStyleBlockedHint(
          'Il runtime non ha inviato il taskId sul messaggio (aggiorna e riavvia ApiServer).'
        );
        return;
      }
      const task = taskRepository.getTask(tid);
      if (!task) {
        setStyleBlockedHint('Task non trovato nel progetto caricato.');
        return;
      }
      if (!projectId?.trim()) {
        setStyleBlockedHint('Manca projectId — seleziona un progetto per l’analisi use case.');
        return;
      }
      setStyleBlockedHint(null);
      setStylePanelOpen(true);
      emitOpenTaskEditorUseCasesTab({
        taskId: task.id,
        type: task.type,
        templateId: task.templateId,
        label: typeof task.label === 'string' ? task.label : undefined,
        flowId: debuggerFlowId,
      });
      void onRunAssistAnalysis();
    },
    [debuggerFlowId, message.sourceTaskId, onRunAssistAnalysis, projectId]
  );

  const onFixStyleInTaskEditor = React.useCallback(() => {
    const tid = message.sourceTaskId?.trim();
    if (!tid) return;
    const task = taskRepository.getTask(tid);
    if (!task) return;
    if (assist.phase === 'done') {
      const ucId = assist.data.recognized_use_case_id?.trim();
      if (ucId) {
        try {
          sessionStorage.setItem(`${PENDING_UC_SELECT_PREFIX}${tid}`, ucId);
        } catch {
          /* ignore */
        }
      }
    }
    emitOpenTaskEditorUseCasesTab({
      taskId: task.id,
      type: task.type,
      templateId: task.templateId,
      label: typeof task.label === 'string' ? task.label : undefined,
      flowId: debuggerFlowId,
    });
  }, [assist, debuggerFlowId, message.sourceTaskId]);

  const onAddSuggestedUseCase = React.useCallback(async () => {
    if (assist.phase !== 'done') return;
    const sug = assist.data.suggested_use_case;
    if (!sug || (!sug.label.trim() && !sug.assistant_example_line.trim())) return;
    const tid = message.sourceTaskId?.trim();
    if (!tid) return;
    const task = taskRepository.getTask(tid);
    if (!task || !projectId?.trim()) return;

    setAddingUseCase(true);
    try {
      const snap = buildTaskSnapshotFromRaw(task);
      const existing = parseAgentUseCasesJson(snap.agentUseCasesJson);
      const contract = resolveGlobalStyleContractForTask(task);
      const styleId =
        snap.agentUseCaseGlobalStyleId.trim() || DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID;
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const { provider, model } = readProviderModel();

      const newUseCaseId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `uc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const turnId = newAgentUseCaseTurnId();
      const line =
        sug.assistant_example_line.trim() ||
        String(message.text || '').trim() ||
        sug.label.trim();

      let draft: AIAgentUseCase = {
        id: newUseCaseId,
        label: sug.label.trim() || 'Nuovo scenario',
        parent_id: null,
        sort_order: 0,
        refinement_prompt: '',
        style_id: styleId,
        payoff: sug.payoff.trim(),
        dialogue: [{ turn_id: turnId, role: 'assistant', content: line, editable: true }],
        notes: {
          behavior: sug.label.trim() || 'Scenario debugger',
          tone: contract.slice(0, 400),
        },
        bubble_notes: {},
      };

      try {
        const { content: annotated, motor } = await annotateAIAgentAssistantMessageForJsonApi({
          useCase: draft,
          turnId,
          provider,
          model,
          outputLanguage,
          globalStyleContract: contract,
          assistantMessageText: line,
        });
        draft = {
          ...draft,
          dialogue: draft.dialogue.map((t) =>
            t.turn_id === turnId
              ? {
                  ...t,
                  content: annotated,
                  motor_snapshot: { source_content: annotated, payload: motor },
                }
              : t
          ),
        };
      } catch {
        /* Designer può usare «Crea JSON» in editor */
      }

      const next = normalizeUseCaseSortOrderLogical([...existing, draft]);
      const ok = taskRepository.updateTask(
        task.id,
        { agentUseCasesJson: serializeUseCases(next) },
        projectId.trim()
      );
      if (!ok) {
        throw new Error('Aggiornamento task fallito.');
      }
      try {
        sessionStorage.setItem(`${PENDING_UC_SELECT_PREFIX}${task.id}`, newUseCaseId);
      } catch {
        /* ignore */
      }
      document.dispatchEvent(
        new CustomEvent(OMNIA_AI_AGENT_REHYDRATE_FROM_REPO, {
          bubbles: true,
          detail: { taskId: task.id },
        })
      );
      setAssist({ phase: 'idle' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAssist({ phase: 'error', message: msg });
    } finally {
      setAddingUseCase(false);
    }
  }, [assist, message.sourceTaskId, message.text, projectId, readProviderModel]);

  const onCompilationFix = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const err = message.compilationFixError;
      if (!err) return;
      try {
        await executeNavigationIntent(resolveNavigationIntent(err));
      } catch (errx) {
        console.error('[FlowBotTurnLabel] Fix navigation failed:', errx);
      }
    },
    [message.compilationFixError]
  );

  const bubbleTone =
    hasFix || message.stepType === 'error'
      ? 'border-amber-500/50 bg-amber-950/40 text-amber-50 dark:border-amber-500/45 dark:bg-amber-950/35'
      : canEdit
        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100/90 text-slate-900 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800'
        : 'border-slate-100 bg-slate-50/60 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200';

  const styleTooltipIneligible =
    !message.sourceTaskId?.trim()
      ? 'Correggi stile: il runtime non ha inviato il taskId sul messaggio (aggiorna e riavvia ApiServer).'
      : !taskRepository.getTask(message.sourceTaskId.trim())
        ? 'Correggi stile: task non trovato nel progetto caricato.'
        : 'Correggi stile: disponibile solo per righe di tipo AI Agent.';

  const toolbarBtn =
    'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 text-xs font-semibold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-transparent';

  const wrenchBorderless =
    'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 shadow-none ' +
    'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-transparent';

  const bubbleRowClass = styleExtended
    ? 'group relative flex items-start gap-2 border-0 bg-transparent px-3 py-2 pr-11 text-sm text-slate-900 dark:text-sky-50'
    : `group relative flex items-start gap-2 rounded-lg border px-3 py-2 pr-11 text-sm transition-colors ${bubbleTone}`;

  const botIconClass = styleExtended
    ? 'text-slate-600 dark:text-sky-300/90 shrink-0 mt-0.5'
    : 'text-slate-600 dark:text-slate-400 shrink-0 mt-0.5';

  const toolbarStripOpacity = styleExtended ? 'opacity-[0.55]' : 'opacity-[0.5]';

  const wrenchEligibleClass =
    styleFixEligible && styleExtended
      ? `${wrenchBorderless} text-sky-600 dark:text-sky-300`
      : styleFixEligible
        ? `${wrenchBorderless} text-slate-600 hover:bg-black/[0.06] dark:text-amber-200/90 dark:hover:bg-white/10`
        : `${toolbarBtn} border-amber-600/80 bg-amber-950/70 text-amber-200/90 hover:bg-amber-900/80 focus:ring-amber-500`;

  const wrenchTitle = styleFixEligible
    ? 'Apri Task Editor (Use case), Correggi stile e analisi IA sul catalogo'
    : styleTooltipIneligible;

  const bubbleRow = (
    <div className={bubbleRowClass}>
      <Bot size={16} className={botIconClass} aria-hidden />
      {message.stepType ? (
        <span className="shrink-0 mt-0.5 [&_svg]:text-amber-500">
          {getStepIcon(message.stepType, message.color)}
        </span>
      ) : null}
      <span className="flex-1 min-w-0 whitespace-pre-line break-words pr-1">{text}</span>

      <div
        className={`absolute top-0.5 right-0.5 bottom-0.5 z-[2] flex w-11 flex-col justify-center gap-1.5 p-0.5 ${toolbarStripOpacity} transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-auto`}
        role="toolbar"
        aria-label="Azioni messaggio"
      >
        {hasFix ? (
          <button
            type="button"
            onClick={onCompilationFix}
            className={`${toolbarBtn} border-amber-400/70 bg-amber-950/90 text-amber-100 hover:bg-amber-900/90 focus:ring-amber-400`}
            title="Apri correzione compilazione"
          >
            Fix
          </button>
        ) : null}
        <button
          type="button"
          aria-disabled={!styleFixEligible}
          disabled={assist.phase === 'loading'}
          title={wrenchTitle}
          aria-label={
            styleFixEligible ? 'Apri Task Editor, Correggi stile e analisi IA use case' : styleTooltipIneligible
          }
          className={`${wrenchEligibleClass} ${assist.phase === 'loading' ? 'opacity-70' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!styleFixEligible) {
              setStyleBlockedHint(styleTooltipIneligible);
              return;
            }
            if (assist.phase === 'loading') return;
            onWrenchDebuggerAssist(e);
          }}
        >
          {assist.phase === 'loading' ? (
            <Loader2 size={20} strokeWidth={2.5} className="animate-spin drop-shadow-sm" aria-hidden />
          ) : (
            <Wrench size={20} strokeWidth={2.5} className="drop-shadow-sm" aria-hidden />
          )}
        </button>
        {canEdit ? (
          <button
            type="button"
            className={`${toolbarBtn} border-slate-500/80 bg-slate-800/95 text-amber-100 hover:bg-slate-700/95 focus:ring-purple-400 dark:border-slate-500 dark:bg-slate-900/95 dark:text-amber-100`}
            title="Modifica traduzione"
            aria-label="Modifica traduzione"
            onClick={(e) => {
              e.stopPropagation();
              onEditTranslation(message.id, message.text);
            }}
          >
            <Pencil size={16} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );

  const assistTaskForDisplay =
    assist.phase === 'done' && message.sourceTaskId?.trim()
      ? taskRepository.getTask(message.sourceTaskId.trim())
      : null;
  const recognizedLabelDisplay =
    assist.phase === 'done'
      ? assist.data.recognized_use_case_label?.trim() ||
        resolveCatalogLabelForTaskUseCase(assistTaskForDisplay, assist.data.recognized_use_case_id)
      : null;

  const recognizedPayoffDisplay =
    assist.phase === 'done' && assist.data.recognized_use_case_id?.trim()
      ? resolveCatalogPayoffForTaskUseCase(assistTaskForDisplay, assist.data.recognized_use_case_id)
      : null;

  const suggestedPayoffDisplay =
    assist.phase === 'done' && assist.data.suggested_use_case?.payoff?.trim()
      ? assist.data.suggested_use_case.payoff.trim()
      : null;

  const assistExpandedTitle =
    assist.phase === 'done'
      ? assist.data.outcome === 'no_matching_use_case'
        ? assist.data.suggested_use_case?.label?.trim() || 'Use case non in catalogo'
        : recognizedLabelDisplay ||
          (assist.data.outcome === 'uncertain' ? 'Esito incerto' : null)
      : null;

  const assistScenarioBody =
    assist.phase === 'done'
      ? assist.data.outcome === 'no_matching_use_case'
        ? suggestedPayoffDisplay
        : recognizedPayoffDisplay
      : null;

  const prefillCorrectReply = React.useMemo(() => {
    if (assist.phase !== 'done') return null;
    return resolveDebuggerPrefillCorrectReply(assistTaskForDisplay, assist.data);
  }, [assist, assistTaskForDisplay]);

  const assistCollapsedPreview =
    assist.phase === 'done'
      ? assist.data.outcome === 'no_matching_use_case'
        ? assist.data.suggested_use_case?.label?.trim() || 'Use case non in catalogo'
        : recognizedLabelDisplay || ''
      : '';

  const assistCard =
    assist.phase === 'idle' ? null : assist.phase === 'loading' ? (
      <div className="border-t border-sky-400/25 px-3 py-2 text-left dark:border-sky-500/25">
        <p className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-sky-100/90">
          <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
          Sto analizzando il catalogo use case…
        </p>
      </div>
    ) : assist.phase === 'error' ? (
      <div className="border-t border-sky-400/25 px-3 py-2 text-left dark:border-sky-500/25 space-y-2">
        <p className="text-[11px] text-red-700 dark:text-red-300 whitespace-pre-wrap">{assist.message}</p>
        <button
          type="button"
          className="text-[10px] font-semibold text-sky-700 underline dark:text-sky-300"
          onClick={() => {
            setAssistDetailOpen(false);
            setAssist({ phase: 'idle' });
          }}
        >
          Chiudi
        </button>
      </div>
    ) : (
      <div className="border-t border-sky-400/25 px-3 py-1.5 dark:border-sky-500/25">
        <button
          type="button"
          className="flex w-full flex-col gap-0 rounded-md px-0 py-0.5 text-left transition-colors hover:bg-sky-950/25 dark:hover:bg-sky-950/40"
          aria-expanded={assistDetailOpen}
          onClick={() => setAssistDetailOpen((o) => !o)}
        >
          <div className="flex w-full items-start justify-between gap-2">
            <span className="rounded-md bg-violet-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100 shrink-0">
              {assistBadgeTitle(assist.data.outcome)}
            </span>
            <ChevronDown
              size={16}
              className={`mt-0.5 shrink-0 text-slate-500 transition-transform dark:text-sky-300/80 ${assistDetailOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </div>
          {assistDetailOpen && assistExpandedTitle ? (
            <p className="mt-0.5 w-full text-left text-[12px] font-semibold leading-tight text-slate-900 break-words dark:text-sky-50">
              {assistExpandedTitle}
            </p>
          ) : null}
          {!assistDetailOpen ? (
            assistCollapsedPreview ? (
              <p className="mt-0.5 min-w-0 max-w-full text-left text-[11px] font-medium leading-snug text-slate-800 break-words dark:text-sky-100/92 line-clamp-2">
                {assistCollapsedPreview}
              </p>
            ) : assist.data.summary_it ? (
              <p className="mt-0.5 min-w-0 max-w-full text-left text-[11px] leading-snug text-slate-700 break-words dark:text-sky-100/88 line-clamp-2">
                {assist.data.summary_it}
              </p>
            ) : (
              <span className="mt-0.5 text-left text-[10px] italic text-slate-500 dark:text-sky-400/85">
                Espandi per i dettagli
              </span>
            )
          ) : null}
        </button>
        {assistDetailOpen ? (
          <div className="mt-1 space-y-1 text-left">
            {assistScenarioBody ? (
              <p className="text-[11px] leading-snug text-slate-800 dark:text-sky-100/95">
                <span className="font-bold text-slate-900 dark:text-sky-50">Scenario</span>
                <span>{`: ${assistScenarioBody}`}</span>
              </p>
            ) : null}
            {assist.data.summary_it ? (
              <p className="text-[11px] leading-snug text-slate-800 dark:text-sky-50/95">{assist.data.summary_it}</p>
            ) : null}
            {assist.data.outcome === 'runtime_divergence' &&
            assist.data.runtime_agent_use_case_id &&
            assist.data.recognized_use_case_id ? (
              <div className="rounded-md border border-amber-600/45 bg-amber-950/25 px-2 py-1.5 text-[11px] dark:border-amber-500/40">
                <p className="font-semibold text-amber-100">Divergenza (runtime vs analisi)</p>
                <p className="mt-1 text-amber-50/95">
                  Agente:{' '}
                  {assist.data.runtime_agent_use_case_label?.trim() || assist.data.runtime_agent_use_case_id}
                </p>
                <p className="mt-0.5 text-amber-50/95">
                  Analisi IA: {recognizedLabelDisplay || assist.data.recognized_use_case_id}
                </p>
              </div>
            ) : null}
            {assist.data.suggested_use_case ? (
              <div className="rounded-md border border-slate-600/40 bg-slate-950/30 px-2 py-1.5 text-[11px] dark:border-slate-500/35">
                <div className="font-semibold text-slate-900 dark:text-sky-50">
                  {assist.data.suggested_use_case.label || '(senza titolo)'}
                </div>
                {assist.data.suggested_use_case.payoff ? (
                  <p className="mt-0.5 text-slate-700 dark:text-slate-300">{assist.data.suggested_use_case.payoff}</p>
                ) : null}
                {assist.data.suggested_use_case.assistant_example_line ? (
                  <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-sky-100/90">
                    {assist.data.suggested_use_case.assistant_example_line}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-0.5">
              {assist.data.suggested_use_case &&
              (assist.data.suggested_use_case.label.trim().length > 0 ||
                assist.data.suggested_use_case.assistant_example_line.trim().length > 0) ? (
                <button
                  type="button"
                  disabled={addingUseCase || !projectId?.trim()}
                  onClick={() => void onAddSuggestedUseCase()}
                  className="rounded-md bg-emerald-700 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                >
                  {addingUseCase ? 'Salvataggio…' : 'Aggiungi use case al task'}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-md border border-slate-500/50 px-2.5 py-1 text-[10px] font-semibold text-slate-700 dark:border-slate-500/60 dark:text-sky-200"
                onClick={() => {
                  setAssistDetailOpen(false);
                  setAssist({ phase: 'idle' });
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );

  return (
    <div
      ref={flowPanelRootRef}
      className="flex w-full max-w-xs lg:max-w-md xl:max-w-xl flex-col gap-0"
    >
      {styleExtended ? (
        <div className={styleExtensionShell}>
          {bubbleRow}
          {assistCard}
          {message.sourceTaskId ? (
            <DebuggerBotStyleRulePanel
              embedded
              sourceTaskId={message.sourceTaskId}
              prefillCorrectReply={prefillCorrectReply}
              onFixInTaskEditor={onFixStyleInTaskEditor}
            />
          ) : null}
        </div>
      ) : (
        bubbleRow
      )}
      {styleBlockedHint ? (
        <p className="mt-1 max-w-[min(100%,28rem)] text-[11px] leading-snug text-amber-600 dark:text-amber-400/95 px-0.5">
          {styleBlockedHint}
        </p>
      ) : null}
      {message.backendInvocations && message.backendInvocations.length > 0 ? (
        <FlowBackendCallInvocationsPanel invocations={message.backendInvocations} />
      ) : null}
      {message.convaiWebhookInvocations && message.convaiWebhookInvocations.length > 0 ? (
        <FlowConvaiWebhookInvocationsPanel invocations={message.convaiWebhookInvocations} />
      ) : null}
    </div>
  );
}
