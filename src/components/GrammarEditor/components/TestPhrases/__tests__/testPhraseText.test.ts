import { describe, it, expect } from 'vitest';
import { normalizePhraseForDedup } from '../testPhraseText';

describe('normalizePhraseForDedup', () => {
  it('trims and lowercases', () => {
    expect(normalizePhraseForDedup('  Hello  ')).toBe('hello');
  });

  it('treats case variants as same', () => {
    expect(normalizePhraseForDedup('Walter')).toBe(normalizePhraseForDedup('walter'));
  });
});
