import { describe, expect, it } from 'vitest';
import { getVariableLabel } from '../getVariableLabel';

describe('getVariableLabel', () => {
  it('returns trimmed translation when key exists', () => {
    expect(getVariableLabel('a-guid', { 'a-guid': '  Etichetta  ' })).toBe('Etichetta');
  });

  it('returns empty string when key missing and no fallback', () => {
    expect(getVariableLabel('x', {})).toBe('');
  });

  it('uses fallback when key missing', () => {
    expect(getVariableLabel('x', {}, 'fb')).toBe('fb');
  });

  it('returns fallback for empty id', () => {
    expect(getVariableLabel('', { x: 'y' }, 'fb')).toBe('fb');
  });

  it('treats undefined or null translations as empty map', () => {
    expect(getVariableLabel('x', undefined)).toBe('');
    expect(getVariableLabel('x', null)).toBe('');
    expect(getVariableLabel('x', undefined, 'fb')).toBe('fb');
  });
});
