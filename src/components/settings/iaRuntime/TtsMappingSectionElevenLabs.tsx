/**
 * TTS mapping (runtime config): per lingua definisce i `tts.model_id` consentiti.
 */

import React from 'react';
import { CatalogApiError, fetchCatalogLanguages } from '@services/iaCatalogApi';
import { fetchElevenLabsTtsModels, type ElevenLabsTtsModelRow } from '@services/elevenLabsTtsModelsApi';
import { resolveScopedTtsModelIds } from '@utils/iaCatalog/ttsLanguageModelMap';

export interface TtsMappingSectionElevenLabsProps {
  value?: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  catalogReloadNonce?: number;
}

function normalizeMap(v: Record<string, string[]> | undefined): Record<string, string[]> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [k, arr] of Object.entries(v)) {
    if (!k.trim()) continue;
    out[k] = [...new Set((arr || []).map((x) => String(x).trim()).filter(Boolean))];
  }
  return out;
}

export function TtsMappingSectionElevenLabs({
  value,
  onChange,
  catalogReloadNonce = 0,
}: TtsMappingSectionElevenLabsProps) {
  const [models, setModels] = React.useState<ElevenLabsTtsModelRow[]>([]);
  const [locales, setLocales] = React.useState<{ locale: string; label: string }[]>([]);
  const [selectedLocale, setSelectedLocale] = React.useState('it-IT');
  const [loadErr, setLoadErr] = React.useState<string | null>(null);

  const map = React.useMemo(() => normalizeMap(value), [value]);

  React.useEffect(() => {
    let cancelled = false;
    setLoadErr(null);
    void (async () => {
      try {
        const [langs, tts] = await Promise.all([
          fetchCatalogLanguages('elevenlabs'),
          fetchElevenLabsTtsModels(),
        ]);
        if (cancelled) return;
        const nonEn = langs.languages.filter(
          (l) => String(l.locale || '').trim() && !String(l.locale || '').toLowerCase().startsWith('en')
        );
        setLocales(nonEn);
        setModels(tts.filter((m) => !m.model_id.toLowerCase().includes('_sts_')));
        setSelectedLocale((prev) => {
          if (nonEn.some((l) => l.locale === prev)) return prev;
          return nonEn[0]?.locale ?? 'it-IT';
        });
      } catch (e) {
        if (cancelled) return;
        setLoadErr(e instanceof CatalogApiError ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogReloadNonce]);

  const selected = React.useMemo(
    () => new Set(resolveScopedTtsModelIds(map, selectedLocale) ?? []),
    [map, selectedLocale]
  );

  const toggleModel = (modelId: string, checked: boolean) => {
    const cur = new Set(resolveScopedTtsModelIds(map, selectedLocale) ?? []);
    if (checked) cur.add(modelId);
    else cur.delete(modelId);
    const arr = [...cur].sort((a, b) => a.localeCompare(b));
    onChange({ ...map, [selectedLocale]: arr });
  };

  return (
    <div className="mt-1 rounded border border-slate-700/80 bg-slate-950/35 p-1 text-[10px] text-slate-300">
      <p className="mb-1 text-[9px] leading-snug text-slate-500">
        Se attivo, limita i modelli TTS per lingua dell&apos;agente. Salvato nella configurazione runtime.
      </p>
      {loadErr ? (
        <div className="mb-1 rounded border border-red-500/45 bg-red-950/30 px-1 py-0.5 text-red-100">
          {loadErr}
        </div>
      ) : null}
      <div className="mb-1 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-px">
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Lingua</span>
          <select
            className="rounded border border-slate-600 bg-slate-950 px-1.5 py-1 font-mono text-[11px] text-slate-100"
            value={selectedLocale}
            onChange={(e) => setSelectedLocale(e.target.value)}
          >
            {locales.map((l) => (
              <option key={l.locale} value={l.locale}>
                {l.label} ({l.locale})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="max-h-44 overflow-y-auto rounded border border-slate-700/80 bg-slate-950/50 p-1">
        <ul className="flex flex-col gap-0.5">
          {models.map((m) => {
            const on = selected.has(m.model_id);
            return (
              <li key={m.model_id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={on}
                  onChange={(e) => toggleModel(m.model_id, e.target.checked)}
                />
                <span className="font-mono text-[11px] text-slate-200">{m.name || m.model_id}</span>
                <span className="text-[9px] text-slate-500">{m.model_id}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
