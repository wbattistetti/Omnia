/**
 * Inline "Last €0.0042" badge shown next to an AI button for `WINDOW_MS` after the most recent
 * call with the matching `purpose`. Renders nothing when no recent call exists, so callers can
 * mount it unconditionally.
 *
 * Currency preference: EUR if the FX rate is available, otherwise USD. The user reads the local
 * currency by default; USD remains the canonical price source under the hood.
 */

import React from 'react';
import { useLastCallCost } from '@hooks/useLastCallCost';
import { useAiCallLog } from '@context/AiCallLogContext';
import { formatCost } from '@domain/aiCost/formatCost';

export interface LastAiCostBadgeProps {
  purpose: string;
  className?: string;
}

export function LastAiCostBadge({ purpose, className }: LastAiCostBadgeProps): React.ReactElement | null {
  const info = useLastCallCost(purpose);
  const { exchangeRate } = useAiCallLog();
  if (!info) return null;
  const { record } = info;
  const text =
    record.costEur !== null && exchangeRate?.usdToEur
      ? formatCost(record.costEur, 'EUR')
      : formatCost(record.costUsd, 'USD');
  const tone = record.error
    ? 'border-rose-500/45 bg-rose-950/40 text-rose-200'
    : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200';
  const label = record.error ? `Last (errore): ${record.error}` : `Last: ${text}`;
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${tone} ${className ?? ''}`}
      title={`${record.providerId} / ${record.modelId}\n${record.totalTokens} token totali, ${record.durationMs} ms`}
    >
      {label}
    </span>
  );
}
