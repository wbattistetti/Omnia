/**
 * Cella output mock table: anteprima, raw, nota (icona on hover), edit mock al click sul valore.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { stableJsonStringify } from '../../../../../utils/stableJsonStringify';
import { coerceMockCellValue } from '../../../../../utils/backendCall/coerceMockCellValue';
import { NoteEditor } from './NoteEditor';
import {
  formatMockOutputValue,
  singleLinePreview,
  toMinifiedJson,
  toPrettyJson,
  type MockOutputValueFormat,
} from './formatMockOutputValue';

function listPreview(arr: unknown[], max = 3): string {
  const slice = arr.slice(0, max);
  const parts = slice.map((x) => {
    const s = stableJsonStringify(x);
    return s.length > 48 ? `${s.slice(0, 48)}…` : s;
  });
  const more = arr.length > max ? ` … (+${arr.length - max})` : '';
  return `[${parts.join(', ')}${more}]`;
}

export type OutputCellProps = {
  columnName: string;
  value: unknown;
  rawJson?: string;
  noteKey: string;
  noteText: string;
  onNoteSave: (key: string, text: string) => void;
  /** Aggiorna valore mock manuale (stringa cella, parsing JSON opzionale). */
  onSaveMockValue?: (next: unknown) => void;
  /** Tooltip sul valore: descrizione + «. Clicca per editare.» */
  valueTooltip?: string;
  /** JSON compatto vs indentato (toggle globale tabella). */
  valueFormat?: MockOutputValueFormat;
};

export function OutputCell({
  columnName: _columnName,
  value,
  rawJson,
  noteKey,
  noteText,
  onNoteSave,
  onSaveMockValue,
  valueTooltip,
  valueFormat = 'js',
}: OutputCellProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);
  const [editMock, setEditMock] = React.useState(false);
  const cellStringForEdit = React.useCallback(
    (v: unknown) =>
      v === undefined || v === null ? '' : valueFormat === 'pretty' ? toPrettyJson(v) : toMinifiedJson(v),
    [valueFormat]
  );
  const [mockDraft, setMockDraft] = React.useState(() => cellStringForEdit(value));

  React.useEffect(() => {
    setMockDraft(cellStringForEdit(value));
  }, [value, cellStringForEdit]);

  const isList = Array.isArray(value);
  const display =
    value === undefined || value === null
      ? ''
      : isList
        ? valueFormat === 'js'
          ? listPreview(value as unknown[])
          : singleLinePreview(formatMockOutputValue(value, 'pretty'), 200)
        : typeof value === 'object'
          ? valueFormat === 'pretty'
            ? singleLinePreview(formatMockOutputValue(value, 'pretty'), 200)
            : stableJsonStringify(value)
          : String(value);

  const fullText =
    value === undefined || value === null ? '' : formatMockOutputValue(value, valueFormat);
  const hint = valueTooltip?.trim() || 'Clicca per editare.';

  const openMockEditor = () => {
    if (onSaveMockValue) setEditMock(true);
  };

  return (
    <div className="group relative min-h-[2.5rem] min-w-[120px] max-w-[320px] border-l border-slate-700 px-2 py-2 align-middle">
      <div className="flex min-h-[2rem] flex-col justify-center pr-7">
        {onSaveMockValue && editMock ? (
          <div className="flex w-full flex-col gap-0.5">
            <textarea
              value={mockDraft}
              onChange={(e) => setMockDraft(e.target.value)}
              rows={valueFormat === 'pretty' ? 8 : 2}
              className="w-full resize-y rounded border border-green-600/60 bg-slate-950 px-1 py-0.5 font-mono text-[10px] text-green-200"
            />
            <div className="flex gap-1">
              <button
                type="button"
                className="text-[9px] text-slate-400 hover:text-slate-200"
                onClick={() => {
                  setEditMock(false);
                  setMockDraft(cellStringForEdit(value));
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                className="text-[9px] text-green-400 hover:text-green-300"
                onClick={() => {
                  onSaveMockValue(coerceMockCellValue(mockDraft));
                  setEditMock(false);
                }}
              >
                Salva mock
              </button>
            </div>
          </div>
        ) : isList ? (
          <>
            {onSaveMockValue ? (
              <button
                type="button"
                className="w-full break-words text-left text-[11px] text-green-300/90 hover:bg-slate-800/60"
                title={hint}
                onClick={openMockEditor}
              >
                {display}
              </button>
            ) : (
              <div className="break-words text-[11px] text-green-300/90" title={fullText}>
                {display}
              </div>
            )}
            <button
              type="button"
              className="mt-0.5 flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-slate-200"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expanded ? 'Comprimi' : 'Espandi'}
            </button>
            {expanded ? (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-1 text-[10px] text-green-200/90">
                {fullText}
              </pre>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={openMockEditor}
            disabled={!onSaveMockValue}
            title={onSaveMockValue ? hint : fullText || undefined}
            className="w-full break-words text-left text-[11px] text-green-300/90 hover:bg-slate-800/60 disabled:cursor-default disabled:hover:bg-transparent"
          >
            {display || <span className="text-slate-500 italic">empty</span>}
          </button>
        )}
        {rawJson ? (
          <div className="mt-1">
            <button
              type="button"
              className="text-[10px] text-slate-500 hover:text-slate-300"
              onClick={() => setShowRaw((s) => !s)}
            >
              {showRaw ? 'Nascondi raw' : 'Raw risposta'}
            </button>
            {showRaw ? (
              <pre className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-1 text-[9px] text-slate-400">
                {rawJson}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100">
        <NoteEditor noteKey={noteKey} value={noteText} onSave={onNoteSave} />
      </div>
    </div>
  );
}
