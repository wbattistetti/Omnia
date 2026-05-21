/**
 * Barra canale review condiviso (pubblica / controlla / importa) per pannelli use case e descrizione.
 */

import React from 'react';
import { ExternalLink, RefreshCw, Upload, Download } from 'lucide-react';
import type { ReviewChannelBanner } from './useAgentReviewChannel';

export interface AgentReviewChannelBarProps {
  scopeLabel: string;
  canUseChannel: boolean;
  busy: boolean;
  banner: ReviewChannelBanner;
  reviewPortalUrl: string | null;
  onPublish: () => void | Promise<void>;
  onCheckUpdate: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  onDismissBanner: () => void;
}

export function AgentReviewChannelBar({
  scopeLabel,
  canUseChannel,
  busy,
  banner,
  reviewPortalUrl,
  onPublish,
  onCheckUpdate,
  onImport,
  onDismissBanner,
}: AgentReviewChannelBarProps) {
  return (
    <div className="shrink-0 space-y-1.5 rounded-md border border-slate-600/50 bg-slate-900/60 px-2 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-slate-300">Canale review</span>
        <span className="text-slate-500">({scopeLabel})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!canUseChannel || busy}
          onClick={() => void onPublish()}
          className="inline-flex items-center gap-1 rounded border border-sky-600/50 bg-sky-950/50 px-2 py-1 text-sky-100 hover:bg-sky-900/60 disabled:opacity-40"
          title="Scrivi lo stato corrente sul file condiviso (server)"
        >
          <Upload className="h-3 w-3" />
          Pubblica
        </button>
        <button
          type="button"
          disabled={!canUseChannel || busy}
          onClick={() => void onCheckUpdate()}
          className="inline-flex items-center gap-1 rounded border border-amber-600/50 bg-amber-950/40 px-2 py-1 text-amber-100 hover:bg-amber-900/50 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />
          Controlla
        </button>
        <button
          type="button"
          disabled={!canUseChannel || busy || banner.kind !== 'update_available'}
          onClick={() => void onImport()}
          className="inline-flex items-center gap-1 rounded border border-emerald-600/50 bg-emerald-950/40 px-2 py-1 text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
          title="Applica il file condiviso a questo task"
        >
          <Download className="h-3 w-3" />
          Importa
        </button>
        {reviewPortalUrl ? (
          <a
            href={reviewPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-slate-500/50 px-2 py-1 text-slate-200 hover:bg-slate-800/80"
          >
            <ExternalLink className="h-3 w-3" />
            Apri review web
          </a>
        ) : null}
      </div>
      <ReviewChannelBannerView banner={banner} onDismiss={onDismissBanner} />
    </div>
  );
}

function ReviewChannelBannerView({
  banner,
  onDismiss,
}: {
  banner: ReviewChannelBanner;
  onDismiss: () => void;
}) {
  if (banner.kind === 'idle') return null;
  let cls = 'rounded px-2 py-1 ';
  let text = '';
  switch (banner.kind) {
    case 'loading':
      cls += 'bg-slate-800 text-slate-300';
      text = 'Connessione al canale…';
      break;
    case 'error':
      cls += 'bg-rose-950/80 text-rose-100';
      text = banner.message;
      break;
    case 'in_sync':
      cls += 'bg-slate-800 text-slate-400';
      text = banner.remoteUpdatedAt
        ? `Allineato al canale (${new Date(banner.remoteUpdatedAt).toLocaleString()}).`
        : 'Allineato al canale.';
      break;
    case 'update_available':
      cls += 'bg-amber-950/70 text-amber-100';
      text = banner.summary;
      break;
    case 'published':
      cls += 'bg-sky-950/60 text-sky-100';
      text = `Pubblicato sul canale (${new Date(banner.at).toLocaleString()}).`;
      break;
    case 'imported':
      cls += 'bg-emerald-950/60 text-emerald-100';
      text = `Importato dal canale (${new Date(banner.at).toLocaleString()}). Salva il progetto.`;
      break;
    default:
      return null;
  }
  return (
    <div className={`flex items-start justify-between gap-2 ${cls}`}>
      <span>{text}</span>
      {banner.kind !== 'loading' ? (
        <button type="button" className="shrink-0 text-slate-400 hover:text-slate-200" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}
