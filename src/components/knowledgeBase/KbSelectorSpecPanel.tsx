/**
 * Pannello «Informazioni da chiedere» — review domande dialogo (KB riformattato).
 */

import React from 'react';
import { ArrowDown, ArrowUp, RefreshCw, Trash2 } from 'lucide-react';
import type { KbTabularGrid } from '@domain/knowledgeBase/parseKbTabularText';
import type {
  KbDocumentSelectorSpec,
  SelectorAskPolicy,
  SelectorSpecValidationIssue,
} from '@domain/knowledgeBase/kbSelectorSpec';
import {
  distinctValuesForSelectorColumn,
  excludeSelectorColumn,
  formatSelectorAskPolicyLabel,
  formatSelectorValuesPreview,
  listAskableSelectorColumns,
  moveSelectorColumn,
} from '@domain/knowledgeBase/kbSelectorSpec';
import { KbAnalysisSectionAccordion } from './KbAnalysisSectionAccordion';
import { KbAutoGrowTextarea } from './KbAutoGrowTextarea';

export type KbSelectorSpecPanelProps = {
  spec: KbDocumentSelectorSpec | null;
  grid: KbTabularGrid | null;
  issues: readonly SelectorSpecValidationIssue[];
  disabled?: boolean;
  onChange: (spec: KbDocumentSelectorSpec) => void;
  onRecalculateFromGrid: () => void;
};

function updateColumn(
  spec: KbDocumentSelectorSpec,
  columnId: string,
  patch: Partial<KbDocumentSelectorSpec['columns'][number]>
): KbDocumentSelectorSpec {
  return {
    ...spec,
    columns: spec.columns.map((c) => (c.columnId === columnId ? { ...c, ...patch } : c)),
  };
}

function updateInvalidation(
  spec: KbDocumentSelectorSpec,
  id: string,
  patch: Partial<KbDocumentSelectorSpec['invalidationTemplates'][number]>
): KbDocumentSelectorSpec {
  return {
    ...spec,
    invalidationTemplates: spec.invalidationTemplates.map((t) =>
      t.id === id ? { ...t, ...patch } : t
    ),
  };
}

type AskRowToolbarProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function AskRowToolbar({
  canMoveUp,
  canMoveDown,
  disabled,
  onMoveUp,
  onMoveDown,
  onRemove,
}: AskRowToolbarProps): React.ReactElement {
  const btnClass =
    'rounded p-0.5 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div
      className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border border-slate-700/80 bg-slate-900/95 px-0.5 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
      role="toolbar"
      aria-label="Azioni domanda"
    >
      <button
        type="button"
        className={btnClass}
        disabled={disabled || !canMoveUp}
        aria-label="Sposta su"
        onClick={onMoveUp}
      >
        <ArrowUp size={13} aria-hidden />
      </button>
      <button
        type="button"
        className={btnClass}
        disabled={disabled || !canMoveDown}
        aria-label="Sposta giù"
        onClick={onMoveDown}
      >
        <ArrowDown size={13} aria-hidden />
      </button>
      <button
        type="button"
        className={btnClass + ' hover:text-rose-300'}
        disabled={disabled}
        aria-label="Rimuovi domanda"
        onClick={onRemove}
      >
        <Trash2 size={13} aria-hidden />
      </button>
    </div>
  );
}

