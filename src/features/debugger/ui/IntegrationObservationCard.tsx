/**
 * Carta osservabilità integrazione — titolo/hint dal catalogo v1 + campi risolti dal runtime.
 */

import React from 'react';
import type {
  IntegrationObservationResolved,
  IntegrationObservationSeverity,
} from '@domain/observability/integrationObservationCatalog';

function severityBadgeClass(sev: IntegrationObservationSeverity): string {
  switch (sev) {
    case 'error':
      return 'border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-50';
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-50';
    default:
      return 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100';
  }
}

export function IntegrationObservationCard(props: { observation: IntegrationObservationResolved }) {
  const { observation: o } = props;
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-[11px] leading-snug ${severityBadgeClass(o.severity)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{o.titleUi}</span>
        <span className="rounded border border-black/10 bg-white/60 px-1.5 py-0.5 font-mono text-[10px] dark:bg-black/20">
          {o.event}
        </span>
        <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide dark:bg-white/10">
          {o.integrationStage}
        </span>
        <span className="text-[10px] opacity-80">{o.severity}</span>
      </div>
      <p className="mt-1.5 text-[11px] opacity-95">{o.hintUi}</p>
      {Object.keys(o.fields).length > 0 ? (
        <dl className="mt-2 space-y-1 border-t border-black/10 pt-2 dark:border-white/10">
          {Object.entries(o.fields).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-mono text-[10px] font-semibold opacity-80">{k}</dt>
              <dd className="min-w-0 break-all font-mono text-[10px]">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
