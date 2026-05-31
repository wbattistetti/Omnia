/**
 * Dialog report readiness OpenAPI / webhook ConvAI: vista React colorata + copia testo plain.
 */

import React from 'react';
import { Check, ClipboardCopy, Loader2, X } from 'lucide-react';
import type { AgentWebhookReadinessReport } from '@domain/openApi/webhookOpenApiReadiness';
import { formatWebhookReadinessReport } from '@domain/openApi/webhookOpenApiReadiness';
import { WebhookReadinessReportView } from './WebhookReadinessReportView';

export type WebhookReadinessReportDialogProps = {
  readonly open: boolean;
  readonly report: AgentWebhookReadinessReport | null;
  readonly onClose: () => void;
};

export function WebhookReadinessReportDialog({
  open,
  report,
  onClose,
}: WebhookReadinessReportDialogProps): React.ReactElement | null {
  const [copyState, setCopyState] = React.useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const reportText = React.useMemo(
    () => (report ? formatWebhookReadinessReport(report) : ''),
    [report]
  );

  React.useEffect(() => {
    if (!open) setCopyState('idle');
  }, [open]);

  const handleCopy = React.useCallback(async () => {
    if (!reportText.trim()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyState('error');
      return;
    }
    setCopyState('busy');
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyState('done');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
    }
  }, [reportText]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webhook-readiness-report-title"
    >
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-cyan-500/35 bg-slate-950 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 px-3 py-2">
          <div className="min-w-0">
            <h2 id="webhook-readiness-report-title" className="text-sm font-semibold text-slate-100">
              Report webhook / OpenAPI (ElevenLabs)
            </h2>
            {report ? (
              <p className="text-[11px] text-slate-400">
                {report.backendCount} backend ·{' '}
                <span className="text-red-300">{report.totalBlockers} blocker</span>
                {' · '}
                <span className="text-amber-200">{report.totalWarnings} warning</span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-45"
              disabled={!reportText.trim() || copyState === 'busy'}
              onClick={() => void handleCopy()}
              title="Copia testo semplice per Slack/email al team backend"
            >
              {copyState === 'busy' ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : copyState === 'done' ? (
                <Check size={12} className="text-emerald-400" aria-hidden />
              ) : (
                <ClipboardCopy size={12} aria-hidden />
              )}
              {copyState === 'done'
                ? 'Copiato'
                : copyState === 'error'
                  ? 'Errore copia'
                  : 'Copia report (testo)'}
            </button>
            <button
              type="button"
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              onClick={onClose}
              aria-label="Chiudi"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {!report ? (
            <p className="px-1 text-xs text-slate-500">Nessun report disponibile.</p>
          ) : (
            <WebhookReadinessReportView report={report} />
          )}
        </div>
        <p className="border-t border-slate-800/80 px-3 py-2 text-[10px] text-slate-500">
          Vista colorata per revisione rapida. «Copia report» esporta testo plain (✓/⚠/✗ e valori campi)
          per il team backend.
        </p>
      </div>
    </div>
  );
}
