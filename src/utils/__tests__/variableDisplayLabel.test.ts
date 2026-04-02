import { describe, expect, it } from 'vitest';
import { resolveVariableMenuLabel } from '../variableDisplayLabel';

describe('resolveVariableMenuLabel', () => {
  const guid = '11111111-1111-4111-8111-111111111111';

  it('uses translation for utterance GUID when present', () => {
    const set = new Set([guid]);
    expect(
      resolveVariableMenuLabel(guid, 'fallback.name', {
        utteranceGuidSet: set,
        translationsByGuid: { [guid]: 'Etichetta UI' },
      })
    ).toBe('Etichetta UI');
  });

  it('falls back to varName when translation missing', () => {
    const set = new Set([guid]);
    expect(
      resolveVariableMenuLabel(guid, 'nome.dotted', {
        utteranceGuidSet: set,
        translationsByGuid: {},
      })
    ).toBe('nome.dotted');
  });

  it('ignores translation table for non-utterance GUIDs', () => {
    const set = new Set<string>();
    expect(
      resolveVariableMenuLabel(guid, 'solo.var', {
        utteranceGuidSet: set,
        translationsByGuid: { [guid]: 'Ignored' },
      })
    ).toBe('solo.var');
  });
});
