/**
 * Backend mapping colonna «Variabile»: scelta GUID da elenco; in SEND anche valore costante (euristica id noto vs testo).
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import { resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';
import { isUuidString } from '../../utils/translationKeys';
import { useActiveFlowMetaTranslationsFlattened } from '../../hooks/useActiveFlowMetaTranslations';

const mirror10 = 'text-[10px] px-2 py-1 font-normal';

export type BackendMappingCommitPatch = {
  variableRefId?: string;
  literalConstant?: string;
};

export interface BackendMappingVariableFieldProps {
  mode: 'send' | 'receive';
  variableRefId?: string;
  /** SEND: valore letterale persistito sul task quando non è un id variabile noto. */
  literalConstant?: string;
  /** SEND: insieme degli id variabile del progetto (GUID) per l’euristica variabile vs costante. */
  knownVariableIds?: ReadonlySet<string>;
  variableOptions: string[];
  placeholder?: string;
  accentClassName?: string;
  onCommit: (patch: BackendMappingCommitPatch) => void;
  onCreateVariable?: (displayName: string) => { id: string; label: string } | null;
  onVariableCreated?: () => void;
}

function filterOptions(
  options: string[],
  q: string,
  mergedTr: Record<string, string>
): string[] {
  const t = q.trim().toLowerCase();
  if (!t) return options;
  return options.filter((o) => {
    const id = String(o || '').trim();
    if (!id) return false;
    if (id.toLowerCase().includes(t)) return true;
    return resolveVariableDisplayName(id, 'menuVariables', {
      compiledTranslations: mergedTr,
      flowMetaTranslations: mergedTr,
    })
      .toLowerCase()
      .includes(t);
  });
}

const panelBaseClassName =
  'rounded-md border border-amber-500/40 bg-slate-950 shadow-lg ring-1 ring-amber-500/25';

/** Match list row text (`text-[10px] font-normal`); avoids measuring `w-full` buttons (scrollWidth = row width). */
function measureTextWidthPx(text: string, fontFamily: string): number {
  if (typeof document === 'undefined' || !text) return 0;
  const span = document.createElement('span');
  span.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'white-space:nowrap',
    'font-size:10px',
    'font-weight:400',
    `font-family:${fontFamily}`,
  ].join(';');
  span.textContent = text;
  document.body.appendChild(span);
  const w = span.offsetWidth;
  document.body.removeChild(span);
  return w;
}

