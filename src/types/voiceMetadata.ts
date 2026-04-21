/**
 * Metadati voce normalizzati multi‑piattaforma e capacità filtri per provider.
 */

import type { CatalogVoice } from '../services/iaCatalogApi';

export interface VoiceMetadata {
  id: string;
  name: string;
  language?: string;
  accent?: string;
  category?: string;
  gender?: string;
  age_group?: string;
  style?: string;
  tags?: string[] | undefined;
  preview_url?: string | null;
  provider: string;
  /** Testo descrittivo multi‑riga (nome escluso) */
  description?: string;
}

export interface VoiceFilterCapabilities {
  language?: boolean;
  accent?: boolean;
  category?: boolean;
  gender?: boolean;
  age_group?: boolean;
  style?: boolean;
}

export const PLATFORM_FILTER_CAPABILITIES: Record<string, VoiceFilterCapabilities> = {
  elevenlabs: {
    language: true,
    accent: true,
    category: true,
    gender: true,
    age_group: true,
    style: true,
  },
  openai: {
    language: true,
  },
  azure: {
    language: true,
    gender: true,
    accent: true,
  },
  google: {
    language: true,
    gender: true,
    accent: true,
  },
};

/** Valori unici ordinati (stringhe). */
export function uniqueSortedStrings(values: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) s.add(v.trim());
  }
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function readRawLabels(cv: { raw?: Record<string, unknown> }): Record<string, unknown> {
  const raw = cv.raw && typeof cv.raw === 'object' ? cv.raw : {};
  const labels = (raw as { labels?: unknown }).labels;
  return labels && typeof labels === 'object' ? (labels as Record<string, unknown>) : {};
}

/**
 * Costruisce il blocco descrittivo sotto il nome (description / voice_description / style; opz. tags).
 */
export function buildVoiceDescriptionBlock(cv: CatalogVoice): string | undefined {
  const labels = readRawLabels(cv);
  const primary =
    (typeof cv.description === 'string' && cv.description.trim()) ||
    (typeof cv.voice_description === 'string' && cv.voice_description.trim()) ||
    (typeof labels.voice_description === 'string' && labels.voice_description.trim()) ||
    (typeof labels.description === 'string' && labels.description.trim()) ||
    '';
  const styleLine =
    (typeof cv.style === 'string' && cv.style.trim()) ||
    (typeof labels.style === 'string' && labels.style.trim()) ||
    '';
  const lines: string[] = [];
  if (primary) lines.push(primary);
  if (styleLine && styleLine !== primary) lines.push(styleLine);
  if (Array.isArray(cv.tags) && cv.tags.length > 0) {
    const tagStr = cv.tags.filter(Boolean).join(', ');
    if (tagStr) lines.push(tagStr);
  }
  const text = lines.join('\n').trim();
  return text || undefined;
}

/** Mappa CatalogVoice API → VoiceMetadata (include raw.labels). */
export function catalogVoiceToMetadata(cv: CatalogVoice, providerFallback = 'elevenlabs'): VoiceMetadata {
  const labels = readRawLabels(cv);
  const accent =
    (typeof cv.accent === 'string' && cv.accent) ||
    (typeof labels.accent === 'string' && labels.accent) ||
    undefined;
  const age_group =
    (typeof cv.age_group === 'string' && cv.age_group) ||
    (typeof labels.age === 'string' && labels.age) ||
    (typeof labels.age_group === 'string' && labels.age_group) ||
    undefined;
  const style =
    (typeof cv.style === 'string' && cv.style) ||
    (typeof labels.style === 'string' && labels.style) ||
    undefined;

  return {
    id: cv.voice_id,
    name: cv.name,
    language: cv.language ?? undefined,
    accent,
    category: cv.category ?? undefined,
    gender: cv.gender ?? undefined,
    age_group,
    style,
    tags: cv.tags,
    preview_url: cv.preview_url ?? null,
    provider: typeof cv.provider === 'string' && cv.provider ? cv.provider : providerFallback,
    description: buildVoiceDescriptionBlock(cv),
  };
}

/** Lingua progetto vs lingua voce (es. it-IT vs it). */
export function voiceMatchesLanguageTag(
  voiceLang: string | null | undefined,
  selectedLocale: string | null | undefined
): boolean {
  if (!selectedLocale || !String(selectedLocale).trim()) return true;
  if (!voiceLang || voiceLang === 'und') return false;
  const v = voiceLang.trim().toLowerCase();
  const s = selectedLocale.trim().toLowerCase();
  const prefix = s.split('-')[0];
  return v === s || v.startsWith(`${prefix}-`) || v === prefix;
}

export interface VoicePanelFilters {
  language: string;
  accent: string;
  category: string;
  gender: string;
  age_group: string;
  style: string;
}

export function emptyVoicePanelFilters(): VoicePanelFilters {
  return {
    language: '',
    accent: '',
    category: '',
    gender: '',
    age_group: '',
    style: '',
  };
}
