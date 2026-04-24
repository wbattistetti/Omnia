/**
 * Dropdown modello sintesi vocale ElevenLabs (`ttsModel` → `tts.model_id` nel payload ConvAI).
 */

import React from 'react';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { fetchElevenLabsTtsModels, type ElevenLabsTtsModelRow } from '@services/elevenLabsTtsModelsApi';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import { FieldHint } from './FieldHint';

function toOptions(rows: ElevenLabsTtsModelRow[]): SearchableSelectOption<string>[] {
  const auto: SearchableSelectOption<string> = {
    value: '',
    label: 'Automatico (consigliato per lingua)',
    subtitle: 'en → eleven_flash_v2 · altre → eleven_flash_v2_5',
  };
  return [
    auto,
    ...rows.map((m) => ({
      value: m.model_id,
      label: m.name || m.model_id,
      subtitle: m.model_id,
    })),
  ];
}

export interface TtsModelSectionProps {
  config: IAAgentConfig;
  onChange: (next: IAAgentConfig) => void;
  catalogReloadNonce?: number;
  showOverrideBadge?: boolean;
}

export function TtsModelSection({
  config,
  onChange,
  catalogReloadNonce = 0,
  showOverrideBadge,
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

  const options = React.useMemo(() => toOptions(models), [models]);
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
      <FieldHint
        variant="clear"
        label="Modello TTS (voce)"
        tooltip="Motore sintesi ElevenLabs per ConvAI (`eleven_*`). Per lingue ≠ inglese servono Flash v2.5 o Turbo v2.5; «turbo» nel nome non indica GPT-4-turbo."
        className="w-full min-w-0 max-w-full"
      >
        <SearchableSelect
          listMaxClassName="w-full min-w-0 max-w-full"
          disabled={Boolean(err) && models.length === 0}
          placeholder="Cerca modello TTS…"
          emptyTriggerLabel="Scegli modello sintesi"
          options={options}
          value={value}
          onChange={(modelId) => onChange({ ...config, ttsModel: modelId })}
        />
      </FieldHint>
    </div>
  );
}
