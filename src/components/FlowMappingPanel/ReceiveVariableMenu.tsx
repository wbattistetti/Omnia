/**
 * RECEIVE mapping: chip collassato + solo ricerca variabile e lista collegabile (niente editor tipizzato SEND).
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import { resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';
import { isUuidString } from '../../utils/translationKeys';
import { useActiveFlowMetaTranslationsFlattened } from '../../hooks/useActiveFlowMetaTranslations';
import { filterVariableOptionsByQuery } from './mappingVariableFilter';
import type { EditorParamCommitPatch } from './editorParamTypes';

const mirror10 = 'text-[10px] px-2 py-1 font-normal';

const panelBaseClassName =
  'rounded-md border border-amber-500/40 bg-slate-950 shadow-lg ring-1 ring-amber-500/25';

export interface ReceiveVariableMenuProps {
  variableRefId?: string;
  variableOptions: string[];
  placeholder?: string;
  accentClassName?: string;
  onCommit: (patch: EditorParamCommitPatch) => void;
  onCreateVariable?: (displayName: string) => { id: string; label: string } | null;
  onVariableCreated?: () => void;
}

export function ReceiveVariableMenu({
  variableRefId,
  variableOptions,
  placeholder = 'Variabile',
  accentClassName = 'text-amber-100/95',
  onCommit,
  onCreateVariable,
  onVariableCreated,
}: ReceiveVariableMenuProps) {
  const flowTr = useActiveFlowMetaTranslationsFlattened();
  const mergedTr = useMemo(
    () => ({ ...getProjectTranslationsTable(), ...flowTr }),
    [flowTr]
  );
  const menuLabel = useCallback(
    (guid: string) =>
      resolveVariableDisplayName(guid, 'menuVariables', {
        compiledTranslations: mergedTr,
        flowMetaTranslations: mergedTr,
      }),
    [mergedTr]
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const receiveSearchRef = useRef<HTMLInputElement>(null);
  const skipNextDocumentCloseClickRef = useRef(false);

  const displayText = variableRefId ? menuLabel(variableRefId) : '';

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      skipNextDocumentCloseClickRef.current = false;
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (skipNextDocumentCloseClickRef.current) {
        skipNextDocumentCloseClickRef.current = false;
        return;
      }
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-omnia-date-picker-overlay]')) return;
      setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    receiveSearchRef.current?.focus();
  }, [open]);

  const showEmpty = !variableRefId?.trim();
  const emptyClass = 'text-slate-500 italic font-normal';

  const pickExisting = useCallback(
    (varId: string) => {
      const id = String(varId || '').trim();
      if (!id || !isUuidString(id)) return;
      onCommit({ variableRefId: id, literalConstant: undefined });
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
        onCommit({ variableRefId: created.id, literalConstant: undefined });
        onVariableCreated?.();
      }
    }
    setOpen(false);
    setDraft('');
  }, [draft, variableOptions, onCreateVariable, onCommit, onVariableCreated, pickExisting]);

  const filteredReceive = filterVariableOptionsByQuery(variableOptions, draft, mergedTr);

  const expandedPanel = open ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Collega variabile in ingresso"
      className={`${panelBaseClassName} mt-1 min-w-[min(18rem,calc(100vw-2rem))] max-w-[min(20rem,92vw)] w-full`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b border-amber-500/20 px-2 pt-1.5 pb-1.5">
        <input
          ref={receiveSearchRef}
          type="text"
          autoComplete="off"
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
      <ul className="max-h-48 overflow-y-auto py-0.5" role="listbox" aria-label="Variabili disponibili">
        {filteredReceive.length === 0 ? (
          <li className="px-2 py-1.5 text-[10px] text-slate-500">Nessuna variabile</li>
        ) : (
          filteredReceive.map((opt) => (
            <li key={opt} role="option">
              <button
                type="button"
                className="w-full truncate px-2 py-1 text-left text-[10px] text-amber-100/95 hover:bg-amber-500/15"
                onClick={(e) => {
                  e.stopPropagation();
                  pickExisting(opt);
                }}
              >
                {menuLabel(opt)}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex min-w-0 max-w-full flex-col items-stretch ${mirror10} ${open ? 'z-20 overflow-visible' : ''}`}
    >
      {!open ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={false}
          className={`inline-flex items-center gap-0.5 max-w-[min(16rem,92vw)] truncate rounded px-2 py-1 text-[10px] font-medium min-h-[1.75rem] border border-transparent hover:border-amber-500/30 ${
            showEmpty ? emptyClass : accentClassName
          }`}
          onClick={() => {
            skipNextDocumentCloseClickRef.current = true;
            setOpen(true);
            setDraft('');
          }}
          title={displayText || placeholder}
        >
          <span className="truncate">
            {showEmpty ? placeholder : displayText}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
        </button>
      ) : (
        expandedPanel
      )}
    </div>
  );
}
