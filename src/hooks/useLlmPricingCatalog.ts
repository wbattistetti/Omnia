/**
 * Hook che carica il catalogo pricing live (`GET /api/ai-calls/pricing`) e fornisce
 * un'azione di refresh asincrona (`POST /api/ai-calls/pricing/refresh` poi reload).
 *
 * Stesso pattern di `useAvailableLlmModels`: stato locale, niente context. Errori
 * sono trasportati fail-loud nel campo `error` perché senza pricing la sezione
 * Cost comparator non ha nulla di sensato da mostrare.
 *
 * Riusabile: la pagina LLM settings, una futura dashboard cost o uno sviluppatore
 * che vuole verificare un modello specifico possono montarlo senza dipendenze
 * da React context.
 */

import * as React from 'react';
import {
  AiCallsApiError,
  fetchPricingCatalog,
  refreshPricingCatalog,
  type LlmPricingCatalogResponse,
  type LlmPricingEntry,
} from '@services/aiCallsApi';

export interface UseLlmPricingCatalogResult {
  items: ReadonlyArray<LlmPricingEntry>;
  meta: LlmPricingCatalogResponse['meta'];
  loading: boolean;
  /** True solo durante il POST di refresh (distinto dal loading iniziale). */
  refreshing: boolean;
  error: string | null;
  /** Re-fetch dello snapshot on-disk del backend, senza colpire OpenRouter. */
  reload: () => void;
  /** Forza un POST di re-sync (chiama OpenRouter, riscrive cache, ricarica). */
  refresh: () => Promise<void>;
}

function describe(reason: unknown): string {
  if (reason instanceof AiCallsApiError) return reason.message;
  if (reason instanceof Error) return reason.message;
  return String(reason ?? 'Errore sconosciuto');
}

export function useLlmPricingCatalog(): UseLlmPricingCatalogResult {
  const [items, setItems] = React.useState<ReadonlyArray<LlmPricingEntry>>([]);
  const [meta, setMeta] = React.useState<LlmPricingCatalogResponse['meta']>({
    updatedAt: null,
    source: null,
  });
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState<number>(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPricingCatalog()
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setMeta(res.meta);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(describe(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const reload = React.useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshPricingCatalog();
      setReloadTick((n) => n + 1);
    } catch (e) {
      setError(describe(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { items, meta, loading, refreshing, error, reload, refresh };
}
