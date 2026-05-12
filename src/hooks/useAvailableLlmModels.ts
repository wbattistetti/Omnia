/**
 * Carica la lista live dei modelli LLM disponibili da `/api/ia-catalog/ui/models`
 * per uno o piu provider, ne fa il merge e li ordina alfabeticamente per label.
 *
 * Nessuna lista hardcoded: l'unica fonte di verita e il catalogo sincronizzato dal backend.
 * Errori per singolo provider sono raccolti in `errors` (fail-loud, no silent swallow).
 */

import * as React from 'react';
import {
  CatalogApiError,
  fetchCatalogModels,
  type LlmCatalogProviderId,
} from '@services/iaCatalogApi';

export interface AvailableLlmProviderSpec {
  id: LlmCatalogProviderId;
  /** Etichetta short usata come prefisso "[Label] modelId" nella UI. */
  displayLabel: string;
}

export interface AvailableLlmModelOption {
  /** model_id come restituito dall'API (es. "gpt-5", "llama-3.3-70b-versatile"). */
  id: string;
  /** Label visualizzata in UI: "[Provider] modelId". */
  label: string;
  /** Provider catalogo di appartenenza. */
  provider: LlmCatalogProviderId;
}

export interface AvailableLlmProviderError {
  provider: LlmCatalogProviderId;
  message: string;
  code?: string;
}

export interface UseAvailableLlmModelsResult {
  items: ReadonlyArray<AvailableLlmModelOption>;
  loading: boolean;
  errors: ReadonlyArray<AvailableLlmProviderError>;
  /** Incrementa per forzare un refetch (es. dopo POST /api/ia-catalog/refresh). */
  reload: () => void;
}

function compareByLabel(a: AvailableLlmModelOption, b: AvailableLlmModelOption): number {
  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}

function describeError(reason: unknown): string {
  if (reason instanceof CatalogApiError) return reason.message;
  if (reason instanceof Error) return reason.message;
  return String(reason ?? 'Errore sconosciuto');
}

function errorCode(reason: unknown): string | undefined {
  return reason instanceof CatalogApiError ? reason.code : undefined;
}

/**
 * @param providers Provider da interrogare con la rispettiva etichetta UI.
 *                  Passare un array stabile (memoizzato) per evitare refetch inutili.
 */
export function useAvailableLlmModels(
  providers: ReadonlyArray<AvailableLlmProviderSpec>
): UseAvailableLlmModelsResult {
  const [items, setItems] = React.useState<ReadonlyArray<AvailableLlmModelOption>>([]);
  const [errors, setErrors] = React.useState<ReadonlyArray<AvailableLlmProviderError>>([]);
  const [loading, setLoading] = React.useState<boolean>(providers.length > 0);
  const [nonce, setNonce] = React.useState<number>(0);

  const providersKey = React.useMemo(
    () => providers.map((p) => `${p.id}:${p.displayLabel}`).join('|'),
    [providers]
  );

  React.useEffect(() => {
    if (providers.length === 0) {
      setItems([]);
      setErrors([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const results = await Promise.allSettled(
        providers.map((p) => fetchCatalogModels(p.id))
      );

      if (cancelled) return;

      const merged: AvailableLlmModelOption[] = [];
      const collectedErrors: AvailableLlmProviderError[] = [];

      results.forEach((res, idx) => {
        const spec = providers[idx];
        if (res.status === 'fulfilled') {
          for (const m of res.value) {
            const id = m.model_id;
            if (!id) continue;
            merged.push({
              id,
              label: `[${spec.displayLabel}] ${m.name || id}`,
              provider: spec.id,
            });
          }
        } else {
          collectedErrors.push({
            provider: spec.id,
            message: describeError(res.reason),
            code: errorCode(res.reason),
          });
        }
      });

      merged.sort(compareByLabel);
      setItems(merged);
      setErrors(collectedErrors);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // providersKey rappresenta in modo stabile l'identita logica di providers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providersKey, nonce]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  return { items, loading, errors, reload };
}
