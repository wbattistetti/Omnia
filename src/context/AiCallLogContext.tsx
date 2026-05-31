/**
 * Global cache of AI calls (last N=500). Polls `/api/ai-calls` on a slow interval while the tab
 * is visible and exposes:
 *  - `calls`: full list (newest first), used by the `$` dialog,
 *  - `lastByPurpose`: O(1) lookup for `useLastCallCost(purpose)` to render "Last $X.XX",
 *  - `refreshNow`: imperative refresh after a known mutation (e.g. just clicked an AI button),
 *  - `clear`: wipe the log via the backend (debug / reset).
 *
 * Background polls are silent (no `loading` flip) to avoid re-rendering the whole app every tick.
 */

import React from 'react';
import {
  AiCallRecord,
  clearAiCalls,
  fetchAiCalls,
  fetchExchangeRate,
  AiExchangeRate,
} from '../services/aiCallsApi';
import { useDocumentVisible } from '../hooks/useDocumentVisible';

/** Slow poll — sufficient for "last cost" badges; avoids Network noise. */
const POLL_INTERVAL_MS = 30_000;
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
  const documentVisible = useDocumentVisible();
  const [calls, setCalls] = React.useState<AiCallRecord[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = React.useState<AiExchangeRate | null>(null);
  const lastSignatureRef = React.useRef<string>('');

  const fetchCalls = React.useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading === true;
    if (showLoading) setLoading(true);
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
      if (showLoading) setLoading(false);
    }
  }, []);

  const refreshNow = React.useCallback(async () => {
    await fetchCalls({ showLoading: true });
  }, [fetchCalls]);

  const clear = React.useCallback(async () => {
    await clearAiCalls();
    lastSignatureRef.current = '';
    setCalls([]);
  }, []);

  React.useEffect(() => {
    if (!documentVisible) return;
    void fetchCalls({ showLoading: true });
    const id = window.setInterval(() => {
      void fetchCalls();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [documentVisible, fetchCalls]);

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
