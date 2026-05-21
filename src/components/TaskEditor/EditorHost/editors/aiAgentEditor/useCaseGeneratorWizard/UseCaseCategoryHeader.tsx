/**
 * Accordion categoria: chevron, titolo (N) se chiusa, descrizione, matita al hover.
 */

import React from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { AIAgentUseCaseCategory } from '@types/aiAgentUseCases';

export type UseCaseCategoryHeaderProps = {
  category: AIAgentUseCaseCategory;
  useCaseCount: number;
  expanded: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onLabelChange: (categoryId: string, label: string) => void;
  onDescriptionChange: (categoryId: string, description: string) => void;
};

export function UseCaseCategoryHeader({
  category,
  useCaseCount,
  expanded,
  disabled = false,
  onToggle,
  onLabelChange,
  onDescriptionChange,
}: UseCaseCategoryHeaderProps): React.ReactElement {
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [editingDescription, setEditingDescription] = React.useState(false);
  const [labelDraft, setLabelDraft] = React.useState(category.label);
  const [descriptionDraft, setDescriptionDraft] = React.useState(category.description ?? '');

  React.useEffect(() => {
    if (!editingLabel) setLabelDraft(category.label);
  }, [category.label, editingLabel]);

  React.useEffect(() => {
    if (!editingDescription) setDescriptionDraft(category.description ?? '');
  }, [category.description, editingDescription]);

  const commitLabel = (): void => {
    const next = labelDraft.trim();
    if (next && next !== category.label) {
      onLabelChange(category.id, next);
    } else {
      setLabelDraft(category.label);
    }
    setEditingLabel(false);
  };

  const commitDescription = (): void => {
    const next = descriptionDraft.trim();
    if (next !== (category.description ?? '').trim()) {
      onDescriptionChange(category.id, next);
    }
    setEditingDescription(false);
  };

  const titleDisplay = expanded
    ? category.label
    : `${category.label} (${useCaseCount})`;

  return (
    <li
      className="group/cat list-none border-b border-violet-500/30 bg-violet-950/40"
      data-uc-category-id={category.id}
    >
      <div className="flex min-w-0 items-start gap-1 px-2 py-2">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={expanded}
          aria-label={expanded ? 'Comprimi categoria' : 'Espandi categoria'}
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-violet-300/90 hover:bg-violet-800/40 disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? (
            <ChevronDown size={16} aria-hidden />
          ) : (
            <ChevronRight size={16} aria-hidden />
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-1">
            {editingLabel ? (
              <input
                type="text"
                value={labelDraft}
                disabled={disabled}
                autoFocus
                className="min-w-0 flex-1 rounded-md border border-violet-500/50 bg-slate-900 px-2 py-1 text-sm font-bold uppercase tracking-wide text-violet-100 focus:ring-2 focus:ring-violet-500/50"
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitLabel();
                  }
                  if (e.key === 'Escape') {
                    setLabelDraft(category.label);
                    setEditingLabel(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-violet-200/95">
                {titleDisplay}
              </span>
            )}

            {!disabled && !editingLabel && !editingDescription ? (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/cat:opacity-100">
                <button
                  type="button"
                  title="Modifica titolo categoria"
                  aria-label="Modifica titolo categoria"
                  className="rounded p-1 text-violet-300/90 hover:bg-violet-800/50 hover:text-violet-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingLabel(true);
                  }}
                >
                  <Pencil size={14} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>

          {expanded ? (
            editingDescription ? (
              <textarea
                rows={2}
                value={descriptionDraft}
                disabled={disabled}
                autoFocus
                placeholder="Descrizione della categoria (cosa raggruppa questi use case)…"
                className="w-full resize-y rounded-md border border-violet-500/40 bg-slate-900/90 px-2 py-1.5 text-xs leading-relaxed text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500/40"
                onChange={(e) => setDescriptionDraft(e.target.value)}
                onBlur={commitDescription}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setDescriptionDraft(category.description ?? '');
                    setEditingDescription(false);
                  }
                }}
              />
            ) : (
              <div className="flex min-w-0 items-start gap-1">
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-400">
                  {category.description?.trim() ? (
                    category.description
                  ) : (
                    <span className="italic text-slate-500">
                      Nessuna descrizione — usa la matita per aggiungerne una.
                    </span>
                  )}
                </p>
                {!disabled && !editingLabel ? (
                  <button
                    type="button"
                    title="Modifica descrizione categoria"
                    aria-label="Modifica descrizione categoria"
                    className="shrink-0 rounded p-1 text-violet-300/80 opacity-0 transition-opacity hover:bg-violet-800/50 hover:text-violet-50 group-hover/cat:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDescription(true);
                    }}
                  >
                    <Pencil size={13} aria-hidden />
                  </button>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      </div>
    </li>
  );
}
