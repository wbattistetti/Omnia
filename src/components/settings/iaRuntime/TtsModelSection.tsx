/**
 * Dropdown modello sintesi vocale ElevenLabs (`ttsModel` → `tts.model_id` nel payload ConvAI).
 */

import React from 'react';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { fetchElevenLabsTtsModels, type ElevenLabsTtsModelRow } from '@services/elevenLabsTtsModelsApi';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import {
  costPerHour,
  parseLatencyMs,
  resolveTtsCostRow,
  type ModelCostRow,
} from './modelCostsCatalog';
import { resolveScopedTtsModelIds } from '@utils/iaCatalog/ttsLanguageModelMap';

function toOptions(
  rows: ElevenLabsTtsModelRow[],
  maxLatency: number,
  maxHourlyCost: number,
  costRows: readonly ModelCostRow[]
): SearchableSelectOption<string>[] {
  const auto: SearchableSelectOption<string> = {
    value: '',
    label: 'Automatico (consigliato per lingua)',
    subtitle: 'en → eleven_flash_v2 · altre → eleven_flash_v2_5',
  };
  return [
    auto,
    ...rows.map((m) => {
      const mapped = resolveTtsCostRow(costRows, m.model_id);
      const latencyMs = mapped ? parseLatencyMs(mapped.latency) : null;
      const hourly = mapped ? costPerHour(mapped.costPerMin) : null;
      const latencyPct =
        latencyMs != null && maxLatency > 0 ? `${Math.min(100, Math.max(4, (latencyMs / maxLatency) * 100))}%` : '0%';
      const costPct =
        hourly != null && maxHourlyCost > 0 ? `${Math.min(100, Math.max(4, (hourly / maxHourlyCost) * 100))}%` : '0%';
      return {
        value: m.model_id,
        label: m.name || m.model_id,
        subtitle: [m.model_id, mapped?.languages].filter(Boolean).join(' · '),
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
    }),
  ];
}

export interface TtsModelSectionProps {
  config: IAAgentConfig;
  onChange: (next: IAAgentConfig) => void;
  catalogReloadNonce?: number;
  showOverrideBadge?: boolean;
  costRows?: readonly ModelCostRow[];
  ttsLanguageScopedEnabled?: boolean;
  ttsPerLanguageModelMap?: Record<string, string[]>;
  onTtsLanguageScopedChange?: (next: boolean) => void;
  /** Override task: mostra lo stato globale, checkbox non modificabile. */
  ttsLanguageScopedUiLocked?: boolean;
}

export function TtsModelSection({
  config,
  onChange,
  catalogReloadNonce = 0,
  showOverrideBadge,
  costRows = [],
  ttsLanguageScopedEnabled = false,
  ttsPerLanguageModelMap,
  onTtsLanguageScopedChange,
  ttsLanguageScopedUiLocked = false,
}: TtsModelSectionProps) {
  const [models, setModels] = React.useState<ElevenLabsTtsModelRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setErr(null);
    void (async () => {
      try {
        const list = await fetchElevenLabsTtsModels();
        if (!cancelled) setModels(list);
      } catch (e) {
        if (!cancelled) {
          setModels([]);
          setErr(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogReloadNonce]);

  const ttsOnlyModels = React.useMemo(
    () => models.filter((m) => !m.model_id.toLowerCase().includes('_sts_')),
    [models]
  );

  const scopedModels = React.useMemo(() => {
    if (!ttsLanguageScopedEnabled) return ttsOnlyModels;
    const allowed = resolveScopedTtsModelIds(ttsPerLanguageModelMap, config.voice?.language);
    if (allowed === null) return ttsOnlyModels;
    const set = new Set(allowed);
    return ttsOnlyModels.filter((m) => set.has(m.model_id));
  }, [ttsLanguageScopedEnabled, ttsPerLanguageModelMap, config.voice?.language, ttsOnlyModels]);

  const sortedModels = React.useMemo(() => {
    const list = [...scopedModels];
    list.sort((a, b) => (a.name || a.model_id).localeCompare(b.name || b.model_id));
    return list;
  }, [scopedModels]);

  const maxLatency = React.useMemo(
    () => Math.max(0, ...sortedModels.map((m) => parseLatencyMs(resolveTtsCostRow(costRows, m.model_id)?.latency ?? '') ?? 0)),
    [sortedModels, costRows]
  );
  const maxHourlyCost = React.useMemo(
    () =>
      Math.max(
        0,
        ...sortedModels.map((m) => {
          const row = resolveTtsCostRow(costRows, m.model_id);
          return row ? costPerHour(row.costPerMin) ?? 0 : 0;
        })
      ),
    [sortedModels, costRows]
  );
  const options = React.useMemo(
    () => toOptions(sortedModels, maxLatency, maxHourlyCost, costRows),
    [sortedModels, maxLatency, maxHourlyCost, costRows]
  );
  const value = typeof config.ttsModel === 'string' ? config.ttsModel.trim() : '';

  return (
    <div data-ia-runtime-focus="ttsModel" className="flex w-full min-w-0 flex-col gap-0.5">
      {showOverrideBadge ? (
        <div className="flex flex-row flex-wrap items-center gap-1">
          <span className="rounded border border-amber-500/35 bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-200">
            override
          </span>
        </div>
      ) : null}
      {err ? (
        <div className="rounded border border-amber-500/45 bg-amber-950/35 px-1 py-0.5 text-[9px] leading-tight text-amber-100">
          {err}
        </div>
      ) : null}
      <div className="flex w-full min-w-0 flex-col gap-1">
        <div className="flex min-h-[2rem] flex-row flex-wrap items-center justify-start gap-x-2 gap-y-1">
          <span
            title="Motore sintesi ElevenLabs per ConvAI (`eleven_*`). Per lingue ≠ inglese servono Flash v2.5 o Turbo v2.5; «turbo» nel nome non indica GPT-4-turbo."
            className="cursor-help border-b border-dotted border-slate-600 text-[11px] font-semibold leading-snug text-gray-900 dark:text-white"
          >
            TTS ({sortedModels.length})
          </span>
          {onTtsLanguageScopedChange != null || ttsLanguageScopedUiLocked ? (
            <label
              className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-300 ${
                ttsLanguageScopedUiLocked ? 'cursor-default' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={ttsLanguageScopedEnabled}
                disabled={ttsLanguageScopedUiLocked}
                onChange={
                  ttsLanguageScopedUiLocked || !onTtsLanguageScopedChange
                    ? undefined
                    : (e) => onTtsLanguageScopedChange(e.target.checked)
                }
              />
              <span>TTS dipende dalla lingua</span>
            </label>
          ) : null}
        </div>
        <SearchableSelect
          listMaxClassName="w-full min-w-0 max-w-full"
          disabled={Boolean(err) && models.length === 0}
          placeholder="Cerca modello TTS…"
          emptyTriggerLabel="Scegli modello sintesi"
          options={options}
          value={value}
          onChange={(modelId) => onChange({ ...config, ttsModel: modelId })}
        />
      </div>
    </div>
  );
}
