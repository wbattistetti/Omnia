/**
 * Polls `/api/convai-runtime-invocations` for editor + debugger (schema V2).
 */

import React from 'react';
import {
  clearConvaiRuntimeInvocations,
  fetchConvaiRuntimeInvocations,
  type FetchConvaiRuntimeInvocationsParams,
} from '@services/convaiRuntimeInvocationsApi';
import type { ConvaiRuntimeInvocationRecord } from '@domain/convaiObservability/convaiRuntimeInvocationRecord';
import { useDocumentVisible } from '../hooks/useDocumentVisible';

const POLL_INTERVAL_MS = 2_500;

export interface ConvaiRuntimeInvocationLogContextValue {
  invocations: ConvaiRuntimeInvocationRecord[];
  loading: boolean;
  error: string | null;
  refreshNow: (filters?: FetchConvaiRuntimeInvocationsParams) => Promise<void>;
  clear: () => Promise<void>;
}

const Ctx = React.createContext<ConvaiRuntimeInvocationLogContextValue | null>(null);

function signatureFor(items: ConvaiRuntimeInvocationRecord[]): string {
  if (items.length === 0) return 'empty';
  const head = items[0];
  return `${head?.id ?? ''}|${items.length}|${head?.ts ?? ''}`;
}

export function ConvaiRuntimeInvocationLogProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const documentVisible = useDocumentVisible();
  const [invocations, setInvocations] = React.useState<ConvaiRuntimeInvocationRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lastSignatureRef = React.useRef<string>('');
  const pollFiltersRef = React.useRef<FetchConvaiRuntimeInvocationsParams>({});
  const pollEnabledRef = React.useRef(true);

  const fetchInvocations = React.useCallback(
    async (options?: {
      showLoading?: boolean;
      filters?: FetchConvaiRuntimeInvocationsParams;
      force?: boolean;
    }) => {
      const showLoading = options?.showLoading === true;
      const filters = options?.filters ?? pollFiltersRef.current;
      if (options?.filters) pollFiltersRef.current = options.filters;
      if (showLoading) setLoading(true);
      try {
        const items = await fetchConvaiRuntimeInvocations({ limit: 200, ...filters });
        const sig = signatureFor(items);
        if (options?.force || sig !== lastSignatureRef.current) {
          lastSignatureRef.current = sig;
          setInvocations(items);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    []
  );

  const refreshNow = React.useCallback(
    async (filters?: FetchConvaiRuntimeInvocationsParams) => {
      await fetchInvocations({ showLoading: true, filters, force: true });
    },
    [fetchInvocations]
  );

  const clear = React.useCallback(async () => {
    await clearConvaiRuntimeInvocations();
    lastSignatureRef.current = '';
    setInvocations([]);
  }, []);

  React.useEffect(() => {
    if (!documentVisible || !pollEnabledRef.current) return;
    void fetchInvocations({ showLoading: true });
    const id = window.setInterval(() => {
      void fetchInvocations();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [documentVisible, fetchInvocations]);

  const value = React.useMemo(
    () => ({ invocations, loading, error, refreshNow, clear }),
    [invocations, loading, error, refreshNow, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConvaiRuntimeInvocationLogOptional(): ConvaiRuntimeInvocationLogContextValue | null {
  return React.useContext(Ctx);
}

export function useConvaiRuntimeInvocationLog(): ConvaiRuntimeInvocationLogContextValue {
  const ctx = useConvaiRuntimeInvocationLogOptional();
  if (!ctx) {
    throw new Error(
      'useConvaiRuntimeInvocationLog must be used within <ConvaiRuntimeInvocationLogProvider>'
    );
  }
  return ctx;
}
