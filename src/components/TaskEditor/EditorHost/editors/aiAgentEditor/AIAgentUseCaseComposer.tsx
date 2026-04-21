/**
 * Use Case Composer: tree of scenarios, metadata fields, dialogue via chat preview bridge.
 */

import React from 'react';
import { Check, GitBranch, Loader2, MessageSquare, Pencil, RefreshCw, Sparkles, X } from 'lucide-react';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
  AI_AGENT_PREVIEW_STYLES,
} from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import { AIAgentPreviewChatPanel } from './AIAgentPreviewChatPanel';
import { orderUseCasesWithDepth } from './useCaseTreeOrder';
import { previewToUseCaseDialogue, useCaseDialogueToPreview } from './useCaseDialogueBridge';
import { HoverEditMultiline } from './HoverEditMultiline';
import { LABEL_GENERATE_USE_CASES } from './constants';

/** Main panels: slate-800 on near-black reads as broken/missing borders; slightly lighter edge for clarity. */
const USE_CASE_PANEL_SHELL =
  'rounded-lg border border-slate-600/65 bg-slate-900/40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]';

export interface AIAgentUseCaseComposerProps {
  logicalSteps: readonly AIAgentLogicalStep[];
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  busy: boolean;
  error: string | null;
  onDismissError: () => void;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void>;
  previewStyleId?: string;
  onPreviewStyleIdChange?: (styleId: string) => void;
  /** When set, empty state shows a primary CTA (e.g. tab toolbar hidden). */
  onGenerateUseCaseBundle?: () => void | Promise<void>;
  /** Disables generate CTA while Create/Refine agent is running. */
  generating?: boolean;
}

