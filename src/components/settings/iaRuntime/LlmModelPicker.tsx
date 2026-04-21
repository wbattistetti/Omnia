/**
 * LLM model picker backed by /api/ia-catalog/ui/models (solo dati sincronizzati sul server).
 */

import React from 'react';
import { CatalogApiError, fetchCatalogModels, type CatalogModel } from '@services/iaCatalogApi';
import { FieldHint } from './FieldHint';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

export interface LlmModelPickerProps {
  catalogProvider: 'openai' | 'anthropic' | 'google';
  value: string;
  onChange: (modelId: string) => void;
  label?: string;
  /** Tooltip lungo sulla label (accessibilità: title). */
  labelTooltip?: string;
  reloadNonce?: number;
}

function modelOption(m: CatalogModel): SearchableSelectOption<string> {
  const meta = [
    m.cost_hint ? `cost ${m.cost_hint}` : '',
    m.latency_ms != null ? `~${m.latency_ms}ms` : '',
    ...(m.tags || []).slice(0, 3),
  ]
    .filter(Boolean)
    .join(' · ');
  const subtitle = [meta, m.notes].filter(Boolean).join(' — ');
  return {
    value: m.model_id,
    label: m.name || m.model_id,
    subtitle: subtitle || undefined,
  };
}

export function LlmModelPicker({
  catalogProvider,
  value,
  onChange,
  label = 'model',
  labelTooltip,
  reloadNonce = 0,
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

  const selectOpts = React.useMemo(() => opts.map(modelOption), [opts]);
  const blocked = Boolean(err) || selectOpts.length === 0;

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
    <FieldHint label={label} tooltip={labelTooltip} className="min-w-0 max-w-[22rem]">
      {inner}
    </FieldHint>
  ) : (
    <label className="flex min-w-0 max-w-[22rem] flex-col gap-0">
      <span className="truncate text-[10px] font-medium uppercase leading-none tracking-wide text-slate-500">
        {label}
      </span>
      {inner}
    </label>
  );
}
