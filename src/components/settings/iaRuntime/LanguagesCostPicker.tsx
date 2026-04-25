/**
 * Picker multi-lingua per celle costi TTS: Any, ricerca, checkbox su elenco ordinato.
 */

import React from 'react';
import { SELECTABLE_LANGUAGE_CODES } from './modelCostsCatalog';

export interface LanguagesCostPickerProps {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

function parseCodes(raw: string): Set<string> {
  const out = new Set<string>();
  const t = String(raw || '').trim();
  if (!t || /^any$/i.test(t)) return out;
  for (const part of t.split(',')) {
    const c = part.trim().toLowerCase();
    if (c && SELECTABLE_LANGUAGE_CODES.includes(c)) out.add(c);
  }
  return out;
}

function isAnyValue(raw: string): boolean {
  return /^any$/i.test(String(raw || '').trim());
}

export function LanguagesCostPicker({ value, onChange, className = '' }: LanguagesCostPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const anyMode = isAnyValue(value);
  const selected = React.useMemo(() => parseCodes(value), [value]);

  const filtered = React.useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return [...SELECTABLE_LANGUAGE_CODES];
    return SELECTABLE_LANGUAGE_CODES.filter((c) => c.includes(f));
  }, [filter]);

  const setAny = () => {
    onChange('any');
    setFilter('');
  };

  const toggleCode = (code: string) => {
    if (anyMode) {
      onChange(code);
      return;
    }
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    const arr = [...next].sort((a, b) => a.localeCompare(b));
    onChange(arr.join(', '));
  };

  const display = String(value || '').trim() || '—';

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-full max-w-full truncate rounded border border-slate-700 bg-slate-950 px-1 text-left text-[10px] text-slate-100 hover:border-slate-500"
        title={display}
      >
        {display}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-0.5 flex w-[min(100%,14rem)] max-w-[14rem] flex-col rounded border border-violet-500/40 bg-slate-950 p-1 shadow-lg">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtra lingue…"
            className="mb-1 h-7 shrink-0 rounded border border-slate-700 bg-slate-900 px-1 text-[10px] text-slate-100 outline-none placeholder:text-slate-600"
            autoFocus
          />
          <label className="flex cursor-pointer items-center gap-1 border-b border-slate-800 pb-1 text-[10px] text-slate-200">
            <input
              type="checkbox"
              checked={anyMode}
              onChange={(e) => {
                if (e.target.checked) setAny();
                else onChange('');
              }}
            />
            <span>Any</span>
          </label>
          <div className="my-0.5 border-t border-dashed border-slate-700" aria-hidden />
          <ul className="max-h-48 min-h-0 overflow-y-auto overscroll-contain pr-0.5 text-[10px] [scrollbar-width:thin]">
            {filtered.map((code) => (
              <li key={code}>
                <label className="flex cursor-pointer items-center gap-1 py-0.5 hover:bg-violet-900/30">
                  <input
                    type="checkbox"
                    checked={selected.has(code)}
                    disabled={anyMode}
                    onChange={() => {
                      if (anyMode) return;
                      toggleCode(code);
                    }}
                  />
                  <span className="font-mono text-slate-100">{code}</span>
                </label>
              </li>
            ))}
            {filtered.length === 0 ? <li className="py-1 text-slate-500">Nessun risultato</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
