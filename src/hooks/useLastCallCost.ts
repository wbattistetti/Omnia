/**
 * `useLastCallCost(purpose)` returns the most recent AI call record matching `purpose`, but only
 * for `WINDOW_MS` after that call's timestamp. After the window elapses the hook returns `null`,
 * so the inline "Last $X.XX" badge next to the AI button disappears automatically.
 *
 * Per product decision (chat 2026-05-12): the badge must persist for at least 15s on the button
 * so the user has time to read it after the busy state ends.
 */

import React from 'react';
import { useAiCallLog } from '../context/AiCallLogContext';
import type { AiCallRecord } from '../services/aiCallsApi';

const WINDOW_MS = 15_000;
const TICK_MS = 500;

export interface LastCallCostInfo {
  record: AiCallRecord;
  ageMs: number;
  remainingMs: number;
}

export function useLastCallCost(purpose: string | null | undefined): LastCallCostInfo | null {
  const { lastByPurpose } = useAiCallLog();
  const [now, setNow] = React.useState<number>(() => Date.now());

  const record = purpose ? lastByPurpose.get(purpose) ?? null : null;
  const recordTs = record ? new Date(record.ts).getTime() : 0;
  const isFresh = record !== null && now - recordTs < WINDOW_MS;

  React.useEffect(() => {
    if (!isFresh) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [isFresh]);

  if (!record || !isFresh) return null;
  const ageMs = now - recordTs;
  return {
    record,
    ageMs,
    remainingMs: Math.max(0, WINDOW_MS - ageMs),
  };
}
