/**
 * Editor messaggio parametrico compatto: toolbar PARAMETRI + chip dimensioni (+ libero con
 * conferma stile composer), prodotto cartesiano, tabella combinazioni / prompt.
 */

import React from 'react';
import { LayoutGrid, Plus, Table, Variable, X } from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import { PARAMETRIC_CATALOG_DIMENSIONS } from '@domain/useCaseBundle/parametricPhraseHelpers';
import type {
  AIAgentPhraseParametricConfig,
  AIAgentPhraseParametricDimension,
} from '@domain/useCaseBundle/schema';
import { BracketTokenHighlightedTextarea } from '../BracketTokenHighlightedTextarea';
import { UC_PARAMETRIC_EDITOR_SURFACE } from '../useCaseComposerPresentation';
import { CompactToolbarStringEdit } from './CompactToolbarStringEdit';

const FREE_PARAM_GUIDE_PLACEHOLDER =
  'Nome parametro — es. tipo visita, sede, canale…';

export type PhraseParametricRevertPickProps = {
  revertPickMode: boolean;
  revertSelectedRowId: string | null;
  onRevertSelectedRowIdChange: (rowId: string) => void;
};

export interface PhraseParametricEditorProps {
  useCase: AIAgentUseCase;
  busy: boolean;
  revertPick?: PhraseParametricRevertPickProps;
  onAddCatalogDimension: (catalogKey: string) => void;
  onAddFreeDimension: () => void;
  onRemoveDimension: (dimensionId: string) => void;
  onPatchDimensionLabel: (dimensionId: string, label: string) => void;
  onAddRow: () => void;
  /** Opzionale: nessuna UI riga «elimina»; mantenuto per compatibilità / automazioni. */
  onRemoveRow?: (rowId: string) => void;
  onPatchCell: (rowId: string, dimensionId: string, value: string) => void;
  onPatchPrompt: (rowId: string, prompt: string) => void;
  onExpandCartesian: () => void;
  cartesianFeedback?: string | null;
}

function dimensionHeaderCell(d: AIAgentPhraseParametricDimension): React.ReactNode {
  if (d.kind === 'catalog') {
    return (
      <span className="whitespace-nowrap text-sm font-medium text-slate-200">
        {d.label || d.catalogKey || '—'}
      </span>
    );
  }
  return (
    <span
      className={`whitespace-nowrap text-sm font-medium text-slate-200 ${d.label.trim() ? '' : 'text-slate-500'}`}
    >
      {d.label.trim() || 'Parametro libero'}
    </span>
  );
}

