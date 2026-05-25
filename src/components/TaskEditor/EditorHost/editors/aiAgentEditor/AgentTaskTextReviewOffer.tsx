/**
 * Toast su editor testo task: propone revisione osservazioni dopo edit rispetto alla baseline agente.
 */

import React from 'react';
import { Loader2, MessageSquare, X } from 'lucide-react';
import {
  AGENT_TASK_TEXT_REVIEW_OFFER,
  AGENT_TASK_TEXT_REVIEW_OFFER_ACCEPT,
  AGENT_TASK_TEXT_REVIEW_OFFER_PENDING,
} from '@domain/aiAgent/agentTaskTextAnalysisGuide';

export interface AgentTaskTextReviewOfferProps {
  visible: boolean;
  busy: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export function AgentTaskTextReviewOffer({
  visible,
  busy,
  onAccept,
  onDismiss,
}: AgentTaskTextReviewOfferProps): React.ReactElement | null {
  const [flashEpoch, setFlashEpoch] = React.useState(0);
  const prevVisibleRef = React.useRef(false);

  React.useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setFlashEpoch((n) => n + 1);
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  if (!visible) return null;

  if (busy) {
    return (
      <div
        key={`busy-${flashEpoch}`}
        className="pointer-events-none absolute top-2 right-2 z-20 flex max-w-[min(100%,24rem)] items-start gap-2 rounded-lg border border-amber-400/70 bg-amber-950/95 px-2.5 py-2.5 text-left shadow-lg shadow-amber-950/40"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2
          size={16}
          className="mt-0.5 shrink-0 animate-spin text-amber-200"
          aria-hidden
        />
        <p className="text-[11px] leading-snug text-amber-50/95">
          {AGENT_TASK_TEXT_REVIEW_OFFER_PENDING}
        </p>
      </div>
    );
  }

  return (
    <div
      key={flashEpoch}
      className="pointer-events-auto absolute top-2 right-2 z-20 flex max-w-[min(100%,22rem)] flex-col gap-1 rounded-lg border border-amber-400/70 bg-amber-950/95 px-2.5 py-2 text-left shadow-lg shadow-amber-950/40 animate-omnia-description-polish-offer"
      role="status"
    >
      <button
        type="button"
        className="absolute top-1 right-1 rounded p-0.5 text-amber-200/80 hover:bg-amber-900/60 hover:text-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        aria-label="Nascondi suggerimento"
        onClick={onDismiss}
      >
        <X size={14} aria-hidden />
      </button>
      <p className="pr-5 text-[11px] leading-snug text-amber-50/95">{AGENT_TASK_TEXT_REVIEW_OFFER}</p>
      <button
        type="button"
        onClick={onAccept}
        className="inline-flex items-center justify-center gap-1.5 self-end rounded-md border border-amber-300/55 bg-amber-600/90 px-2.5 py-1 text-[11px] font-semibold text-amber-50 transition-colors hover:bg-amber-500/95"
      >
        <MessageSquare size={13} className="shrink-0" aria-hidden />
        {AGENT_TASK_TEXT_REVIEW_OFFER_ACCEPT}
      </button>
    </div>
  );
}
