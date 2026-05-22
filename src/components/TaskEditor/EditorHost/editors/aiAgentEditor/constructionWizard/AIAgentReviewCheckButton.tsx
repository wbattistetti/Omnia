/**
 * Pulsante «Check review» a sinistra di «Pubblica for review» — visibile solo se ci sono aggiornamenti da importare.
 */

import React from 'react';
import { ChevronDown, Check, Download } from 'lucide-react';
import { REVIEW_PUBLISH_AUDIENCES } from '@domain/agentReviewChannel/reviewAudience';
import type { UseAgentReviewChannelResult } from '../useAgentReviewChannel';

const ROW_LABEL: Record<(typeof REVIEW_PUBLISH_AUDIENCES)[number], string> = {
  customer: 'Customer',
  internal: 'Internal',
};

export interface AIAgentReviewCheckButtonProps {
  channel: UseAgentReviewChannelResult;
}

export function AIAgentReviewCheckButton({
  channel,
}: AIAgentReviewCheckButtonProps): React.ReactElement | null {
  if (!channel.anyPendingImport) return null;

  const [open, setOpen] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
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
          void channel.checkAllReviewChannels();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Review esterne con modifiche da importare"
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/75 bg-amber-700/90 px-2.5 py-1.5 text-xs font-semibold text-amber-950 shadow hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-200" />
        </span>
        <span>Check review</span>
        <ChevronDown size={12} aria-hidden className="opacity-80" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Check review"
          className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border border-amber-700/50 bg-slate-950 shadow-xl"
        >
          <p className="border-b border-amber-900/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
            Importa da review
          </p>
          <ul>
            {REVIEW_PUBLISH_AUDIENCES.map((audience) => {
              const row = channel.pendingStatuses.find((s) => s.audience === audience);
              const pending = row?.hasPendingImport === true;
              if (!pending) return null;
              return (
                <li
                  key={audience}
                  className="flex items-center gap-2 border-b border-slate-800/80 px-3 py-2 text-sm bg-amber-950/30 text-amber-50 last:border-0"
                >
                  <Check size={14} className="shrink-0 text-amber-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{ROW_LABEL[audience]}</div>
                    {row?.summary ? (
                      <div className="text-[10px] text-amber-200/80">{row.summary}</div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    className="shrink-0 inline-flex items-center gap-1 rounded border border-emerald-600/50 bg-emerald-950/60 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
                    onClick={() => {
                      setOpen(false);
                      void channel.importFromAudience(audience);
                    }}
                  >
                    <Download size={12} aria-hidden />
                    Importa
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
