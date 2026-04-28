/**
 * LLM mapping (ElevenLabs): per lingua ≠ en definisce quali `model_id` del catalogo sync sono ammessi.
 * - File: `config/llmMapping.json` via POST (OMNIA_WRITABLE_CONFIG=1).
 * - Progetto (global): stesso payload in `IAAgentConfig.advanced.omniaProjectElevenLabsLlmMapping` → Mongo con «Salva configurazione».
 */

import React from 'react';
import {
  CatalogApiError,
  fetchCatalogLanguages,
  fetchCatalogModels,
  fetchLlmMapping,
  postLlmMapping,
  type CatalogModel,
  type LlmMappingPayload,
} from '@services/iaCatalogApi';
import {
  effectiveAllowedForLocale,
  mergeNonEnLocalesFromCatalogAndMapping,
  pickDefaultLocaleForElevenLabsMappingFromFile,
  primaryLang,
} from '@utils/iaCatalog/elevenLabsLlmMappingLocale';
import { mergeFileLlmMappingWithProjectEmbedded } from '@utils/iaAgentRuntime/omniaProjectElevenLabsLlmMapping';

/** Ultima lingua mapping scelta: sopravvive a chiusura/riapertura pannello (stesso tab). */
const LLM_MAPPING_LOCALE_STORAGE_KEY = 'omnia.llmMapping.selectedLocale.v1';

export interface LlmMappingSectionElevenLabsProps {
  catalogReloadNonce?: number;
  /** Mapping letto da default progetto (Mongo); unito al file dopo fetch. */
  embeddedProjectMapping?: LlmMappingPayload | null;
  /** Aggiorna `advanced` così «Salva configurazione» Studio persiste i checkbox. */
  onEmbeddedProjectMappingChange?: (next: LlmMappingPayload) => void;
}

