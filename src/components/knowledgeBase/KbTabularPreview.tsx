/**
 * Scrollable aligned table for KB tabular document previews (TSV/CSV/xlsx text).
 */

import React from 'react';
import type { KbTabularGrid } from '@domain/knowledgeBase/parseKbTabularText';

export type KbTabularPreviewProps = {
  grid: KbTabularGrid;
  preamble?: readonly string[];
  truncatedRowCount?: number;
  className?: string;
};

function columnMinWidthCh(header: string, columnCells: readonly string[]): number {
  let maxLen = header.length;
  for (const cell of columnCells) {
    maxLen = Math.max(maxLen, cell.length);
  }
  return Math.min(48, Math.max(8, maxLen + 2));
}

export function KbTabularPreview({
  grid,
  preamble = [],
  truncatedRowCount,
  className = '',
}: KbTabularPreviewProps): React.ReactElement {
  const colWidths = React.useMemo(
    () => grid.headers.map((h, i) => columnMinWidthCh(h, grid.rows.map((r) => r[i] ?? ''))),
    [grid.headers, grid.rows]
  );

  return (
    <div
      className={
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-800 bg-slate-950/40 ' +
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
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse text-left text-slate-200">
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={`col-${i}`} style={{ minWidth: `${w}ch` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_rgb(30_41_59)]">
            <tr>
              {grid.headers.map((h, i) => (
                <th
                  key={`h-${i}-${h}`}
                  className="whitespace-nowrap border-b border-slate-700 px-2 py-1.5 font-semibold text-amber-200/90"
                  title={h}
                >
                  {h || '—'}
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
                    className="whitespace-nowrap border-b border-slate-800/80 px-2 py-1 text-slate-300"
                    title={cell}
                  >
                    {cell || '—'}
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

