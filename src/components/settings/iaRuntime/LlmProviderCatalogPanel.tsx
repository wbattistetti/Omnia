/**
 * Modello LLM ConvAI (ElevenLabs): un solo dropdown catalogo — niente tab provider
 * duplicate (la piattaforma è già scelta sopra). Default catalogo OpenAI; opzionale
 * lock su altro provider sincronizzato.
 */

import React from 'react';
import { CatalogApiError, fetchCatalogModels, type CatalogModel } from '@services/iaCatalogApi';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

export type LockedLlmCatalogProvider = 'openai' | 'anthropic' | 'google';

function catalogModelOption(m: CatalogModel): SearchableSelectOption<string> {
  const meta = [
    m.cost_hint ? `${m.cost_hint}` : '',
    m.latency_ms != null ? `${m.latency_ms} ms` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const tagLabels = (m.tags || []).map((t) =>
    t === 'preview' ? 'Preview' : t === 'new' ? 'New' : t
  );
  return {
    value: m.model_id,
    label: m.name || m.model_id,
    subtitle: meta || undefined,
    badges: tagLabels.length ? tagLabels : undefined,
  };
}

function reasonToMessage(reason: unknown): string {
  if (reason instanceof CatalogApiError) return reason.message;
  if (reason instanceof Error) return reason.message;
  return String(reason ?? 'Errore sconosciuto');
}

export interface LlmProviderCatalogPanelProps {
  value: string;
  onChange: (modelId: string) => void;
  reloadNonce?: number;
  /** Catalogo singolo da usare (default openai, coerente con preset ConvAI). */
  lockedProvider?: LockedLlmCatalogProvider;
}

export function LlmProviderCatalogPanel({
  value,
  onChange,
  reloadNonce = 0,
  lockedProvider = 'openai',
}: LlmProviderCatalogPanelProps) {
  const [models, setModels] = React.useState<CatalogModel[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setErr(null);

    (async () => {
      try {
        const list = await fetchCatalogModels(lockedProvider);
        if (cancelled) return;
        setModels(list);
        setErr(
          list.length
            ? null
            : 'Catalogo vuoto: chiave API e POST /api/ia-catalog/sync/models.'
        );
      } catch (e) {
        if (cancelled) return;
        setModels([]);
        setErr(reasonToMessage(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lockedProvider, reloadNonce]);

  const catalogOpts = React.useMemo(() => models.map(catalogModelOption), [models]);
  const blockedCatalog = Boolean(err) || catalogOpts.length === 0;

  return (
    <div className="w-fit max-w-[min(100vw-2rem,22rem)]">
      {err ? (
        <div className="mb-0.5 rounded border border-amber-500/45 bg-amber-950/35 px-1 py-0.5 text-[9px] leading-tight text-amber-100">
          {err}
        </div>
      ) : null}
      <SearchableSelect
        listMaxClassName="max-w-[min(100%,22rem)] min-w-[12rem]"
        disabled={blockedCatalog}
        placeholder="Cerca modello…"
        emptyTriggerLabel="Scegli il modello LLM"
        options={catalogOpts}
        value={value || ''}
        onChange={onChange}
      />
    </div>
  );
}
