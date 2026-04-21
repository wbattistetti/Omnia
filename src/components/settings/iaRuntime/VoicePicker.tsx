/**
 * Selettore voce: filtri dinamici per piattaforma, anteprima audio condivisa, metadati normalizzati.
 */

import React from 'react';
import type { CatalogVoice } from '@services/iaCatalogApi';
import { useVoicePreview } from './VoicePreviewContext';
import { VoicePickerFilterBar } from './VoicePickerFilterBar';
import {
  buildVoiceDescriptionBlock,
  catalogVoiceToMetadata,
  emptyVoicePanelFilters,
  voiceMatchesLanguageTag,
  type VoicePanelFilters,
} from '@types/voiceMetadata';

export interface VoicePickerProps {
  voices: CatalogVoice[];
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  emptyTriggerLabel?: string;
  listMaxClassName?: string;
  listScrollMaxHeightClassName?: string;
  /** Lingua selezionata nel form (BCP‑47): filtra voci compatibili. */
  selectedLanguage?: string;
  /** Piattaforma TTS per capability filtri (default elevenlabs). */
  platform?: string;
}

function normalizeGender(raw: string | null | undefined): 'male' | 'female' | 'unknown' {
  const g = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (g === 'male' || g === 'm') return 'male';
  if (g === 'female' || g === 'f') return 'female';
  return 'unknown';
}

function nameTextClass(gender: 'male' | 'female' | 'unknown'): string {
  if (gender === 'male') return 'text-blue-400';
  if (gender === 'female') return 'text-pink-400';
  return 'text-gray-300';
}

function VoiceGenderIcon({ gender }: { gender: 'male' | 'female' | 'unknown' }) {
  const cls = 'h-4 w-4 shrink-0';
  if (gender === 'male') {
    return (
      <svg className={`${cls} text-blue-400`} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M7 20c0-2.8 2.2-5 5-5s5 2.2 5 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (gender === 'female') {
    return (
      <svg className={`${cls} text-pink-400`} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 20c0-2.2 1.8-4 4-4s4 1.8 4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className={`${cls} text-gray-300`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7 20c0-2.8 2.2-5 5-5s5 2.2 5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function matchesPanel(cv: CatalogVoice, platform: string, panel: VoicePanelFilters): boolean {
  const m = catalogVoiceToMetadata(cv, platform);
  if (panel.language && (m.language || '') !== panel.language) return false;
  if (panel.accent && (m.accent || '') !== panel.accent) return false;
  if (panel.category && (m.category || '') !== panel.category) return false;
  if (panel.gender) {
    const pg = panel.gender.toLowerCase();
    const mg = (m.gender || '').toLowerCase();
    if (mg !== pg) return false;
  }
  if (panel.age_group && (m.age_group || '') !== panel.age_group) return false;
  if (panel.style && (m.style || '') !== panel.style) return false;
  return true;
}

export function VoicePicker({
  voices,
  value,
  onChange,
  disabled = false,
  emptyTriggerLabel = 'Scegli la voce',
  listMaxClassName = 'min-w-[18rem] max-w-[28rem]',
  listScrollMaxHeightClassName = 'max-h-[min(42dvh,calc(100dvh-22rem),32rem)]',
  selectedLanguage,
  platform = 'elevenlabs',
}: VoicePickerProps) {
  const { playingVoiceId, togglePreview } = useVoicePreview();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const [panel, setPanel] = React.useState<VoicePanelFilters>(() => emptyVoicePanelFilters());
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const filteredVoices = React.useMemo(() => {
    let out = [...voices];

    if (selectedLanguage?.trim()) {
      out = out.filter((v) => voiceMatchesLanguageTag(v.language ?? null, selectedLanguage));
    }

    out = out.filter((v) => matchesPanel(v, platform, panel));

    const f = filter.trim().toLowerCase();
    if (f) {
      out = out.filter((v) => {
        const blob = `${v.name || ''} ${buildVoiceDescriptionBlock(v) || ''}`.toLowerCase();
        return blob.includes(f) || String(v.voice_id || '').toLowerCase().includes(f);
      });
    }

    out.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
    return out;
  }, [voices, selectedLanguage, panel, platform, filter]);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = voices.find((v) => v.voice_id === value);
  const selectedGender = normalizeGender(selected?.gender);
  const showEmptyHint =
    Boolean(emptyTriggerLabel) &&
    (value === '' || value === null || value === undefined || !selected);

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${listMaxClassName}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex h-8 max-h-[32px] w-full min-w-0 items-center justify-between gap-1 rounded border border-slate-600 bg-slate-950 px-2 py-0.5 text-left text-[11px] leading-none ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${showEmptyHint ? 'text-slate-500 italic' : ''}`}
      >
        <span className="inline-flex min-w-0 flex-1 items-center gap-1 truncate">
          {showEmptyHint ? (
            emptyTriggerLabel
          ) : (
            <>
              <VoiceGenderIcon gender={selectedGender} />
              <span className={`truncate font-mono ${nameTextClass(selectedGender)}`}>
                {selected?.name ?? '—'}
              </span>
            </>
          )}
        </span>
        <span className="shrink-0 text-slate-500">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div
          className={`absolute left-0 top-full z-40 mt-0.5 flex min-w-[12rem] flex-col rounded border border-violet-500/40 bg-slate-950 shadow-lg ${listMaxClassName}`}
        >
          <input
            type="text"
            autoFocus
            placeholder="Cerca…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 max-h-[32px] shrink-0 border-b border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] leading-none text-slate-100 outline-none ring-0 placeholder:text-slate-600"
          />
          <div className="shrink-0 px-1 pt-1">
            <VoicePickerFilterBar
              platform={platform}
              voices={voices}
              panel={panel}
              onPanelChange={setPanel}
            />
          </div>
          <ul
            className={`min-h-0 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.5)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/70 ${listScrollMaxHeightClassName}`}
          >
            {filteredVoices.map((cv) => {
              const g = normalizeGender(cv.gender);
              const url = cv.preview_url;
              const isPlayingRow = playingVoiceId === cv.voice_id;
              const desc = buildVoiceDescriptionBlock(cv);
              return (
                <li key={cv.voice_id} className="border-b border-slate-800/60 last:border-b-0">
                  <div className="flex flex-col gap-0.5 py-1 pl-2 pr-2 hover:bg-violet-900/40">
                    <div className="flex flex-row items-center gap-2">
                      <VoiceGenderIcon gender={g} />
                      <button
                        type="button"
                        className={`min-w-0 flex-1 truncate text-left font-mono text-[11px] leading-none ${nameTextClass(g)}`}
                        onClick={() => {
                          onChange(cv.voice_id);
                          setOpen(false);
                          setFilter('');
                        }}
                      >
                        {cv.name}
                      </button>
                      <button
                        type="button"
                        title={isPlayingRow ? 'Pausa' : 'Anteprima'}
                        disabled={!url}
                        className="shrink-0 rounded px-0.5 text-[10px] leading-none text-slate-300 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-30"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePreview(cv.voice_id);
                        }}
                      >
                        {isPlayingRow ? '⏸' : '▶'}
                      </button>
                    </div>
                    {desc ? (
                      <div className="pl-6 text-xs leading-tight text-gray-400 whitespace-pre-line">
                        {desc}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {filteredVoices.length === 0 ? (
              <li className="px-2 py-1 text-[10px] text-slate-500">Nessun risultato</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
