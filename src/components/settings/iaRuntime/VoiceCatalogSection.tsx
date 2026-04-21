/**
 * Voce ElevenLabs + lingua: due dropdown affiancati (catalogo residency); lingua default da progetto.
 */

import React from 'react';
import type { IAAgentConfig, IAAgentVoiceEntry } from 'types/iaAgentRuntimeSetup';
import {
  CatalogApiError,
  fetchCatalogLanguages,
  fetchCatalogVoices,
  type CatalogVoice,
} from '@services/iaCatalogApi';
import { getCurrentProjectLocale } from '@utils/categoryPresets';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import { VoicePicker } from './VoicePicker';
import { VoicePreviewProvider, useVoicePreview } from './VoicePreviewContext';
import { LocaleFlagEmoji } from './LocaleFlagEmoji';
import { FieldHint } from './FieldHint';

const TT = {
  voice:
    'Voce TTS ElevenLabs per l’agente. Influenza timbro e stile. Scegli dal catalogo sincronizzato sul server (residency/API allineate).',
  lang:
    'Lingua principale delle risposte vocali. Di default segue la lingua del progetto; cambia solo per eccezioni multilingua.',
} as const;

/** Messaggio guida sempre visibile (non solo tooltip). */
const GUIDE_COPY =
  'Lingua e voce delle risposte vocali: elenco dal catalogo sincronizzato sul server (API ElevenLabs / residency). La lingua parte da quella del progetto; la voce definisce il timbro — modifica solo se serve un’eccezione.';

export interface VoiceCatalogSectionProps {
  config: IAAgentConfig;
  showOverrideBadge?: boolean;
  onChange: (next: IAAgentConfig) => void;
  catalogReloadNonce?: number;
}

function ensureVoiceShape(c: IAAgentConfig): IAAgentVoiceEntry[] {
  const v = c.voice ?? { id: '', language: 'en', settings: {} };
  if (Array.isArray(c.voices) && c.voices.length > 0) {
    const hasPrimary = c.voices.some((x) => x.role === 'primary');
    if (!hasPrimary) {
      return [{ id: v.id, role: 'primary' }, ...c.voices];
    }
    return c.voices;
  }
  return [{ id: v.id, role: 'primary' }];
}

function setCompat(
  base: IAAgentConfig,
  entries: IAAgentVoiceEntry[],
  locale: string,
  voicePatch: Partial<NonNullable<IAAgentConfig['voice']>>
): IAAgentConfig {
  const primary = entries.find((e) => e.role === 'primary');
  const prev = base.voice ?? { id: '', language: 'en', settings: {} };
  const loc = locale.trim() || prev.language || 'en';
  return {
    ...base,
    voices: entries,
    voice: {
      ...prev,
      ...voicePatch,
      id: primary?.id ?? '',
      language: loc,
      languages: undefined,
    },
  };
}

/** Best BCP-47 / tag match against catalog locales. */
function resolveCatalogLocale(
  preferred: string,
  catalog: { locale: string }[]
): string | null {
  const p = preferred.trim().toLowerCase();
  if (!p) return null;
  const exact = catalog.find((c) => c.locale.toLowerCase() === p);
  if (exact) return exact.locale;
  const primary = p.split('-')[0];
  const byPrimary = catalog.find((c) => c.locale.toLowerCase().startsWith(primary));
  return byPrimary?.locale ?? null;
}

