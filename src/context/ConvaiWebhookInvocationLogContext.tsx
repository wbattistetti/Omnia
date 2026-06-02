/**
 * Polls `/api/convai-webhook-invocations` for the Task Editor webhook guardalog panel.
 */

import React from 'react';
import {
  clearConvaiWebhookInvocations,
  fetchConvaiWebhookInvocations,
  type ConvaiWebhookInvocationRecord,
  type FetchConvaiWebhookInvocationsParams,
} from '../services/convaiWebhookInvocationsApi';
import { useDocumentVisible } from '../hooks/useDocumentVisible';

const POLL_INTERVAL_MS = 2_500;

export interface ConvaiWebhookInvocationLogContextValue {
  invocations: ConvaiWebhookInvocationRecord[];
  loading: boolean;
  error: string | null;
  refreshNow: (filters?: FetchConvaiWebhookInvocationsParams) => Promise<void>;
  clear: () => Promise<void>;
}

const Ctx = React.createContext<ConvaiWebhookInvocationLogContextValue | null>(null);

function signatureFor(items: ConvaiWebhookInvocationRecord[]): string {
  if (items.length === 0) return 'empty';
  const head = items[0];
  return `${head?.id ?? ''}|${items.length}|${head?.ts ?? ''}`;
}

export function ConvaiWebhookInvocationLogProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const documentVisible = useDocumentVisible();
  const [invocations, setInvocations] = React.useState<ConvaiWebhookInvocationRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lastSignatureRef = React.useRef<string>('');
  const pollFiltersRef = React.useRef<FetchConvaiWebhookInvocationsParams>({});

  const fetchInvocations = React.useCallback(
    async (options?: { showLoading?: boolean; filters?: FetchConvaiWebhookInvocationsParams }) => {
      const showLoading = options?.showLoading === true;
      const filters = options?.filters ?? pollFiltersRef.current;
      if (options?.filters) pollFiltersRef.current = options.filters;
      if (showLoading) setLoading(true);
      try {
        const items = await fetchConvaiWebhookInvocations({ limit: 200, ...filters });
        const sig = signatureFor(items);
        if (sig !== lastSignatureRef.current) {
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
    async (filters?: FetchConvaiWebhookInvocationsParams) => {
      await fetchInvocations({ showLoading: true, filters });
    },
    [fetchInvocations]
  );

  const clear = React.useCallback(async () => {
    await clearConvaiWebhookInvocations();
    lastSignatureRef.current = '';
    setInvocations([]);
  }, []);

  React.useEffect(() => {
    if (!documentVisible) return;
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

export function useConvaiWebhookInvocationLogOptional(): ConvaiWebhookInvocationLogContextValue | null {
  return React.useContext(Ctx);
}

export function useConvaiWebhookInvocationLog(): ConvaiWebhookInvocationLogContextValue {
  const ctx = useConvaiWebhookInvocationLogOptional();
  if (!ctx) {
    throw new Error(
      'useConvaiWebhookInvocationLog must be used within <ConvaiWebhookInvocationLogProvider>'
    );
  }
  return ctx;
}
