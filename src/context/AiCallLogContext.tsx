/**
 * Global cache of AI calls (last N=500). Polls `/api/ai-calls` every `POLL_INTERVAL_MS` and
 * exposes:
 *  - `calls`: full list (newest first), used by the `$` dialog,
 *  - `lastByPurpose`: O(1) lookup for `useLastCallCost(purpose)` to render "Last $X.XX",
 *  - `refreshNow`: imperative refresh after a known mutation (e.g. just clicked an AI button),
 *  - `clear`: wipe the log via the backend (debug / reset).
 *
 * Polling is intentionally simple; we can swap it for SSE without changing the consumer surface
 * if we ever need real-time push for multiple designers.
 */

import React from 'react';
import {
  AiCallRecord,
  clearAiCalls,
  fetchAiCalls,
  fetchExchangeRate,
  AiExchangeRate,
} from '../services/aiCallsApi';

const POLL_INTERVAL_MS = 5000;
const FX_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export interface AiCallLogContextValue {
  calls: AiCallRecord[];
  lastByPurpose: ReadonlyMap<string, AiCallRecord>;
  loading: boolean;
  error: string | null;
  exchangeRate: AiExchangeRate | null;
  refreshNow: () => Promise<void>;
  clear: () => Promise<void>;
}

const Ctx = React.createContext<AiCallLogContextValue | null>(null);

function indexByPurpose(records: AiCallRecord[]): ReadonlyMap<string, AiCallRecord> {
  const map = new Map<string, AiCallRecord>();
  for (const rec of records) {
    if (!rec.purpose) continue;
    if (!map.has(rec.purpose)) {
      map.set(rec.purpose, rec);
    }
  }
  return map;
}

export function AiCallLogProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [calls, setCalls] = React.useState<AiCallRecord[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = React.useState<AiExchangeRate | null>(null);
  const lastSignatureRef = React.useRef<string>('');

  const refreshNow = React.useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchAiCalls();
      const signature = items.length ? `${items[0]?.id ?? ''}|${items.length}` : 'empty';
      if (signature !== lastSignatureRef.current) {
        lastSignatureRef.current = signature;
        setCalls(items);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = React.useCallback(async () => {
    await clearAiCalls();
    lastSignatureRef.current = '';
    setCalls([]);
  }, []);

  React.useEffect(() => {
    void refreshNow();
    const id = window.setInterval(() => {
      void refreshNow();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshNow]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const rate = await fetchExchangeRate();
        if (!cancelled) setExchangeRate(rate);
      } catch {
        if (!cancelled) setExchangeRate(null);
      }
    };
    void load();
    const id = window.setInterval(load, FX_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const lastByPurpose = React.useMemo(() => indexByPurpose(calls), [calls]);

  const value: AiCallLogContextValue = React.useMemo(
    () => ({ calls, lastByPurpose, loading, error, exchangeRate, refreshNow, clear }),
    [calls, lastByPurpose, loading, error, exchangeRate, refreshNow, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Returns null when rendered outside {@link AiCallLogProvider} (e.g. review portal). */
export function useAiCallLogOptional(): AiCallLogContextValue | null {
  return React.useContext(Ctx);
}

export function useAiCallLog(): AiCallLogContextValue {
  const ctx = useAiCallLogOptional();
  if (!ctx) {
    throw new Error('useAiCallLog must be used within <AiCallLogProvider>');
  }
  return ctx;
}