function VoiceRowPreviewControls({
  catalogBlocked,
  catalogVoices,
  primaryVoiceId,
  selectedLanguage,
  onVoiceChange,
}: {
  catalogBlocked: boolean;
  catalogVoices: CatalogVoice[];
  primaryVoiceId: string;
  selectedLanguage: string;
  onVoiceChange: (id: string) => void;
}) {
  const { playingVoiceId, togglePreview } = useVoicePreview();
  const hasPreview =
    Boolean(primaryVoiceId) && Boolean(catalogVoices.find((v) => v.voice_id === primaryVoiceId)?.preview_url);
  const isPlayingSelected = playingVoiceId === primaryVoiceId && Boolean(primaryVoiceId);

  return (
    <div className="flex min-w-0 flex-row items-center gap-0.5">
      <VoicePicker
        emptyTriggerLabel="Scegli la voce"
        listMaxClassName="min-w-[18rem] max-w-[28rem]"
        listScrollMaxHeightClassName="max-h-[min(42dvh,calc(100dvh-22rem),32rem)]"
        disabled={catalogBlocked || catalogVoices.length === 0}
        voices={catalogVoices}
        value={primaryVoiceId}
        selectedLanguage={selectedLanguage}
        platform="elevenlabs"
        onChange={onVoiceChange}
      />
      <button
        type="button"
        disabled={catalogBlocked || !hasPreview}
        title={isPlayingSelected ? 'Pausa' : 'Anteprima audio'}
        className="h-8 shrink-0 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[10px] leading-none text-slate-200 hover:border-violet-500 disabled:opacity-40"
        onClick={() => primaryVoiceId && togglePreview(primaryVoiceId)}
      >
        {isPlayingSelected ? '⏸' : '▶'}
      </button>
    </div>
  );
}

