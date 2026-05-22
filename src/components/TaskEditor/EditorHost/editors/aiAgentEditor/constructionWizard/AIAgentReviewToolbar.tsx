/**
 * Barra stepper: Check review (se pending) + Pubblica for review + stato publish.
 */

import React from 'react';
import { REVIEW_AUDIENCE_LABELS } from '@domain/agentReviewChannel/reviewAudience';
import { AIAgentReviewCheckButton } from './AIAgentReviewCheckButton';
import { AIAgentReviewPublishMenu } from './AIAgentReviewPublishMenu';
import type { UseAgentReviewChannelResult } from '../useAgentReviewChannel';

export interface AIAgentReviewToolbarProps {
  channel: UseAgentReviewChannelResult;
}

function toolbarStatusLine(channel: UseAgentReviewChannelResult): string | null {
  const { banner, busy } = channel;
  if (busy || banner.kind === 'loading') return 'Pubblicazione in corso…';
  if (banner.kind === 'published') {
    return `Pubblicato per ${REVIEW_AUDIENCE_LABELS[banner.audience]}.`;
  }
  if (banner.kind === 'error') return banner.message;
  if (banner.kind === 'imported') return 'Importato — salva il progetto.';
  return null;
}

export function AIAgentReviewToolbar({ channel }: AIAgentReviewToolbarProps): React.ReactElement {
  const statusLine = toolbarStatusLine(channel);
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <div className="flex items-center gap-2">
        <AIAgentReviewCheckButton channel={channel} />
        <AIAgentReviewPublishMenu channel={channel} />
      </div>
      {statusLine ? (
        <p
          className="max-w-[280px] text-right text-[10px] leading-snug text-violet-200/90"
          role="status"
          aria-live="polite"
        >
          {statusLine}
        </p>
      ) : null}
    </div>
  );
}
