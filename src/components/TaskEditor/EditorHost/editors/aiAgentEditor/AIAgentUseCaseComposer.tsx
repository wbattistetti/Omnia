/**
 * Use Case Composer: tree of scenarios, metadata fields, dialogue via chat preview bridge.
 */

import React from 'react';
import {
  Brackets,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  FileJson,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
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
  LABEL_AGENT_MSG_STRIP_TOKENS,
  LABEL_AGENT_MSG_WRAP_TOKEN,
  LABEL_GENERATE_USE_CASES,
  LABEL_REGENERATE_AGENT_EXAMPLE,
  LABEL_REGENERATE_USE_CASE_FOR_SCENARIO,
} from './constants';
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
import { useUseCaseWizardListToolbarOptional } from './useCaseGeneratorWizard/UseCaseWizardListToolbarContext';

/** Main panels: slate-800 on near-black reads as broken/missing borders; slightly lighter edge for clarity. */
const USE_CASE_PANEL_SHELL =
  'rounded-lg border border-slate-600/65 bg-slate-900/40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]';

/** Pill testuale; la matita sta in un wrapper `relative` (angolo in alto a destra del contenitore label). */
const UC_PILL_SCENARIO =
  'inline-flex shrink-0 select-none items-center rounded-full border border-violet-500/45 bg-violet-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100';
const UC_PILL_AGENT_MSG =
  'inline-flex shrink-0 select-none items-center rounded-full border border-emerald-600/50 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100';
const UC_CLASSIC_TEXTAREA_SCENARIO =
  'min-w-0 flex-1 rounded-md border border-violet-500/50 bg-slate-900/95 px-2 py-1.5 text-xs leading-snug text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-60';
const UC_CLASSIC_TEXTAREA_AGENT =
  'min-w-0 flex-1 rounded-md border border-emerald-500/50 bg-emerald-950/50 px-2 py-1.5 font-mono text-sm leading-snug text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60';
/** Matita a destra della riga (stesso stile dell’header lista use case: `Pencil` 12px). */
const UC_SCENARIO_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-40';
const UC_AGENT_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40';

/** Triplet IA non modificato (grigio) vs campo editato rispetto all’ultima baseline (verde). */
export type AiTripletFieldBaseline = {
  label: string;
  payoff: string;
  assistantContent: string;
};

function aiFieldToneClass(current: string, baseline: string | undefined): string {
  if (baseline === undefined) return 'text-slate-500';
  return current === baseline ? 'text-slate-500' : 'text-emerald-400';
}

/** Colore testo: pollice (verde/rosso) ha priorità su baseline IA. */
function fieldTextClass(
  vote: 'up' | 'down' | undefined,
  current: string,
  baseline: string | undefined
): string {
  if (vote === 'up') return 'text-emerald-400';
  if (vote === 'down') return 'text-red-400';
  return aiFieldToneClass(current, baseline);
}

const UC_HEAD_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-800/80 group-hover/uc-head:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 disabled:opacity-40';
const UC_SCENARIO_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-800/80 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 disabled:opacity-40';
const UC_AGENT_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-800/80 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 disabled:opacity-40';

type DesignerVoteField = 'label' | 'payoff' | 'agentMessage';