type AskRowProps = {
  columnId: string;
  label: string;
  askPolicy: SelectorAskPolicy | undefined;
  informOnAutofill: boolean | undefined;
  valuesPreview: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onLabelChange: (value: string) => void;
  onTogglePolicy: () => void;
  onToggleInform: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function AskRow({
  label,
  askPolicy,
  informOnAutofill,
  valuesPreview,
  canMoveUp,
  canMoveDown,
  disabled,
  onLabelChange,
  onTogglePolicy,
  onToggleInform,
  onMoveUp,
  onMoveDown,
  onRemove,
}: AskRowProps): React.ReactElement {
  const policyLabel = formatSelectorAskPolicyLabel(askPolicy);

  return (
    <div className="group relative rounded border border-slate-800/70 bg-slate-950/40 px-2 py-1.5 pr-24 text-xs">
      <div className="flex min-w-0 items-baseline gap-2">
        <input
          type="text"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-0.5 py-0.5 text-slate-100 placeholder:text-slate-600 focus:border-violet-700/50 focus:bg-slate-950/80 focus:outline-none disabled:opacity-50"
          value={label}
          disabled={disabled}
          placeholder="Informazione da chiedere"
          onChange={(e) => onLabelChange(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 text-[10px] text-slate-500 underline decoration-dotted underline-offset-2 hover:text-violet-300 disabled:opacity-50"
          disabled={disabled}
          title="Cambia obbligatorietà"
          onClick={onTogglePolicy}
        >
          ({policyLabel})
        </button>
        <label
          className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-violet-300/90"
          title="Informa su scelta implicita (valore univoco significativo)"
        >
          <input
            type="checkbox"
            className="accent-violet-400"
            checked={informOnAutofill === true}
            disabled={disabled}
            onChange={onToggleInform}
          />
          Informa implicito
        </label>
        <span className="shrink-0 text-slate-600" aria-hidden>
          :
        </span>
        <span
          className="min-w-0 max-w-[30%] shrink truncate text-[11px] text-slate-400"
          title={valuesPreview}
        >
          {valuesPreview}
        </span>
      </div>
      <AskRowToolbar
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        disabled={disabled}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={onRemove}
      />
    </div>
  );
}

export function KbSelectorSpecPanel({
  spec,
  grid,
  issues,
  disabled = false,
  onChange,
  onRecalculateFromGrid,
}: KbSelectorSpecPanelProps): React.ReactElement {
  const hasGrid = Boolean(grid && grid.headers.length > 0);
  const askable = spec ? listAskableSelectorColumns(spec) : [];

  if (!spec || askable.length === 0) {
    return (
      <div className="rounded border border-slate-800/80 bg-slate-950/30 px-2 py-2 text-xs text-slate-400">
        <p>Nessuna informazione da chiedere.</p>
        {hasGrid ? (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 rounded border border-violet-800/60 bg-violet-950/40 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-900/50 disabled:opacity-40"
            disabled={disabled}
            onClick={onRecalculateFromGrid}
          >
            <RefreshCw size={12} aria-hidden />
            Ricalcola da tabella
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <KbAnalysisSectionAccordion
      heading="Informazioni da chiedere"
      defaultOpen
      badge={`${askable.length} domande`}
      headingToneClass="text-violet-300/90"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-slate-700/70 bg-slate-900/50 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800/60 disabled:opacity-40"
            disabled={disabled || !hasGrid}
            onClick={onRecalculateFromGrid}
          >
            <RefreshCw size={11} aria-hidden />
            Ricalcola da tabella
          </button>
          {issues.length > 0 ? (
            <ul className="text-[10px] text-amber-300/90">
              {issues.map((issue) => (
                <li key={issue.code + issue.message}>{issue.message}</li>
              ))}
            </ul>
          ) : (
            <span className="text-[10px] text-teal-300/80">Pronte per approvazione.</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {askable.map((col, index) => {
            const values = distinctValuesForSelectorColumn(grid, col.headerLabel);
            const valuesPreview = formatSelectorValuesPreview(values, col.promptType);
            return (
              <AskRow
                key={col.columnId}
                columnId={col.columnId}
                label={col.promptTemplate}
                askPolicy={col.askPolicy}
                informOnAutofill={col.informOnAutofill}
                valuesPreview={valuesPreview}
                canMoveUp={index > 0}
                canMoveDown={index < askable.length - 1}
                disabled={disabled}
                onLabelChange={(value) =>
                  onChange(updateColumn(spec, col.columnId, { promptTemplate: value }))
                }
                onTogglePolicy={() =>
                  onChange(
                    updateColumn(spec, col.columnId, {
                      askPolicy: col.askPolicy === 'required' ? 'optional' : 'required',
                    })
                  )
                }
                onToggleInform={() =>
                  onChange(
                    updateColumn(spec, col.columnId, {
                      informOnAutofill: !col.informOnAutofill,
                      ...(col.columnId.includes('esame') &&
                      !col.columnId.includes('obbligatorio') &&
                      col.informOnAutofill !== true
                        ? {
                            acceptanceWhen: [
                              { metadataColumnId: 'esame_obbligatorio', metadataValue: 'si' },
                            ],
                          }
                        : {}),
                    })
                  )
                }
                onMoveUp={() => onChange(moveSelectorColumn(spec, col.columnId, 'up'))}
                onMoveDown={() => onChange(moveSelectorColumn(spec, col.columnId, 'down'))}
                onRemove={() => onChange(excludeSelectorColumn(spec, col.columnId))}
              />
            );
          })}
        </div>

        {spec.invalidationTemplates.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-slate-800/70 pt-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Messaggi se combinazione non disponibile
            </span>
            {spec.invalidationTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex w-full min-w-0 flex-col rounded border border-slate-800/70 bg-slate-950/40 p-2 text-xs"
              >
                <label className="mb-1.5 flex w-full cursor-pointer items-center gap-1 text-[10px] text-slate-300">
                  <input
                    type="checkbox"
                    className="accent-violet-400"
                    checked={tpl.approved}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        updateInvalidation(spec, tpl.id, { approved: e.target.checked })
                      )
                    }
                  />
                  Approvato
                </label>
                <KbAutoGrowTextarea
                  className="box-border w-full max-w-full rounded border border-slate-700/80 bg-slate-950/60 px-2 py-1.5 text-xs leading-snug text-slate-200"
                  value={tpl.template}
                  disabled={disabled}
                  maxRows={4}
                  onChange={(e) =>
                    onChange(updateInvalidation(spec, tpl.id, { template: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </KbAnalysisSectionAccordion>
  );
}
