/**
 * Runtime IA agent motors: configurabile come default globale o override per task (mode).
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, Cpu, Globe2, Mic, Sparkles, Stethoscope } from 'lucide-react';
import type { IAAgentConfig, IAAgentPlatform } from 'types/iaAgentRuntimeSetup';
import {
  computeSectionOverrides,
  type SectionOverrideFlags,
} from '@utils/iaAgentRuntime/overrideFields';
import { getDefaultConfig, getVisibleFields } from '@utils/iaAgentRuntime/platformHelpers';
import { ModelSection } from './iaRuntime/ModelSection';
import { ElevenLabsConvaiIdentitySection } from './iaRuntime/ElevenLabsConvaiIdentitySection';
import { ToolsSection } from './iaRuntime/ToolsSection';
import { BackendToolsSection } from './iaRuntime/BackendToolsSection';
import {
  VoiceCatalogSection,
  VoiceRuntimeDeveloperJson,
} from './iaRuntime/VoiceCatalogSection';
import { TtsModelSection } from './iaRuntime/TtsModelSection';
import { AdvancedSection } from './iaRuntime/AdvancedSection';
import { LlmMappingSectionElevenLabs } from './iaRuntime/LlmMappingSectionElevenLabs';
import { TtsMappingSectionElevenLabs } from './iaRuntime/TtsMappingSectionElevenLabs';
import { ModelCostsSection } from './iaRuntime/ModelCostsSection';
import {
  defaultLlmCostRows,
  defaultTtsCostRows,
  type ModelCostRow,
} from './iaRuntime/modelCostsCatalog';
import {
  runIaProviderDiagnostics,
  type IaProviderDiagnosticResult,
} from '@diagnostics/iaProviderDiagnostics';
import { withElevenLabsReprovisionAfterTtsChange } from '@utils/iaAgentRuntime/applyElevenLabsReprovisionFlag';
import {
  OMNIA_PROJECT_ELEVENLABS_LLM_MAPPING_KEY,
  parseProjectElevenLabsLlmMapping,
} from '@utils/iaAgentRuntime/omniaProjectElevenLabsLlmMapping';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';

export interface IAAgentSetupProps {
  defaultConfig?: IAAgentConfig;
  value?: IAAgentConfig;
  onChange?: (config: IAAgentConfig) => void;
  mode?: 'global' | 'override';
  /** Incrementato dopo sync catalogo sul server → rifetch voci/lingue. */
  catalogReloadNonce?: number;
  /** Optional: POST /elevenlabs/createAgent via ApiServer when Agent ID is empty. */
  onProvisionConvaiAgent?: () => Promise<void>;
  /**
   * Quando true, applica `omnia:convai-apply-tts-model` solo se il payload non ha `taskInstanceId`
   * (fix da chat verso default globali). I pannelli override per-task gestiscono l’evento nel container.
   */
  listenConvaiTtsFix?: boolean;
  /**
   * Se false, nasconde LLM/TTS Costs. Default: true solo con `mode="global"` (Studio / app-wide).
   */
  showModelCostsSection?: boolean;
}

/** OpenAI → Anthropic → Gemini → ElevenLabs → Custom */
const PLATFORM_META: ReadonlyArray<{
  id: IAAgentPlatform;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: 'openai', label: 'OpenAI', Icon: Sparkles },
  { id: 'anthropic', label: 'Anthropic', Icon: Bot },
  { id: 'google', label: 'Gemini', Icon: Globe2 },
  { id: 'elevenlabs', label: 'ElevenLabs', Icon: Mic },
  { id: 'custom', label: 'Custom', Icon: Cpu },
];

function emptyOverrides(): SectionOverrideFlags {
  return {
    modelSection: false,
    promptSection: false,
    toolsSection: false,
    voiceSection: false,
    advancedSection: false,
  };
}

const ADV_LLM_LANGUAGE_SCOPED_KEY = 'llmLanguageScopedEnabled';
const ADV_TTS_LANGUAGE_SCOPED_KEY = 'ttsLanguageScopedEnabled';
const ADV_TTS_PER_LANGUAGE_MAP_KEY = 'ttsPerLanguageModelMap';

