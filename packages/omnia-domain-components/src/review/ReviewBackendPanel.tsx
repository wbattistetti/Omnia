/**
 * Review portal — Backend tab (read-only snapshot from publish).
 */

import React from 'react';
import type { AgentReviewBackendSnapshot } from '@omnia/domain-core/review/reviewSnapshots';

export interface ReviewBackendPanelProps {
  snapshot: AgentReviewBackendSnapshot | null;
}

export function ReviewBackendPanel({ snapshot }: ReviewBackendPanelProps): React.ReactElement {
  const rows = snapshot?.catalogRows ?? [];
  const placeholders = snapshot?.structuredPlaceholders ?? [];

  if (rows.length === 0 && placeholders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Nessun backend collegato a questo task nella review. Configura backend in Omnia e
        ripubblica.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto p-3">
      {rows.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Backend collegati
          </h2>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.key}
                className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-100">{row.label}</span>
                  <span className="font-mono text-[10px] text-violet-300/90">
                    {row.method} {row.pathnameDisplay}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 border-t border-slate-800/60 pt-2">
                  {row.bindings.map((b) => (
                    <li key={b.bindingId} className="flex gap-2 text-[11px] text-slate-400">
                      <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] uppercase">
                        {b.source}
                      </span>
                      <code className="truncate">{b.bindingId}</code>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {placeholders.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Placeholder backend (design strutturato)
          </h2>
          <ul className="space-y-1">
            {placeholders.map((p) => (
              <li
                key={p.id}
                className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5 font-mono text-xs text-slate-300"
              >
                {p.definitionId}
                <span className="ml-2 text-slate-500">({p.id})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