export function BackendMappingVariableField({
  mode,
  variableRefId,
  literalConstant,
  knownVariableIds,
  variableOptions,
  placeholder = 'Variabile',
  accentClassName = 'text-amber-100/95',
  onCommit,
  onCreateVariable,
  onVariableCreated,
}: BackendMappingVariableFieldProps) {
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
  const [sendLiteralDraft, setSendLiteralDraft] = useState('');
  /** Max intrinsic width of menu labels + placeholder/draft (not full row width). */
  const [labelColumnMaxPx, setLabelColumnMaxPx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputTopRef = useRef<HTMLInputElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const knownIds = useMemo(
    () => knownVariableIds ?? new Set(variableOptions),
    [knownVariableIds, variableOptions]
  );

  const displayText = variableRefId
    ? menuLabel(variableRefId)
    : literalConstant?.trim()
      ? literalConstant.trim()
      : '';

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
    if (!open) {
      setLabelColumnMaxPx(0);
      setPanelStyle({});
      return;
    }
    const root = rootRef.current;
    const fontFamily = root ? getComputedStyle(root).fontFamily : 'system-ui,sans-serif';
    let max = 0;
    for (const opt of variableOptions) {
      max = Math.max(max, measureTextWidthPx(menuLabel(opt), fontFamily));
    }
    if (mode === 'send') {
      max = Math.max(max, measureTextWidthPx('Costante (Invio)', fontFamily));
      max = Math.max(max, measureTextWidthPx(sendLiteralDraft, fontFamily));
    } else {
      max = Math.max(max, measureTextWidthPx('Cerca per GUID o crea (Invio)', fontFamily));
      max = Math.max(max, measureTextWidthPx(draft, fontFamily));
    }
    const capped = Math.max(max, 40);
    setLabelColumnMaxPx(capped);

    const runPlace = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const padX = 16;
      const inputBorderBox = Math.min(Math.max(capped + padX + 2, 72), Math.min(320, vw - 16));
      const panelW = Math.min(inputBorderBox + padX, vw - 16);
      const left = Math.max(8, Math.min(r.left, vw - panelW - 8));

      const receiveFiltered = filterOptions(variableOptions, draft, mergedTr);
      const itemCount = mode === 'receive' ? receiveFiltered.length : variableOptions.length;
      const estList = Math.min(itemCount * 26 + 12, 192);
      const estHeader = 44;
      const estPanelH = estHeader + estList + 8;
      const ph = panelRef.current?.getBoundingClientRect().height || estPanelH;

      const gap = 4;
      const margin = 8;
      let top = r.bottom + gap;
      const bottomOverflow = top + ph > vh - margin;
      const fitsAbove = r.top - gap - ph >= margin;
      if (bottomOverflow && fitsAbove) {
        top = r.top - gap - ph;
      } else if (bottomOverflow && !fitsAbove) {
        top = Math.max(margin, vh - margin - ph);
      }

      setPanelStyle({
        position: 'fixed',
        left,
        top,
        width: panelW,
        zIndex: 100000,
      });
    };

    runPlace();
    let rafNested = 0;
    const raf1 = window.requestAnimationFrame(() => {
      runPlace();
      rafNested = window.requestAnimationFrame(() => runPlace());
    });
    window.addEventListener('scroll', runPlace, true);
    window.addEventListener('resize', runPlace);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(rafNested);
      window.removeEventListener('scroll', runPlace, true);
      window.removeEventListener('resize', runPlace);
    };
  }, [open, variableOptions, menuLabel, mode, sendLiteralDraft, draft, mergedTr]);

  useLayoutEffect(() => {
    if (!open) return;
    if (mode === 'receive') {
      inputTopRef.current?.focus();
    }
  }, [open, mode]);

  useEffect(() => {
    if (open && mode === 'send') {
      setSendLiteralDraft(literalConstant?.trim() ?? '');
    }
  }, [open, mode, literalConstant]);

  const showEmpty = !variableRefId?.trim() && !literalConstant?.trim();
  const emptyClass = 'text-slate-500 italic font-normal';

  const pickExisting = useCallback(
    (varId: string) => {
      const id = String(varId || '').trim();
      if (!id || !isUuidString(id)) return;
      onCommit({ variableRefId: id, literalConstant: undefined });
      setOpen(false);
      setDraft('');
      setSendLiteralDraft('');
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

  const handleSendLiteralSubmit = useCallback(() => {
    const t = sendLiteralDraft.trim();
    if (!t) {
      onCommit({ variableRefId: undefined, literalConstant: undefined });
    } else if (knownIds.has(t)) {
      onCommit({ variableRefId: t, literalConstant: undefined });
    } else {
      onCommit({ variableRefId: undefined, literalConstant: t });
    }
    setOpen(false);
    setDraft('');
  }, [knownIds, onCommit, sendLiteralDraft]);

  const filteredReceive = filterOptions(variableOptions, draft, mergedTr);
  const filteredSend = variableOptions;

  const innerPadAndBorder = 16 + 2;
  const constantInputWidthPx =
    labelColumnMaxPx > 0
      ? Math.min(Math.max(labelColumnMaxPx + innerPadAndBorder, 72), Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 16 : 320))
      : undefined;

  const panel = open ? (
    <div
      ref={panelRef}
      className={`${panelBaseClassName} min-w-0`}
      style={panelStyle}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {mode === 'receive' && (
        <div className="border-b border-amber-500/20 px-2 pt-1.5 pb-1.5">
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
        <div className="border-b border-amber-500/20 px-2 pt-1.5 pb-1.5 flex justify-start min-w-0">
          <input
            type="text"
            className="min-w-0 rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60 box-border"
            style={constantInputWidthPx != null ? { width: constantInputWidthPx } : { width: '100%' }}
            placeholder="Costante (Invio)"
            value={sendLiteralDraft}
            onChange={(e) => setSendLiteralDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendLiteralSubmit();
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            title="Valore fisso inviato all’API se non scegli una variabile dall’elenco sotto"
          />
        </div>
      )}
      <ul className="max-h-48 overflow-y-auto py-0.5" role="listbox">
        {(mode === 'receive' ? filteredReceive : filteredSend).length === 0 ? (
          <li className="px-2 py-1.5 text-[10px] text-slate-500">Nessuna variabile</li>
        ) : (
          (mode === 'receive' ? filteredReceive : filteredSend).map((opt) => (
            <li key={opt}>
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