export function VoiceCatalogSection({
  config,
  showOverrideBadge,
  onChange,
  catalogReloadNonce = 0,
}: VoiceCatalogSectionProps) {
  const voice = config.voice ?? { id: '', language: 'en', settings: {} };
  const entries = React.useMemo(() => ensureVoiceShape(config), [config]);

  const primaryLang = voice.language || 'en';

  const [catalogVoices, setCatalogVoices] = React.useState<CatalogVoice[]>([]);
  const [catalogLangs, setCatalogLangs] = React.useState<{ locale: string; label: string }[]>([]);
  const [blockingError, setBlockingError] = React.useState<string | null>(null);
  const [infoLine, setInfoLine] = React.useState<string | null>(null);
  const bootstrapLangRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    setBlockingError(null);
    setInfoLine(null);

    (async () => {
      try {
        const [vr, lr] = await Promise.all([
          fetchCatalogVoices('elevenlabs', {
            language: primaryLang.trim() || undefined,
          }),
          fetchCatalogLanguages('elevenlabs'),
        ]);
        if (cancelled) return;

        if (!vr.applicable) {
          setCatalogVoices([]);
          setBlockingError(null);
          setInfoLine(vr.message ?? null);
          setCatalogLangs([]);
          return;
        }

        setCatalogVoices(vr.voices);

        if (!lr.applicable) {
          setCatalogLangs([]);
          setInfoLine(lr.message ?? null);
        } else {
          setCatalogLangs(lr.languages.map((x) => ({ locale: x.locale, label: x.label || x.locale })));
          setInfoLine(null);
        }

        if (!vr.voices.length) {
          setBlockingError(
            vr.message ??
              'Catalogo voci vuoto: imposta ELEVENLABS_API_KEY e POST /api/ia-catalog/refresh.'
          );
        }
      } catch (e) {
        if (cancelled) return;
        setCatalogVoices([]);
        setCatalogLangs([]);
        setBlockingError(
          e instanceof CatalogApiError ? e.message : String(e instanceof Error ? e.message : e)
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogReloadNonce, primaryLang]);

  /** Preseleziona lingua progetto quando il valore è ancora il default factory (`en`). */
  React.useEffect(() => {
    if (bootstrapLangRef.current || catalogLangs.length === 0) return;
    const current = config.voice?.language;
    if (current && current !== 'en') {
      bootstrapLangRef.current = true;
      return;
    }
    const project = getCurrentProjectLocale();
    const resolved = resolveCatalogLocale(project, catalogLangs);
    if (!resolved) {
      bootstrapLangRef.current = true;
      return;
    }
    bootstrapLangRef.current = true;
    onChange(setCompat(config, ensureVoiceShape(config), resolved, {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap una tantum al caricamento catalogo lingue
  }, [catalogLangs, catalogReloadNonce]);

  const catalogBlocked = Boolean(blockingError) || catalogVoices.length === 0;

  const langOptions: SearchableSelectOption<string>[] = React.useMemo(() => {
    return catalogLangs.map((l) => ({
      value: l.locale,
      label: l.label,
      decorator: <LocaleFlagEmoji locale={l.locale} />,
    }));
  }, [catalogLangs]);

  const primary = entries.find((e) => e.role === 'primary') ?? { id: '', role: 'primary' as const };

  const projectLocaleLabel = React.useMemo(() => getCurrentProjectLocale(), []);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row flex-wrap items-center gap-1">
        <span className="text-[11px] font-semibold leading-none tracking-wide text-slate-200">
          Lingua e voce
        </span>
        {showOverrideBadge ? (
          <span className="rounded border border-amber-500/35 bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-200">
            override
          </span>
        ) : null}
      </div>
      <p className="max-w-[42rem] text-[10px] leading-snug text-slate-300">{GUIDE_COPY}</p>
      <div className="flex flex-col gap-0.5">
        {blockingError ? (
          <div className="rounded border border-red-500/50 bg-red-950/40 px-1 py-0.5 text-[9px] leading-tight text-red-100">
            {blockingError}
          </div>
        ) : null}

        {!blockingError && infoLine ? (
          <div className="rounded border border-slate-600 bg-slate-950/80 px-1 py-0.5 text-[9px] leading-tight text-slate-400">
            {infoLine}
          </div>
        ) : null}

        <div
          className={`grid w-full max-w-3xl grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 ${catalogBlocked ? 'pointer-events-none opacity-40' : ''}`}
        >
          <FieldHint variant="clear" label="Lingua" tooltip={TT.lang} className="min-w-0">
            <SearchableSelect
              emptyTriggerLabel={
                langOptions.length
                  ? 'Scegli la lingua'
                  : `Lingua progetto (default): ${projectLocaleLabel}`
              }
              listMaxClassName="min-w-[18rem] max-w-[28rem]"
              disabled={catalogBlocked || !langOptions.length}
              options={langOptions}
              value={primaryLang || ''}
              onChange={(locale) => {
                onChange(setCompat(config, entries, locale, {}));
              }}
            />
          </FieldHint>

          <FieldHint variant="clear" label="Voce" tooltip={TT.voice} className="min-w-0">
            <VoicePreviewProvider voices={catalogVoices}>
              <VoiceRowPreviewControls
                catalogBlocked={catalogBlocked}
                catalogVoices={catalogVoices}
                primaryVoiceId={primary.id || ''}
                selectedLanguage={primaryLang}
                onVoiceChange={(id) => {
                  const next = entries.map((e) => (e.role === 'primary' ? { ...e, id } : e));
                  onChange(setCompat(config, next, primaryLang, {}));
                }}
              />
            </VoicePreviewProvider>
          </FieldHint>
        </div>
      </div>
    </div>
  );
}

/**
 * Editor JSON `voice.settings` — solo accordion Developer Tools.
 */
export function VoiceRuntimeDeveloperJson({
  config,
  onChange,
}: {
  config: IAAgentConfig;
  onChange: (next: IAAgentConfig) => void;
}) {
  const voice = config.voice ?? { id: '', language: 'en', settings: {} };
  const entries = ensureVoiceShape(config);
  const selectedLocales = voice.language ? [voice.language] : ['en'];
  const settingsStr = JSON.stringify(voice.settings ?? {}, null, 2);

  return (
    <FieldHint
      label="voice.settings (JSON)"
      tooltip="Override tecnici sulla configurazione voce ConvAI. Solo per integrazioni avanzate."
      className="max-w-[min(100%,280px)]"
    >
      <textarea
        rows={4}
        className="w-full resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] leading-snug text-slate-100"
        value={settingsStr}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (!t) {
            onChange(setCompat(config, entries, selectedLocales[0], { settings: {} }));
            return;
          }
          try {
            const parsed = JSON.parse(t) as unknown;
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
              onChange(
                setCompat(config, entries, selectedLocales[0], {
                  settings: parsed as Record<string, unknown>,
                })
              );
            }
          } catch {
            /* editing */
          }
        }}
      />
    </FieldHint>
  );
}
