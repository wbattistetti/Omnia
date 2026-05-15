/**
 * Pannello «Dominio valori» (sampleValues su task Backend Call): edit locale fino a conferma ✓,
 * larghezza input adattiva, allineamento al nome parametro tramite inset calcolato.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { BACKEND_DOMINIO_VALORI_LABEL } from './backendMappingDominioValoriLayout';

const VALUE_PLACEHOLDER = 'Inserisci un valore';

function toParentSampleValues(rows: string[]): string[] {
  const t = [...rows];
  while (t.length > 1 && t[t.length - 1].trim() === '') t.pop();
  if (t.length === 1 && t[0].trim() === '') return [];
  return t;
}

function SampleValueRowEditor({
  committed,
  onCommit,
  onRemoveRow,
  showRemoveRow,
  rowKey,
}: {
  committed: string;
  onCommit: (next: string) => void;
  onRemoveRow: () => void;
  showRemoveRow: boolean;
  rowKey: string;
}) {
  const [draft, setDraft] = useState(committed);
  useEffect(() => {
    setDraft(committed);
  }, [committed, rowKey]);

  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.width = '0px';
    const measured = el.scrollWidth;
    const minPx = 72;
    el.style.width = `${Math.max(Math.ceil(measured) + 10, minPx)}px`;
  }, [draft]);

  const cancel = () => setDraft(committed);
  const apply = () => onCommit(draft);

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      <input
        ref={inputRef}
        className="box-border max-w-[min(36rem,calc(100%-5.5rem))] shrink-0 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[10px] text-amber-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/45"
        value={draft}
        placeholder={VALUE_PLACEHOLDER}
        title={draft.trim() || VALUE_PLACEHOLDER}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      />
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-emerald-400"
        title="Applica valore"
        aria-label="Applica valore"
        onClick={apply}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        title="Annulla modifiche"
        aria-label="Annulla modifiche"
        onClick={cancel}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>
      {showRemoveRow ? (
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-red-400"
          title="Rimuovi valore"
          aria-label="Rimuovi valore"
          onClick={onRemoveRow}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function BackendMappingDominioValoriPanel({
  values,
  onChange,
  entryId,
  onClose,
  alignInsetPx,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  entryId: string;
  onClose?: () => void;
  alignInsetPx: number;
}) {
  const fingerprint = values.join('\u0001');
  const [localRows, setLocalRows] = useState<string[]>(() => (values.length > 0 ? [...values] : ['']));

  useEffect(() => {
    setLocalRows(values.length > 0 ? [...values] : ['']);
  }, [entryId, fingerprint]); // eslint-disable-line react-hooks/exhaustive-deps -- `fingerprint` serializza `values` ed evita reset su identity churn del parent

  const commitRow = (index: number, next: string) => {
    const nextRows = [...localRows];
    nextRows[index] = next;
    setLocalRows(nextRows);
    onChange(toParentSampleValues(nextRows));
  };

  const removeRowAt = (index: number) => {
    const filtered = localRows.filter((_, j) => j !== index);
    const nextRows = filtered.length === 0 ? [''] : filtered;
    setLocalRows(nextRows);
    onChange(toParentSampleValues(nextRows));
  };

  const addRow = () => {
    setLocalRows((prev) => [...prev, '']);
  };

  return (
    <div
      className="mt-1 w-full min-w-0 space-y-1.5 rounded-md border border-sky-600/35 bg-slate-950/80 py-2 pr-2"
      style={{ paddingLeft: alignInsetPx }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-sky-200/80">{BACKEND_DOMINIO_VALORI_LABEL}</p>
        {onClose ? (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-sky-200"
            title="Chiudi"
            aria-label="Chiudi dominio valori"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
      {localRows.map((committed, i) => (
        <SampleValueRowEditor
          key={`${entryId}-dom-${i}`}
          rowKey={`${entryId}-dom-${i}`}
          committed={committed}
          onCommit={(next) => commitRow(i, next)}
          onRemoveRow={() => removeRowAt(i)}
          showRemoveRow={localRows.length > 1 || committed.trim() !== ''}
        />
      ))}
      <button type="button" className="text-[10px] text-sky-400 hover:underline" onClick={addRow}>
        + Aggiungi valore
      </button>
    </div>
  );
}
