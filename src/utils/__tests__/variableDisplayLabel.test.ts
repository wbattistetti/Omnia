import { describe, expect, it } from 'vitest';
import { resolveVariableMenuLabel } from '../variableDisplayLabel';
import { makeTranslationKey } from '../translationKeys';

describe('resolveVariableMenuLabel', () => {
  const guid = '11111111-1111-4111-8111-111111111111';
  const vkey = makeTranslationKey('variable', guid);

  it('uses translation for utterance GUID when present', () => {
    const set = new Set([guid]);
    expect(
      resolveVariableMenuLabel(guid, 'fallback.name', {
        utteranceGuidSet: set,
        translationsByGuid: { [vkey]: 'Etichetta UI' },
      })
    ).toBe('Etichetta UI');
  });

  it('uses varName fallback when translation missing', () => {
    const set = new Set([guid]);
    expect(
      resolveVariableMenuLabel(guid, 'nome.dotted', {
        utteranceGuidSet: set,
        translationsByGuid: {},
      })
    ).toBe('nome.dotted');
  });

  it('uses translation for any GUID when present in the table', () => {
    const set = new Set<string>();
    expect(
      resolveVariableMenuLabel(guid, 'solo.var', {
        utteranceGuidSet: set,
        translationsByGuid: { [vkey]: 'From translations' },
      })
    ).toBe('From translations');
  });
});
