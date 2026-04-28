/**
 * Dropdown modelli LLM: contenuto = catalogo del provider selezionato (ElevenLabs = lista sync da GET /v1/convai/llm/list).
 */

import React from 'react';
import type { ReactNode } from 'react';
import {
  CatalogApiError,
  fetchLlmMapping,
  type CatalogModel,
  type LlmMappingPayload,
} from '@services/iaCatalogApi';
import { fetchIaModelsForPlatform, type IaRuntimeCatalogPlatform } from '@utils/iaCatalog/fetchIaCatalog';
import {
  effectiveAllowedForLocale,
  primaryLang,
} from '@utils/iaCatalog/elevenLabsLlmMappingLocale';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import { FieldHint } from './FieldHint';
import {
  costPerHour,
  parseLatencyMs,
  resolveLlmCostRow,
  type ModelCostRow,
} from './modelCostsCatalog';

function catalogModelOption(
  m: CatalogModel,
  maxLatency: number,
  maxHourlyCost: number,
  costRows: readonly ModelCostRow[]
): SearchableSelectOption<string> {
  const mapped = resolveLlmCostRow(costRows, m.model_id, m.name || m.model_id, 'elevenlabs');
  const latencyMs = mapped ? parseLatencyMs(mapped.latency) : m.latency_ms;
  const hourly = mapped ? costPerHour(mapped.costPerMin) : null;
  const meta = [
    latencyMs != null ? `~${Math.round(latencyMs)}ms` : '',
    hourly != null ? `~${hourly.toFixed(4)} USD/h` : '',
    m.cost_hint ? `${m.cost_hint}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const tagLabels = (m.tags || []).map((t) =>
    t === 'preview' ? 'Preview' : t === 'new' ? 'New' : t
  );
  const latencyPct =
    latencyMs != null && maxLatency > 0 ? `${Math.min(100, Math.max(4, (latencyMs / maxLatency) * 100))}%` : '0%';
  const costPct =
    hourly != null && maxHourlyCost > 0 ? `${Math.min(100, Math.max(4, (hourly / maxHourlyCost) * 100))}%` : '0%';
  return {
    value: m.model_id,
    label: m.name || m.model_id,
    subtitle: meta || undefined,
    badges: tagLabels.length ? tagLabels : undefined,
    details: (
      <span className="block">
        <span className="grid grid-cols-2 gap-1 text-[8px] text-slate-400">
          <span>{latencyMs != null ? `${Math.round(latencyMs)} ms` : 'latency n/a'}</span>
          <span>{hourly != null ? `${hourly.toFixed(4)} USD/h` : 'cost n/a'}</span>
        </span>
        <span className="mt-0.5 grid grid-cols-2 gap-1">
          <span className="h-1 rounded bg-slate-800">
            <span className="block h-full rounded bg-cyan-400/80" style={{ width: latencyPct }} />
          </span>
          <span className="h-1 rounded bg-slate-800">
            <span className="block h-full rounded bg-violet-400/80" style={{ width: costPct }} />
          </span>
        </span>
      </span>
    ),
  };
}

function reasonToMessage(reason: unknown): string {
  if (reason instanceof CatalogApiError) return reason.message;
  if (reason instanceof Error) return reason.message;
  return String(reason ?? 'Errore sconosciuto');
}

/** `null` = nessun filtro mapping (en, lingua assente, o config non ancora impostata); array = elenco ammessi. */
function allowedIdsForAgent(
  mapping: LlmMappingPayload | null,
  agentLanguage: string | undefined
): string[] | null {
  if (!mapping || !agentLanguage?.trim()) return null;
  const full = agentLanguage.trim();
  if (primaryLang(full) === 'en') return null;
  const { perLanguage, nonEnglishAllowedModels } = mapping.elevenlabs;
  const p = primaryLang(full);
  const hasExplicitEntry =
    Object.prototype.hasOwnProperty.call(perLanguage, full) ||
    Object.prototype.hasOwnProperty.call(perLanguage, p) ||
    Object.keys(perLanguage).some((k) => primaryLang(k) === p);
  if (!hasExplicitEntry && nonEnglishAllowedModels.length === 0) return null;
  return effectiveAllowedForLocale(mapping, full);
}

export interface LlmProviderCatalogPanelProps {
  value: string;
  onChange: (modelId: string) => void;
  reloadNonce?: number;
  /** Piattaforma IA — determina quale catalogo modelli caricare. */
  catalogPlatform: IaRuntimeCatalogPlatform;
  /** Lingua agente (BCP-47): se ≠ en, la combo mostra solo i modelli definiti in config/llmMapping.json. */
  agentLanguage?: string;
  label?: string;
  labelTooltip?: string;
  costRows?: readonly ModelCostRow[];
  /**
   * Riga titolo bianca + checkbox affiancati, combo LLM a tutta larghezza sotto (allineata alla combo TTS).
   */
  stackedLayout?: boolean;
  /** Es. checkbox «dipende dalla lingua» sulla stessa riga del titolo. */
  trailingHeader?: ReactNode;
}

function emptyCatalogHint(platform: IaRuntimeCatalogPlatform): string {
  if (platform === 'elevenlabs') {
    return 'Catalogo ElevenLabs vuoto: ELEVENLABS_API_KEY, base URL (EU se serve), poi POST /api/ia-catalog/refresh.';
  }
  return 'Catalogo vuoto: chiave API provider e POST /api/ia-catalog/sync/models.';
}

export function LlmProviderCatalogPanel({
  value,
  onChange,
  reloadNonce = 0,
  catalogPlatform,
  agentLanguage,
  label = 'LLM',
  labelTooltip,
  costRows = [],
  stackedLayout = false,
  trailingHeader,
}: LlmProviderCatalogPanelProps) {
  const [models, setModels] = React.useState<CatalogModel[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [mapping, setMapping] = React.useState<LlmMappingPayload | null>(null);
  const [mappingErr, setMappingErr] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (catalogPlatform !== 'elevenlabs') {
      setMapping(null);
      setMappingErr(null);
      return;
    }
    let cancelled = false;
    setMappingErr(null);
    void (async () => {
      try {
        const m = await fetchLlmMapping();
        if (cancelled) return;
        setMapping(m);
      } catch (e) {
        if (cancelled) return;
        setMapping(null);
        setMappingErr(reasonToMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogPlatform, reloadNonce]);

  const allowed = React.useMemo(
    () => (catalogPlatform === 'elevenlabs' ? allowedIdsForAgent(mapping, agentLanguage) : null),
    [catalogPlatform, mapping, agentLanguage]
  );

  const displayModels = React.useMemo(() => {
    if (allowed === null) return models;
    if (allowed.length === 0) return [];
    const set = new Set(allowed);
    return models.filter((m) => set.has(m.model_id));
  }, [models, allowed]);

  React.useEffect(() => {
    if (catalogPlatform !== 'elevenlabs' || allowed === null) return;
    if (allowed.length === 0) return;
    const v = String(value ?? '').trim();
    if (!v || allowed.includes(v)) return;
    onChange(allowed[0]);
  }, [catalogPlatform, allowed, value, onChange]);

  const maxLatency = React.useMemo(
    () =>
      Math.max(
        0,
        ...displayModels.map((m) => {
          const row = resolveLlmCostRow(costRows, m.model_id, m.name || m.model_id, 'elevenlabs');
          return row ? parseLatencyMs(row.latency) ?? 0 : m.latency_ms ?? 0;
        })
      ),
    [displayModels, costRows]
  );
  const maxHourlyCost = React.useMemo(
    () =>
      Math.max(
        0,
        ...displayModels.map((m) => {
          const row = resolveLlmCostRow(costRows, m.model_id, m.name || m.model_id, 'elevenlabs');
          return row ? costPerHour(row.costPerMin) ?? 0 : 0;
        })
      ),
    [displayModels, costRows]
  );
  const catalogOpts = React.useMemo(
    () => displayModels.map((m) => catalogModelOption(m, maxLatency, maxHourlyCost, costRows)),
    [displayModels, maxLatency, maxHourlyCost, costRows]
  );
  const blockedCatalog = Boolean(err) || catalogOpts.length === 0;
  const labelWithCount = `${label} (${displayModels.length})`;

  const alerts = (
    <>
      {mappingErr ? (
        <div className="mb-0.5 rounded border border-amber-500/35 bg-amber-950/25 px-1 py-0.5 text-[9px] text-amber-100">
          Mapping: {mappingErr}
        </div>
      ) : null}
      {err ? (
        <div className="mb-0.5 rounded border border-amber-500/45 bg-amber-950/35 px-1 py-0.5 text-[9px] leading-tight text-amber-100">
          {err}
        </div>
      ) : null}
    </>
  );

  const selectEl = (
    <SearchableSelect
      listMaxClassName={
        stackedLayout
          ? 'w-full min-w-0 max-w-full'
          : 'max-w-[min(100%,22rem)] min-w-[12rem]'
      }
      disabled={blockedCatalog}
      placeholder="Cerca modello…"
      emptyTriggerLabel="Scegli il modello LLM"
      options={catalogOpts}
      value={value || ''}
      onChange={onChange}
    />
  );

  if (stackedLayout) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1" data-ia-runtime-focus="llm">
        {alerts}
        <div className="flex min-h-[2rem] flex-row flex-wrap items-center justify-start gap-x-2 gap-y-1">
          <span
            title={labelTooltip ?? ''}
            className="cursor-help border-b border-dotted border-slate-500 text-[11px] font-semibold leading-snug text-gray-900 dark:text-white"
          >
            {labelWithCount}
          </span>
          {trailingHeader}
        </div>
        {selectEl}
      </div>
    );
  }

  const inner = (
    <div className="w-fit max-w-[min(100vw-2rem,22rem)]">
      {alerts}
      {selectEl}
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
