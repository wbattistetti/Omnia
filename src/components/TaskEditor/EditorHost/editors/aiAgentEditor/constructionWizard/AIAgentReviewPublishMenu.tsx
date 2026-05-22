/**
 * Dropdown «Pubblica for review» — solo pubblicazione per audience (Customer / Internal).
 */

import React from 'react';
import { ChevronDown, ExternalLink, Upload } from 'lucide-react';
import { REVIEW_PUBLISH_AUDIENCES } from '@domain/agentReviewChannel/reviewAudience';
import { REVIEW_AUDIENCE_LABELS } from '@domain/agentReviewChannel/reviewAudience';
import type { UseAgentReviewChannelResult } from '../useAgentReviewChannel';

export interface AIAgentReviewPublishMenuProps {
  channel: UseAgentReviewChannelResult;
}

const PUBLISH_LABEL: Record<(typeof REVIEW_PUBLISH_AUDIENCES)[number], string> = {
  customer: 'Customer',
  internal: 'Internal (auditing team)',
};

function bannerStatusLine(channel: UseAgentReviewChannelResult): string | null {
  const { banner } = channel;
  if (banner.kind === 'published') {
    return `Pubblicato per ${REVIEW_AUDIENCE_LABELS[banner.audience]}.`;
  }
  if (banner.kind === 'imported') return 'Importato — salva il progetto.';
  if (banner.kind === 'error') return banner.message;
  return null;
}

export function AIAgentReviewPublishMenu({
  channel,
}: AIAgentReviewPublishMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const statusLine = bannerStatusLine(channel);
  const disabled = !channel.canUseChannel || channel.busy;

  React.useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e: MouseEvent) => {
      const root = containerRef.current;
      if (!root?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Pubblica task for review (descrizione, use case, sequenza)"
        className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/70 bg-violet-700/90 px-2.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Upload size={13} aria-hidden />
        <span>Pubblica for review</span>
        <ChevronDown size={12} aria-hidden className="opacity-80" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Pubblica for review"
          className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-slate-700 bg-slate-950 shadow-xl"
        >
          <p className="border-b border-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-300">
            Pubblica task for review by:
          </p>
          {REVIEW_PUBLISH_AUDIENCES.map((audience) => (
            <button
              key={audience}
              type="button"
              role="menuitem"
              disabled={disabled}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-100 hover:bg-violet-900/50 disabled:opacity-40"
              onClick={() => {
                setOpen(false);
                void channel.publishToChannel(audience);
              }}
            >
              <Upload size={14} className="shrink-0 text-violet-300" aria-hidden />
              <span>{PUBLISH_LABEL[audience]}</span>
            </button>
          ))}
          {channel.reviewPortalUrl ? (
            <a
              href={channel.reviewPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-900"
            >
              <ExternalLink size={12} aria-hidden />
              Apri portale review
            </a>
          ) : null}
          {statusLine ? (
            <p className="border-t border-slate-800 px-3 py-2 text-[10px] leading-snug text-violet-200/85">
              {statusLine}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
