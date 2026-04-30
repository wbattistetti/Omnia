/**
 * LLM mapping ElevenLabs persistito nel progetto (`IAAgentConfig.advanced`), non solo in llmMapping.json.
 */

import type { LlmMappingPayload } from '@services/iaCatalogApi';
import { primaryLang } from '@utils/iaCatalog/elevenLabsLlmMappingLocale';

export const OMNIA_PROJECT_ELEVENLABS_LLM_MAPPING_KEY = 'omniaProjectElevenLabsLlmMapping';

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export function parseProjectElevenLabsLlmMapping(
  advanced: unknown
): LlmMappingPayload | null {
  if (!isRecord(advanced)) return null;
  const raw = advanced[OMNIA_PROJECT_ELEVENLABS_LLM_MAPPING_KEY];
  if (!isRecord(raw)) return null;
  const el = raw.elevenlabs;
  if (!isRecord(el)) return null;
  const nonEnglishAllowedModels = Array.isArray(el.nonEnglishAllowedModels)
    ? (el.nonEnglishAllowedModels as unknown[]).map((x) => String(x))
    : [];
  const per: Record<string, string[]> = {};
  const perLanguage = el.perLanguage;
  if (perLanguage && typeof perLanguage === 'object' && !Array.isArray(perLanguage)) {
    for (const [k, v] of Object.entries(perLanguage as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      per[k] = v.map((x) => String(x).trim()).filter(Boolean);
    }
  }
  return {
    elevenlabs: {
      nonEnglishAllowedModels,
      perLanguage: per,
    },
  };
}

function normalizeModelIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((x) => String(x).trim()).filter(Boolean))];
}

/**
 * Solo `omniaProjectElevenLabsLlmMapping`: se per la lingua dell'agente c'è un elenco **non vuoto** in
 * `perLanguage`, quella lista filtra la combo LLM. Altrimenti `null` = nessun filtro (catalogo intero).
 * Nessun merge con file server-side né fallback a `nonEnglishAllowedModels`.
 */
export function resolveProjectLlmAllowlistForLocale(
  projectMapping: LlmMappingPayload | null,
  agentLanguage: string | undefined
): string[] | null {
  if (!projectMapping?.elevenlabs || !agentLanguage?.trim()) return null;
  const full = agentLanguage.trim();
  if (primaryLang(full) === 'en') return null;
  const { perLanguage } = projectMapping.elevenlabs;
  if (Object.prototype.hasOwnProperty.call(perLanguage, full)) {
    const arr = normalizeModelIdList(perLanguage[full]);
    return arr.length > 0 ? arr : null;
  }
  const p = primaryLang(full);
  if (Object.prototype.hasOwnProperty.call(perLanguage, p)) {
    const arr = normalizeModelIdList(perLanguage[p]);
    return arr.length > 0 ? arr : null;
  }
  const samePrimary = Object.keys(perLanguage).filter((k) => primaryLang(k) === p);
  if (samePrimary.length > 0) {
    samePrimary.sort((a, b) => {
      const ra = a.split('-').filter(Boolean).length;
      const rb = b.split('-').filter(Boolean).length;
      if (rb !== ra) return rb - ra;
      return b.length - a.length;
    });
    const arr = normalizeModelIdList(perLanguage[samePrimary[0]]);
    return arr.length > 0 ? arr : null;
  }
  return null;
}

/**
 * Unisce file catalogo con mapping salvato nel progetto: il progetto vince sulle chiavi `perLanguage`
 * e su `nonEnglishAllowedModels` se valorizzato.
 */
export function mergeFileLlmMappingWithProjectEmbedded(
  file: LlmMappingPayload,
  embedded: LlmMappingPayload | null
): LlmMappingPayload {
  if (!embedded?.elevenlabs) return file;
  const e = embedded.elevenlabs;
  return {
    elevenlabs: {
      nonEnglishAllowedModels:
        Array.isArray(e.nonEnglishAllowedModels) && e.nonEnglishAllowedModels.length > 0
          ? [...e.nonEnglishAllowedModels]
          : [...file.elevenlabs.nonEnglishAllowedModels],
      perLanguage: {
        ...file.elevenlabs.perLanguage,
        ...e.perLanguage,
      },
    },
  };
}
