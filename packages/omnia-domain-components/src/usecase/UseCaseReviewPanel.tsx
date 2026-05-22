/**
 * Pannello use case per il portale review: accordion categorie/scenario/messaggio, senza IA/dock/DnD.
 */

import React from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  MessageSquareText,
  Plus,
  Trash2,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import { getAssistantExample } from '@types/aiAgentUseCases';
import { getScenarioText, withScenarioText } from '@domain/aiAgentUseCase/scenarioText';
import { displayUseCaseLabelForCategory } from '@domain/aiAgentUseCase/useCaseCategories';
import { orderUseCasesWithDepth } from '@omnia/domain-core/usecase/tree/useCaseTreeOrder';
import { UseCaseCategoryHeader } from './UseCaseCategoryHeader';
import {
  UC_CLASSIC_TEXTAREA_SCENARIO,
  UC_USE_CASE_LIST_SCROLL,
  UC_WIZARD_AGENT_MESSAGE_PANEL,
  UC_WIZARD_CARD_BODY,
  UC_WIZARD_ROW_EXPANDED,
  UC_WIZARD_SCENARIO_BLOCK,
  USE_CASE_PANEL_SHELL,
} from './reviewPresentation';
import { buildUseCaseReviewListRows } from './useCaseReviewListRows';
import { UseCaseActionsReadOnlyList } from './UseCaseActionsReadOnlyList';
import {
  createBlankUseCaseInList,
  deleteUseCaseFromList,
  duplicateUseCaseInList,
  moveUseCaseAmongSiblings,
} from '@omnia/domain-core/usecase/logic/useCaseBundleCompose';

export interface UseCaseReviewPanelProps {
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  useCaseCategories: readonly AIAgentUseCaseCategory[];
  onUseCaseCategoryLabelChange?: (categoryId: string, label: string) => void;
  onUseCaseCategoryDescriptionChange?: (categoryId: string, description: string) => void;
  error: string | null;
  onDismissError: () => void;
  controlledSelectionId?: string | null;
  onSelectionChange?: (selectedUseCaseId: string | null) => void;
  /** Enables add/delete/duplicate/reorder toolbar (review portal compose). */
  composeEnabled?: boolean;
}

