/**
 * Backend mapping "Variabile" column: SEND = pick existing only; RECEIVE = search/create + pick list.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const mirror10 = 'text-[10px] px-2 py-1 font-normal';

export interface BackendMappingVariableFieldProps {
  mode: 'send' | 'receive';
  value: string;
  variableRefId?: string;
  variableOptions: string[];
  placeholder?: string;
  accentClassName?: string;
  onCommit: (patch: { linkedVariable: string; variableRefId?: string }) => void;
  /** RECEIVE: create variable when user confirms a new name (Invio). */
  onCreateVariable?: (displayName: string) => { id: string; label: string } | null;
  onVariableCreated?: () => void;
}

function filterOptions(options: string[], q: string): string[] {
  const t = q.trim().toLowerCase();
  if (!t) return options;
  return options.filter((o) => o.toLowerCase().includes(t));
}

export function BackendMappingVariableField({
  mode,
  value,
  variableRefId: _variableRefId,
  variableOptions,
  placeholder = 'Variabile',
  accentClassName = 'text-amber-100/95',
  onCommit,
  onCreateVariable,
  onVariableCreated,
}: BackendMappingVariableFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputTopRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useLayoutEffect(() => {
    if (open && mode === 'receive') {
      inputTopRef.current?.focus();
    }
  }, [open, mode]);

  const showEmpty = !value?.trim();
  const emptyClass = 'text-slate-500 italic font-normal';

  const pickExisting = useCallback(
    (label: string) => {
      onCommit({ linkedVariable: label });
      setOpen(false);
      setDraft('');
    },
    [onCommit]
  );

  const handleReceiveSubmit = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    const exact = variableOptions.find((o) => o === t);
    if (exact) {
      pickExisting(exact);
      return;
    }
    const ci = variableOptions.find((o) => o.toLowerCase() === t.toLowerCase());
    if (ci) {
      pickExisting(ci);
      return;
    }
    if (onCreateVariable) {
      const created = onCreateVariable(t);
      if (created) {
        onCommit({ linkedVariable: created.label, variableRefId: created.id });
        onVariableCreated?.();
      }
    }
    setOpen(false);
    setDraft('');
  }, [draft, variableOptions, onCreateVariable, onCommit, onVariableCreated, pickExisting]);

  const filtered = filterOptions(variableOptions, mode === 'receive' ? draft : draft);

  return (
    <div ref={rootRef} className={`relative inline-flex min-w-0 max-w-full group/vf ${mirror10}`}>
      <button
        type="button"
        className={`inline-flex items-center gap-0.5 max-w-[min(16rem,92vw)] truncate rounded px-2 py-1 text-[10px] font-medium min-h-[1.75rem] border border-transparent hover:border-amber-500/30 ${showEmpty ? emptyClass : accentClassName}`}
        onClick={() => {
          setOpen((o) => !o);
          setDraft('');
        }}
        title={value || placeholder}
      >
        <span className="truncate">{showEmpty ? placeholder : value}</span>
        <ChevronDown className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-50 mt-0.5 min-w-[12rem] max-w-[min(20rem,92vw)] rounded-md border border-amber-500/40 bg-slate-950 shadow-lg ring-1 ring-amber-500/25"
        >
          {mode === 'receive' && (
            <div className="border-b border-amber-500/20 p-1.5">
              <input
                ref={inputTopRef}
                type="text"
                className="w-full rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                placeholder="Cerca o crea variabile (Invio per creare)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleReceiveSubmit();
                  }
                  if (e.key === 'Escape') setOpen(false);
                }}
              />
            </div>
          )}
          {mode === 'send' && (
            <div className="border-b border-amber-500/20 p-1.5">
              <input
                type="text"
                className="w-full rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                placeholder="Filtra variabili…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                }}
              />
            </div>
          )}
          <ul className="max-h-48 overflow-y-auto py-0.5" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-[10px] text-slate-500">Nessuna variabile</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    className="w-full truncate px-2 py-1 text-left text-[10px] text-amber-100/95 hover:bg-amber-500/15"
                    onClick={() => pickExisting(opt)}
                  >
                    {opt}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
