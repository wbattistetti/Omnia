/**
 * Read-only modal listing the last AI calls (newest first): timestamp, purpose label, model,
 * tokens, USD/EUR cost.
 *
 * Aggregations are intentionally out of scope right now (per product decision 2026-05-12: "Per
 * ora nel report facciamo solo la lista"). The dialog only renders the list + a "Pulisci log"
 * action and an exchange-rate footer for transparency.
 */

import React from 'react';
import { Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { useAiCallLog } from '../../context/AiCallLogContext';
import { describeAiCallPurpose } from '../../domain/aiCalls/purposes';
import type { AiCallRecord } from '../../services/aiCallsApi';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});
const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

function formatEur(value: number | null): string {
  return value === null ? '—' : eurFormatter.format(value);
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export interface AiCallLogDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AiCallLogDialog({ open, onClose }: AiCallLogDialogProps): React.ReactElement | null {
  const { calls, loading, error, refreshNow, clear, exchangeRate } = useAiCallLog();

  React.useEffect(() => {
    if (!open) return undefined;
    void refreshNow();
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, refreshNow]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Storico chiamate IA"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          loading={loading}
          onRefresh={refreshNow}
          onClear={clear}
          onClose={onClose}
        />
        <DialogBody calls={calls} error={error} />
        <DialogFooter exchangeRateUsdToEur={exchangeRate?.usdToEur ?? null} count={calls.length} />
      </div>
    </div>
  );
}

function DialogHeader({
  loading,
  onRefresh,
  onClear,
  onClose,
}: {
  loading: boolean;
  onRefresh: () => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
}): React.ReactElement {
  return (
    <header className="flex items-center justify-between border-b border-slate-700/70 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Storico chiamate IA
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Ultime chiamate al motore IA con costo stimato (USD ed EUR al cambio ECB).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
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
            if (window.confirm('Vuoi davvero cancellare tutto lo storico delle chiamate IA?')) {
              void onClear();
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-700/60 bg-rose-950/40 px-2.5 text-xs text-rose-100 hover:bg-rose-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <Trash2 size={13} aria-hidden />
          Pulisci log
        </button>
        <button
          type="button"
          aria-label="Chiudi"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-slate-100"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </header>
  );
}

function DialogBody({
  calls,
  error,
}: {
  calls: AiCallRecord[];
  error: string | null;
}): React.ReactElement {
  if (error) {
    return (
      <div className="flex-1 px-4 py-6 text-sm text-rose-200">
        Errore caricando lo storico: {error}
      </div>
    );
  }
  if (!calls.length) {
    return (
      <div className="flex-1 px-4 py-10 text-center text-sm text-slate-400">
        Nessuna chiamata IA registrata finora.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full table-auto border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="border-b border-slate-700/60 px-3 py-2">Data / Ora</th>
            <th className="border-b border-slate-700/60 px-3 py-2">Scopo</th>
            <th className="border-b border-slate-700/60 px-3 py-2">Provider / Modello</th>
            <th className="border-b border-slate-700/60 px-3 py-2 text-right">Token in</th>
            <th className="border-b border-slate-700/60 px-3 py-2 text-right">Token out</th>
            <th className="border-b border-slate-700/60 px-3 py-2 text-right">Costo $</th>
            <th className="border-b border-slate-700/60 px-3 py-2 text-right">Costo €</th>
            <th className="border-b border-slate-700/60 px-3 py-2 text-right">Durata</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id} className="text-slate-200 odd:bg-slate-800/30">
              <td className="border-b border-slate-800/60 px-3 py-1.5 align-top text-slate-300">
                {formatTimestamp(c.ts)}
              </td>
              <td className="border-b border-slate-800/60 px-3 py-1.5 align-top">
                <div className="font-medium text-slate-100">{describeAiCallPurpose(c.purpose)}</div>
                {c.error ? (
                  <div className="mt-0.5 text-[10px] text-rose-300">Errore: {c.error}</div>
                ) : null}
              </td>
              <td className="border-b border-slate-800/60 px-3 py-1.5 align-top text-slate-300">
                <span className="text-slate-400">{c.providerId}</span> / {c.modelId}
                {!c.pricingFound ? (
                  <span className="ml-1 inline-block rounded bg-amber-900/50 px-1 py-0 text-[10px] text-amber-200">
                    n/p
                  </span>
                ) : null}
              </td>
              <td className="border-b border-slate-800/60 px-3 py-1.5 text-right tabular-nums">
                {c.inputTokens.toLocaleString('it-IT')}
              </td>
              <td className="border-b border-slate-800/60 px-3 py-1.5 text-right tabular-nums">
                {c.outputTokens.toLocaleString('it-IT')}
              </td>
              <td className="border-b border-slate-800/60 px-3 py-1.5 text-right tabular-nums">
                {formatUsd(c.costUsd)}
              </td>
              <td className="border-b border-slate-800/60 px-3 py-1.5 text-right tabular-nums">
                {formatEur(c.costEur)}
              </td>
              <td className="border-b border-slate-800/60 px-3 py-1.5 text-right text-slate-400 tabular-nums">
                {c.durationMs} ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DialogFooter({
  exchangeRateUsdToEur,
  count,
}: {
  exchangeRateUsdToEur: number | null;
  count: number;
}): React.ReactElement {
  return (
    <footer className="flex items-center justify-between border-t border-slate-700/70 px-4 py-2 text-[11px] text-slate-400">
      <span>{count} chiamata{count === 1 ? '' : 'e'} in elenco</span>
      <span>
        {exchangeRateUsdToEur !== null
          ? `Cambio applicato: 1 USD = ${exchangeRateUsdToEur.toFixed(4)} EUR`
          : 'Cambio EUR non disponibile (n/d)'}
      </span>
    </footer>
  );
}
