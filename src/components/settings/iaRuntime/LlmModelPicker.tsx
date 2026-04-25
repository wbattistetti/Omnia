/**
 * LLM model picker backed by /api/ia-catalog/ui/models (solo dati sincronizzati sul server).
 */

import React from 'react';
import {
  CatalogApiError,
  fetchCatalogModels,
  type CatalogModel,
  type LlmCatalogProviderId,
} from '@services/iaCatalogApi';
import { FieldHint } from './FieldHint';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import {
  costPerHour,
  parseLatencyMs,
  resolveLlmCostRow,
  type ModelCostRow,
} from './modelCostsCatalog';

export interface LlmModelPickerProps {
  catalogProvider: Exclude<LlmCatalogProviderId, 'elevenlabs'>;
  value: string;
  onChange: (modelId: string) => void;
  label?: string;
  /** Tooltip lungo sulla label (accessibilità: title). */
  labelTooltip?: string;
  reloadNonce?: number;
  costRows?: readonly ModelCostRow[];
}

function modelOption(
  m: CatalogModel,
  maxLatency: number,
  maxHourlyCost: number,
  costRows: readonly ModelCostRow[],
  provider: Exclude<LlmCatalogProviderId, 'elevenlabs'>
): SearchableSelectOption<string> {
  const mapped = resolveLlmCostRow(costRows, m.model_id, m.name || m.model_id, provider);
  const latencyMs = mapped ? parseLatencyMs(mapped.latency) : m.latency_ms;
  const hourly = mapped ? costPerHour(mapped.costPerMin) : null;

  const meta = [
    latencyMs != null ? `~${Math.round(latencyMs)}ms` : '',
    hourly != null ? `~${hourly.toFixed(4)} USD/h` : '',
    m.cost_hint ? `cost ${m.cost_hint}` : '',
    ...(m.tags || []).slice(0, 3),
  ]
    .filter(Boolean)
    .join(' · ');
  const subtitle = [meta, m.notes].filter(Boolean).join(' — ');

  const latencyPct =
    latencyMs != null && maxLatency > 0 ? `${Math.min(100, Math.max(4, (latencyMs / maxLatency) * 100))}%` : '0%';
  const costPct =
    hourly != null && maxHourlyCost > 0 ? `${Math.min(100, Math.max(4, (hourly / maxHourlyCost) * 100))}%` : '0%';

  return {
    value: m.model_id,
    label: m.name || m.model_id,
    subtitle: subtitle || undefined,
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

export function LlmModelPicker({
  catalogProvider,
  value,
  onChange,
  label = 'model',
  labelTooltip,
  reloadNonce = 0,
  costRows = [],
}: LlmModelPickerProps) {
  const [opts, setOpts] = React.useState<CatalogModel[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setErr(null);
    (async () => {
      try {
        const list = await fetchCatalogModels(catalogProvider);
        if (!cancelled) {
          setOpts(list);
          if (!list.length) {
            setErr('Catalogo modelli vuoto: sync non ha popolato il backend per questo provider.');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setErr(
            e instanceof CatalogApiError
              ? e.message
              : String(e instanceof Error ? e.message : e)
          );
          setOpts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogProvider, reloadNonce]);

  const maxLatency = React.useMemo(
    () =>
      Math.max(
        0,
        ...opts.map((m) => {
          const row = resolveLlmCostRow(costRows, m.model_id, m.name || m.model_id, catalogProvider);
          return row ? parseLatencyMs(row.latency) ?? 0 : m.latency_ms ?? 0;
        })
      ),
    [opts, costRows, catalogProvider]
  );
  const maxHourlyCost = React.useMemo(
    () =>
      Math.max(
        0,
        ...opts.map((m) => {
          const row = resolveLlmCostRow(costRows, m.model_id, m.name || m.model_id, catalogProvider);
          return row ? costPerHour(row.costPerMin) ?? 0 : 0;
        })
      ),
    [opts, costRows, catalogProvider]
  );

  const selectOpts = React.useMemo(
    () =>
      opts.map((m) =>
        modelOption(m, maxLatency, maxHourlyCost, costRows, catalogProvider)
      ),
    [opts, maxLatency, maxHourlyCost, costRows, catalogProvider]
  );
  const blocked = Boolean(err) || selectOpts.length === 0;
  const labelWithCount = `${label} (${opts.length})`;

  const inner = (
    <>
      {err ? (
        <div className="rounded border border-red-500/40 bg-red-950/40 px-1 py-0.5 text-[9px] leading-tight text-red-100">
          {err}
        </div>
      ) : null}
      <SearchableSelect
        disabled={blocked}
        emptyTriggerLabel="Scegli il modello LLM"
        listMaxClassName="min-w-[12rem] max-w-[22rem]"
        options={selectOpts}
        value={value || ''}
        onChange={onChange}
      />
    </>
  );

  return labelTooltip ? (
    <FieldHint label={labelWithCount} tooltip={labelTooltip} className="min-w-0 max-w-[22rem]">
      {inner}
    </FieldHint>
  ) : (
    <label className="flex min-w-0 max-w-[22rem] flex-col gap-0">
      <span className="truncate text-[10px] font-medium uppercase leading-none tracking-wide text-slate-500">
        {labelWithCount}
      </span>
      {inner}
    </label>
  );
}
