/**
 * Use Case Composer: tree of scenarios, metadata fields, dialogue via chat preview bridge.
 */

import React from 'react';
import {
  Brackets,
  Copy,
  FileJson,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  newAgentUseCaseTurnId,
  type AIAgentLogicalStep,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import {
  AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
} from '@types/aiAgentPreview';
import { orderUseCasesWithDepth } from './useCaseTreeOrder';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  LABEL_AGENT_MSG_CREATE_JSON,
  LABEL_AGENT_MSG_UPDATE_JSON,
  LABEL_AGENT_MSG_STRIP_TOKENS,
  LABEL_AGENT_MSG_WRAP_TOKEN,
  LABEL_GENERATE_USE_CASES,
  LABEL_REGENERATE_AGENT_EXAMPLE,
  LABEL_REGENERATE_USE_CASE_FOR_SCENARIO,
} from './constants';
import { AgentMessageMotorPreview } from './AgentMessageMotorPreview';
import {
  normalizeRootUseCaseDraftDisplay,
  parseRootUseCaseDraftSegments,
  ROOT_USE_CASE_BATCH_MAX,
} from './parseRootUseCaseDraft';
import { logUseCaseRootBatch } from './useCaseRootBatchDebug';
import {
  messageHasSlotBrackets,
  stripAgentMessageSlotBrackets,
} from './agentMessageTokenHelpers';
import {
  buildVirtualAgentRuntimeCatalogFromUseCases,
  buildVirtualAgentUseCaseConstrainedPromptAppendix,
  serializeVirtualAgentRuntimeCatalog,
} from '@domain/aiAgentUseCase/virtualAgentRuntimeCatalog';

/** Main panels: slate-800 on near-black reads as broken/missing borders; slightly lighter edge for clarity. */
const USE_CASE_PANEL_SHELL =
  'rounded-lg border border-slate-600/65 bg-slate-900/40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]';

export interface AIAgentUseCaseComposerProps {
  /** When set, selects this use case id once after it appears (e.g. debugger «Aggiungi»). */
  editorTaskInstanceId?: string;
  logicalSteps: readonly AIAgentLogicalStep[];
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  busy: boolean;
  creationMessage?: string | null;
  error: string | null;
  onDismissError: () => void;
  onCreateUseCase: (params: {
    label: string;
    parentId: string | null;
    creationScope?: 'single' | 'batch';
  }) => Promise<string>;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void | AIAgentUseCase | null>;
  onRegenerateAgentMessage: (useCaseId: string) => void | Promise<void>;
  /** IA: tokenizza il messaggio con [slot] e allinea il JSON motore (preview sotto). */
  onAnnotateAgentMessageForJson: (
    useCaseId: string,
    assistantContentFromEditor?: string
  ) => void | Promise<boolean>;
  onDeleteUseCase: (useCaseId: string) => void;
  useCaseGlobalStyleId: string;
  onUseCaseGlobalStyleIdChange: (styleId: string) => void;
  previewStyleId?: string;
  onPreviewStyleIdChange?: (styleId: string) => void;
  /** When set, empty state shows a primary CTA (e.g. tab toolbar hidden). */
  onGenerateUseCaseBundle?: () => void | Promise<void>;
  /** Disables generate CTA while Create/Refine agent is running. */
  generating?: boolean;
}

