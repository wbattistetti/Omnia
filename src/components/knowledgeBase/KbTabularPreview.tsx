/**
 * Scrollable aligned table for KB tabular document previews (TSV/CSV/xlsx text).
 */

import React from 'react';
import type { KbTabularGrid } from '@domain/knowledgeBase/parseKbTabularText';
import { kbTabularColumnWidthCh } from '@domain/knowledgeBase/kbTabularColumnSizing';

export type KbTabularPreviewProps = {
  grid: KbTabularGrid;
  preamble?: readonly string[];
  truncatedRowCount?: number;
  className?: string;
};

export function KbTabularPreview({
  grid,
  preamble = [],
  truncatedRowCount,
  className = '',
}: KbTabularPreviewProps): React.ReactElement {
  const colWidths = React.useMemo(
    () => grid.headers.map((h, i) => kbTabularColumnWidthCh(h, grid.rows.map((r) => r[i] ?? ''))),
    [grid.headers, grid.rows]
  );

  return (
    <div
      className={
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border border-slate-800 bg-slate-950/40 ' +
        className
      }
    >
      {preamble.length > 0 ? (
        <div className="shrink-0 space-y-0.5 border-b border-slate-800/80 px-2 py-1.5">
          {preamble.map((line, i) => (
            <p key={`pre-${i}`} className="text-slate-500">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain">
        <table className="w-max border-collapse text-left text-xs text-slate-200">
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={`col-${i}`} style={{ width: `${w}ch` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_rgb(30_41_59)]">
            <tr>
              {grid.headers.map((h, i) => (
                <th
                  key={`h-${i}-${h}`}
                  className="border-b border-slate-700 px-2 py-1.5 font-semibold text-amber-200/90"
                  style={{ width: `${colWidths[i]}ch`, maxWidth: '42ch' }}
                  title={h}
                >
                  <span className="block max-w-[42ch] truncate">{h || '—'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, ri) => (
              <tr key={`r-${ri}`} className="odd:bg-slate-950/50 even:bg-slate-900/30">
                {row.map((cell, ci) => (
                  <td
                    key={`c-${ri}-${ci}`}
                    className="border-b border-slate-800/80 px-2 py-1 text-slate-300"
                    style={{ width: `${colWidths[ci]}ch`, maxWidth: '42ch' }}
                    title={cell}
                  >
                    <span className="block max-w-[42ch] truncate">{cell || '—'}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncatedRowCount != null && truncatedRowCount > grid.rows.length ? (
        <p className="shrink-0 border-t border-slate-800 px-2 py-1 text-amber-400/90">
          Mostrate {grid.rows.length} righe (anteprima troncata).
        </p>
      ) : null}
    </div>
  );
}

