/**
 * Combo categoria Slot Mapping: textbox nuova categoria, poi voci già in mapping e catalogo.
 */

import React from 'react';
import {
  isUnclassifiedSlotId,
  isValidSlotId,
  normalizeSlotId,
} from '@domain/useCaseBundle/projectSlotLexicon';

export interface SlotCategoryComboboxProps {
  value: string;
  /** Categorie già usate nel lessico (escl. `undefined`). */
  mappedOptions: readonly string[];
  /** Altre categorie del catalogo non ancora presenti nel mapping. */
  otherOptions: readonly string[];
  onCommit: (slotId: string) => void;
  disabled?: boolean;
  className?: string;
}

function filterOptions(options: readonly string[], query: string): string[] {
  if (!query) return [...options];
  return options.filter((o) => o.includes(query));
}

function OptionRow({
  label,
  onPick,
}: {
  label: string;
  onPick: () => void;
}): React.ReactElement {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full px-2 py-1 text-left font-mono text-[11px] text-slate-100 hover:bg-violet-900/40"
      >
        {label}
      </button>
    </li>
  );
}

export function SlotCategoryCombobox({
  value,
  mappedOptions,
  otherOptions,
  onCommit,
  disabled = false,
  className = '',
}: SlotCategoryComboboxProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const displayValue = normalizeSlotId(value);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const f = filter.trim().toLowerCase();
  const mappedFiltered = React.useMemo(() => filterOptions(mappedOptions, f), [mappedOptions, f]);
  const otherFiltered = React.useMemo(() => filterOptions(otherOptions, f), [otherOptions, f]);
  const hasOptions = mappedFiltered.length > 0 || otherFiltered.length > 0;

  const tryCommitDraft = React.useCallback(() => {
    const next = normalizeSlotId(f || filter);
    if (!isValidSlotId(next) || isUnclassifiedSlotId(next)) return;
    onCommit(next);
    setOpen(false);
    setFilter('');
  }, [f, filter, onCommit]);

  const pick = React.useCallback(
    (slotId: string) => {
      onCommit(slotId);
      setOpen(false);
      setFilter('');
    },
    [onCommit]
  );

  return (
    <div ref={wrapRef} className={`relative min-w-0 max-w-[140px] ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={[
          'flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded border px-1.5',
          'font-mono text-[11px] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',
          disabled ? 'cursor-not-allowed opacity-50' : '',
          'border-slate-600 bg-slate-900',
        ].join(' ')}
      >
        <span className="truncate">{displayValue}</span>
        <span className="shrink-0 text-slate-500">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-0.5 flex min-w-[10rem] flex-col rounded border border-violet-500/40 bg-slate-950 text-slate-100 shadow-lg">
          <input
            type="text"
            autoFocus
            placeholder="Nuova categoria…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                tryCommitDraft();
              }
              if (e.key === 'Escape') {
                setOpen(false);
                setFilter('');
              }
            }}
            className="h-8 shrink-0 border-b border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
          />
          <ul className="max-h-48 min-h-0 overflow-y-auto overscroll-contain py-0.5">
            {mappedFiltered.map((o) => (
              <OptionRow key={`mapped-${o}`} label={o} onPick={() => pick(o)} />
            ))}
            {mappedFiltered.length > 0 && otherFiltered.length > 0 ? (
              <li aria-hidden className="my-0.5 border-t border-slate-600/80" />
            ) : null}
            {otherFiltered.map((o) => (
              <OptionRow key={`other-${o}`} label={o} onPick={() => pick(o)} />
            ))}
            {!hasOptions ? (
              <li className="px-2 py-1 text-[10px] text-slate-500">
                {f && isValidSlotId(f) && !isUnclassifiedSlotId(f)
                  ? 'Invio per usare questa categoria'
                  : 'Nessun risultato'}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