export function AIAgentUseCaseComposer({
  editorTaskInstanceId,
  logicalSteps: _logicalSteps,
  useCases,
  setUseCases,
  busy,
  creationMessage = null,
  error,
  onDismissError,
  onCreateUseCase,
  onRegenerateUseCase,
  onRegenerateAgentMessage,
  onAnnotateAgentMessageForJson,
  onDeleteUseCase,
  useCaseGlobalStyleId,
  onUseCaseGlobalStyleIdChange,
  previewStyleId = AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
  onPreviewStyleIdChange = () => {},
  onGenerateUseCaseBundle,
  generating = false,
}: AIAgentUseCaseComposerProps) {
  const { ordered, depthById } = React.useMemo(() => orderUseCasesWithDepth(useCases), [useCases]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (useCases.length === 0) {
      setSelectedId(null);
      return;
    }
    let pending: string | null = null;
    if (editorTaskInstanceId?.trim()) {
      try {
        const key = `omnia.pendingAiAgentUseCaseSelection.${editorTaskInstanceId.trim()}`;
        const raw = sessionStorage.getItem(key);
        if (raw) {
          sessionStorage.removeItem(key);
          if (useCases.some((u) => u.id === raw)) pending = raw;
        }
      } catch {
        /* ignore */
      }
    }
    setSelectedId((prev) => {
      if (pending) return pending;
      if (prev && useCases.some((u) => u.id === prev)) return prev;
      const { ordered: o } = orderUseCasesWithDepth(useCases);
      return o[0]?.id ?? null;
    });
  }, [editorTaskInstanceId, useCases]);

  /** Stable selection while the list is non-empty (avoids empty right pane before effect runs). */
  const effectiveSelectedId = React.useMemo(() => {
    if (ordered.length === 0) return null;
    if (selectedId != null && ordered.some((u) => u.id === selectedId)) return selectedId;
    return ordered[0]?.id ?? null;
  }, [ordered, selectedId]);

  const selected = React.useMemo(
    () => (effectiveSelectedId ? useCases.find((u) => u.id === effectiveSelectedId) : undefined),
    [effectiveSelectedId, useCases]
  );

  const [editingTitleId, setEditingTitleId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState('');
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [rootDraftLabel, setRootDraftLabel] = React.useState('');
  const [creatingChildParentId, setCreatingChildParentId] = React.useState<string | null>(null);
  const [childDraftLabel, setChildDraftLabel] = React.useState('');
  /** Last payoff baseline per use case for “scenario dirty” (edit vs last AI sync). */
  const [scenarioBaselines, setScenarioBaselines] = React.useState<Record<string, string>>({});
  const [motorJsonExpanded, setMotorJsonExpanded] = React.useState(false);
  const [rootBatchWarning, setRootBatchWarning] = React.useState<string | null>(null);
  const rootDraftRef = React.useRef<HTMLTextAreaElement>(null);
  /** Selection range in assistant message textarea (for Token wrap UX). */
  const [agentMsgSelection, setAgentMsgSelection] = React.useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  React.useEffect(() => {
    setEditingTitleId(null);
  }, [effectiveSelectedId]);

  React.useEffect(() => {
    if (!effectiveSelectedId) return;
    setScenarioBaselines((prev) => {
      if (prev[effectiveSelectedId] !== undefined) return prev;
      const uc = useCases.find((u) => u.id === effectiveSelectedId);
      return { ...prev, [effectiveSelectedId]: uc?.payoff ?? '' };
    });
  }, [effectiveSelectedId, useCases]);

  React.useEffect(() => {
    setAgentMsgSelection({ start: 0, end: 0 });
  }, [effectiveSelectedId]);

  const commitTitleEdit = React.useCallback(
    (useCaseId: string) => {
      const next = draftTitle.trim();
      if (!next) {
        setEditingTitleId(null);
        return;
      }
      setUseCases((prev) => prev.map((u) => (u.id === useCaseId ? { ...u, label: next } : u)));
      setEditingTitleId(null);
    },
    [draftTitle, setUseCases]
  );

  const createUseCase = React.useCallback(
    async (params: {
      label: string;
      parentId: string | null;
      creationScope?: 'single' | 'batch';
    }) => {
      const label = String(params.label || '').trim();
      if (!label) {
        logUseCaseRootBatch('createUseCase_skip_empty_label', { parentId: params.parentId });
        return;
      }
      logUseCaseRootBatch('createUseCase_call', {
        labelPreview: label.slice(0, 120),
        labelLen: label.length,
        parentId: params.parentId,
        creationScope: params.creationScope ?? 'single',
      });
      const createdId = await onCreateUseCase({
        label,
        parentId: params.parentId,
        creationScope: params.creationScope,
      });
      logUseCaseRootBatch('createUseCase_done', { createdId });
      setSelectedId(createdId);
    },
    [onCreateUseCase]
  );

  const handleCreateRoot = React.useCallback(async () => {
    logUseCaseRootBatch('handleCreateRoot_start', {
      busy,
      rawLen: rootDraftLabel.length,
      rawPreview: rootDraftLabel.slice(0, 200),
    });
    if (busy) {
      logUseCaseRootBatch('handleCreateRoot_abort_busy');
      return;
    }
    const parts = parseRootUseCaseDraftSegments(rootDraftLabel);
    logUseCaseRootBatch('handleCreateRoot_parsed', { segmentCount: parts.length, partsPreview: parts.map((p) => p.slice(0, 80)) });
    if (parts.length === 0) {
      logUseCaseRootBatch('handleCreateRoot_abort_no_segments');
      return;
    }
    if (parts.length > ROOT_USE_CASE_BATCH_MAX) {
      setRootBatchWarning(`Massimo ${ROOT_USE_CASE_BATCH_MAX} use case per invio. Riduci il batch.`);
      logUseCaseRootBatch('handleCreateRoot_abort_over_cap', { cap: ROOT_USE_CASE_BATCH_MAX });
      return;
    }
    setRootBatchWarning(null);
    const batchScope = parts.length > 1 ? 'batch' : 'single';
    try {
      for (let i = 0; i < parts.length; i++) {
        const label = parts[i];
        logUseCaseRootBatch('batch_segment_start', { index: i, total: parts.length });
        await createUseCase({ label, parentId: null, creationScope: batchScope });
        logUseCaseRootBatch('batch_segment_ok', { index: i, total: parts.length });
      }
      logUseCaseRootBatch('handleCreateRoot_batch_complete');
    } catch (e) {
      logUseCaseRootBatch('handleCreateRoot_batch_error', {
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
    setRootDraftLabel('');
    logUseCaseRootBatch('handleCreateRoot_cleared_textarea');
  }, [busy, rootDraftLabel, createUseCase]);

  React.useLayoutEffect(() => {
    const el = rootDraftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minPx = 36;
    el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
  }, [rootDraftLabel]);

  const handleCreateChild = React.useCallback(
    async (parentId: string) => {
      if (busy) return;
      const nextLabel = childDraftLabel.trim();
      if (!nextLabel) return;
      await createUseCase({ label: nextLabel, parentId });
      setCreatingChildParentId(null);
      setChildDraftLabel('');
    },
    [busy, childDraftLabel, createUseCase]
  );

  const setAssistantTurnContent = React.useCallback(
    (turnId: string, content: string) => {
      if (!selected) return;
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === selected.id
            ? {
                ...u,
                dialogue: u.dialogue.map((turn) =>
                  turn.turn_id === turnId ? { ...turn, content, userEdited: true } : turn
                ),
              }
            : u
        )
      );
    },
    [selected, setUseCases]
  );

  const payoffTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const agentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  /** Shell for JSON “Espandi”: overlay fills treeview + dettaglio (intera riga use case). */
  const useCaseDetailShellRef = React.useRef<HTMLDivElement>(null);

  const syncDetailTextareaHeights = React.useCallback(() => {
    const grow = (el: HTMLTextAreaElement | null, minPx: number) => {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
    };
    grow(payoffTextareaRef.current, 48);
    grow(agentTextareaRef.current, 64);
  }, []);

  const setPayoffContent = React.useCallback(
    (value: string) => {
      if (!selected) return;
      setUseCases((prev) =>
        prev.map((u) => (u.id === selected.id ? { ...u, payoff: value } : u))
      );
    },
    [selected, setUseCases]
  );

  const assistantTurn = React.useMemo(
    () => (selected ? selected.dialogue.find((t) => t.role === 'assistant') : undefined),
    [selected]
  );

  /**
   * Tracks the live textarea content synchronously on every onChange, bypassing React's rendering
   * cycle. This is the source of truth for the "Aggiorna JSON" action: avoids the race condition
   * where React re-renders with stale state between a paste and the button click.
   * Declared after `assistantTurn` so the initial ref matches the selected turn (sync effect below).
   */
  const liveAgentContentRef = React.useRef<string>(assistantTurn?.content ?? '');

  const scenarioDirty = React.useMemo(() => {
    if (!selected) return false;
    if (!(selected.id in scenarioBaselines)) return false;
    return (selected.payoff ?? '') !== scenarioBaselines[selected.id];
  }, [selected, selected?.payoff, scenarioBaselines]);

  const agentMessageEmpty = React.useMemo(
    () => !assistantTurn || !String(assistantTurn.content ?? '').trim(),
    [assistantTurn, assistantTurn?.content]
  );

  const motorPayload = assistantTurn?.motor_snapshot?.payload ?? null;
  const motorJsonStale = Boolean(
    assistantTurn?.motor_snapshot &&
      assistantTurn.content !== assistantTurn.motor_snapshot.source_content
  );
  const showMotorJsonCreate = Boolean(
    assistantTurn && !agentMessageEmpty && !assistantTurn.motor_snapshot
  );
  const showMotorJsonUpdate = Boolean(
    assistantTurn && !agentMessageEmpty && assistantTurn.motor_snapshot && motorJsonStale
  );

  const syncAgentMsgSelection = React.useCallback(() => {
    const ta = agentTextareaRef.current;
    if (!ta) return;
    setAgentMsgSelection({ start: ta.selectionStart, end: ta.selectionEnd });
  }, []);

  const canWrapAgentToken = React.useMemo(() => {
    if (!assistantTurn || busy) return false;
    const { start, end } = agentMsgSelection;
    if (start === end) return false;
    return assistantTurn.content.slice(start, end).trim().length > 0;
  }, [assistantTurn, busy, agentMsgSelection, assistantTurn?.content]);

  const canStripAgentTokens = React.useMemo(
    () => Boolean(assistantTurn && messageHasSlotBrackets(assistantTurn.content)),
    [assistantTurn]
  );

  const handleWrapAgentToken = React.useCallback(() => {
    if (!assistantTurn || busy) return;
    const ta = agentTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const content = assistantTurn.content;
    const sel = content.slice(start, end);
    if (!sel.trim()) return;
    const wrapped = `[${sel}]`;
    const next = content.slice(0, start) + wrapped + content.slice(end);
    setAssistantTurnContent(assistantTurn.turn_id, next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = agentTextareaRef.current;
        if (!el) return;
        el.focus();
        const hi = start + wrapped.length;
        el.setSelectionRange(start, hi);
        syncDetailTextareaHeights();
        setAgentMsgSelection({ start, end: hi });
      });
    });
  }, [assistantTurn, busy, setAssistantTurnContent, syncDetailTextareaHeights]);

  const handleStripAgentTokens = React.useCallback(() => {
    if (!assistantTurn || busy) return;
    if (!messageHasSlotBrackets(assistantTurn.content)) return;
    const next = stripAgentMessageSlotBrackets(assistantTurn.content);
    setAssistantTurnContent(assistantTurn.turn_id, next);
    requestAnimationFrame(() => {
      syncDetailTextareaHeights();
      syncAgentMsgSelection();
    });
  }, [assistantTurn, busy, setAssistantTurnContent, syncDetailTextareaHeights, syncAgentMsgSelection]);

  const handleScenarioRegenerateClick = React.useCallback(async () => {
    if (!selected || busy) return;
    const updated = await onRegenerateUseCase(selected.id);
    if (updated && typeof updated.payoff === 'string') {
      setScenarioBaselines((prev) => ({ ...prev, [selected.id]: updated.payoff }));
    }
  }, [selected, busy, onRegenerateUseCase]);

  const ensureAssistantTurn = React.useCallback(() => {
    if (!selected) return;
    setUseCases((prev) =>
      prev.map((u) => {
        if (u.id !== selected.id) return u;
        if (u.dialogue.some((t) => t.role === 'assistant')) return u;
        return {
          ...u,
          dialogue: [
            ...u.dialogue,
            {
              turn_id: newAgentUseCaseTurnId(),
              role: 'assistant' as const,
              content: '',
              editable: true,
            },
          ],
        };
      })
    );
  }, [selected, setUseCases]);

  React.useLayoutEffect(() => {
    syncDetailTextareaHeights();
  }, [
    syncDetailTextareaHeights,
    effectiveSelectedId,
    selected?.payoff,
    assistantTurn?.content,
    assistantTurn?.turn_id,
  ]);

  /**
   * Keep liveAgentContentRef in sync with external state changes (API annotation response,
   * use case selection, regeneration). User input is captured directly in onChange and takes
   * precedence since it runs synchronously before React's render cycle.
   */
  React.useEffect(() => {
    liveAgentContentRef.current = assistantTurn?.content ?? '';
  }, [assistantTurn?.content, assistantTurn?.turn_id]);

  const styleContract =
    AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === useCaseGlobalStyleId)?.contract ?? '';

  const runtimeCatalogExport = React.useMemo(() => {
    const built = buildVirtualAgentRuntimeCatalogFromUseCases(useCases);
    return {
      catalogJson: serializeVirtualAgentRuntimeCatalog(built),
      appendix: buildVirtualAgentUseCaseConstrainedPromptAppendix(built.entries, {
        globalStyleContract: styleContract,
      }),
      skippedCount: built.skipped.length,
      entryCount: built.entries.length,
    };
  }, [useCases, styleContract]);

  const copyRuntimeCatalogJson = React.useCallback(() => {
    void navigator.clipboard.writeText(runtimeCatalogExport.catalogJson).catch(() => {
      /* clipboard denied */
    });
  }, [runtimeCatalogExport.catalogJson]);

  const copyRuntimeAppendix = React.useCallback(() => {
    void navigator.clipboard.writeText(runtimeCatalogExport.appendix).catch(() => {
      /* clipboard denied */
    });
  }, [runtimeCatalogExport.appendix]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <div className={`rounded-lg px-3 py-2 text-xs ${USE_CASE_PANEL_SHELL}`}>
        <div className="flex items-center gap-2">
          <label htmlFor="ai-agent-global-use-case-style" className="text-slate-300 whitespace-nowrap">
            Stile globale
          </label>
          <select
            id="ai-agent-global-use-case-style"
            value={useCaseGlobalStyleId}
            onChange={(e) => onUseCaseGlobalStyleIdChange(e.target.value)}
            disabled={busy}
            className="rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60"
          >
            {AI_AGENT_GLOBAL_USE_CASE_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
          <span className="text-slate-500">Applicato a tutti i use case</span>
        </div>
      </div>

      {ordered.length > 0 ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs ${USE_CASE_PANEL_SHELL}`}
        >
          <span className="font-semibold text-slate-400 shrink-0">Runtime catalogo</span>
          <span className="text-slate-500">
            {runtimeCatalogExport.entryCount} scenari con JSON motore
            {runtimeCatalogExport.skippedCount > 0 ? (
              <span className="text-amber-400/95">
                {' '}
                · {runtimeCatalogExport.skippedCount} senza motor snapshot (esclusi)
              </span>
            ) : null}
          </span>
          <button
            type="button"
            title="Copia JSON catalogo (schema + esempi) negli appunti"
            onClick={copyRuntimeCatalogJson}
            disabled={busy || runtimeCatalogExport.entryCount === 0}
            className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/90 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-750 disabled:opacity-40"
          >
            <FileJson size={12} aria-hidden />
            Copia JSON
          </button>
          <button
            type="button"
            title="Copia appendix prompt (use case vincolati + stile globale) negli appunti"
            onClick={copyRuntimeAppendix}
            disabled={busy || runtimeCatalogExport.entryCount === 0}
            className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/90 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-750 disabled:opacity-40"
          >
            <Copy size={12} aria-hidden />
            Copia appendix prompt
          </button>
        </div>
      ) : null}

      {creationMessage ? (
        <div className="rounded-lg border border-violet-800/70 bg-violet-950/40 px-3 py-2 text-sm text-violet-100 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
          <span>{creationMessage}</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-800/80 bg-red-950/40 px-3 py-2 text-sm text-red-200 flex justify-between gap-2">
          <span className="min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 text-red-300 hover:text-red-100 underline text-xs"
          >
            Chiudi
          </button>
        </div>
      ) : null}

      <div
        ref={useCaseDetailShellRef}
        className="relative flex flex-1 min-h-0 gap-2 flex-col sm:flex-row sm:items-stretch sm:min-h-[320px]"
      >
        <div
          className={`${
            ordered.length === 0 ? 'w-full' : 'w-full sm:w-[44%]'
          } shrink-0 min-h-0 flex-1 flex flex-col self-stretch overflow-hidden min-h-[240px] ${USE_CASE_PANEL_SHELL}`}
        >
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <div className="px-2 pt-2 pb-1 border-b border-slate-700/50 shrink-0 space-y-1">
                <textarea
                  ref={rootDraftRef}
                  rows={1}
                  value={rootDraftLabel}
                  onChange={(e) => {
                    setRootBatchWarning(null);
                    setRootDraftLabel(e.target.value);
                  }}
                  onBlur={() => {
                    setRootDraftLabel((prev) => normalizeRootUseCaseDraftDisplay(prev));
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text/plain');
                    if (!/[;,\r\n]/.test(pasted)) return;
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = rootDraftLabel.slice(0, start);
                    const after = rootDraftLabel.slice(end);
                    setRootDraftLabel(normalizeRootUseCaseDraftDisplay(before + pasted + after));
                    setRootBatchWarning(null);
                  }}
                  disabled={busy}
                  placeholder="Uno o più use case: una riga per scenario, oppure separa con ; o ,. INVIO crea tutti in sequenza."
                  className="w-full resize-none overflow-hidden rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 min-h-[36px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleCreateRoot();
                    } else if (e.key === 'Escape') {
                      setRootDraftLabel('');
                      setRootBatchWarning(null);
                    }
                  }}
                />
                {rootBatchWarning ? (
                  <p className="text-[11px] text-amber-300/95">{rootBatchWarning}</p>
                ) : null}
              </div>
              {ordered.length === 0 ? (
                <div className="flex-1 min-h-[120px] flex flex-col items-center justify-center gap-4 p-6 text-center overflow-y-auto">
                  <p className="text-sm text-slate-500 max-w-md">
                    {onGenerateUseCaseBundle
                      ? 'Nessuno scenario ancora. Puoi generarli con IA usando il pulsante qui sotto.'
                      : 'Nessuno scenario. Genera con IA o crea il design agent prima.'}
                  </p>
                  {onGenerateUseCaseBundle ? (
                    <button
                      type="button"
                      disabled={busy || generating}
                      onClick={() => void onGenerateUseCaseBundle()}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
                    >
                      {busy ? (
                        <Loader2 className="animate-spin" size={16} aria-hidden />
                      ) : (
                        <Sparkles size={16} aria-hidden />
                      )}
                      {busy ? 'Generazione scenari…' : LABEL_GENERATE_USE_CASES}
                    </button>
                  ) : null}
                </div>
              ) : (
              <ul className="p-1.5 flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
                {ordered.map((u) => {
                  const depth = depthById[u.id] ?? 0;
                  const active = u.id === effectiveSelectedId;
                  const editingTitle = editingTitleId === u.id;
                  const showToolbar = active || hoveredId === u.id || creatingChildParentId === u.id || editingTitle;
                  const creatingChild = creatingChildParentId === u.id;
                  const descriptionTooltip = String(u.notes?.behavior || '').trim();
                  return (
                    <li
                      key={u.id}
                      className="rounded-md border border-slate-600/45 bg-slate-950/30 overflow-hidden"
                      onMouseEnter={() => setHoveredId(u.id)}
                      onMouseLeave={() => setHoveredId((prev) => (prev === u.id ? null : prev))}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                          }
                        }}
                        onClick={() => {
                          if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer ${
                          active ? 'bg-violet-900/40' : 'hover:bg-slate-800/80'
                        }`}
                        style={{ paddingLeft: `${8 + depth * 12}px` }}
                      >
                        <GitBranch size={12} className="shrink-0 opacity-60 text-slate-400" aria-hidden />
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                          {editingTitle ? (
                            <div
                              className="flex min-w-0 flex-1 items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={draftTitle}
                                onChange={(e) => setDraftTitle(e.target.value)}
                                className="min-w-0 flex-1 rounded border border-violet-600/50 bg-slate-950 px-2 py-0.5 text-xs text-slate-100"
                                autoFocus
                                disabled={busy}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    commitTitleEdit(u.id);
                                    return;
                                  }
                                  if (e.key === 'Escape') {
                                    e.stopPropagation();
                                    setDraftTitle(u.label);
                                    setEditingTitleId(null);
                                  }
                                }}
                                onBlur={() => commitTitleEdit(u.id)}
                              />
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                title={descriptionTooltip || undefined}
                                className={`min-w-0 flex-1 text-left text-sm truncate ${
                                  active ? 'text-violet-100' : 'text-slate-300'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                                }}
                              >
                                {u.label || u.id}
                              </button>
                              {showToolbar ? (
                                <button
                                  type="button"
                                  title="Modifica etichetta"
                                  className="shrink-0 p-0.5 rounded text-slate-400 hover:text-violet-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDraftTitle(u.label);
                                    setEditingTitleId(u.id);
                                  }}
                                >
                                  <Pencil size={12} aria-hidden />
                                </button>
                              ) : null}
                              {showToolbar ? (
                                <button
                                  type="button"
                                  title="Aggiungi figlio"
                                  className="shrink-0 p-0.5 rounded text-slate-400 hover:text-violet-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(u.id);
                                    setCreatingChildParentId(u.id);
                                    setChildDraftLabel('');
                                  }}
                                >
                                  <Plus size={12} aria-hidden />
                                </button>
                              ) : null}
                              {showToolbar ? (
                                <button
                                  type="button"
                                  title="Elimina questo scenario e i figli"
                                  aria-label="Elimina scenario"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteUseCase(u.id);
                                  }}
                                  className="shrink-0 p-0.5 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800/90 disabled:opacity-40"
                                >
                                  <Trash2 size={14} aria-hidden />
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                      {creatingChild ? (
                        <div
                          className="border-t border-slate-700/45 px-2 py-2 bg-slate-950/40"
                          style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
                        >
                          <input
                            type="text"
                            value={childDraftLabel}
                            autoFocus
                            disabled={busy}
                            placeholder="Nuovo figlio… (ENTER conferma, ESC annulla)"
                            className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60"
                            onChange={(e) => setChildDraftLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleCreateChild(u.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setCreatingChildParentId(null);
                                setChildDraftLabel('');
                              }
                            }}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              )}
          </div>
        </div>

        {ordered.length > 0 ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden self-stretch">
              {selected ? (
                <div className="flex flex-1 min-h-0 flex-col overflow-auto gap-3 px-0.5 py-1 min-h-0">
                  <div className="rounded-lg overflow-hidden ring-1 ring-violet-500/35">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide bg-violet-950/85 text-violet-100 border-b border-violet-600/45">
                      <span>Scenario</span>
                      {scenarioDirty ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleScenarioRegenerateClick()}
                          title={LABEL_REGENERATE_USE_CASE_FOR_SCENARIO}
                          className="inline-flex items-center gap-1 rounded-md border border-violet-500/50 bg-violet-900/40 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-violet-100 hover:bg-violet-800/50 disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 className="animate-spin shrink-0" size={12} aria-hidden />
                          ) : (
                            <RefreshCw size={12} className="shrink-0" aria-hidden />
                          )}
                          {LABEL_REGENERATE_USE_CASE_FOR_SCENARIO}
                        </button>
                      ) : null}
                    </div>
                    <textarea
                      ref={payoffTextareaRef}
                      value={selected.payoff ?? ''}
                      onChange={(e) => {
                        setPayoffContent(e.target.value);
                        requestAnimationFrame(() => syncDetailTextareaHeights());
                      }}
                      disabled={busy}
                      rows={1}
                      placeholder="Descrizione sintetica dello scenario e del contesto dialogico…"
                      className="w-full resize-none overflow-hidden rounded-none border-0 bg-slate-900/95 px-2.5 py-2 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap break-words placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500/50 disabled:opacity-60"
                    />
                  </div>

                  <div className="rounded-lg overflow-hidden ring-1 ring-emerald-600/40">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide bg-emerald-950/80 text-emerald-100 border-b border-emerald-700/45">
                      <span>Messaggio agente</span>
                      <div className="flex flex-wrap items-center gap-1 justify-end">
                        {assistantTurn && !agentMessageEmpty ? (
                          <>
                            <button
                              type="button"
                              disabled={busy || !canWrapAgentToken}
                              onClick={() => handleWrapAgentToken()}
                              title="Avvolge il testo selezionato tra quadre [ ] come slot runtime"
                              className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/50 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-50 hover:bg-emerald-900/70 disabled:opacity-40"
                            >
                              <Brackets size={12} className="shrink-0 opacity-90" aria-hidden />
                              {LABEL_AGENT_MSG_WRAP_TOKEN}
                            </button>
                            <button
                              type="button"
                              disabled={busy || !canStripAgentTokens}
                              onClick={() => handleStripAgentTokens()}
                              title="Rimuove tutte le quadre [ ], lasciando solo il testo interno"
                              className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/45 bg-emerald-950/45 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-100/95 hover:bg-emerald-900/55 disabled:opacity-40"
                            >
                              {LABEL_AGENT_MSG_STRIP_TOKENS}
                            </button>
                            {showMotorJsonCreate || showMotorJsonUpdate ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  if (!assistantTurn) {
                                    void (async () => {
                                      const ok = await onAnnotateAgentMessageForJson(selected.id);
                                      if (ok) setMotorJsonExpanded(true);
                                    })();
                                    return;
                                  }
                                  /**
                                   * liveAgentContentRef is updated synchronously in onChange,
                                   * BEFORE React's batched state commit. It is the definitive
                                   * source of the current user-visible text at click time,
                                   * immune to React's concurrent-mode rendering cycle.
                                   *
                                   * Fallback chain: live ref → DOM textarea value → React state.
                                   */
                                  // liveAgentContentRef is always a string (set synchronously in onChange
                                  // and synced from external state via useEffect). Use it directly.
                                  // DOM value is the secondary safety net if somehow ref is unset.
                                  const live =
                                    liveAgentContentRef.current ??
                                    agentTextareaRef.current?.value ??
                                    assistantTurn.content;
                                  void (async () => {
                                    const ok = await onAnnotateAgentMessageForJson(selected.id, live);
                                    if (ok) setMotorJsonExpanded(true);
                                  })();
                                }}
                                title={
                                  showMotorJsonUpdate
                                    ? 'Ricalcola il JSON motore (messaggio modificato rispetto all’ultima sincronizzazione)'
                                    : 'Usa l’IA per aggiungere [slot] al testo e generare il JSON motore'
                                }
                                className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/50 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-50 hover:bg-emerald-900/70 disabled:opacity-40"
                              >
                                {busy ? (
                                  <Loader2 className="animate-spin shrink-0" size={12} aria-hidden />
                                ) : (
                                  <FileJson size={12} className="shrink-0 opacity-90" aria-hidden />
                                )}
                                {showMotorJsonUpdate
                                  ? LABEL_AGENT_MSG_UPDATE_JSON
                                  : LABEL_AGENT_MSG_CREATE_JSON}
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {agentMessageEmpty ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onRegenerateAgentMessage(selected.id)}
                            title={LABEL_REGENERATE_AGENT_EXAMPLE}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-600/50 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-50 hover:bg-emerald-900/70 disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 className="animate-spin shrink-0" size={12} aria-hidden />
                            ) : (
                              <RefreshCw size={12} className="shrink-0" aria-hidden />
                            )}
                            {LABEL_REGENERATE_AGENT_EXAMPLE}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {assistantTurn ? (
                      <textarea
                        ref={agentTextareaRef}
                        value={assistantTurn.content}
                        onChange={(e) => {
                          // Update the live ref synchronously BEFORE the React state update.
                          // This ensures "Aggiorna JSON" always reads the current user input
                          // even if the click fires before React commits the state change.
                          liveAgentContentRef.current = e.target.value;
                          setAssistantTurnContent(assistantTurn.turn_id, e.target.value);
                          requestAnimationFrame(() => syncDetailTextareaHeights());
                        }}
                        onMouseUp={syncAgentMsgSelection}
                        onSelect={syncAgentMsgSelection}
                        onKeyUp={syncAgentMsgSelection}
                        disabled={busy}
                        rows={1}
                        spellCheck={false}
                        aria-label="Messaggio agente"
                        placeholder="Seleziona testo e usa Token per creare [slot]. Senza quadre rimuove il markup."
                        className="w-full resize-none overflow-hidden rounded-none border-0 bg-emerald-950/35 px-2.5 py-2 font-mono text-sm leading-relaxed text-emerald-50 whitespace-pre-wrap break-words placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/45 disabled:opacity-60"
                      />
                    ) : (
                      <div className="space-y-2 bg-emerald-950/25 px-2.5 py-3">
                        <p className="text-xs text-slate-500">
                          Nessun turno assistente. Rigenera per crearne uno con l&apos;IA oppure aggiungi manualmente un
                          turno vuoto.
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => ensureAssistantTurn()}
                          className="text-xs text-emerald-300 underline disabled:opacity-50"
                        >
                          Aggiungi messaggio agente (vuoto)
                        </button>
                      </div>
                    )}
                    <div className="border-t border-emerald-800/35 bg-emerald-950/20 px-2 py-2">
                      <AgentMessageMotorPreview
                        motorPayload={motorPayload}
                        isStale={motorJsonStale}
                        expanded={motorJsonExpanded}
                        onToggleExpanded={() => setMotorJsonExpanded((v) => !v)}
                        expandMountRef={useCaseDetailShellRef}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
        ) : null}
      </div>
    </div>
  );
}
