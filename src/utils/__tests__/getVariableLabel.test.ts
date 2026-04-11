import { describe, expect, it } from 'vitest';
import { getVariableLabel } from '../getVariableLabel';
import { makeTranslationKey } from '../translationKeys';

const VID = 'a0000000-0000-4000-8000-000000000099';

describe('getVariableLabel', () => {
  it('returns trimmed translation when key exists', () => {
    expect(getVariableLabel(VID, { [makeTranslationKey('var', VID)]: '  Etichetta  ' })).toBe('Etichetta');
  });

  it('returns guid when key missing', () => {
    expect(getVariableLabel(VID, {})).toBe(VID);
  });

  it('returns empty string for empty id', () => {
    expect(getVariableLabel('', { x: 'y' })).toBe('');
  });

  it('treats undefined or null translations as empty map', () => {
    expect(getVariableLabel(VID, undefined)).toBe(VID);
    expect(getVariableLabel(VID, null)).toBe(VID);
  });

  it('rejects non-uuid id', () => {
    expect(getVariableLabel('not-a-uuid', {})).toBe('');
  });
});
