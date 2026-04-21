/**
 * Dropdown con filtro testo: lista con altezza massima moderata (non fino al bordo schermo) e scroll interno.
 */

import React from 'react';

export interface SearchableSelectOption<T = string> {
  value: T;
  label: string;
  subtitle?: string;
  decorator?: React.ReactNode;
  badges?: string[];
}

export interface SearchableSelectProps<T = string> {
  id?: string;
  placeholder?: string;
  /** Testo sul trigger quando non c’è selezione (`value` vuoto o senza match). */
  emptyTriggerLabel?: string;
  options: SearchableSelectOption<T>[];
  value: T | null | '';
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
  /** Larghezza massima trigger + pannello (default 200px). */
  listMaxClassName?: string;
  /** Altezza massima della sola lista (sotto il campo Cerca). Default: ~1/3–1/2 viewport + margine basso (no overflow sotto taskbar). */
  listScrollMaxHeightClassName?: string;
}

export function SearchableSelect<T extends string | number>({
  id,
  placeholder = 'Cerca…',
  emptyTriggerLabel,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  listMaxClassName = 'max-w-[200px]',
  listScrollMaxHeightClassName = 'max-h-[min(36dvh,calc(100dvh-20rem),28rem)]',
}: SearchableSelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const wrapRef = React.useRef<HTMLDivElement>(null);

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
  const filtered = React.useMemo(() => {
    if (!f) return options;
    return options.filter(
      (o) =>
        String(o.label).toLowerCase().includes(f) ||
        String(o.value).toLowerCase().includes(f) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(f))
    );
  }, [options, f]);

  const selected = options.find((o) => o.value === value);
  const showEmptyHint =
    Boolean(emptyTriggerLabel) &&
    (value === '' || value === null || value === undefined || !selected);

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${listMaxClassName} ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded border border-slate-600 bg-slate-950 px-2 py-0.5 text-left font-mono text-[11px] leading-none ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${showEmptyHint ? 'text-slate-500 italic' : 'text-slate-100'}`}
      >
        <span className="truncate">
          {showEmptyHint ? emptyTriggerLabel : selected?.label ?? '—'}
        </span>
        <span className="shrink-0 text-slate-500">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div
          className={`absolute left-0 top-full z-40 mt-0.5 flex min-w-[12rem] flex-col rounded border border-violet-500/40 bg-slate-950 shadow-lg ${listMaxClassName}`}
        >
          <input
            type="text"
            autoFocus
            placeholder={placeholder}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 shrink-0 border-b border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] leading-none text-slate-100 outline-none ring-0 placeholder:text-slate-600"
          />
          <ul
            className={`min-h-0 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.5)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/70 ${listScrollMaxHeightClassName}`}
          >
            {filtered.map((o) => (
              <li key={String(o.value)}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setFilter('');
                  }}
                  className="flex w-full items-start gap-1 px-2 py-0.5 text-left hover:bg-violet-900/40"
                >
                  {o.decorator ? <span className="shrink-0">{o.decorator}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11px] leading-tight text-slate-100">
                      {o.label}
                    </span>
                    {o.subtitle ? (
                      <span className="block truncate text-[9px] leading-tight text-slate-500">{o.subtitle}</span>
                    ) : null}
                    {o.badges && o.badges.length > 0 ? (
                      <span className="flex flex-wrap gap-0.5">
                        {o.badges.map((b) => (
                          <span
                            key={b}
                            className="rounded bg-violet-900/45 px-0.5 font-sans text-[8px] uppercase text-violet-200"
                          >
                            {b}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-0.5 text-[10px] text-slate-500">Nessun risultato</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
