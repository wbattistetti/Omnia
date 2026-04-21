/**
 * Coppie chiave/valore generiche su `advanced` (esclusi blocchi riservati) — uso in Developer Tools.
 */

import React from 'react';
import { FieldHint } from './FieldHint';

export interface AdvancedSectionProps {
  advanced: Record<string, unknown>;
  showOverrideBadge?: boolean;
  onChange: (next: Record<string, unknown>) => void;
}

/** Chiavi gestite altrove (ModelSection, ConvAI). */
const RESERVED = new Set([
  'llm',
  'workflow',
  'conversation_settings',
  'top_p',
  'topP',
  'frequency_penalty',
  'presence_penalty',
  'stop',
  'seed',
  'stop_sequences',
  'topK',
  'safetySettings',
]);

type Row = { key: string; value: string };

function toRows(adv: Record<string, unknown>): Row[] {
  return Object.keys(adv)
    .filter((k) => !RESERVED.has(k))
    .map((key) => {
      const val = adv[key];
      return {
        key,
        value:
          typeof val === 'string' ? val : val === undefined ? '' : JSON.stringify(val, null, 2),
      };
    });
}

export function AdvancedSection({
  advanced,
  showOverrideBadge: _showOverrideBadge,
  onChange,
}: AdvancedSectionProps) {
  const [rows, setRows] = React.useState<Row[]>(() => toRows(advanced));

  React.useEffect(() => {
    setRows(toRows(advanced));
  }, [advanced]);

  const rebuildAdvanced = React.useCallback(
    (nextRows: Row[]) => {
      const next: Record<string, unknown> = {};
      for (const rk of RESERVED) {
        if (rk in advanced && advanced[rk] !== undefined) {
          next[rk] = advanced[rk];
        }
      }
      for (const row of nextRows) {
        const k = row.key.trim();
        if (!k || RESERVED.has(k)) continue;
        const raw = row.value.trim();
        if (!raw) {
          next[k] = '';
          continue;
        }
        try {
          next[k] = JSON.parse(raw) as unknown;
        } catch {
          next[k] = raw;
        }
      }
      onChange(next);
    },
    [advanced, onChange]
  );

  const updateRow = (idx: number, patch: Partial<Row>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setRows(next);
    rebuildAdvanced(next);
  };

  const addRow = () => {
    const next = [...rows, { key: '', value: '' }];
    setRows(next);
  };

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    rebuildAdvanced(next);
  };

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, idx) => (
        <div key={idx} className="flex flex-row flex-wrap items-end gap-1">
          <FieldHint
            label="Chiave"
            tooltip="Nome parametro extra nel blob advanced. Valore stringa o JSON."
            className="min-w-0 shrink"
          >
            <input
              placeholder="chiave"
              className="h-8 max-w-[120px] rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] leading-none text-slate-100"
              value={row.key}
              onChange={(e) => updateRow(idx, { key: e.target.value })}
            />
          </FieldHint>
          <FieldHint
            label="Valore"
            tooltip="Stringa o oggetto JSON serializzato."
            className="min-w-0 flex-1"
          >
            <textarea
              rows={2}
              placeholder="valore"
              className="max-w-[240px] resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] leading-snug text-slate-100"
              value={row.value}
              onChange={(e) => updateRow(idx, { value: e.target.value })}
            />
          </FieldHint>
          <button
            type="button"
            className="mb-0.5 shrink-0 text-[10px] leading-none text-red-400 hover:text-red-300"
            onClick={() => removeRow(idx)}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="h-7 w-fit rounded border border-slate-600 bg-slate-800 px-1.5 py-0 text-[10px] leading-none text-slate-100 hover:bg-slate-700"
        onClick={addRow}
      >
        Aggiungi chiave / valore
      </button>
    </div>
  );
}
