/**
 * Guardalog webhook ConvAI nel Task Editor AI Agent: invocazioni ElevenLabs → gateway → backend.
 */

import React from 'react';
import { Activity, ChevronDown, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useConvaiWebhookInvocationLog } from '@context/ConvaiWebhookInvocationLogContext';
import type { ConvaiWebhookInvocationRecord } from '@services/convaiWebhookInvocationsApi';

export interface EditorWebhookInvocationsPanelProps {
  readonly projectId: string;
  readonly agentTaskId: string;
  readonly taskLabel: string;
  readonly backendTaskIds?: readonly string[];
}

function formatJsonPreview(raw: string | null): string {
  if (!raw?.trim()) return '—';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusTone(record: ConvaiWebhookInvocationRecord): string {
  if (record.error) {
    return 'border-rose-400/60 bg-rose-950/35 text-rose-100';
  }
  if (record.upstreamStatus != null && record.upstreamStatus >= 400) {
    return 'border-amber-400/60 bg-amber-950/35 text-amber-100';
  }
  return 'border-emerald-400/50 bg-emerald-950/30 text-emerald-100';
}

function InvocationRow({ record }: { record: ConvaiWebhookInvocationRecord }) {
  const when = new Date(record.ts).toLocaleString('it-IT');
  const statusLabel =
    record.error ?? (record.upstreamStatus != null ? `HTTP ${record.upstreamStatus}` : '—');

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
          <span className="font-semibold text-slate-100">
            {record.backendLabel || record.backendTaskId || 'Backend'}
          </span>
          <span
            className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusTone(record)}`}
          >
            {statusLabel}
          </span>
          <span className="text-[10px] text-slate-500">{record.durationMs} ms</span>
          {record.sendHintsApplied > 0 ? (
            <span className="text-[10px] text-violet-300">sendHints ×{record.sendHintsApplied}</span>
          ) : null}
        </div>
        <div className="mt-1 break-all font-mono text-[10px] text-slate-400">
          {record.forwardMethod} {record.upstreamUrl || record.gatewayPath || '—'}
        </div>
      </summary>
      <div className="space-y-3 border-t border-slate-700/70 px-3 py-3">
        <Block title="Body da ElevenLabs (gateway IN)" text={formatJsonPreview(record.requestBodyFromClient)} />
        <Block
          title="Body dopo sendHints (forward upstream)"
          text={formatJsonPreview(record.requestBodyAfterSendHints)}
        />
        <Block title="Risposta backend (RECEIVE preview)" text={formatJsonPreview(record.upstreamResponsePreview)} />
      </div>
    </details>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <pre className="max-h-48 overflow-auto rounded bg-slate-950/70 px-2 py-1.5 font-mono text-[10px] text-slate-200">
        {text}
      </pre>
    </div>
  );
}

export function EditorWebhookInvocationsPanel({
  projectId,
  agentTaskId,
  taskLabel,
  backendTaskIds = [],
}: EditorWebhookInvocationsPanelProps): React.ReactElement {
  const { invocations, loading, error, refreshNow, clear } = useConvaiWebhookInvocationLog();
  const [backendFilter, setBackendFilter] = React.useState<string>('');

  const refreshFilters = React.useMemo(
    () => ({
      projectId,
      agentTaskId,
      ...(backendFilter.trim() ? { backendTaskId: backendFilter.trim() } : {}),
    }),
    [projectId, agentTaskId, backendFilter]
  );

  React.useEffect(() => {
    void refreshNow(refreshFilters);
  }, [refreshNow, refreshFilters]);

  const filtered = React.useMemo(
    () =>
      invocations.filter(
        (r) =>
          r.projectId === projectId &&
          r.agentTaskId === agentTaskId &&
          (!backendFilter.trim() || r.backendTaskId === backendFilter.trim())
      ),
    [invocations, projectId, agentTaskId, backendFilter]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/40 px-5 py-3">
        <div className="min-w-0 flex items-center gap-2">
          <Activity size={18} className="shrink-0 text-sky-300" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">
              Webhook agente — <span className="text-violet-200">{taskLabel || '(senza nome)'}</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Chiamate ConvAI verso i backend collegati (gateway Omnia → upstream). Aggiornamento
              automatico ogni ~2,5 s.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {backendTaskIds.length > 0 ? (
            <select
              value={backendFilter}
              onChange={(e) => setBackendFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-200"
              aria-label="Filtra per backend"
            >
              <option value="">Tutti i backend</option>
              {backendTaskIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshNow(refreshFilters)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700"
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={13} aria-hidden />
            )}
            Aggiorna
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Svuotare tutto il guardalog webhook?')) return;
              void clear().then(() => refreshNow(refreshFilters));
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            <Trash2 size={13} aria-hidden />
            Svuota
          </button>
        </div>
      </header>

      {error ? (
        <div className="px-5 py-4 text-sm text-rose-200">Errore caricamento log: {error}</div>
      ) : null}

      {!error && filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-slate-400">
          <Activity size={28} className="text-slate-600" aria-hidden />
          <div className="max-w-lg">
            Nessuna invocazione webhook registrata per questo agente.
            <br />
            Parla con l’agente ElevenLabs (con tunnel ngrok attivo verso Express) e le chiamate ai
            tool backend compariranno qui.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-5 py-4 space-y-2">
          {filtered.map((record) => (
            <InvocationRow key={record.id} record={record} />
          ))}
        </div>
      )}

      <footer className="border-t border-slate-800/70 px-5 py-2 text-[11px] text-slate-500">
        {filtered.length} eventi · agentTaskId{' '}
        <span className="font-mono text-slate-400">{agentTaskId}</span>
      </footer>
    </div>
  );
}
