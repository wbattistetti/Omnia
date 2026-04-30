import { describe, it, expect } from 'vitest';
import {
  mergeFileLlmMappingWithProjectEmbedded,
  OMNIA_PROJECT_ELEVENLABS_LLM_MAPPING_KEY,
  parseProjectElevenLabsLlmMapping,
  resolveProjectLlmAllowlistForLocale,
} from '../omniaProjectElevenLabsLlmMapping';
import type { LlmMappingPayload } from '@services/iaCatalogApi';

const file: LlmMappingPayload = {
  elevenlabs: {
    nonEnglishAllowedModels: ['a', 'b'],
    perLanguage: { 'it-IT': ['x'] },
  },
};

describe('parseProjectElevenLabsLlmMapping', () => {
  it('legge da advanced', () => {
    const p = parseProjectElevenLabsLlmMapping({
      [OMNIA_PROJECT_ELEVENLABS_LLM_MAPPING_KEY]: {
        elevenlabs: {
          nonEnglishAllowedModels: ['m1'],
          perLanguage: { 'it-IT': ['m2'] },
        },
      },
    });
    expect(p?.elevenlabs.perLanguage['it-IT']).toEqual(['m2']);
  });

  it('ritorna null se assente', () => {
    expect(parseProjectElevenLabsLlmMapping({})).toBeNull();
  });
});

describe('mergeFileLlmMappingWithProjectEmbedded', () => {
  it('sovrascrive perLanguage con il progetto', () => {
    const emb: LlmMappingPayload = {
      elevenlabs: {
        nonEnglishAllowedModels: [],
        perLanguage: { 'it-IT': ['gemini-2.0-flash'] },
      },
    };
    const m = mergeFileLlmMappingWithProjectEmbedded(file, emb);
    expect(m.elevenlabs.perLanguage['it-IT']).toEqual(['gemini-2.0-flash']);
  });
});

describe('resolveProjectLlmAllowlistForLocale', () => {
  const project: LlmMappingPayload = {
    elevenlabs: {
      nonEnglishAllowedModels: ['should-not-use'],
      perLanguage: { 'it-IT': ['gemini-2.5-flash'] },
    },
  };

  it('ritorna null senza mapping o lingua', () => {
    expect(resolveProjectLlmAllowlistForLocale(null, 'it-IT')).toBeNull();
    expect(resolveProjectLlmAllowlistForLocale(project, undefined)).toBeNull();
  });

  it('ritorna null per en (catalogo intero)', () => {
    expect(resolveProjectLlmAllowlistForLocale(project, 'en')).toBeNull();
  });

  it('usa solo perLanguage per it-IT; ignora nonEnglishAllowedModels', () => {
    expect(resolveProjectLlmAllowlistForLocale(project, 'it-IT')).toEqual(['gemini-2.5-flash']);
  });

  it('array vuoto per lingua ⇒ null (catalogo intero)', () => {
    const empty: LlmMappingPayload = {
      elevenlabs: { nonEnglishAllowedModels: [], perLanguage: { 'it-IT': [] } },
    };
    expect(resolveProjectLlmAllowlistForLocale(empty, 'it-IT')).toBeNull();
  });
});