export function UseCaseReviewPanel({
  useCases,
  setUseCases,
  useCaseCategories,
  onUseCaseCategoryLabelChange,
  onUseCaseCategoryDescriptionChange,
  error,
  onDismissError,
  controlledSelectionId,
  onSelectionChange,
  composeEnabled = false,
}: UseCaseReviewPanelProps): React.ReactElement {
  const { ordered } = React.useMemo(() => orderUseCasesWithDepth(useCases), [useCases]);
  const rows = React.useMemo(
    () => buildUseCaseReviewListRows(useCaseCategories, ordered),
    [useCaseCategories, ordered]
  );

  const [collapsedCategoryIds, setCollapsedCategoryIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [expandedById, setExpandedById] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setExpandedById((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const u of ordered) {
        if (next[u.id] === undefined) {
          next[u.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [ordered]);

  const [internalSelectedId, setInternalSelectedId] = React.useState<string | null>(null);
  const effectiveSelectedId =
    controlledSelectionId !== undefined ? controlledSelectionId : internalSelectedId;

  React.useEffect(() => {
    if (ordered.length === 0) {
      if (effectiveSelectedId !== null) {
        if (controlledSelectionId === undefined) setInternalSelectedId(null);
        onSelectionChange?.(null);
      }
      return;
    }
    const still = ordered.some((u) => u.id === effectiveSelectedId);
    if (!still) {
      const first = ordered[0]?.id ?? null;
      if (controlledSelectionId === undefined) setInternalSelectedId(first);
      onSelectionChange?.(first);
    }
  }, [ordered, effectiveSelectedId, controlledSelectionId, onSelectionChange]);

  const setSelectedId = React.useCallback(
    (id: string | null) => {
      if (controlledSelectionId === undefined) setInternalSelectedId(id);
      onSelectionChange?.(id);
    },
    [controlledSelectionId, onSelectionChange]
  );

  const toggleCategory = React.useCallback((categoryId: string) => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  const toggleCard = React.useCallback((useCaseId: string) => {
    setExpandedById((prev) => ({ ...prev, [useCaseId]: !prev[useCaseId] }));
  }, []);

  const patchScenario = React.useCallback(
    (useCaseId: string, text: string) => {
      setUseCases((prev) =>
        prev.map((uc) => (uc.id === useCaseId ? withScenarioText(uc, text) : uc))
      );
    },
    [setUseCases]
  );

  const patchLabel = React.useCallback(
    (useCaseId: string, label: string) => {
      setUseCases((prev) =>
        prev.map((uc) => (uc.id === useCaseId ? { ...uc, label } : uc))
      );
    },
    [setUseCases]
  );

  const handleAddUseCase = React.useCallback(() => {
    const { useCases: next, newId } = createBlankUseCaseInList(useCases);
    setUseCases(next);
    setSelectedId(newId);
  }, [useCases, setUseCases, setSelectedId]);

  const handleDuplicateUseCase = React.useCallback(() => {
    if (!effectiveSelectedId) return;
    const { useCases: next, newRootId } = duplicateUseCaseInList(useCases, effectiveSelectedId);
    setUseCases(next);
    if (newRootId) setSelectedId(newRootId);
  }, [useCases, effectiveSelectedId, setUseCases, setSelectedId]);

  const handleDeleteUseCase = React.useCallback(() => {
    if (!effectiveSelectedId) return;
    const next = deleteUseCaseFromList(useCases, effectiveSelectedId);
    setUseCases(next);
  }, [useCases, effectiveSelectedId, setUseCases]);

  const handleMoveUseCase = React.useCallback(
    (direction: 'up' | 'down') => {
      if (!effectiveSelectedId) return;
      setUseCases((prev) => moveUseCaseAmongSiblings(prev, effectiveSelectedId, direction));
    },
    [effectiveSelectedId, setUseCases]
  );

  const patchAgentMessage = React.useCallback(
    (useCaseId: string, text: string) => {
      setUseCases((prev) =>
        prev.map((uc) => {
          if (uc.id !== useCaseId) return uc;
          const dialogue = [...(uc.dialogue ?? [])];
          const idx = dialogue.findIndex((t) => t.role === 'assistant');
          if (idx >= 0) {
            dialogue[idx] = { ...dialogue[idx], content: text };
            return { ...uc, dialogue };
          }
          return {
            ...uc,
            dialogue: [
              ...dialogue,
              { id: `asst-${useCaseId}`, role: 'assistant' as const, content: text },
            ],
          };
        })
      );
    },
    [setUseCases]
  );

  const scenarioIcon = (
    <span
      title="Scenario"
      aria-label="Scenario"
      className="shrink-0 inline-flex h-6 w-6 items-center justify-center text-violet-300"
    >
      <BookOpen size={15} aria-hidden />
    </span>
  );
  const agentMsgIcon = (
    <span
      title="Messaggio agente"
      aria-label="Messaggio agente"
      className="shrink-0 inline-flex h-6 w-6 items-center justify-center text-emerald-300"
    >
      <MessageSquareText size={15} aria-hidden />
    </span>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
      {error ? (
        <div className="mb-0 flex justify-between gap-2 rounded-lg border border-red-800/80 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          <span className="min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 text-xs text-red-300 underline hover:text-red-100"
          >
            Chiudi
          </button>
        </div>
      ) : null}

      {composeEnabled ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-700/60 px-2 py-1.5">
          <button
            type="button"
            onClick={handleAddUseCase}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            title="Aggiungi scenario"
          >
            <Plus size={14} aria-hidden />
            Aggiungi
          </button>
          <button
            type="button"
            onClick={handleDuplicateUseCase}
            disabled={!effectiveSelectedId}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            title="Duplica scenario selezionato"
          >
            <Copy size={14} aria-hidden />
            Duplica
          </button>
          <button
            type="button"
            onClick={handleDeleteUseCase}
            disabled={!effectiveSelectedId}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            title="Elimina scenario selezionato"
          >
            <Trash2 size={14} aria-hidden />
            Elimina
          </button>
          <button
            type="button"
            onClick={() => handleMoveUseCase('up')}
            disabled={!effectiveSelectedId}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            title="Sposta su"
          >
            <ArrowUp size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => handleMoveUseCase('down')}
            disabled={!effectiveSelectedId}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            title="Sposta giù"
          >
            <ArrowDown size={14} aria-hidden />
          </button>
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${USE_CASE_PANEL_SHELL}`}>
        {ordered.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-500">
            {composeEnabled
              ? 'Nessuno scenario. Usa «Aggiungi» per crearne uno.'
              : 'Nessun use case in questa review. Pubblica da Omnia.'}
          </p>
        ) : (
          <ul className={`min-h-0 flex-1 p-1 pb-2 ${UC_USE_CASE_LIST_SCROLL}`}>
            {rows.map((row) => {
              if (row.kind === 'category') {
                const expanded = !collapsedCategoryIds.has(row.category.id);
                return (
                  <UseCaseCategoryHeader
                    key={`cat-${row.category.id}`}
                    category={row.category}
                    useCaseCount={row.count}
                    expanded={expanded}
                    onToggle={() => toggleCategory(row.category.id)}
                    onLabelChange={(id, label) => onUseCaseCategoryLabelChange?.(id, label)}
                    onDescriptionChange={(id, desc) =>
                      onUseCaseCategoryDescriptionChange?.(id, desc)
                    }
                  />
                );
              }
              if (row.category && collapsedCategoryIds.has(row.category.id)) {
                return null;
              }
              const u = row.useCase;
              const cardExpanded = expandedById[u.id] !== false;
              const listLabel = row.category
                ? displayUseCaseLabelForCategory(u, row.category)
                : u.label || u.id;
              const active = u.id === effectiveSelectedId;

              return (
                <li
                  key={u.id}
                  className={`group/uc-row overflow-hidden rounded-md border ${
                    cardExpanded ? UC_WIZARD_ROW_EXPANDED : 'border-slate-600/40 bg-slate-900/40'
                  } ${row.category ? 'ml-8 mr-1 border-l-2 border-violet-500/40 pl-2' : ''}`}
                >
                  <button
                    type="button"
                    className={`flex w-full cursor-pointer items-start gap-1 py-1.5 pl-1.5 pr-2 text-left ${
                      active ? 'ring-1 ring-violet-500/40' : ''
                    }`}
                    onClick={() => setSelectedId(u.id)}
                  >
                    <span
                      role="presentation"
                      className="mt-[1px] shrink-0 rounded p-0.5 text-slate-300 hover:bg-slate-800/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCard(u.id);
                      }}
                    >
                      {cardExpanded ? (
                        <ChevronDown size={14} aria-hidden />
                      ) : (
                        <ChevronRight size={14} aria-hidden />
                      )}
                    </span>
                    <GitBranch
                      size={12}
                      className="mt-[4px] shrink-0 opacity-60 text-slate-400"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-100">
                      {listLabel}
                    </span>
                  </button>
                  {cardExpanded ? (
                    <div className={UC_WIZARD_CARD_BODY} onClick={(e) => e.stopPropagation()}>
                      {composeEnabled ? (
                        <label className="mb-2 block">
                          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Titolo
                          </span>
                          <input
                            type="text"
                            className="w-full rounded-md border border-slate-600/50 bg-slate-900/80 px-2 py-1 text-sm text-slate-100"
                            value={u.label ?? ''}
                            onChange={(e) => patchLabel(u.id, e.target.value)}
                          />
                        </label>
                      ) : null}
                      <div className={UC_WIZARD_SCENARIO_BLOCK}>
                        <div className="flex flex-wrap items-start gap-2">
                          {scenarioIcon}
                          <textarea
                            className={`${UC_CLASSIC_TEXTAREA_SCENARIO} min-h-[52px] flex-1`}
                            value={getScenarioText(u)}
                            onChange={(e) => patchScenario(u.id, e.target.value)}
                            placeholder="Descrizione scenario…"
                            rows={3}
                          />
                        </div>
                      </div>
                      <div className={UC_WIZARD_AGENT_MESSAGE_PANEL}>
                        <div className="flex flex-wrap items-start gap-2">
                          {agentMsgIcon}
                          <textarea
                            className="min-h-[52px] flex-1 rounded-md border border-slate-600/50 bg-slate-900/80 px-2 py-1.5 text-sm text-slate-100"
                            value={getAssistantExample(u)}
                            onChange={(e) => patchAgentMessage(u.id, e.target.value)}
                            placeholder="Messaggio agente…"
                            rows={3}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Azioni
                        </p>
                        <UseCaseActionsReadOnlyList useCase={u} />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
