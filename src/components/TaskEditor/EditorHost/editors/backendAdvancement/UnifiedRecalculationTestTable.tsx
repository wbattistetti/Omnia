/**
 * Tabella Test per policy Recalculation unificata: valore ingresso `param` → valore nell’oggetto restituito dallo script.
 */

import React from 'react';
import type { UnifiedRecalculationBeforeAfterRow } from '../../../../../domain/advancement/advancementQuickTest';

export function UnifiedRecalculationTestTable({
  rows,
}: {
  rows: readonly UnifiedRecalculationBeforeAfterRow[];
}) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded border border-teal-600/35 bg-slate-950/90">
      <table className="w-full min-w-[280px] border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-slate-600/70 bg-slate-900/95 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-2 py-1.5 font-semibold">Parametro</th>
            <th className="px-2 py-1.5 font-semibold text-orange-200/90">Prima (ingresso)</th>
            <th className="px-2 py-1.5 font-semibold text-emerald-200/90">Dopo (script)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b border-slate-700/50 last:border-b-0 hover:bg-slate-900/60"
            >
              <td className="max-w-[120px] truncate px-2 py-1 font-mono text-teal-100/95" title={r.key}>
                {r.key}
              </td>
              <td className="max-w-[min(200px,40vw)] truncate px-2 py-1 font-mono text-orange-100/90">
                {r.beforeDisplay}
              </td>
              <td className="max-w-[min(200px,40vw)] truncate px-2 py-1 font-mono text-emerald-100/90">
                {r.afterDisplay}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-700/50 px-2 py-1 text-[9px] leading-snug text-slate-500">
        «Prima» = snapshot da letterali SEND (`param` del Test). «Dopo» = chiavi nell’oggetto restituito; «—» se lo
        script non imposta quella chiave. La scrittura nel runtime avviene nell’executor, non nello script.
      </p>
    </div>
  );
}
