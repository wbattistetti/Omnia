import { describe, expect, it } from 'vitest';
import { measureSource } from '../AutosizeOneLineInput';

describe('measureSource', () => {
  it('pads value when non-empty but shorter than minChars', () => {
    expect(measureSource('abc', 'ph', 4)).toBe('abc\u00a0');
  });

  it('uses full value when at least minChars', () => {
    expect(measureSource('abcd', 'ph', 4)).toBe('abcd');
  });

  it('pads value to minChars', () => {
    expect(measureSource('ab', '', 4)).toBe('ab\u00a0\u00a0');
  });

  it('uses placeholder when value empty', () => {
    expect(measureSource('', 'Variabile', 4)).toBe('Variabile');
  });

  it('pads placeholder when shorter than minChars', () => {
    expect(measureSource('', 'ab', 4)).toBe('ab\u00a0\u00a0');
  });

  it('pads with nbsp when both empty', () => {
    expect(measureSource('', undefined, 4)).toBe('\u00a0\u00a0\u00a0\u00a0');
  });
});
