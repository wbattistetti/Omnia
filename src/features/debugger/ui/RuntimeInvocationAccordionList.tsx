/**
 * Righe accordion condivise per log runtime ConvAI V2 (editor + debugger).
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { ConvaiRuntimeInvocationRecord } from '@domain/convaiObservability/convaiRuntimeInvocationRecord';
import { formatRuntimeInvocationSummary } from '@domain/convaiObservability/formatRuntimeInvocationSummary';

function formatJsonPreview(raw: string | null): string {
  if (!raw?.trim()) return '—';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusTone(record: ConvaiRuntimeInvocationRecord): string {
  if (record.error) {
    return 'border-rose-400/60 bg-rose-950/35 text-rose-100';
  }
  if (record.httpStatus >= 400) {
    return 'border-amber-400/60 bg-amber-950/35 text-amber-100';
  }
  return 'border-emerald-400/50 bg-emerald-950/30 text-emerald-100';
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <pre className="max-h-48 overflow-auto rounded bg-slate-950/70 px-2 py-1.5 font-mono text-[10px] text-slate-200 whitespace-pre-wrap break-words">
        {text}
      </pre>
    </div>
  );
}

export function RuntimeInvocationRow({ record }: { record: ConvaiRuntimeInvocationRecord }) {
  const when = new Date(record.ts).toLocaleString('it-IT');
  const statusLabel =
    record.dialogStatus ??
    record.error ??
    (record.upstreamHttpStatus != null ? `upstream ${record.upstreamHttpStatus}` : `HTTP ${record.httpStatus}`);

  return (
    <details className="group rounded-lg border border-slate-700/80 bg-slate-900/50 text-xs">
      <summary className="cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <ChevronDown
            size={14}
            className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
            aria-hidden
          />
          <span className="font-mono text-[10px] text-slate-400">{when}</span>
          <span className="font-semibold text-slate-100">{formatRuntimeInvocationSummary(record)}</span>
          <span
            className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusTone(record)}`}
          >
            {statusLabel}
          </span>
          {record.conversationId ? (
            <span className="font-mono text-[10px] text-slate-500 truncate max-w-[8rem]" title={record.conversationId}>
              {record.conversationId.slice(0, 12)}…
            </span>
          ) : null}
        </div>
        <div className="mt-1 break-all font-mono text-[10px] text-slate-400">
          {record.kind === 'convai_webhook_gateway'
            ? `${record.forwardMethod ?? 'POST'} ${record.upstreamUrl ?? record.gatewayPath ?? '—'}`
            : record.gatewayPath ?? '—'}
        </div>
      </summary>
      <div className="space-y-3 border-t border-slate-700/70 px-3 py-3">
        <Block title="Body da ConvAI (IN)" text={formatJsonPreview(record.requestBodyFromClient)} />
        {record.requestBodyAfterSendHints ? (
          <Block
            title="Body dopo sendHints"
            text={formatJsonPreview(record.requestBodyAfterSendHints)}
          />
        ) : null}
        <Block title="Risposta Omnia (OUT)" text={formatJsonPreview(record.upstreamResponsePreview)} />
      </div>
    </details>
  );
}

export function RuntimeInvocationAccordionList(props: {
  invocations: readonly ConvaiRuntimeInvocationRecord[];
}) {
  if (!props.invocations.length) return null;
  return (
    <div className="space-y-2">
      {props.invocations.map((record) => (
        <RuntimeInvocationRow key={record.id} record={record} />
      ))}
    </div>
  );
}
