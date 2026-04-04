import { describe, expect, it } from 'vitest';
import { getVariableLabel } from '../getVariableLabel';
import { makeTranslationKey } from '../translationKeys';

const VID = 'a0000000-0000-4000-8000-000000000099';

describe('getVariableLabel', () => {
  it('returns trimmed translation when key exists', () => {
    expect(getVariableLabel(VID, { [makeTranslationKey('variable', VID)]: '  Etichetta  ' })).toBe('Etichetta');
  });

  it('returns empty string when key missing and no fallback', () => {
    expect(getVariableLabel(VID, {})).toBe('');
  });

  it('uses fallback when key missing', () => {
    expect(getVariableLabel(VID, {}, 'fb')).toBe('fb');
  });

  it('returns fallback for empty id', () => {
    expect(getVariableLabel('', { x: 'y' }, 'fb')).toBe('fb');
  });

  it('treats undefined or null translations as empty map', () => {
    expect(getVariableLabel(VID, undefined)).toBe('');
    expect(getVariableLabel(VID, null)).toBe('');
    expect(getVariableLabel(VID, undefined, 'fb')).toBe('fb');
  });

  it('rejects non-uuid id without fallback', () => {
    expect(getVariableLabel('not-a-uuid', {})).toBe('');
  });
});
