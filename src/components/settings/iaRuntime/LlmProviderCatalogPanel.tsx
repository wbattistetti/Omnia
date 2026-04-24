/**
 * Dropdown modelli LLM per la piattaforma runtime selezionata (ConvAI ElevenLabs = catalogo dedicato).
 */

import React from 'react';
import { CatalogApiError, type CatalogModel } from '@services/iaCatalogApi';
import { fetchIaModelsForPlatform, type IaRuntimeCatalogPlatform } from '@utils/iaCatalog/fetchIaCatalog';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import { FieldHint } from './FieldHint';

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
  /** Piattaforma IA corrente — determina quale catalogo modelli caricare (elevenlabs = ConvAI). */
  catalogPlatform: IaRuntimeCatalogPlatform;
}

function emptyCatalogHint(platform: IaRuntimeCatalogPlatform): string {
  if (platform === 'elevenlabs') {
    return 'Catalogo ConvAI vuoto: ELEVENLABS_API_KEY, EU base URL se serve, poi POST /api/ia-catalog/refresh.';
  }
  return 'Catalogo vuoto: chiave API provider e POST /api/ia-catalog/sync/models.';
}

export function LlmProviderCatalogPanel({
  value,
  onChange,
  reloadNonce = 0,
  catalogPlatform,
  label = 'LLM',
  labelTooltip,
}: LlmProviderCatalogPanelProps) {
  const [models, setModels] = React.useState<CatalogModel[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setErr(null);

    (async () => {
      try {
        const list = await fetchIaModelsForPlatform(catalogPlatform);
        if (cancelled) return;
        setModels(list);
        setErr(list.length ? null : emptyCatalogHint(catalogPlatform));
      } catch (e) {
        if (cancelled) return;
        setModels([]);
        setErr(reasonToMessage(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogPlatform, reloadNonce]);

  const catalogOpts = React.useMemo(() => models.map(catalogModelOption), [models]);
  const blockedCatalog = Boolean(err) || catalogOpts.length === 0;
  const labelWithCount = `${label} (${models.length})`;

  const inner = (
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

  if (labelTooltip) {
    return (
      <FieldHint label={labelWithCount} tooltip={labelTooltip} className="w-fit shrink-0">
        {inner}
      </FieldHint>
    );
  }

  return (
    <label className="flex w-fit shrink-0 min-w-0 max-w-[min(100vw-2rem,22rem)] flex-col gap-0">
      <span className="truncate text-[10px] font-medium uppercase leading-none tracking-wide text-slate-500">
        {labelWithCount}
      </span>
      {inner}
    </label>
  );
}
