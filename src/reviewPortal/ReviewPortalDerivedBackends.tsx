/**
 * Backend collegati da grafo/agent (read-only) — complemento a {@link EditorBackendsPanel}.
 */

import React from 'react';
import type { AgentReviewBackendSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import { derivedBackendRowsFromSnapshot } from './mapReviewSnapshotToProjectContext';

export interface ReviewPortalDerivedBackendsProps {
  snapshot: AgentReviewBackendSnapshot | null | undefined;
}

export function ReviewPortalDerivedBackends({
  snapshot,
}: ReviewPortalDerivedBackendsProps): React.ReactElement | null {
  const rows = derivedBackendRowsFromSnapshot(snapshot);
  if (rows.length === 0) return null;

  return (
    <section className="shrink-0 border-t border-slate-800/80 px-2 py-3">
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Dal grafo e dagli agent
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
            <div className="mt-2 flex gap-1">
              {row.sources.graph ? (
                <span className="rounded bg-slate-700/80 px-1 py-0.5 text-[9px] text-slate-300">
                  Grafo
                </span>
              ) : null}
              {row.sources.tools ? (
                <span className="rounded bg-violet-900/50 px-1 py-0.5 text-[9px] text-violet-200">
                  Agent
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