export function AIAgentUseCaseComposer({
  logicalSteps: _logicalSteps,
  useCases,
  setUseCases,
  busy,
  error,
  onDismissError,
  onRegenerateUseCase,
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
    setSelectedId((prev) => {
      if (prev && useCases.some((u) => u.id === prev)) return prev;
      const { ordered: o } = orderUseCasesWithDepth(useCases);
      return o[0]?.id ?? null;
    });
  }, [useCases]);

  /** Stable selection while the list is non-empty (avoids empty right pane before effect runs). */
  const effectiveSelectedId = React.useMemo(() => {
    if (ordered.length === 0) return null;
    if (selectedId != null && ordered.some((u) => u.id === selectedId)) return selectedId;
    return ordered[0]?.id ?? null;
  }, [ordered, selectedId]);

  const selected = effectiveSelectedId ? useCases.find((u) => u.id === effectiveSelectedId) : undefined;
  const previewTurns = React.useMemo(
    () =>
      selected
        ? useCaseDialogueToPreview(selected.dialogue, selected.bubble_notes)
        : [],
    [selected]
  );

  /** Use case ids where notes changed vs last regeneration — show rigenera next to the title. */
  const [needsRegenerateScenarioIds, setNeedsRegenerateScenarioIds] = React.useState<Set<string>>(
    () => new Set()
  );

  /** Expanded note panels (toggle on title; selection always expands the active row). */
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const [editingTitleId, setEditingTitleId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState('');

  /** New selection opens that scenario; collapse state is per-row until selection changes again. */
  React.useEffect(() => {
    if (effectiveSelectedId) {
      setExpandedIds(new Set([effectiveSelectedId]));
    }
  }, [effectiveSelectedId]);

  React.useEffect(() => {
    setEditingTitleId(null);
  }, [effectiveSelectedId]);

  const flagNeedsRegenerateScenario = React.useCallback((id: string) => {
    setNeedsRegenerateScenarioIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const clearNeedsRegenerateScenario = React.useCallback((id: string) => {
    setNeedsRegenerateScenarioIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const patchSelected = React.useCallback(
    (patch: Partial<AIAgentUseCase>) => {
      if (!effectiveSelectedId) return;
      if (Object.prototype.hasOwnProperty.call(patch, 'notes')) {
        flagNeedsRegenerateScenario(effectiveSelectedId);
      }
      setUseCases((prev) =>
        prev.map((u) => (u.id === effectiveSelectedId ? { ...u, ...patch } : u))
      );
    },
    [effectiveSelectedId, setUseCases, flagNeedsRegenerateScenario]
  );

  const regenerateUseCaseFromSidebar = React.useCallback(
    async (useCaseId: string) => {
      try {
        await onRegenerateUseCase(useCaseId);
        clearNeedsRegenerateScenario(useCaseId);
      } catch {
        /* parent may surface error; keep hint visible */
      }
    },
    [onRegenerateUseCase, clearNeedsRegenerateScenario]
  );

  const handlePreviewTurnsChange = React.useCallback(
    (next: AIAgentPreviewTurn[]) => {
      if (!effectiveSelectedId) return;
      setUseCases((prev) => {
        const uc = prev.find((u) => u.id === effectiveSelectedId);
        if (!uc) return prev;
        const { dialogue, bubble_notes } = previewToUseCaseDialogue(next, uc.dialogue);
        return prev.map((u) =>
          u.id === effectiveSelectedId ? { ...u, dialogue, bubble_notes } : u
        );
      });
    },
    [effectiveSelectedId, setUseCases]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
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

      <div className="flex flex-1 min-h-0 gap-2 flex-col sm:flex-row sm:items-stretch sm:min-h-[320px]">
        {ordered.length === 0 ? (
          <div className={`flex-1 min-h-0 w-full overflow-y-auto flex flex-col ${USE_CASE_PANEL_SHELL}`}>
            <div className="flex-1 min-h-[120px] flex flex-col items-center justify-center gap-4 p-6 text-center">
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
                  {busy ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
                  {busy ? 'Generazione scenari…' : LABEL_GENERATE_USE_CASES}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div
              className={`w-full sm:w-[44%] shrink-0 min-h-0 flex-1 overflow-y-auto flex flex-col self-stretch ${USE_CASE_PANEL_SHELL}`}
            >
              <ul className="p-1.5 flex flex-col gap-1 flex-1 min-h-0">
                {ordered.map((u) => {
                  const depth = depthById[u.id] ?? 0;
                  const active = u.id === effectiveSelectedId;
                  const showRegen = needsRegenerateScenarioIds.has(u.id);
                  const notesOpen = active && expandedIds.has(u.id);
                  const editingTitle = editingTitleId === u.id && active;
                  return (
                    <li key={u.id} className="rounded-md border border-slate-600/45 bg-slate-950/30 overflow-hidden">
                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (u.id !== effectiveSelectedId) {
                              setSelectedId(u.id);
                            } else {
                              setExpandedIds(new Set([u.id]));
                            }
                          }
                        }}
                        onClick={() => {
                          if (u.id !== effectiveSelectedId) {
                            setSelectedId(u.id);
                          } else {
                            setExpandedIds(new Set([u.id]));
                          }
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
                                  if (e.key === 'Escape') {
                                    e.stopPropagation();
                                    setEditingTitleId(null);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                title="Conferma"
                                disabled={busy}
                                className="shrink-0 p-0.5 rounded text-emerald-400 hover:bg-slate-800"
                                onClick={() => {
                                  patchSelected({ label: draftTitle });
                                  setEditingTitleId(null);
                                }}
                              >
                                <Check size={14} aria-hidden />
                              </button>
                              <button
                                type="button"
                                title="Annulla"
                                className="shrink-0 p-0.5 rounded text-slate-400 hover:bg-slate-800"
                                onClick={() => setEditingTitleId(null)}
                              >
                                <X size={14} aria-hidden />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                aria-expanded={notesOpen}
                                className={`min-w-0 flex-1 text-left text-sm truncate ${
                                  active ? 'text-violet-100' : 'text-slate-300'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (u.id !== effectiveSelectedId) {
                                    setSelectedId(u.id);
                                  } else {
                                    setExpandedIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(u.id)) next.delete(u.id);
                                      else next.add(u.id);
                                      return next;
                                    });
                                  }
                                }}
                              >
                                {u.label || u.id}
                              </button>
                              {active ? (
                                <button
                                  type="button"
                                  title="Modifica etichetta"
                                  className="shrink-0 p-0.5 rounded text-slate-500 hover:text-violet-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDraftTitle(u.label);
                                    setEditingTitleId(u.id);
                                  }}
                                >
                                  <Pencil size={12} aria-hidden />
                                </button>
                              ) : null}
                              {showRegen ? (
                                <button
                                  type="button"
                                  title="Rigenera scenario dalle note"
                                  aria-label="Rigenera scenario dalle note"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void regenerateUseCaseFromSidebar(u.id);
                                  }}
                                  className="shrink-0 p-0.5 rounded text-slate-400 hover:text-violet-200 hover:bg-slate-800/90 disabled:opacity-40"
                                >
                                  {busy ? (
                                    <Loader2 className="animate-spin" size={14} aria-hidden />
                                  ) : (
                                    <RefreshCw size={14} aria-hidden />
                                  )}
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                      {notesOpen ? (
                        <div className="border-t border-slate-600/40 px-2 pb-2 pt-1.5">
                          <HoverEditMultiline
                            label=""
                            compact
                            contentClassName="text-sky-300"
                            value={u.notes.behavior}
                            onChange={(v) =>
                              patchSelected({
                                notes: { ...u.notes, behavior: v },
                              })
                            }
                            disabled={busy}
                            rows={3}
                          />
                          <div className="mt-1 border-t border-slate-600/35 pt-1">
                            <HoverEditMultiline
                              label=""
                              compact
                              contentClassName="text-orange-300"
                              value={u.notes.tone}
                              onChange={(v) =>
                                patchSelected({
                                  notes: { ...u.notes, tone: v },
                                })
                              }
                              disabled={busy}
                              rows={3}
                            />
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-1 min-h-0 flex-col overflow-hidden self-stretch">
              {selected ? (
                <div className={`flex flex-1 min-h-0 flex-col overflow-hidden ${USE_CASE_PANEL_SHELL}`}>
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-600/45 bg-slate-950/50 px-2 py-2 min-w-0">
                    <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      <MessageSquare size={14} className="shrink-0 text-violet-400" aria-hidden />
                      <span className="truncate">Esempio di dialogo</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label
                        htmlFor="ai-agent-use-case-preview-style"
                        className="text-xs text-slate-500 whitespace-nowrap"
                      >
                        Stile
                      </label>
                      <select
                        id="ai-agent-use-case-preview-style"
                        value={previewStyleId}
                        onChange={(e) => onPreviewStyleIdChange(e.target.value)}
                        disabled={busy}
                        className="rounded-md bg-slate-900 border border-slate-600 px-2 py-1.5 text-sm text-slate-200 min-w-[9rem] max-w-[14rem] focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {AI_AGENT_PREVIEW_STYLES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                    <AIAgentPreviewChatPanel
                      selectedStyleId={previewStyleId}
                      onStyleIdChange={onPreviewStyleIdChange}
                      turns={previewTurns}
                      onTurnsChange={handlePreviewTurnsChange}
                      readOnly={busy}
                      hideStyleSelector
                      flushMessagesArea
                      emptyPlaceholder={
                        <div className="flex flex-1 min-h-0 items-center justify-center p-4 text-sm text-slate-500 text-center">
                          Dialogo vuoto.
                        </div>
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
