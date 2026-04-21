/**
 * Runtime IA agent motors: configurabile come default globale o override per task (mode).
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, Cpu, Globe2, Mic, Sparkles } from 'lucide-react';
import type { IAAgentConfig, IAAgentPlatform } from 'types/iaAgentRuntimeSetup';
import {
  computeSectionOverrides,
  type SectionOverrideFlags,
} from '@utils/iaAgentRuntime/overrideFields';
import { getDefaultConfig, getVisibleFields } from '@utils/iaAgentRuntime/platformHelpers';
import { ModelSection } from './iaRuntime/ModelSection';
import { ToolsSection } from './iaRuntime/ToolsSection';
import {
  VoiceCatalogSection,
  VoiceRuntimeDeveloperJson,
} from './iaRuntime/VoiceCatalogSection';
import { AdvancedSection } from './iaRuntime/AdvancedSection';

export interface IAAgentSetupProps {
  defaultConfig?: IAAgentConfig;
  value?: IAAgentConfig;
  onChange?: (config: IAAgentConfig) => void;
  mode?: 'global' | 'override';
  /** Incrementato dopo sync catalogo sul server → rifetch voci/lingue. */
  catalogReloadNonce?: number;
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

export function IAAgentSetup({
  defaultConfig,
  value,
  onChange,
  mode = 'global',
  catalogReloadNonce = 0,
}: IAAgentSetupProps) {
  const [inner, setInner] = React.useState<IAAgentConfig>(() =>
    value !== undefined ? value : getDefaultConfig('openai')
  );

  React.useEffect(() => {
    if (value !== undefined) {
      setInner(value);
    }
  }, [value]);

  const config = value !== undefined ? value : inner;

  const setConfig = React.useCallback(
    (next: IAAgentConfig) => {
      if (value === undefined) {
        setInner(next);
      }
      onChange?.(next);
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

  return (
    <div className="flex flex-col gap-1 text-slate-100">
      <ModelSection
        config={config}
        visibility={visibility}
        showOverrideBadge={mode === 'override' && overrides.modelSection}
        onChange={setConfig}
        catalogReloadNonce={catalogReloadNonce}
        platformSlot={platformSlot}
        afterParamRow={
          visibility.voice && config.platform === 'elevenlabs' ? (
            <VoiceCatalogSection
              config={config}
              showOverrideBadge={mode === 'override' && overrides.voiceSection}
              onChange={setConfig}
              catalogReloadNonce={catalogReloadNonce}
            />
          ) : null
        }
      />

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
          {visibility.tools ? (
            <ToolsSection
              tools={config.tools}
              showOverrideBadge={mode === 'override' && overrides.toolsSection}
              onChange={(tools) => setConfig({ ...config, tools })}
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