export function LlmMappingSectionElevenLabs({
  catalogReloadNonce = 0,
  embeddedProjectMapping = null,
  onEmbeddedProjectMappingChange,
}: LlmMappingSectionElevenLabsProps) {
  const [models, setModels] = React.useState<CatalogModel[]>([]);
  const [locales, setLocales] = React.useState<{ locale: string; label: string }[]>([]);
  const [mapping, setMapping] = React.useState<LlmMappingPayload | null>(null);
  const [selectedLocale, setSelectedLocale] = React.useState('it-IT');
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [saveNotice, setSaveNotice] = React.useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [saveBusy, setSaveBusy] = React.useState(false);
  /** Dopo il primo fetch, non sovrascrivere la lingua scelta dall’utente (solo se resta nel catalogo). */
  const localeEditorHydratedRef = React.useRef(false);

  const embeddedJson = React.useMemo(
    () => JSON.stringify(embeddedProjectMapping ?? null),
    [embeddedProjectMapping]
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoadErr(null);
    void (async () => {
      try {
        const [mods, langs, map] = await Promise.all([
          fetchCatalogModels('elevenlabs'),
          fetchCatalogLanguages('elevenlabs'),
          fetchLlmMapping(),
        ]);
        if (cancelled) return;
        setModels(mods);
        const merged = mergeFileLlmMappingWithProjectEmbedded(
          map,
          embeddedProjectMapping ? embeddedProjectMapping : null
        );
        const nonEn = langs.languages.filter((l) => String(l.locale || '').trim() && primaryLang(l.locale) !== 'en');
        const list = mergeNonEnLocalesFromCatalogAndMapping(nonEn, merged.elevenlabs.perLanguage ?? {});
        setLocales(list);
        setMapping(merged);
        const keys = list.map((l) => l.locale);
        const per = merged.elevenlabs.perLanguage || {};
        let storedLocale: string | null = null;
        try {
          storedLocale = sessionStorage.getItem(LLM_MAPPING_LOCALE_STORAGE_KEY);
        } catch {
          storedLocale = null;
        }
        setSelectedLocale((prev) => {
          if (localeEditorHydratedRef.current && keys.includes(prev)) return prev;
          localeEditorHydratedRef.current = true;
          if (storedLocale && keys.includes(storedLocale)) return storedLocale;
          return pickDefaultLocaleForElevenLabsMappingFromFile(keys, per);
        });
      } catch (e) {
        if (cancelled) return;
        setLoadErr(e instanceof CatalogApiError ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogReloadNonce, embeddedJson]);

  const allowedForSelected = React.useMemo(() => {
    if (!mapping) return [];
    return effectiveAllowedForLocale(mapping, selectedLocale);
  }, [mapping, selectedLocale]);

  const toggleModel = (modelId: string, checked: boolean) => {
    if (!mapping) return;
    const next = JSON.parse(JSON.stringify(mapping)) as LlmMappingPayload;
    const cur = new Set(effectiveAllowedForLocale(next, selectedLocale));
    if (checked) cur.add(modelId);
    else cur.delete(modelId);
    const arr = [...cur].sort();
    next.elevenlabs.perLanguage = { ...next.elevenlabs.perLanguage, [selectedLocale]: arr };
    setMapping(next);
    onEmbeddedProjectMappingChange?.(next);
  };

  const save = async () => {
    if (!mapping) return;
    setSaveBusy(true);
    setSaveNotice(null);
    try {
      await postLlmMapping(mapping);
      const fresh = await fetchLlmMapping();
      setMapping(
        onEmbeddedProjectMappingChange
          ? mergeFileLlmMappingWithProjectEmbedded(fresh, embeddedProjectMapping)
          : fresh
      );
      try {
        sessionStorage.setItem(LLM_MAPPING_LOCALE_STORAGE_KEY, selectedLocale);
      } catch {
        /* ignore quota / private mode */
      }
      setSaveNotice({ tone: 'success', message: 'Salvato correttamente.' });
    } catch (e) {
      const message =
        e instanceof CatalogApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Salvataggio fallito (serve OMNIA_WRITABLE_CONFIG=1 sul server Express).';
      setSaveNotice({ tone: 'error', message });
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 text-[10px] text-slate-300">
      <p className="leading-snug text-slate-500">
        Seleziona una lingua (≠ en) e spunta gli LLM ElevenLabs ammessi per quella lingua. La combo LLM in
        runtime userà solo questi id quando l’agente ha la stessa lingua.
        {onEmbeddedProjectMappingChange ? (
          <>
            {' '}
            Con i default di progetto, le selezioni sono incluse in{' '}
            <strong className="text-slate-400">Salva configurazione</strong> (Mongo). Il file{' '}
            <code className="rounded bg-slate-900 px-0.5 text-slate-400">config/llmMapping.json</code> è
            opzionale (pulsante sotto).
          </>
        ) : (
          <>
            {' '}
            File:{' '}
            <code className="rounded bg-slate-900 px-0.5 text-slate-400">config/llmMapping.json</code>.
          </>
        )}
      </p>
      {loadErr ? (
        <div className="rounded border border-red-500/40 bg-red-950/30 px-1 py-0.5 text-red-100">{loadErr}</div>
      ) : null}
      {mapping ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-px">
              <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Lingua</span>
              <select
                className="rounded border border-slate-600 bg-slate-950 px-1.5 py-1 font-mono text-[11px] text-slate-100"
                value={selectedLocale}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedLocale(v);
                  try {
                    sessionStorage.setItem(LLM_MAPPING_LOCALE_STORAGE_KEY, v);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {locales.map((l) => (
                  <option key={l.locale} value={l.locale}>
                    {l.label} ({l.locale})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={saveBusy}
              onClick={() => void save()}
              className="h-8 rounded border border-violet-600/80 bg-violet-950/50 px-2 text-[11px] font-medium text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
              title={
                onEmbeddedProjectMappingChange
                  ? 'Scrive anche config/llmMapping.json sul server (opzionale). I checkbox sono salvati nel progetto con «Salva configurazione» in alto.'
                  : undefined
              }
            >
              {saveBusy ? 'Salvataggio…' : onEmbeddedProjectMappingChange ? 'Salva su file (opz.)' : 'Salva mapping'}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto rounded border border-slate-700/80 bg-slate-950/50 p-1">
            <p className="mb-1 text-[9px] uppercase tracking-wide text-slate-500">
              LLM catalogo ({models.length}) — {selectedLocale}
            </p>
            <ul className="flex flex-col gap-0.5">
              {models.map((m) => {
                const id = m.model_id;
                const on = allowedForSelected.includes(id);
                return (
                  <li key={id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600"
                      checked={on}
                      onChange={(e) => toggleModel(id, e.target.checked)}
                    />
                    <span className="font-mono text-[11px] text-slate-200">{m.name || id}</span>
                    <span className="text-[9px] text-slate-500">{id}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-[9px] text-slate-500">
            Default globale lingue non inglesi:{' '}
            <code className="text-slate-400">{mapping.elevenlabs.nonEnglishAllowedModels.join(', ')}</code>
            . Puoi modificarlo nel JSON o estendere <code className="text-slate-400">perLanguage</code> qui sopra.
          </p>
          {saveNotice ? (
            <div
              role={saveNotice.tone === 'error' ? 'alert' : 'status'}
              className={
                saveNotice.tone === 'error'
                  ? 'rounded border border-red-500/50 bg-red-950/40 px-1 py-0.5 text-red-100'
                  : 'rounded border border-emerald-500/45 bg-emerald-950/35 px-1 py-0.5 text-emerald-100'
              }
            >
              {saveNotice.message}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