function VoteThumbPair(props: {
  vote?: 'up' | 'down';
  disabled?: boolean;
  outerBtnClass: string;
  onVote: (choice: 'up' | 'down') => void;
}): React.ReactElement {
  const { vote, disabled, outerBtnClass, onVote } = props;
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={vote === 'up' ? 'Rimuovi validazione' : 'Valida (testo verde)'}
        className={`${outerBtnClass} ${vote === 'up' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-300/90'}`}
        onClick={(e) => {
          e.stopPropagation();
          onVote('up');
        }}
      >
        <ThumbsUp size={12} aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        title={vote === 'down' ? 'Rimuovi invalidazione' : 'Invalida (testo rosso)'}
        className={`${outerBtnClass} ${vote === 'down' ? 'text-red-400' : 'text-slate-500 hover:text-red-300/90'}`}
        onClick={(e) => {
          e.stopPropagation();
          onVote('down');
        }}
      >
        <ThumbsDown size={12} aria-hidden />
      </button>
    </>
  );
}

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
  onRegenerateAgentMessage: (useCaseId: string) => void | Promise<string | null | void>;
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
  /**
   * Generazione lista nel view wizard: nessun pulsante «Genera use case» nel pannello sinistro;
   * messaggio empty state punta al Tutorial destro.
   */
  primaryGenerateOnRightOnly?: boolean;
  /** Id da evidenziare dopo generazione / «creane altri». */
  highlightIds?: readonly string[];
  /** Rimuove l’evidenziazione quando l’use case è confermato (edit o cerchio). */
  onClearUseCaseHighlight?: (useCaseId: string) => void;
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
  onAnnotateAgentMessageForJson: _onAnnotateAgentMessageForJson,
  onDeleteUseCase,
  useCaseGlobalStyleId,
  onUseCaseGlobalStyleIdChange,
  previewStyleId = AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
  onPreviewStyleIdChange = () => {},
  onGenerateUseCaseBundle,
  generating = false,
  primaryGenerateOnRightOnly = false,
  highlightIds = [],
  onClearUseCaseHighlight,
}: AIAgentUseCaseComposerProps) {
  const { ordered, depthById } = React.useMemo(() => orderUseCasesWithDepth(useCases), [useCases]);
  const highlightIdSet = React.useMemo(() => new Set(highlightIds), [highlightIds]);
  const listToolbarCtx = useUseCaseWizardListToolbarOptional();
  const wizardShowScenario =
    primaryGenerateOnRightOnly && listToolbarCtx ? listToolbarCtx.showScenario : true;
  const wizardShowMessage =
    primaryGenerateOnRightOnly && listToolbarCtx ? listToolbarCtx.showMessage : true;
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
  const [rootDraftLabel, setRootDraftLabel] = React.useState('');
  const [creatingChildParentId, setCreatingChildParentId] = React.useState<string | null>(null);
  const [childDraftLabel, setChildDraftLabel] = React.useState('');
  /** Valori triplet (etichetta, scenario, messaggio) all’ingresso in lista o dopo rigenera IA. */
  const [fieldBaselineByUseCaseId, setFieldBaselineByUseCaseId] = React.useState<
    Record<string, AiTripletFieldBaseline>
  >({});
  /** Wizard only: corpo card espanso per id (default true quando compare un nuovo use case). */
  const [cardExpandedById, setCardExpandedById] = React.useState<Record<string, boolean>>({});
  const [rootBatchWarning, setRootBatchWarning] = React.useState<string | null>(null);
  const rootDraftRef = React.useRef<HTMLTextAreaElement>(null);
  /** Selection range in assistant message textarea (for Token wrap UX). */
  const [agentMsgSelection, setAgentMsgSelection] = React.useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  /** Modifica payoff / messaggio: vista etichetta+matita, edit con textbox classica e ✓ / ✗ */
  const [payoffEditUseCaseId, setPayoffEditUseCaseId] = React.useState<string | null>(null);
  const [payoffEditDraft, setPayoffEditDraft] = React.useState('');
  const [agentMsgEditUseCaseId, setAgentMsgEditUseCaseId] = React.useState<string | null>(null);
  const [agentMsgEditDraft, setAgentMsgEditDraft] = React.useState('');

  React.useEffect(() => {
    setEditingTitleId(null);
  }, [effectiveSelectedId]);

  React.useEffect(() => {
    if (!primaryGenerateOnRightOnly) {
      setPayoffEditUseCaseId(null);
      setAgentMsgEditUseCaseId(null);
    }
  }, [effectiveSelectedId, primaryGenerateOnRightOnly]);

  React.useEffect(() => {
    setFieldBaselineByUseCaseId((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const u of ordered) {
        if (next[u.id]) continue;
        const ast = u.dialogue.find((t) => t.role === 'assistant');
        next[u.id] = {
          label: u.label,
          payoff: u.payoff ?? '',
          assistantContent: ast?.content ?? '',
        };
        changed = true;
      }
      for (const id of Object.keys(next)) {
        if (!ordered.some((u) => u.id === id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [ordered, useCases]);

  React.useEffect(() => {
    setAgentMsgSelection({ start: 0, end: 0 });
  }, [effectiveSelectedId]);

  React.useEffect(() => {
    setCardExpandedById((prev) => {
      const next = { ...prev };
      for (const u of ordered) {
        if (!(u.id in next)) next[u.id] = true;
      }
      for (const id of Object.keys(next)) {
        if (!ordered.some((u) => u.id === id)) delete next[id];
      }
      return next;
    });
  }, [ordered]);

  const expandAllWizardCards = React.useCallback(() => {
    setCardExpandedById((prev) => {
      const next = { ...prev };
      for (const u of ordered) next[u.id] = true;
      return next;
    });
  }, [ordered]);

  const collapseAllWizardCards = React.useCallback(() => {
    setCardExpandedById((prev) => {
      const next = { ...prev };
      for (const u of ordered) next[u.id] = false;
      return next;
    });
  }, [ordered]);

  React.useEffect(() => {
    if (!primaryGenerateOnRightOnly || !listToolbarCtx) return;
    listToolbarCtx.registerHandlers({
      expandAll: expandAllWizardCards,
      collapseAll: collapseAllWizardCards,
    });
    return () => listToolbarCtx.registerHandlers(null);
  }, [
    primaryGenerateOnRightOnly,
    listToolbarCtx,
    expandAllWizardCards,
    collapseAllWizardCards,
  ]);

  const commitTitleEdit = React.useCallback(
    (useCaseId: string) => {
      const next = draftTitle.trim();
      if (!next) {
        setEditingTitleId(null);
        return;
      }
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...u,
                label: next,
                designer_edit_confirmed: true as const,
                designer_label_vote: 'up' as const,
              }
            : u
        )
      );
      onClearUseCaseHighlight?.(useCaseId);
      setEditingTitleId(null);
    },
    [draftTitle, setUseCases, onClearUseCaseHighlight]
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

  const setAssistantTurnContentForUseCase = React.useCallback(
    (useCaseId: string, turnId: string, content: string) => {
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...u,
                designer_edit_confirmed: true as const,
                designer_agent_message_vote: 'up' as const,
                dialogue: u.dialogue.map((turn) =>
                  turn.turn_id === turnId ? { ...turn, content, userEdited: true } : turn
                ),
              }
            : u
        )
      );
      onClearUseCaseHighlight?.(useCaseId);
    },
    [setUseCases, onClearUseCaseHighlight]
  );

  const setAssistantTurnContent = React.useCallback(
    (turnId: string, content: string) => {
      if (!selected) return;
      setAssistantTurnContentForUseCase(selected.id, turnId, content);
    },
    [selected, setAssistantTurnContentForUseCase]
  );

  const payoffTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const agentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const payoffTextareaRefsById = React.useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const agentTextareaRefsById = React.useRef<Map<string, HTMLTextAreaElement>>(new Map());
  /** Live assistant text per use case (Annotate JSON / focus safety). */
  const liveAgentContentByIdRef = React.useRef<Record<string, string>>({});
  /** Turn in modifica nel wizard (commit messaggio). */
  const agentMsgEditTurnIdRef = React.useRef<string>('');
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

  const syncWizardTextareaHeights = React.useCallback(() => {
    const grow = (el: HTMLTextAreaElement | null, minPx: number) => {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
    };
    for (const el of payoffTextareaRefsById.current.values()) grow(el, 48);
    for (const el of agentTextareaRefsById.current.values()) grow(el, 64);
  }, []);

  const setPayoffForUseCase = React.useCallback(
    (useCaseId: string, value: string) => {
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...u,
                payoff: value,
                designer_edit_confirmed: true as const,
                designer_payoff_vote: 'up' as const,
              }
            : u
        )
      );
      onClearUseCaseHighlight?.(useCaseId);
    },
    [setUseCases, onClearUseCaseHighlight]
  );

  const acknowledgeUseCaseReview = React.useCallback(
    (useCaseId: string) => {
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId ? { ...u, designer_acknowledged: true as const } : u
        )
      );
      onClearUseCaseHighlight?.(useCaseId);
    },
    [setUseCases, onClearUseCaseHighlight]
  );

  const toggleDesignerFieldVote = React.useCallback(
    (useCaseId: string, field: DesignerVoteField, choice: 'up' | 'down') => {
      setUseCases((prev) =>
        prev.map((u) => {
          if (u.id !== useCaseId) return u;
          if (field === 'label') {
            const cur = u.designer_label_vote;
            return { ...u, designer_label_vote: cur === choice ? undefined : choice };
          }
          if (field === 'payoff') {
            const cur = u.designer_payoff_vote;
            return { ...u, designer_payoff_vote: cur === choice ? undefined : choice };
          }
          const cur = u.designer_agent_message_vote;
          return { ...u, designer_agent_message_vote: cur === choice ? undefined : choice };
        })
      );
      onClearUseCaseHighlight?.(useCaseId);
    },
    [setUseCases, onClearUseCaseHighlight]
  );

  const beginPayoffEdit = React.useCallback((useCaseId: string, current: string) => {
    setAgentMsgEditUseCaseId(null);
    setPayoffEditUseCaseId(useCaseId);
    setPayoffEditDraft(current);
  }, []);

  const commitPayoffEdit = React.useCallback(() => {
    if (!payoffEditUseCaseId) return;
    setPayoffForUseCase(payoffEditUseCaseId, payoffEditDraft.trim());
    setPayoffEditUseCaseId(null);
    requestAnimationFrame(() => {
      syncWizardTextareaHeights();
      syncDetailTextareaHeights();
    });
  }, [
    payoffEditUseCaseId,
    payoffEditDraft,
    setPayoffForUseCase,
    syncWizardTextareaHeights,
    syncDetailTextareaHeights,
  ]);

  const cancelPayoffEdit = React.useCallback(() => {
    setPayoffEditUseCaseId(null);
  }, []);

  const beginAgentMsgEdit = React.useCallback((useCaseId: string, turnId: string, current: string) => {
    setPayoffEditUseCaseId(null);
    agentMsgEditTurnIdRef.current = turnId;
    setAgentMsgEditUseCaseId(useCaseId);
    setAgentMsgEditDraft(current);
    liveAgentContentByIdRef.current[useCaseId] = current;
    liveAgentContentRef.current = current;
  }, []);

  const commitAgentMsgEdit = React.useCallback(() => {
    if (!agentMsgEditUseCaseId || !agentMsgEditTurnIdRef.current) return;
    const tid = agentMsgEditTurnIdRef.current;
    setAssistantTurnContentForUseCase(agentMsgEditUseCaseId, tid, agentMsgEditDraft);
    liveAgentContentByIdRef.current[agentMsgEditUseCaseId] = agentMsgEditDraft;
    setAgentMsgEditUseCaseId(null);
    requestAnimationFrame(() => {
      syncWizardTextareaHeights();
      syncDetailTextareaHeights();
    });
  }, [
    agentMsgEditUseCaseId,
    agentMsgEditDraft,
    setAssistantTurnContentForUseCase,
    syncWizardTextareaHeights,
    syncDetailTextareaHeights,
  ]);

  const cancelAgentMsgEdit = React.useCallback(() => {
    setAgentMsgEditUseCaseId(null);
  }, []);

  const setPayoffContent = React.useCallback(
    (value: string) => {
      if (!selected) return;
      setPayoffForUseCase(selected.id, value);
    },
    [selected, setPayoffForUseCase]
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
    const b = fieldBaselineByUseCaseId[selected.id];
    if (!b) return false;
    return (selected.payoff ?? '') !== b.payoff;
  }, [selected, selected?.payoff, fieldBaselineByUseCaseId]);

  const agentMessageEmpty = React.useMemo(
    () => !assistantTurn || !String(assistantTurn.content ?? '').trim(),
    [assistantTurn, assistantTurn?.content]
  );

  const syncAgentMsgSelection = React.useCallback(() => {
    const ta = agentTextareaRef.current;
    if (!ta) return;
    setAgentMsgSelection({ start: ta.selectionStart, end: ta.selectionEnd });
  }, []);

  const agentMsgContentForDetailOps = React.useMemo(() => {
    if (!assistantTurn) return '';
    if (selected && agentMsgEditUseCaseId === selected.id) return agentMsgEditDraft;
    return assistantTurn.content;
  }, [assistantTurn, selected, agentMsgEditUseCaseId, agentMsgEditDraft]);

  const canWrapAgentToken = React.useMemo(() => {
    if (!assistantTurn || busy) return false;
    const { start, end } = agentMsgSelection;
    if (start === end) return false;
    return agentMsgContentForDetailOps.slice(start, end).trim().length > 0;
  }, [assistantTurn, busy, agentMsgSelection, agentMsgContentForDetailOps]);

  const canStripAgentTokens = React.useMemo(
    () => Boolean(assistantTurn && messageHasSlotBrackets(agentMsgContentForDetailOps)),
    [assistantTurn, agentMsgContentForDetailOps]
  );

  const handleWrapAgentToken = React.useCallback(() => {
    if (!assistantTurn || busy || !selected) return;
    const ta = agentTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const content = agentMsgContentForDetailOps;
    const sel = content.slice(start, end);
    if (!sel.trim()) return;
    const wrapped = `[${sel}]`;
    const next = content.slice(0, start) + wrapped + content.slice(end);
    setAssistantTurnContent(assistantTurn.turn_id, next);
    if (agentMsgEditUseCaseId === selected.id) {
      setAgentMsgEditDraft(next);
      liveAgentContentRef.current = next;
    }
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
  }, [
    assistantTurn,
    busy,
    selected,
    agentMsgContentForDetailOps,
    agentMsgEditUseCaseId,
    setAssistantTurnContent,
    syncDetailTextareaHeights,
  ]);

  const handleStripAgentTokens = React.useCallback(() => {
    if (!assistantTurn || busy || !selected) return;
    const content = agentMsgContentForDetailOps;
    if (!messageHasSlotBrackets(content)) return;
    const next = stripAgentMessageSlotBrackets(content);
    setAssistantTurnContent(assistantTurn.turn_id, next);
    if (agentMsgEditUseCaseId === selected.id) {
      setAgentMsgEditDraft(next);
      liveAgentContentRef.current = next;
    }
    requestAnimationFrame(() => {
      syncDetailTextareaHeights();
      syncAgentMsgSelection();
    });
  }, [
    assistantTurn,
    busy,
    selected,
    agentMsgContentForDetailOps,
    agentMsgEditUseCaseId,
    setAssistantTurnContent,
    syncDetailTextareaHeights,
    syncAgentMsgSelection,
  ]);

  const handleScenarioRegenerateClick = React.useCallback(async () => {
    if (!selected || busy) return;
    const updated = await onRegenerateUseCase(selected.id);
    if (updated) {
      const ast = updated.dialogue.find((t) => t.role === 'assistant');
      setFieldBaselineByUseCaseId((prev) => ({
        ...prev,
        [selected.id]: {
          label: updated.label,
          payoff: typeof updated.payoff === 'string' ? updated.payoff : '',
          assistantContent: ast?.content ?? '',
        },
      }));
    }
  }, [selected, busy, onRegenerateUseCase]);

  const ensureAssistantTurnFor = React.useCallback(
    (useCaseId: string) => {
      setUseCases((prev) =>
        prev.map((u) => {
          if (u.id !== useCaseId) return u;
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
    },
    [setUseCases]
  );

  const ensureAssistantTurn = React.useCallback(() => {
    if (!selected) return;
    ensureAssistantTurnFor(selected.id);
  }, [selected, ensureAssistantTurnFor]);

  React.useLayoutEffect(() => {
    syncDetailTextareaHeights();
  }, [
    syncDetailTextareaHeights,
    effectiveSelectedId,
    selected?.payoff,
    assistantTurn?.content,
    assistantTurn?.turn_id,
  ]);

  React.useLayoutEffect(() => {
    if (!primaryGenerateOnRightOnly) return;
    syncWizardTextareaHeights();
  }, [
    primaryGenerateOnRightOnly,
    syncWizardTextareaHeights,
    useCases,
    wizardShowScenario,
    wizardShowMessage,
    cardExpandedById,
  ]);

  /**
   * Keep liveAgentContentRef in sync with external state changes (API annotation response,
   * use case selection, regeneration). User input is captured directly in onChange and takes
   * precedence since it runs synchronously before React's render cycle.
   */
  React.useEffect(() => {
    liveAgentContentRef.current = assistantTurn?.content ?? '';
  }, [assistantTurn?.content, assistantTurn?.turn_id]);

  React.useEffect(() => {
    const m = { ...liveAgentContentByIdRef.current };
    for (const uc of useCases) {
      const t = uc.dialogue.find((x) => x.role === 'assistant');
      m[uc.id] = t?.content ?? '';
    }
    liveAgentContentByIdRef.current = m;
  }, [useCases]);

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
      {!primaryGenerateOnRightOnly ? (
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
      ) : null}

      {ordered.length > 0 && !primaryGenerateOnRightOnly ? (
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
            ordered.length === 0 || primaryGenerateOnRightOnly
              ? 'w-full'
              : 'w-full sm:w-[44%]'
          } shrink-0 min-h-0 flex-1 flex flex-col self-stretch overflow-hidden min-h-[240px] ${USE_CASE_PANEL_SHELL}`}
        >
          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden">
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
                      : primaryGenerateOnRightOnly
                        ? 'Nessuno scenario ancora. Usa la bozza sopra (INVIO per creare in batch) oppure il pulsante «Genera use case» nel pannello Tutorial a destra.'
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
              <>
              <ul className="flex flex-col gap-1 p-1 pb-2">
                {ordered.map((u) => {
                  const rowBaseline = fieldBaselineByUseCaseId[u.id];
                  const depth = depthById[u.id] ?? 0;
                  const active = u.id === effectiveSelectedId;
                  const editingTitle = editingTitleId === u.id;
                  const creatingChild = creatingChildParentId === u.id;
                  const reviewed = Boolean(u.designer_edit_confirmed || u.designer_acknowledged);
                  const descriptionTooltip = String(u.notes?.behavior || '').trim();
                  const rowAssistant = u.dialogue.find((t) => t.role === 'assistant');
                  const cardExpanded =
                    !primaryGenerateOnRightOnly || cardExpandedById[u.id] !== false;
                  const showWizardBody =
                    primaryGenerateOnRightOnly &&
                    cardExpanded &&
                    (wizardShowScenario || wizardShowMessage);
                  return (
                    <li
                      key={u.id}
                      className={
                        highlightIdSet.has(u.id)
                          ? 'overflow-hidden rounded-md border border-amber-500/55 bg-amber-950/20 ring-2 ring-amber-400/40'
                          : 'overflow-hidden rounded-md border border-slate-600/45 bg-slate-950/30'
                      }
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
                        className={`group/uc-head flex cursor-pointer items-center gap-1 pl-1.5 pr-2 py-1 ${
                          active ? 'bg-violet-900/40' : 'hover:bg-slate-800/80'
                        }`}
                        style={{ paddingLeft: `${4 + depth * 8}px` }}
                      >
                        <div className="flex w-5 shrink-0 items-center justify-center">
                          {reviewed ? (
                            <Check
                              size={14}
                              className="shrink-0 text-emerald-400/95"
                              aria-label="Controllato"
                            />
                          ) : (
                            <button
                              type="button"
                              title="Segna come controllato"
                              aria-label="Segna come controllato"
                              className="shrink-0 rounded-full p-0.5 text-slate-500 opacity-0 transition-opacity hover:bg-slate-800/90 hover:text-slate-200 group-hover/uc-head:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                acknowledgeUseCaseReview(u.id);
                              }}
                            >
                              <Circle size={14} strokeWidth={2} aria-hidden />
                            </button>
                          )}
                        </div>
                        {primaryGenerateOnRightOnly ? (
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/90 hover:text-slate-100"
                            title={cardExpanded ? 'Collassa' : 'Espandi'}
                            aria-expanded={cardExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardExpandedById((prev) => {
                                const isOpen = prev[u.id] !== false;
                                return { ...prev, [u.id]: !isOpen };
                              });
                              listToolbarCtx?.notifyCardToggle();
                            }}
                          >
                            {cardExpanded ? (
                              <ChevronDown size={14} aria-hidden />
                            ) : (
                              <ChevronRight size={14} aria-hidden />
                            )}
                          </button>
                        ) : null}
                        <GitBranch size={12} className="shrink-0 opacity-60 text-slate-400" aria-hidden />
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
                            />
                            <button
                              type="button"
                              title="Conferma"
                              disabled={busy}
                              className="shrink-0 rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 hover:text-emerald-300 disabled:opacity-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitTitleEdit(u.id);
                              }}
                            >
                              <Check size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              title="Annulla"
                              disabled={busy}
                              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/90 hover:text-slate-100 disabled:opacity-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDraftTitle(u.label);
                                setEditingTitleId(null);
                              }}
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              title={descriptionTooltip || undefined}
                              className={`min-w-0 flex-1 text-left text-sm truncate ${fieldTextClass(
                                u.designer_label_vote,
                                u.label ?? '',
                                fieldBaselineByUseCaseId[u.id]?.label
                              )} ${active ? 'font-semibold' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (u.id !== effectiveSelectedId) setSelectedId(u.id);
                              }}
                            >
                              {u.label || u.id}
                            </button>
                            <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/uc-head:opacity-100 group-focus-within/uc-head:opacity-100">
                              <VoteThumbPair
                                vote={u.designer_label_vote}
                                disabled={busy}
                                outerBtnClass={UC_HEAD_VOTE_BTN}
                                onVote={(choice) => toggleDesignerFieldVote(u.id, 'label', choice)}
                              />
                              <button
                                type="button"
                                title="Modifica etichetta"
                                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-violet-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDraftTitle(u.label);
                                  setEditingTitleId(u.id);
                                }}
                              >
                                <Pencil size={12} aria-hidden />
                              </button>
                              {!primaryGenerateOnRightOnly ? (
                                <button
                                  type="button"
                                  title="Aggiungi figlio"
                                  className="shrink-0 rounded p-0.5 text-slate-400 hover:text-violet-200"
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
                              <button
                                type="button"
                                title="Elimina questo scenario e i figli"
                                aria-label="Elimina scenario"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteUseCase(u.id);
                                }}
                                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/90 hover:text-rose-300 disabled:opacity-40"
                              >
                                <Trash2 size={14} aria-hidden />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      {creatingChild ? (
                        <div
                          className="border-t border-slate-700/45 px-2 py-2 bg-slate-950/40"
                          style={{ paddingLeft: `${4 + (depth + 1) * 8}px` }}
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
                      {showWizardBody ? (
                        <div
                          className="border-t border-slate-700/45 px-2 py-2 space-y-2 bg-slate-950/25"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {wizardShowScenario ? (
                            <div className="rounded-md ring-1 ring-violet-500/25 bg-slate-950/40 px-2 py-1">
                              {payoffEditUseCaseId === u.id ? (
                                <div className="flex flex-wrap items-start gap-2">
                                  <span className={UC_PILL_SCENARIO}>Scenario</span>
                                  <textarea
                                    ref={(el) => {
                                      if (el) payoffTextareaRefsById.current.set(u.id, el);
                                      else payoffTextareaRefsById.current.delete(u.id);
                                    }}
                                    value={payoffEditDraft}
                                    onChange={(e) => {
                                      setPayoffEditDraft(e.target.value);
                                      requestAnimationFrame(() => syncWizardTextareaHeights());
                                    }}
                                    disabled={busy}
                                    rows={2}
                                    autoFocus
                                    placeholder="Descrizione sintetica dello scenario…"
                                    className={`${UC_CLASSIC_TEXTAREA_SCENARIO} min-h-[52px]`}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        e.preventDefault();
                                        cancelPayoffEdit();
                                      }
                                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        commitPayoffEdit();
                                      }
                                    }}
                                  />
                                  <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                                    <button
                                      type="button"
                                      title="Conferma"
                                      disabled={busy}
                                      className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                                      onClick={() => commitPayoffEdit()}
                                    >
                                      <Check size={14} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      title="Annulla"
                                      disabled={busy}
                                      className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                                      onClick={() => cancelPayoffEdit()}
                                    >
                                      <X size={14} aria-hidden />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="group/payoff-row flex w-full min-w-0 items-center gap-x-1 rounded px-0.5 py-0">
                                  <span className={UC_PILL_SCENARIO}>Scenario</span>
                                  <p
                                    className={`min-w-0 flex-1 cursor-default text-xs leading-snug whitespace-pre-wrap ${fieldTextClass(
                                      u.designer_payoff_vote,
                                      (u.payoff ?? '').trim() ? (u.payoff ?? '') : '',
                                      rowBaseline?.payoff
                                    )}`}
                                  >
                                    {(u.payoff ?? '').trim() ? (
                                      u.payoff
                                    ) : (
                                      <span className="text-slate-500">— passa il mouse e usa la matita a destra</span>
                                    )}
                                  </p>
                                  <VoteThumbPair
                                    vote={u.designer_payoff_vote}
                                    disabled={busy}
                                    outerBtnClass={UC_SCENARIO_VOTE_BTN}
                                    onVote={(choice) => toggleDesignerFieldVote(u.id, 'payoff', choice)}
                                  />
                                  <button
                                    type="button"
                                    disabled={busy}
                                    title="Modifica scenario"
                                    className={UC_SCENARIO_ROW_EDIT_BTN}
                                    onClick={() => beginPayoffEdit(u.id, u.payoff ?? '')}
                                  >
                                    <Pencil size={12} aria-hidden />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                          {wizardShowMessage ? (
                            <div className="rounded-md ring-1 ring-emerald-600/35 bg-emerald-950/20 px-2 py-1">
                              {rowAssistant ? (
                                <>
                                  {agentMsgEditUseCaseId === u.id ? (
                                    <div className="flex flex-wrap items-start gap-2">
                                      <span className={UC_PILL_AGENT_MSG}>Messaggio agente</span>
                                      <textarea
                                        ref={(el) => {
                                          if (el) agentTextareaRefsById.current.set(u.id, el);
                                          else agentTextareaRefsById.current.delete(u.id);
                                        }}
                                        value={agentMsgEditDraft}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setAgentMsgEditDraft(v);
                                          liveAgentContentByIdRef.current[u.id] = v;
                                          requestAnimationFrame(() => syncWizardTextareaHeights());
                                        }}
                                        disabled={busy}
                                        rows={2}
                                        autoFocus
                                        spellCheck={false}
                                        aria-label="Messaggio agente"
                                        placeholder="Testo esempio per il messaggio agente…"
                                        className={`${UC_CLASSIC_TEXTAREA_AGENT} min-h-[52px]`}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            cancelAgentMsgEdit();
                                          }
                                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                            e.preventDefault();
                                            commitAgentMsgEdit();
                                          }
                                        }}
                                      />
                                      <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                                        <button
                                          type="button"
                                          title="Conferma"
                                          disabled={busy}
                                          className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                                          onClick={() => commitAgentMsgEdit()}
                                        >
                                          <Check size={14} aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          title="Annulla"
                                          disabled={busy}
                                          className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                                          onClick={() => cancelAgentMsgEdit()}
                                        >
                                          <X size={14} aria-hidden />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="group/agentmsg-row flex w-full min-w-0 items-center gap-x-1 rounded px-0.5 py-0">
                                      <span className={UC_PILL_AGENT_MSG}>Messaggio agente</span>
                                      <p
                                        className={`min-w-0 flex-1 cursor-default font-mono text-sm leading-snug whitespace-pre-wrap ${fieldTextClass(
                                          u.designer_agent_message_vote,
                                          rowAssistant.content,
                                          rowBaseline?.assistantContent
                                        )}`}
                                      >
                                        {rowAssistant.content.trim() ? (
                                          rowAssistant.content
                                        ) : (
                                          <span className="text-slate-500">— passa il mouse e usa la matita a destra</span>
                                        )}
                                      </p>
                                      <VoteThumbPair
                                        vote={u.designer_agent_message_vote}
                                        disabled={busy}
                                        outerBtnClass={UC_AGENT_VOTE_BTN}
                                        onVote={(choice) =>
                                          toggleDesignerFieldVote(u.id, 'agentMessage', choice)
                                        }
                                      />
                                      <button
                                        type="button"
                                        disabled={busy}
                                        title="Modifica messaggio"
                                        className={UC_AGENT_ROW_EDIT_BTN}
                                        onClick={() =>
                                          beginAgentMsgEdit(u.id, rowAssistant.turn_id, rowAssistant.content)
                                        }
                                      >
                                        <Pencil size={12} aria-hidden />
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={UC_PILL_AGENT_MSG}>Messaggio agente</span>
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <p className="text-xs text-slate-500">
                                      Nessun turno assistente. Aggiungi un messaggio vuoto per iniziare.
                                    </p>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => ensureAssistantTurnFor(u.id)}
                                      className="text-xs text-emerald-300 underline disabled:opacity-50"
                                    >
                                      Aggiungi messaggio agente (vuoto)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              </>
              )}
          </div>
        </div>

        {ordered.length > 0 && !primaryGenerateOnRightOnly ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden self-stretch">
              {selected ? (
                <div className="flex flex-1 min-h-0 flex-col overflow-auto gap-3 px-0.5 py-1 min-h-0">
                  <div className="rounded-lg ring-1 ring-violet-500/35 bg-slate-950/40 px-2 py-1">
                    {payoffEditUseCaseId === selected.id ? (
                      <div className="flex flex-wrap items-start gap-2">
                        <span className={UC_PILL_SCENARIO}>Scenario</span>
                        <textarea
                          ref={payoffTextareaRef}
                          value={payoffEditDraft}
                          onChange={(e) => {
                            setPayoffEditDraft(e.target.value);
                            requestAnimationFrame(() => syncDetailTextareaHeights());
                          }}
                          disabled={busy}
                          rows={2}
                          autoFocus
                          placeholder="Descrizione sintetica dello scenario…"
                          className={`${UC_CLASSIC_TEXTAREA_SCENARIO} min-h-[52px]`}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelPayoffEdit();
                            }
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              commitPayoffEdit();
                            }
                          }}
                        />
                        <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                          <button
                            type="button"
                            title="Conferma"
                            disabled={busy}
                            className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                            onClick={() => commitPayoffEdit()}
                          >
                            <Check size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            title="Annulla"
                            disabled={busy}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                            onClick={() => cancelPayoffEdit()}
                          >
                            <X size={14} aria-hidden />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group/payoff-row flex w-full min-w-0 items-center gap-x-1">
                        <span className={UC_PILL_SCENARIO}>Scenario</span>
                        <p
                          className={`min-w-0 flex-1 text-xs leading-snug whitespace-pre-wrap ${fieldTextClass(
                            selected.designer_payoff_vote,
                            selected.payoff ?? '',
                            fieldBaselineByUseCaseId[selected.id]?.payoff
                          )}`}
                        >
                          {(selected.payoff ?? '').trim() ? (
                            selected.payoff
                          ) : (
                            <span className="text-slate-500">— passa il mouse sulla riga e usa la matita a destra</span>
                          )}
                        </p>
                        {scenarioDirty ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleScenarioRegenerateClick()}
                            title={LABEL_REGENERATE_USE_CASE_FOR_SCENARIO}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-500/50 bg-violet-900/40 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-violet-100 hover:bg-violet-800/50 disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 className="animate-spin shrink-0" size={12} aria-hidden />
                            ) : (
                              <RefreshCw size={12} className="shrink-0" aria-hidden />
                            )}
                            {LABEL_REGENERATE_USE_CASE_FOR_SCENARIO}
                          </button>
                        ) : null}
                        <VoteThumbPair
                          vote={selected.designer_payoff_vote}
                          disabled={busy}
                          outerBtnClass={UC_SCENARIO_VOTE_BTN}
                          onVote={(choice) => toggleDesignerFieldVote(selected.id, 'payoff', choice)}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          title="Modifica scenario"
                          className={UC_SCENARIO_ROW_EDIT_BTN}
                          onClick={() => beginPayoffEdit(selected.id, selected.payoff ?? '')}
                        >
                          <Pencil size={12} aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg ring-1 ring-emerald-600/40 bg-emerald-950/20 px-2 py-1">
                    {assistantTurn ? (
                      agentMsgEditUseCaseId === selected.id ? (
                        <div className="flex flex-wrap items-start gap-2">
                          <span className={UC_PILL_AGENT_MSG}>Messaggio agente</span>
                          <textarea
                            ref={agentTextareaRef}
                            value={agentMsgEditDraft}
                            onChange={(e) => {
                              const v = e.target.value;
                              liveAgentContentRef.current = v;
                              setAgentMsgEditDraft(v);
                              requestAnimationFrame(() => syncDetailTextareaHeights());
                            }}
                            onMouseUp={syncAgentMsgSelection}
                            onSelect={syncAgentMsgSelection}
                            onKeyUp={syncAgentMsgSelection}
                            disabled={busy}
                            rows={2}
                            autoFocus
                            spellCheck={false}
                            aria-label="Messaggio agente"
                            placeholder="Seleziona testo e usa Token per creare [slot]. Senza quadre rimuove il markup."
                            className={`${UC_CLASSIC_TEXTAREA_AGENT} min-h-[52px]`}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelAgentMsgEdit();
                              }
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                commitAgentMsgEdit();
                              }
                            }}
                          />
                          <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                            <button
                              type="button"
                              title="Conferma"
                              disabled={busy}
                              className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                              onClick={() => commitAgentMsgEdit()}
                            >
                              <Check size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              title="Annulla"
                              disabled={busy}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                              onClick={() => cancelAgentMsgEdit()}
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="group/agentmsg-row flex w-full min-w-0 items-center gap-x-1">
                          <span className={UC_PILL_AGENT_MSG}>Messaggio agente</span>
                          <p
                            className={`min-w-0 flex-1 font-mono text-sm leading-snug whitespace-pre-wrap ${fieldTextClass(
                              selected.designer_agent_message_vote,
                              assistantTurn.content,
                              fieldBaselineByUseCaseId[selected.id]?.assistantContent
                            )}`}
                          >
                            {assistantTurn.content.trim() ? (
                              assistantTurn.content
                            ) : (
                              <span className="text-slate-500">— passa il mouse sulla riga e usa la matita a destra</span>
                            )}
                          </p>
                          <VoteThumbPair
                            vote={selected.designer_agent_message_vote}
                            disabled={busy}
                            outerBtnClass={UC_AGENT_VOTE_BTN}
                            onVote={(choice) =>
                              toggleDesignerFieldVote(selected.id, 'agentMessage', choice)
                            }
                          />
                          <button
                            type="button"
                            disabled={busy}
                            title="Modifica messaggio"
                            className={UC_AGENT_ROW_EDIT_BTN}
                            onClick={() =>
                              beginAgentMsgEdit(selected.id, assistantTurn.turn_id, assistantTurn.content)
                            }
                          >
                            <Pencil size={12} aria-hidden />
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                        <span className={UC_PILL_AGENT_MSG}>Messaggio agente</span>
                        <div className="min-w-0 flex-1 space-y-2 py-0.5">
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
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-emerald-800/40 pt-1.5">
                      {assistantTurn && !agentMessageEmpty ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !canWrapAgentToken ||
                              (Boolean(selected) && agentMsgEditUseCaseId !== selected.id)
                            }
                            title={
                              selected && agentMsgEditUseCaseId !== selected.id
                                ? 'Apri la modifica con la matita per selezionare il testo e usare Token'
                                : 'Avvolge il testo selezionato tra quadre [ ] come slot runtime'
                            }
                            onClick={() => handleWrapAgentToken()}
                            className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/50 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-50 hover:bg-emerald-900/70 disabled:opacity-40"
                          >
                            <Brackets size={12} className="shrink-0 opacity-90" aria-hidden />
                            {LABEL_AGENT_MSG_WRAP_TOKEN}
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !canStripAgentTokens ||
                              (Boolean(selected) && agentMsgEditUseCaseId !== selected.id)
                            }
                            onClick={() => handleStripAgentTokens()}
                            title={
                              selected && agentMsgEditUseCaseId !== selected.id
                                ? 'Apri la modifica con la matita per usare questa azione sul testo'
                                : 'Rimuove tutte le quadre [ ], lasciando solo il testo interno'
                            }
                            className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/45 bg-emerald-950/45 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-100/95 hover:bg-emerald-900/55 disabled:opacity-40"
                          >
                            {LABEL_AGENT_MSG_STRIP_TOKENS}
                          </button>
                        </>
                      ) : null}
                      {agentMessageEmpty ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              const next = await onRegenerateAgentMessage(selected.id);
                              if (typeof next === 'string') {
                                setFieldBaselineByUseCaseId((prev) => {
                                  const cur = prev[selected.id];
                                  if (!cur) return prev;
                                  return {
                                    ...prev,
                                    [selected.id]: { ...cur, assistantContent: next },
                                  };
                                });
                              }
                            })();
                          }}
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
                </div>
              ) : null}
            </div>
        ) : null}
      </div>
    </div>
  );
}
