import { resolveScopedTtsModelIds } from '../ttsLanguageModelMap';

describe('resolveScopedTtsModelIds', () => {
  it('returns null when no locale or no map', () => {
    expect(resolveScopedTtsModelIds(undefined, 'it-IT')).toBeNull();
    expect(resolveScopedTtsModelIds({}, '')).toBeNull();
  });

  it('resolves full locale first', () => {
    const map = { 'it-IT': ['eleven_flash_v2_5'], it: ['eleven_v3'] };
    expect(resolveScopedTtsModelIds(map, 'it-IT')).toEqual(['eleven_flash_v2_5']);
  });

  it('falls back to primary locale', () => {
    const map = { it: ['eleven_v3', 'eleven_v3'] };
    expect(resolveScopedTtsModelIds(map, 'it-CH')).toEqual(['eleven_v3']);
  });

  it('prefers primary key before same-primary variants', () => {
    const map = { 'pt-BR': ['a'], 'pt-PT': ['b'], pt: ['c'] };
    expect(resolveScopedTtsModelIds(map, 'pt-AO')).toEqual(['c']);
  });
});
