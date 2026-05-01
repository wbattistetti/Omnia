import { describe, expect, it } from 'vitest';
import { interpolateVariableBracketsInText } from '../interpolateVariableBracketsInText';

const GUID_NOME = '11111111-1111-1111-1111-111111111111';
const GUID_COGNOME = '22222222-2222-2222-2222-222222222222';

describe('interpolateVariableBracketsInText', () => {
  it('resolves [guid] from variable store', () => {
    const store = { [GUID_NOME]: { semantic: 'Mario' } };
    expect(interpolateVariableBracketsInText(`Ciao [${GUID_NOME}]`, store)).toBe('Ciao Mario');
  });

  it('resolves [label] when guid→label map is provided', () => {
    const map = new Map<string, string>([
      [GUID_NOME, 'nome'],
      [GUID_COGNOME, 'cognome'],
    ]);
    const store = {
      [GUID_NOME]: { semantic: 'Mario' },
      [GUID_COGNOME]: { semantic: 'Rossi' },
    };
    expect(interpolateVariableBracketsInText('Salve [nome] [cognome]', store, map)).toBe('Salve Mario Rossi');
  });

  it('leaves unknown tokens unchanged', () => {
    const store = { [GUID_NOME]: 'x' };
    const map = new Map([[GUID_NOME, 'nome']]);
    expect(interpolateVariableBracketsInText('[missing]', store, map)).toBe('[missing]');
  });

  it('returns original text when store is empty', () => {
    const map = new Map([[GUID_NOME, 'nome']]);
    expect(interpolateVariableBracketsInText('[nome]', {}, map)).toBe('[nome]');
  });
});
