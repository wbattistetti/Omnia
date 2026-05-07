/**
 * Sezioni collassabili per diagnostica Backend Call ricca (timeline HTTP, JSON, BookFromAgenda).
 */

import React from 'react';

type TimelineStep = {
  id?: string;
  label?: string;
  ok?: boolean;
  status?: string;
  detail?: string;
};

function stepTone(s: TimelineStep): string {
  const st = (s.status || '').toLowerCase();
  if (st === 'skipped') {
    return 'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50';
  }
  if (st === 'failed' || s.ok === false) {
    return 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/35 dark:text-red-50';
  }
  return 'border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-50';
}

export function DiagnosticTimelineCollapsible(props: { timeline: TimelineStep[] }) {
  const { timeline } = props;
  if (!timeline.length) return null;
  return (
    <details className="group rounded-md border border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-950/40">
      <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
        Pipeline (timeline)
      </summary>
      <ol className="space-y-1.5 border-t border-slate-200 px-2 py-2 dark:border-slate-600">
        {timeline.map((s, i) => (
          <li
            key={String(s.id ?? i)}
            className={`rounded border px-2 py-1.5 text-[11px] leading-snug ${stepTone(s)}`}
          >
            <div className="font-medium">{s.label ?? s.id ?? `Step ${i + 1}`}</div>
            {s.detail ? (
              <div className="mt-0.5 whitespace-pre-wrap break-words opacity-95">{s.detail}</div>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function DiagnosticValidationCollapsible(props: {
  validation: Record<string, unknown> | null | undefined;
}) {
  const v = props.validation;
  if (!v || typeof v !== 'object') return null;
  const fields = (v as { fields?: Record<string, unknown> }).fields;
  if (!fields || typeof fields !== 'object') return null;
  const entries = Object.entries(fields as Record<string, Record<string, unknown>>);
  if (!entries.length) return null;
  return (
    <details className="group rounded-md border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/60">
      <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
        Dettaglio validazione campi
      </summary>
      <div className="border-t border-slate-200 px-2 py-2 dark:border-slate-600">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-200 text-left dark:border-slate-600">
              <th className="py-1 pr-2 font-semibold text-slate-600 dark:text-slate-400">Campo</th>
              <th className="py-1 font-semibold text-slate-600 dark:text-slate-400">Atteso / Ricevuto</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, meta]) => (
              <tr key={key} className="border-b border-slate-100 align-top dark:border-slate-700">
                <td className="py-1 pr-2 font-mono text-slate-800 dark:text-slate-100">{key}</td>
                <td className="py-1 font-mono text-[10px] text-slate-700 dark:text-slate-300">
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(meta, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function JsonBlobCollapsible(props: { title: string; raw: string | null | undefined }) {
  const { title, raw } = props;
  if (!raw || !raw.trim()) return null;
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* keep raw */
  }
  return (
    <details className="group rounded-md border border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-950/40">
      <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
        {title}
      </summary>
      <pre className="max-h-48 overflow-auto border-t border-slate-200 px-2 py-2 font-mono text-[10px] leading-relaxed text-slate-800 dark:border-slate-600 dark:text-slate-200">
        {pretty}
      </pre>
    </details>
  );
}

export function BookFromAgendaDiagnosticSections(props: {
  diagnostic: Record<string, unknown> | null | undefined;
}) {
  const d = props.diagnostic;
  if (!d || typeof d !== 'object') return null;
  const timelineRaw = d.timeline;
  const timeline = Array.isArray(timelineRaw)
    ? (timelineRaw as TimelineStep[]).filter((x) => x && typeof x === 'object')
    : [];
  const validation = (d as { validation?: Record<string, unknown> }).validation;

  const summary = (d as { summary?: Record<string, unknown> }).summary;

  return (
    <div className="space-y-2">
      {summary && typeof summary === 'object' ? (
        <details className="group rounded-md border border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/30">
          <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] font-semibold text-violet-900 dark:text-violet-100 [&::-webkit-details-marker]:hidden">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
            Riepilogo BookFromAgenda
          </summary>
          <pre className="max-h-36 overflow-auto border-t border-violet-200 px-2 py-2 font-mono text-[10px] text-violet-950 dark:border-violet-800 dark:text-violet-100">
            {JSON.stringify(summary, null, 2)}
          </pre>
        </details>
      ) : null}
      {timeline.length > 0 ? <DiagnosticTimelineCollapsible timeline={timeline} /> : null}
      <DiagnosticValidationCollapsible validation={validation ?? null} />
    </div>
  );
}