export function IAAgentSetup({
  defaultConfig,
  value,
  onChange,
  mode = 'global',
  catalogReloadNonce = 0,
  onProvisionConvaiAgent,
  listenConvaiTtsFix = false,
  showModelCostsSection: showModelCostsProp,
}: IAAgentSetupProps) {
  const showModelCostsSection = showModelCostsProp ?? mode === 'global';
  const [inner, setInner] = React.useState<IAAgentConfig>(() =>
    value !== undefined ? value : getDefaultConfig('openai')
  );

  React.useEffect(() => {
    if (value !== undefined) {
      setInner(value);
    }
  }, [value]);

  const config = value !== undefined ? value : inner;

  const configRef = React.useRef(config);
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);

  const setConfig = React.useCallback(
    (next: IAAgentConfig) => {
      const prev = configRef.current;
      const flagged = withElevenLabsReprovisionAfterTtsChange(prev, next, true);
      if (value === undefined) {
        setInner(flagged);
      }
      onChange?.(flagged);
    },
    [onChange, value]
  );

  const overrides: SectionOverrideFlags =
    mode === 'override' && defaultConfig
      ? computeSectionOverrides(config, defaultConfig)
      : emptyOverrides();

  const visibility = React.useMemo(() => getVisibleFields(config.platform), [config.platform]);

  const onPlatformSelect = (p: IAAgentPlatform) => {
    setConfig(getDefaultConfig(p));
  };

  const platformSlot = (
    <>
      {PLATFORM_META.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => onPlatformSelect(id)}
          className={`inline-flex h-7 items-center gap-0.5 rounded border px-1.5 py-px text-[11px] transition-colors ${
            config.platform === id
              ? 'border-violet-500 bg-violet-950/60 text-violet-100'
              : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500'
          }`}
        >
          <Icon size={13} className="shrink-0 opacity-90" aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </>
  );

  const devOverride =
    (overrides.toolsSection || overrides.advancedSection) && mode === 'override';

  const [diagnostic, setDiagnostic] = React.useState<IaProviderDiagnosticResult | null>(null);
  const [diagnosticBusy, setDiagnosticBusy] = React.useState(false);
  const [diagnosticFetchError, setDiagnosticFetchError] = React.useState<string | null>(null);
  const [llmCostRows, setLlmCostRows] = React.useState<ModelCostRow[]>(() => defaultLlmCostRows());
  const [ttsCostRows, setTtsCostRows] = React.useState<ModelCostRow[]>(() => defaultTtsCostRows());
  const advanced = React.useMemo(
    () => (config.advanced && typeof config.advanced === 'object' ? config.advanced : {}),
    [config.advanced]
  );
  const llmLanguageScopedEnabled =
    config.platform === 'elevenlabs' ? advanced[ADV_LLM_LANGUAGE_SCOPED_KEY] !== false : false;
  /** Stesso criterio dell’LLM mapping: attivo di default su ElevenLabs; disattivabile dal checkbox in TtsModelSection. */
  const ttsLanguageScopedEnabled =
    config.platform === 'elevenlabs' ? advanced[ADV_TTS_LANGUAGE_SCOPED_KEY] !== false : false;

  /** In override, checkbox e filtri LLM/TTS per lingua seguono i default globali (mapping non editabile qui). */
  const globalIaRuntimeSlice = React.useMemo(() => {
    const g = loadGlobalIaAgentConfig();
    const ga = g.advanced && typeof g.advanced === 'object' ? g.advanced : {};
    const ttsMap =
      ga[ADV_TTS_PER_LANGUAGE_MAP_KEY] &&
      typeof ga[ADV_TTS_PER_LANGUAGE_MAP_KEY] === 'object' &&
      !Array.isArray(ga[ADV_TTS_PER_LANGUAGE_MAP_KEY])
        ? (ga[ADV_TTS_PER_LANGUAGE_MAP_KEY] as Record<string, string[]>)
        : {};
    return {
      llmScoped: g.platform === 'elevenlabs' ? ga[ADV_LLM_LANGUAGE_SCOPED_KEY] !== false : false,
      ttsScoped: g.platform === 'elevenlabs' ? ga[ADV_TTS_LANGUAGE_SCOPED_KEY] !== false : false,
      ttsPerLanguageModelMap: ttsMap,
      elevenLabsLlmMapping: parseProjectElevenLabsLlmMapping(ga),
    };
  }, [catalogReloadNonce]);

  const effectiveLlmLanguageScoped =
    mode === 'override' ? globalIaRuntimeSlice.llmScoped : llmLanguageScopedEnabled;
  const effectiveTtsLanguageScoped =
    mode === 'override' ? globalIaRuntimeSlice.ttsScoped : ttsLanguageScopedEnabled;
  const ttsPerLanguageModelMap =
    advanced[ADV_TTS_PER_LANGUAGE_MAP_KEY] &&
    typeof advanced[ADV_TTS_PER_LANGUAGE_MAP_KEY] === 'object' &&
    !Array.isArray(advanced[ADV_TTS_PER_LANGUAGE_MAP_KEY])
      ? (advanced[ADV_TTS_PER_LANGUAGE_MAP_KEY] as Record<string, string[]>)
      : {};
  const ttsPerLanguageModelMapForPicker =
    mode === 'override' ? globalIaRuntimeSlice.ttsPerLanguageModelMap : ttsPerLanguageModelMap;
  const hasScopedTtsRules = Object.values(ttsPerLanguageModelMap).some((arr) => Array.isArray(arr) && arr.length > 0);
  const hasVoiceLanguage = Boolean(String(config.voice?.language ?? '').trim());

  const patchAdvanced = React.useCallback(
    (patch: Record<string, unknown>) => {
      const current = configRef.current;
      const advCurrent =
        current.advanced && typeof current.advanced === 'object' ? current.advanced : {};
      setConfig({ ...current, advanced: { ...advCurrent, ...patch } });
    },
    [setConfig]
  );

  const platformLabel =
    PLATFORM_META.find((x) => x.id === config.platform)?.label ?? config.platform;
  const embeddedElevenLabsLlmMapping = React.useMemo(
    () => parseProjectElevenLabsLlmMapping(config.advanced),
    [config.advanced]
  );

  const mappingLanguageLabel = React.useMemo(() => {
    const raw = String(config.voice?.language ?? '').trim();
    if (!raw) return 'lingua non impostata';
    const primary = raw.toLowerCase().split('-')[0];
    try {
      const dn = new Intl.DisplayNames(['it'], { type: 'language' });
      const name = dn.of(primary);
      if (name && name.trim()) return name;
    } catch {
      /* fallback su codice */
    }
    return raw;
  }, [config.voice?.language]);

  const runDiagnostics = React.useCallback(async () => {
    if (config.platform === 'custom') return;
    setDiagnosticBusy(true);
    setDiagnosticFetchError(null);
    try {
      const result = await runIaProviderDiagnostics(config.platform);
      setDiagnostic(result);
    } catch (e) {
      setDiagnostic(null);
      setDiagnosticFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiagnosticBusy(false);
    }
  }, [config.platform]);

  React.useEffect(() => {
    setDiagnostic(null);
    setDiagnosticFetchError(null);
  }, [config.platform]);

  React.useEffect(() => {
    if (!listenConvaiTtsFix) return undefined;
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ ttsModel?: string; taskInstanceId?: string }>;
      const tid = String(e.detail?.taskInstanceId ?? '').trim();
      if (tid) return;
      const model = typeof e.detail?.ttsModel === 'string' ? e.detail.ttsModel.trim() : '';
      if (!model) return;
      const cur = configRef.current;
      if (cur.platform !== 'elevenlabs') return;
      setConfig({ ...cur, ttsModel: model });
    };
    document.addEventListener('omnia:convai-apply-tts-model', handler);
    return () => document.removeEventListener('omnia:convai-apply-tts-model', handler);
  }, [listenConvaiTtsFix, setConfig]);

  return (
    <div className="flex flex-col gap-1 text-slate-100">
      <ModelSection
        config={config}
        visibility={visibility}
        showOverrideBadge={mode === 'override' && overrides.modelSection}
        onChange={setConfig}
        catalogReloadNonce={catalogReloadNonce}
        llmCostRows={llmCostRows}
        llmLanguageScopedEnabled={effectiveLlmLanguageScoped}
        llmLanguageScopedUiLocked={mode === 'override'}
        elevenLabsLlmMappingForCatalog={
          mode === 'override' ? globalIaRuntimeSlice.elevenLabsLlmMapping : undefined
        }
        onLlmLanguageScopedChange={
          mode === 'override'
            ? undefined
            : (next) => patchAdvanced({ [ADV_LLM_LANGUAGE_SCOPED_KEY]: next })
        }
        showElevenLabsConvaiIdentity={false}
        platformSlot={platformSlot}
        elevenLabsTtsVoiceSlots={
          visibility.voice && config.platform === 'elevenlabs'
            ? {
                tts: (
                  <TtsModelSection
                    config={config}
                    onChange={setConfig}
                    catalogReloadNonce={catalogReloadNonce}
                    costRows={ttsCostRows}
                    ttsLanguageScopedEnabled={effectiveTtsLanguageScoped}
                    ttsPerLanguageModelMap={ttsPerLanguageModelMapForPicker}
                    ttsLanguageScopedUiLocked={mode === 'override'}
                    onTtsLanguageScopedChange={
                      mode === 'override'
                        ? undefined
                        : (next) => patchAdvanced({ [ADV_TTS_LANGUAGE_SCOPED_KEY]: next })
                    }
                  />
                ),
                voice: (
                  <VoiceCatalogSection
                    config={config}
                    catalogPlatform={config.platform}
                    showOverrideBadge={false}
                    onChange={setConfig}
                    catalogReloadNonce={catalogReloadNonce}
                  />
                ),
              }
            : undefined
        }
      />

      {mode === 'global' && config.platform === 'elevenlabs' && llmLanguageScopedEnabled ? (
        <details className="rounded border border-slate-700/80 bg-slate-950/40">
          <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
            LLM mapping
          </summary>
          <div className="border-t border-slate-800 px-1.5 py-1">
            <LlmMappingSectionElevenLabs
              catalogReloadNonce={catalogReloadNonce}
              embeddedProjectMapping={mode === 'global' ? embeddedElevenLabsLlmMapping : undefined}
              onEmbeddedProjectMappingChange={
                mode === 'global'
                  ? (next) => patchAdvanced({ [OMNIA_PROJECT_ELEVENLABS_LLM_MAPPING_KEY]: next })
                  : undefined
              }
            />
          </div>
        </details>
      ) : null}

      {mode === 'global' && config.platform === 'elevenlabs' && ttsLanguageScopedEnabled ? (
        <details className="rounded border border-slate-700/80 bg-slate-950/40">
          <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
            TTS mapping
          </summary>
          <div className="border-t border-slate-800 px-1.5 py-1">
            {!hasVoiceLanguage ? (
              <div className="mb-1 rounded border border-amber-500/35 bg-amber-950/25 px-1 py-0.5 text-[9px] text-amber-100">
                Imposta prima la lingua voce dell&apos;agente per applicare correttamente il mapping TTS.
              </div>
            ) : null}
            {!hasScopedTtsRules ? (
              <div className="mb-1 rounded border border-amber-500/35 bg-amber-950/25 px-1 py-0.5 text-[9px] text-amber-100">
                Mapping TTS attivo ma senza regole: seleziona almeno un modello per una lingua.
              </div>
            ) : null}
            <TtsMappingSectionElevenLabs
              catalogReloadNonce={catalogReloadNonce}
              value={ttsPerLanguageModelMap}
              onChange={(next) => patchAdvanced({ [ADV_TTS_PER_LANGUAGE_MAP_KEY]: next })}
            />
          </div>
        </details>
      ) : null}

      {showModelCostsSection ? (
        <ModelCostsSection
          llmRows={llmCostRows}
          ttsRows={ttsCostRows}
          onLlmRowsChange={setLlmCostRows}
          onTtsRowsChange={setTtsCostRows}
        />
      ) : null}

      <details className="rounded border border-slate-700/80 bg-slate-950/40">
        <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
          <span className="inline-flex items-center gap-1">
            <Stethoscope size={12} className="opacity-90" aria-hidden />
            Diagnostica catalogo (backend Express)
          </span>
        </summary>
        <div className="flex flex-col gap-1 border-t border-slate-800 px-1.5 py-1 text-[10px] leading-snug text-slate-300">
          <p className="text-[9px] text-slate-500">
            Controlla solo il processo Node che espone{' '}
            <code className="rounded bg-slate-900 px-0.5 text-slate-400">/api/ia-catalog</code>{' '}
            (variabili env + conteggi dopo sync). Nessuna chiave viene mostrata.
          </p>
          <button
            type="button"
            disabled={config.platform === 'custom' || diagnosticBusy}
            onClick={() => void runDiagnostics()}
            className="inline-flex h-8 max-w-fit items-center gap-1 rounded border border-cyan-600/70 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-900/35 disabled:pointer-events-none disabled:opacity-40"
          >
            <Stethoscope size={13} aria-hidden />
            {diagnosticBusy ? 'Analisi…' : `Diagnostica provider (${platformLabel})`}
          </button>
          {config.platform === 'custom' ? (
            <p className="text-[9px] text-slate-500">
              Provider Custom: nessuna diagnostica catalogo centralizzata.
            </p>
          ) : null}
          {diagnosticFetchError ? (
            <div className="rounded border border-red-500/45 bg-red-950/35 px-1 py-0.5 text-[10px] text-red-100">
              {diagnosticFetchError}
            </div>
          ) : null}
          {config.platform === 'elevenlabs' && config.elevenLabsNeedsReprovision ? (
            <p className="rounded border border-amber-500/40 bg-amber-950/30 px-1 py-0.5 text-[9px] leading-snug text-amber-100/95">
              Re-provision ConvAI: al prossimo avvio flusso verrà creato un nuovo agent ElevenLabs con il modello
              TTS corrente (<code className="text-amber-200/90">{String(config.ttsModel ?? '').trim() || 'default lingua'}</code>
              ), poi <code className="text-amber-200/90">startAgent</code> userà il nuovo <code className="text-amber-200/90">agentId</code>.
              Dettaglio in console: <code className="text-amber-200/90">[IA·ConvAI] reprovision</code>.
            </p>
          ) : null}
          {diagnostic ? (
            <div
              className="diagnostic-report space-y-1 rounded border border-slate-600/80 bg-slate-950/70 px-1.5 py-1"
              role="region"
              aria-live="polite"
            >
              <h3 className="text-[11px] font-semibold text-slate-100">
                Report · {diagnostic.provider}
              </h3>
              <p>
                <span className="text-slate-500">Chiave API (env Node): </span>
                <span className={diagnostic.env.apiKeyPresent ? 'text-emerald-400' : 'text-amber-400'}>
                  {diagnostic.env.apiKeyPresent ? 'OK' : 'MANCANTE'}
                </span>
              </p>
              <p>
                <span className="text-slate-500">URL base API (env): </span>
                <span className={diagnostic.env.apiBasePresent ? 'text-emerald-400' : 'text-slate-400'}>
                  {diagnostic.env.apiBasePresent ? 'OK (impostato)' : 'Non impostato / default'}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Modelli sincronizzati: </span>
                <span className="tabular-nums text-slate-200">{diagnostic.catalog.modelsCount}</span>
              </p>
              {diagnostic.catalog.voicesCount !== undefined ? (
                <p>
                  <span className="text-slate-500">Voci sincronizzate: </span>
                  <span className="tabular-nums text-slate-200">{diagnostic.catalog.voicesCount}</span>
                </p>
              ) : null}
              {diagnostic.catalog.languagesCount !== undefined ? (
                <p>
                  <span className="text-slate-500">Lingue in catalogo: </span>
                  <span className="tabular-nums text-slate-200">{diagnostic.catalog.languagesCount}</span>
                </p>
              ) : null}
              {diagnostic.hints && diagnostic.hints.length > 0 ? (
                <div className="rounded border border-amber-500/35 bg-amber-950/25 px-1 py-0.5">
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/90">
                    Suggerimenti
                  </div>
                  <ul className="mt-0.5 list-inside list-disc text-[9px] text-amber-100/95">
                    {diagnostic.hints.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {diagnostic.errors.length > 0 ? (
                <div className="rounded border border-red-500/40 bg-red-950/30 px-1 py-0.5">
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-red-200/90">
                    Errori rilevati
                  </div>
                  <ul className="mt-0.5 list-inside list-disc text-[9px] text-red-100">
                    {diagnostic.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[10px] text-emerald-400/95">Nessun errore rilevato nel catalogo.</p>
              )}
            </div>
          ) : null}
        </div>
      </details>

      <details className="rounded border border-slate-700/80 bg-slate-950/40">
        <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
          Developer tools
          {devOverride ? (
            <span className="ml-1 rounded border border-amber-500/35 bg-amber-500/15 px-1 py-px text-[9px] uppercase text-amber-200">
              override
            </span>
          ) : null}
        </summary>
        <div className="flex flex-col gap-1 border-t border-slate-800 px-1.5 py-1">
          {config.platform === 'elevenlabs' ? (
            <ElevenLabsConvaiIdentitySection
              config={config}
              onChange={setConfig}
              onProvisionConvaiAgent={onProvisionConvaiAgent}
            />
          ) : null}
          {visibility.tools ? (
            <ToolsSection
              tools={config.tools}
              showOverrideBadge={devOverride}
              onChange={(tools) => setConfig({ ...config, tools })}
            />
          ) : null}
          {config.platform === 'elevenlabs' && visibility.tools ? (
            <BackendToolsSection
              config={config}
              showOverrideBadge={devOverride}
              catalogReloadNonce={catalogReloadNonce}
              onChange={setConfig}
            />
          ) : null}
          {config.platform === 'elevenlabs' ? (
            <VoiceRuntimeDeveloperJson config={config} onChange={setConfig} />
          ) : null}
          <AdvancedSection
            advanced={config.advanced ?? {}}
            showOverrideBadge={mode === 'override' && overrides.advancedSection}
            onChange={(advanced) => setConfig({ ...config, advanced })}
          />
        </div>
      </details>
    </div>
  );
}
