/**
 * Anteprima URL webhook ElevenLabs per backend catalogo (tab Backend del prompt completo).
 * Separato dal markdown prompt: l’endpoint operativo OpenAPI resta sul task Backend Call.
 */

import React from 'react';
import { Clipboard, ClipboardCheck } from 'lucide-react';
import type { ConvaiWebhookUrlPreviewRow } from '@utils/iaAgentRuntime/prepareConvaiWebhookToolForElevenLabsApi';

export type BackendWebhookUrlPreviewPanelProps = {
  rows: readonly ConvaiWebhookUrlPreviewRow[];
};

export function BackendWebhookUrlPreviewPanel({
  rows,
}: BackendWebhookUrlPreviewPanelProps): React.ReactElement | null {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = React.useCallback(async (row: ConvaiWebhookUrlPreviewRow) => {
    const text = row.webhookUrl.trim();
    if (!text) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(row.backendTaskId);
      window.setTimeout(() => setCopiedId((prev) => (prev === row.backendTaskId ? null : prev)), 1600);
    } catch {
      /* ignore */
    }
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="shrink-0 space-y-2 rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-violet-200/95">
        URL webhook ElevenLabs (verifica manuale)
      </p>
      <p className="text-[10px] leading-relaxed text-slate-500">
        URL inviate al tool ConvAI in sync — non nel prompt BACKEND RECEIVE. L’endpoint operativo OpenAPI sul Backend
        Call resta invariato (es. Supabase).
      </p>
      <ul className="space-y-2">
        {rows.map((row) => {
          const copied = copiedId === row.backendTaskId;
          const canCopy = Boolean(row.webhookUrl.trim());
          return (
            <li
              key={row.backendTaskId}
              className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <span className="font-semibold text-slate-200">{row.label}</span>
                <span className="text-slate-500">
                  tool: <span className="font-mono text-slate-400">{row.toolName}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="uppercase text-slate-500">{row.method}</span>
                {!row.reachable && row.webhookUrl ? (
                  <span className="rounded border border-amber-600/45 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-100">
                    tunnel mancante
                  </span>
                ) : null}
              </div>
              {row.buildError ? (
                <p className="mt-1 text-[10px] text-rose-300/90">{row.buildError}</p>
              ) : (
                <div className="mt-1.5 flex items-start gap-1.5">
                  <code
                    className="min-w-0 flex-1 break-all font-mono text-[10px] leading-snug text-emerald-200/90"
                    title={row.webhookUrl}
                  >
                    {row.webhookUrl}
                  </code>
                  <button
                    type="button"
                    disabled={!canCopy}
                    aria-label={`Copia URL webhook ${row.label}`}
                    title={canCopy ? 'Copia URL' : 'URL non disponibile'}
                    onClick={() => void handleCopy(row)}
                    className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copied ? (
                      <ClipboardCheck size={14} aria-hidden className="text-emerald-400" />
                    ) : (
                      <Clipboard size={14} aria-hidden />
                    )}
                  </button>
                </div>
              )}
              {!row.buildError && !row.reachable && row.reachabilityMessage ? (
                <p className="mt-1 text-[10px] text-amber-200/85">{row.reachabilityMessage}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
