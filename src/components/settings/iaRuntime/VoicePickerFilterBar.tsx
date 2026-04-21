/**
 * Pannello filtri dinamici sopra la lista voci (capability per piattaforma).
 */

import React from 'react';
import type { CatalogVoice } from '@services/iaCatalogApi';
import {
  PLATFORM_FILTER_CAPABILITIES,
  type VoiceFilterCapabilities,
  type VoicePanelFilters,
  catalogVoiceToMetadata,
  uniqueSortedStrings,
} from '@types/voiceMetadata';

const LABELS: Record<keyof VoicePanelFilters, string> = {
  language: 'Lingua',
  accent: 'Accento',
  category: 'Tipo',
  gender: 'Genere',
  age_group: 'Età',
  style: 'Stile',
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-px">
      <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <select
        className="max-w-full rounded border border-slate-600 bg-slate-900 px-1 py-0.5 font-mono text-[10px] leading-tight text-slate-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Tutti</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface VoicePickerFilterBarProps {
  platform: string;
  voices: CatalogVoice[];
  panel: VoicePanelFilters;
  onPanelChange: (next: VoicePanelFilters) => void;
}

export function VoicePickerFilterBar({
  platform,
  voices,
  panel,
  onPanelChange,
}: VoicePickerFilterBarProps) {
  const caps: VoiceFilterCapabilities = PLATFORM_FILTER_CAPABILITIES[platform] ?? {
    language: true,
  };

  const meta = React.useMemo(
    () => voices.map((v) => catalogVoiceToMetadata(v, platform)),
    [voices, platform]
  );

  const languages = uniqueSortedStrings(meta.map((m) => m.language));
  const accents = uniqueSortedStrings(meta.map((m) => m.accent));
  const categories = uniqueSortedStrings(meta.map((m) => m.category));
  const genders = uniqueSortedStrings(meta.map((m) => m.gender));
  const ages = uniqueSortedStrings(meta.map((m) => m.age_group));
  const styles = uniqueSortedStrings(meta.map((m) => m.style));

  const setKey = (key: keyof VoicePanelFilters, val: string) => {
    onPanelChange({ ...panel, [key]: val });
  };

  return (
    <div className="mb-2 flex w-full flex-wrap gap-2 border-b border-slate-800/80 px-2 pb-2">
      {caps.language ? (
        <FilterSelect
          label={LABELS.language}
          value={panel.language}
          options={languages}
          onChange={(v) => setKey('language', v)}
        />
      ) : null}
      {caps.accent ? (
        <FilterSelect
          label={LABELS.accent}
          value={panel.accent}
          options={accents}
          onChange={(v) => setKey('accent', v)}
        />
      ) : null}
      {caps.category ? (
        <FilterSelect
          label={LABELS.category}
          value={panel.category}
          options={categories}
          onChange={(v) => setKey('category', v)}
        />
      ) : null}
      {caps.gender ? (
        <FilterSelect
          label={LABELS.gender}
          value={panel.gender}
          options={genders}
          onChange={(v) => setKey('gender', v)}
        />
      ) : null}
      {caps.age_group ? (
        <FilterSelect
          label={LABELS.age_group}
          value={panel.age_group}
          options={ages}
          onChange={(v) => setKey('age_group', v)}
        />
      ) : null}
      {caps.style ? (
        <FilterSelect
          label={LABELS.style}
          value={panel.style}
          options={styles}
          onChange={(v) => setKey('style', v)}
        />
      ) : null}
    </div>
  );
}
