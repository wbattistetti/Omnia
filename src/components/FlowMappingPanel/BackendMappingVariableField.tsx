/**
 * Backend mapping "Variabile" column: pick variable by GUID; label from active flow `meta.translations` only.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { getVariableLabel } from '../../utils/getVariableLabel';
import { isUuidString } from '../../utils/translationKeys';
import { useActiveFlowMetaTranslationsFlattened } from '../../hooks/useActiveFlowMetaTranslations';

const mirror10 = 'text-[10px] px-2 py-1 font-normal';

export interface BackendMappingVariableFieldProps {
  mode: 'send' | 'receive';
  /** Variable GUID when wired. */
  variableRefId?: string;
  /** Sorted unique variable GUIDs (see {@link VariableCreationService.getAllVarNames}). */
  variableOptions: string[];
  placeholder?: string;
  accentClassName?: string;
  onCommit: (patch: { variableRefId?: string }) => void;
  /** RECEIVE: create variable when user confirms a new name (Invio). */
  onCreateVariable?: (displayName: string) => { id: string; label: string } | null;
  onVariableCreated?: () => void;
}

function filterOptions(
  options: string[],
  q: string,
  flowTr: Record<string, string>
): string[] {
  const t = q.trim().toLowerCase();
  if (!t) return options;
  return options.filter((o) => {
    const id = String(o || '').trim();
    if (!id) return false;
    if (id.toLowerCase().includes(t)) return true;
    return getVariableLabel(id, flowTr).toLowerCase().includes(t);
  });
}

const panelClassName =
  'min-w-[12rem] max-w-[min(20rem,92vw)] rounded-md border border-amber-500/40 bg-slate-950 shadow-lg ring-1 ring-amber-500/25';

export function BackendMappingVariableField({
  mode,
  variableRefId,
  variableOptions,
  placeholder = 'Variabile',
  accentClassName = 'text-amber-100/95',
  onCommit,
  onCreateVariable,
  onVariableCreated,
}: BackendMappingVariableFieldProps) {
  const flowTr = useActiveFlowMetaTranslationsFlattened();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputTopRef = useRef<HTMLInputElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const displayText = variableRefId ? getVariableLabel(variableRefId, flowTr) : '';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const maxW = Math.min(320, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - maxW - 8));
      setPanelStyle({
        position: 'fixed',
        left,
        top: r.bottom + 4,
        width: maxW,
        zIndex: 100000,
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    if (mode === 'receive') {
      inputTopRef.current?.focus();
    }
  }, [open, mode]);

  const showEmpty = !variableRefId?.trim();
  const emptyClass = 'text-slate-500 italic font-normal';

  const pickExisting = useCallback(
    (varId: string) => {
      const id = String(varId || '').trim();
      if (!id || !isUuidString(id)) return;
      onCommit({ variableRefId: id });
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
        onCommit({ variableRefId: created.id });
        onVariableCreated?.();
      }
    }
    setOpen(false);
    setDraft('');
  }, [draft, variableOptions, onCreateVariable, onCommit, onVariableCreated, pickExisting]);

  const filtered = filterOptions(variableOptions, mode === 'receive' ? draft : draft, flowTr);

  const panel = open ? (
    <div
      ref={panelRef}
      className={panelClassName}
      style={panelStyle}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {mode === 'receive' && (
        <div className="border-b border-amber-500/20 p-1.5">
          <input
            ref={inputTopRef}
            type="text"
            className="w-full rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
            placeholder="Cerca per GUID o crea (Invio)"
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
            placeholder="Filtra per GUID…"
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
                onClick={(e) => {
                  e.stopPropagation();
                  pickExisting(opt);
                }}
              >
                {getVariableLabel(opt, flowTr)}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative inline-flex min-w-0 max-w-full group/vf ${mirror10}`}>
      <button
        type="button"
        className={`inline-flex items-center gap-0.5 max-w-[min(16rem,92vw)] truncate rounded px-2 py-1 text-[10px] font-medium min-h-[1.75rem] border border-transparent hover:border-amber-500/30 ${showEmpty ? emptyClass : accentClassName}`}
        onClick={() => {
          setOpen((o) => !o);
          setDraft('');
        }}
        title={displayText || placeholder}
      >
        <span className="truncate">{showEmpty ? placeholder : displayText}</span>
        <ChevronDown className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
      </button>

      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