export function PhraseParametricEditor({
  useCase,
  busy,
  revertPick,
  onAddCatalogDimension,
  onAddFreeDimension,
  onRemoveDimension,
  onPatchDimensionLabel,
  onAddRow,
  onPatchCell,
  onPatchPrompt,
  onExpandCartesian,
  cartesianFeedback,
}: PhraseParametricEditorProps): React.ReactElement {
  const uc = ensureUseCasePhrases(useCase);
  const phrase = uc.phrases?.[0];
  const cfg: AIAgentPhraseParametricConfig = phrase?.parametric ?? {
    enabled: true,
    dimensions: [],
    rows: [],
  };
  const dims = cfg.dimensions;
  const rows = cfg.rows;
  const revertPickMode = Boolean(revertPick?.revertPickMode);
  const revertSelectedRowId = revertPick?.revertSelectedRowId ?? null;
  const tableInputsDisabled = busy || revertPickMode;

  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const addMenuWrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!addMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = addMenuWrapRef.current;
      if (el && !el.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [addMenuOpen]);

  const pickCatalog = React.useCallback(
    (key: string) => {
      onAddCatalogDimension(key);
      setAddMenuOpen(false);
    },
    [onAddCatalogDimension]
  );

  const pickFree = React.useCallback(() => {
    onAddFreeDimension();
    setAddMenuOpen(false);
  }, [onAddFreeDimension]);

  const addedCatalogKeys = React.useMemo(() => {
    const s = new Set<string>();
    for (const d of dims) {
      if (d.kind === 'catalog' && d.catalogKey) s.add(d.catalogKey);
    }
    return s;
  }, [dims]);

  return (
    <div
      className={`${UC_PARAMETRIC_EDITOR_SURFACE} space-y-1.5 pb-0.5 text-sm leading-snug text-slate-100`}
    >
      <div
        ref={addMenuWrapRef}
        className={`relative flex w-full flex-wrap items-center gap-x-1 gap-y-1 border-b border-slate-500/35 pb-1 dark:border-slate-600/40 ${revertPickMode ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1">
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-slate-200 dark:text-slate-200/95">
          <Table className="h-4 w-4 shrink-0 text-sky-400/80 opacity-90" aria-hidden />
          Parametri
        </span>

        {dims.map((d) =>
          d.kind === 'catalog' ? (
            <span
              key={d.dimensionId}
              className="inline-flex max-w-full items-center gap-0.5 rounded border border-slate-500/40 bg-slate-800/25 px-1.5 py-0.5 font-normal text-slate-100 dark:bg-slate-950/35"
            >
              <Variable className="h-4 w-4 shrink-0 text-sky-400/85" aria-hidden />
              <span className="max-w-[14rem] truncate">{d.label || d.catalogKey}</span>
              <button
                type="button"
                disabled={busy}
                title="Rimuovi parametro"
                className="rounded p-0.5 text-slate-300 hover:bg-slate-800/80 disabled:opacity-40"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveDimension(d.dimensionId);
                }}
              >
                <X size={13} aria-hidden />
              </button>
            </span>
          ) : (
            <CompactToolbarStringEdit
              key={d.dimensionId}
              busy={busy}
              committed={d.label}
              guidePlaceholder={FREE_PARAM_GUIDE_PLACEHOLDER}
              ariaLabel="Nome parametro libero"
              startInEditWhenEmpty
              onCommit={(t) => onPatchDimensionLabel(d.dimensionId, t)}
              onCancelEdit={() => {}}
              onAbortWhenCommittedEmpty={() => onRemoveDimension(d.dimensionId)}
              renderDisplay={(label) => (
                <>
                  <Variable className="h-4 w-4 shrink-0 text-amber-300/90" aria-hidden />
                  <span className="max-w-[14rem] truncate font-normal text-amber-50/95">{label}</span>
                </>
              )}
            />
          )
        )}

        {dims.length >= 2 ? (
          <button
            type="button"
            disabled={busy}
            title="Genera una riga per ogni combinazione di valori distinti già presenti nelle colonne"
            className="inline-flex shrink-0 items-center gap-0.5 rounded border border-sky-600/35 bg-transparent px-1.5 py-0.5 font-normal text-sky-100/95 hover:bg-slate-800/45 disabled:opacity-40 dark:border-sky-500/30"
            onClick={() => onExpandCartesian()}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Tutte le combinazioni</span>
            <span className="sm:hidden">Combinazioni</span>
          </button>
        ) : null}

        <div className="relative shrink-0">
          <button
            type="button"
            disabled={busy}
            title="Aggiungi parametro"
            aria-expanded={addMenuOpen}
            className="inline-flex shrink-0 items-center justify-center rounded border border-slate-500/45 bg-transparent px-1.5 py-0.5 text-slate-200 hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45 disabled:opacity-40"
            onClick={(e) => {
              e.stopPropagation();
              setAddMenuOpen((o) => !o);
            }}
          >
            <Plus size={14} aria-hidden />
          </button>
          {addMenuOpen ? (
            <div
              className="absolute start-0 top-full z-20 mt-0.5 min-w-[200px] rounded border border-slate-600/50 bg-slate-950 py-1 text-sm shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-2 py-1.5 text-left text-slate-100 hover:bg-slate-800/70"
                onClick={() => pickFree()}
              >
                Parametro libero…
              </button>
              <div className="border-t border-slate-700/60" />
              {PARAMETRIC_CATALOG_DIMENSIONS.map((c) => {
                const alreadyAdded = addedCatalogKeys.has(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="menuitem"
                    disabled={busy || alreadyAdded}
                    title={alreadyAdded ? 'Parametro già presente' : undefined}
                    className={
                      alreadyAdded
                        ? 'flex w-full cursor-not-allowed px-2 py-1 text-left text-slate-500 opacity-50'
                        : 'flex w-full px-2 py-1 text-left text-slate-200 hover:bg-slate-800/70 disabled:opacity-40'
                    }
                    onClick={() => {
                      if (alreadyAdded) return;
                      pickCatalog(c.key);
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        </div>

        {dims.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            title="Aggiunge una riga alla tabella delle combinazioni"
            className="inline-flex shrink-0 items-center gap-0.5 rounded border border-slate-500/45 bg-transparent px-1.5 py-0.5 font-normal text-slate-100 hover:bg-slate-800/45 disabled:opacity-40"
            onClick={() => onAddRow()}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            Aggiungi riga tabella
          </button>
        ) : null}
      </div>

      {cartesianFeedback ? (
        <p className="text-sm leading-tight text-rose-400/95">{cartesianFeedback}</p>
      ) : null}

      {dims.length > 0 ? (
        <div className="overflow-x-auto rounded border border-slate-500/40 bg-slate-950/20 dark:border-slate-600/45 dark:bg-slate-950/35">
          <table className="w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-600/40 dark:border-slate-600/50">
                {revertPickMode ? (
                  <th className="w-8 px-1 py-1 text-left font-medium text-slate-200" scope="col">
                    <span className="sr-only">Messaggio unico</span>
                  </th>
                ) : null}
                {dims.map((d) => (
                  <th
                    key={d.dimensionId}
                    className="w-px max-w-none whitespace-nowrap px-1 py-1 text-left font-medium text-slate-200"
                  >
                    {dimensionHeaderCell(d)}
                  </th>
                ))}
                <th className="min-w-0 px-1 py-1 text-left font-medium text-slate-200">
                  Prompt / frase
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.rowId}
                  className={`border-b border-slate-600/30 dark:border-slate-700/40 ${revertPickMode && revertSelectedRowId === row.rowId ? 'bg-sky-950/25' : ''}`}
                >
                  {revertPickMode ? (
                    <td className="w-8 px-1 py-1 align-top">
                      <input
                        type="radio"
                        name="parametric-revert-row"
                        disabled={busy}
                        checked={revertSelectedRowId === row.rowId}
                        aria-label="Usa questa riga come messaggio unico"
                        onChange={() => revertPick?.onRevertSelectedRowIdChange(row.rowId)}
                        className="mt-1 h-3.5 w-3.5 accent-sky-400"
                      />
                    </td>
                  ) : null}
                  {dims.map((d) => {
                    const placeholder =
                      d.kind === 'free'
                        ? d.label.trim() || 'Valore…'
                        : `${d.label || d.catalogKey}…`;
                    return (
                      <td key={d.dimensionId} className="w-px whitespace-nowrap px-1 py-0.5 align-top">
                        <input
                          disabled={tableInputsDisabled}
                          type="text"
                          value={row.valuesByDimensionId[d.dimensionId] ?? ''}
                          placeholder={placeholder}
                          onChange={(e) => onPatchCell(row.rowId, d.dimensionId, e.target.value)}
                          className="box-border min-w-[3ch] max-w-[14rem] rounded border border-slate-500/45 bg-slate-950/30 px-1 py-0.5 font-normal text-slate-100 placeholder:text-slate-500 [field-sizing:content] dark:border-slate-600/50"
                        />
                      </td>
                    );
                  })}
                  <td className="min-w-0 max-w-full px-1 py-0.5 align-top">
                    <BracketTokenHighlightedTextarea
                      value={row.promptNaturalText}
                      disabled={tableInputsDisabled}
                      rows={2}
                      spellCheck={false}
                      onChange={(e) => onPatchPrompt(row.rowId, e.target.value)}
                      placeholder="Messaggio per questa combinazione…"
                      containerClassName="min-h-[40px] w-full rounded border border-emerald-500/40 bg-slate-950/20 px-1.5 py-1 font-mono text-sm leading-snug text-emerald-50 shadow-none dark:border-emerald-500/35"
                      className="font-mono text-sm caret-emerald-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
