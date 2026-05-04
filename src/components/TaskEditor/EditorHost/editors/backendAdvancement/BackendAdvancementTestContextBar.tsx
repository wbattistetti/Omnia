/**
 * Bar sopra SEND: override opzionale PREV per test avanzamento.
 * I valori di default per prev.* nel Play provengono dai letterali della griglia SEND (come param.*).
 */

import React from 'react';

export function BackendAdvancementTestContextBar({
  advancementTestPrevJson,
  onTestPrevJsonChange,
}: {
  advancementTestPrevJson: string;
  onTestPrevJsonChange: (s: string) => void;
}) {
  return (
    <div className="mb-1.5 flex min-w-0 flex-col gap-1 rounded-md border border-teal-600/30 bg-slate-950/55 px-2 py-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        Test — PREV opzionale (override JSON)
      </span>
      <p className="text-[9px] leading-snug text-slate-500">
        Il Play usa i letterali SEND come contesto; qui puoi sovrascrivere chiavi per simulare uno stato batch
        precedente diverso (facoltativo).
      </p>
      <label className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[8px] uppercase text-slate-600">prev (facoltativo)</span>
        <textarea
          value={advancementTestPrevJson}
          onChange={(e) => onTestPrevJsonChange(e.target.value)}
          spellCheck={false}
          rows={2}
          className="min-h-[44px] w-full resize-y rounded border border-slate-600/80 bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-100"
          placeholder='{} oppure {"campo":"valore"}'
        />
      </label>
    </div>
  );
}
