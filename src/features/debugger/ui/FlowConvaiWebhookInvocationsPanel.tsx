/**
 * Accordion diagnostica tool ConvAI `webhook` nel debugger flusso (sotto bolla bot).
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { FlowConvaiWebhookDiagnostic } from '@features/debugger/types/flowConvaiWebhookDiagnostic';

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function FlowConvaiWebhookInvocationsPanel(props: {
  invocations: FlowConvaiWebhookDiagnostic[];
}) {
  const { invocations } = props;
  if (!invocations.length) return null;

  return (
    <div className="mt-2 space-y-2 w-full max-w-xs lg:max-w-md xl:max-w-xl">
      {invocations.map((inv, idx) => (
        <details
          key={`${inv.toolName}-${inv.endpoint}-${idx}`}
          className="group rounded-lg border border-slate-200 bg-white/90 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-900/50"
        >
          <summary className="cursor-pointer list-none px-3 py-2 font-medium text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <ChevronDown
                size={14}
                className="shrink-0 text-slate-500 transition-transform group-open:rotate-180 dark:text-slate-400"
                aria-hidden
              />
              <span className="inline-flex items-center rounded border border-sky-400 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-950 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-100">
                ConvAI webhook
              </span>
              <span>
                Invocazione backend (webhook):{' '}
                <span className="font-semibold">{inv.toolName}</span>
              </span>
              {inv.unreachable ? (
                <span className="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-900 dark:bg-red-950/50 dark:text-red-100">
                  non raggiungibile
                </span>
              ) : (
                <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-100">
                  ok
                </span>
              )}
            </div>
          </summary>
          <div className="border-t border-slate-200 px-3 py-2 space-y-2 dark:border-slate-700">
            {inv.unreachable && inv.errorMessage ? (
              <div className="rounded-md border border-red-400 bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-950 dark:border-red-700 dark:bg-red-950/35 dark:text-red-50">
                {inv.errorMessage}
              </div>
            ) : null}
            <div className="text-[11px] text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{inv.method}</span>
              <span className="ml-2 break-all font-mono text-slate-900 dark:text-slate-100">{inv.endpoint}</span>
            </div>
            {inv.sourceTaskId ? (
              <div className="text-[10px] text-slate-500 dark:text-slate-500">
                Task: <span className="font-mono">{inv.sourceTaskId}</span>
              </div>
            ) : null}
            {Object.keys(inv.headers).length > 0 ? (
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Headers
                </div>
                <pre className="max-h-40 overflow-auto rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-800 dark:bg-slate-950/50 dark:text-slate-200">
                  {formatJson(inv.headers)}
                </pre>
              </div>
            ) : null}
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Parametri di input (schema)
              </div>
              <pre className="max-h-48 overflow-auto rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-800 dark:bg-slate-950/50 dark:text-slate-200">
                {inv.inputSchemaSummary.body !== undefined || inv.inputSchemaSummary.query !== undefined
                  ? formatJson(inv.inputSchemaSummary)
                  : '(nessuno)'}
              </pre>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
