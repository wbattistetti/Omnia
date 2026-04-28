/**
 * LLM mapping ElevenLabs persistito nel progetto (`IAAgentConfig.advanced`), non solo in llmMapping.json.
 */

import type { LlmMappingPayload } from '@services/iaCatalogApi';

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
