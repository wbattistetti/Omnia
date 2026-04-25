import { describe, expect, it } from 'vitest';
import {
  effectiveAllowedForLocale,
  mergeNonEnLocalesFromCatalogAndMapping,
  pickDefaultLocaleForElevenLabsMappingFromFile,
} from '../elevenLabsLlmMappingLocale';
import type { LlmMappingPayload } from '@services/iaCatalogApi';

describe('pickDefaultLocaleForElevenLabsMappingFromFile', () => {
  it('prefers locale with more saved model ids', () => {
    const per = {
      it: ['eleven_flash_v2_5'],
      'it-IT': ['eleven_flash_v2_5', 'eleven_turbo_v2', 'gemini-2.0-flash'],
    };
    expect(pickDefaultLocaleForElevenLabsMappingFromFile(['it', 'it-IT'], per)).toBe('it-IT');
  });

  it('uses first catalog key when perLanguage empty for all', () => {
    expect(pickDefaultLocaleForElevenLabsMappingFromFile(['it', 'it-IT'], {})).toBe('it');
  });

  it('defaults to it-IT when catalog locale list is empty', () => {
    expect(pickDefaultLocaleForElevenLabsMappingFromFile([], {})).toBe('it-IT');
  });

  it('prefers it-IT in pick when file has models only under it-IT but catalog lists it', () => {
    const per = { 'it-IT': ['m1', 'm2'], it: [] };
    const merged = mergeNonEnLocalesFromCatalogAndMapping([{ locale: 'it', label: 'Italian' }], per).map(
      (x) => x.locale
    );
    expect(merged).toContain('it');
    expect(merged).toContain('it-IT');
    expect(pickDefaultLocaleForElevenLabsMappingFromFile(merged, per)).toBe('it-IT');
  });
});

describe('mergeNonEnLocalesFromCatalogAndMapping', () => {
  it('adds perLanguage locales missing from catalog', () => {
    const out = mergeNonEnLocalesFromCatalogAndMapping([{ locale: 'it', label: 'Italian' }], {
      'it-IT': ['a'],
    });
    const locales = out.map((x) => x.locale).sort();
    expect(locales).toEqual(['it', 'it-IT']);
  });

  it('returns it-IT fallback when catalog and file have no non-en locales', () => {
    const out = mergeNonEnLocalesFromCatalogAndMapping([], {});
    expect(out).toEqual([{ locale: 'it-IT', label: 'Italiano (it-IT)' }]);
  });
});

describe('effectiveAllowedForLocale', () => {
  it('uses full locale before primary', () => {
    const m: LlmMappingPayload = {
      elevenlabs: {
        nonEnglishAllowedModels: ['a'],
        perLanguage: { it: ['x'], 'it-IT': ['y'] },
      },
    };
    expect(effectiveAllowedForLocale(m, 'it-IT')).toEqual(['y']);
    expect(effectiveAllowedForLocale(m, 'it')).toEqual(['x']);
  });

  it('does not fall back when perLanguage key exists but array is empty', () => {
    const m: LlmMappingPayload = {
      elevenlabs: {
        nonEnglishAllowedModels: ['a', 'b'],
        perLanguage: { 'it-IT': [], it: ['x'] },
      },
    };
    expect(effectiveAllowedForLocale(m, 'it-IT')).toEqual([]);
  });

  it('maps voice language it to it-IT entry when there is no explicit it key', () => {
    const m: LlmMappingPayload = {
      elevenlabs: {
        nonEnglishAllowedModels: ['fallback'],
        perLanguage: { 'it-IT': ['gemini-2.0-flash'] },
      },
    };
    expect(effectiveAllowedForLocale(m, 'it')).toEqual(['gemini-2.0-flash']);
  });
});
