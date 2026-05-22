/**
 * Pulsanti canale review in cima alla lista use case (sempre visibili nel composer).
 */

import React from 'react';
import { ExternalLink, RefreshCw, Upload } from 'lucide-react';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';

export function UseCaseReviewPublishStrip(): React.ReactElement {
  const { agentReviewChannel } = useAIAgentEditorDock();
  const ch = agentReviewChannel;
  const banner = ch.banner;

  let statusLine: string | null = null;
  if (banner.kind === 'published') statusLine = 'Pubblicato sul canale condiviso.';
  else if (banner.kind === 'update_available') statusLine = banner.summary;
  else if (banner.kind === 'imported') statusLine = 'Importato dal canale — salva il progetto.';
  else if (banner.kind === 'error') statusLine = banner.message;
  else if (banner.kind === 'in_sync') statusLine = 'Allineato al canale.';

  return (
    <div className="shrink-0 border-b border-violet-500/35 bg-violet-950/30 px-2 py-2 sm:px-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!ch.canUseChannel || ch.busy}
          onClick={() => void ch.publishToChannel('customer')}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          title="Pubblica use case e descrizione sul canale per la pagina review"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Pubblica review
        </button>
        <button
          type="button"
          disabled={!ch.canUseChannel || ch.busy}
          onClick={() => void ch.checkChannelUpdate()}
          className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${ch.busy ? 'animate-spin' : ''}`} aria-hidden />
          Controlla
        </button>
        <button
          type="button"
          disabled={!ch.canUseChannel || ch.busy || banner.kind !== 'update_available'}
          onClick={() => void ch.importFromChannel()}
          className="inline-flex items-center gap-1 rounded border border-emerald-700/50 bg-emerald-950/50 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
        >
          Importa
        </button>
        {ch.reviewPortalUrl ? (
          <a
            href={ch.reviewPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Apri review web
          </a>
        ) : null}
      </div>
      {statusLine ? (
        <p className="mt-1.5 text-[11px] leading-snug text-violet-200/80">{statusLine}</p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Pubblica qui prima di aprire la pagina review esterna.
        </p>
      )}
    </div>
  );
}
