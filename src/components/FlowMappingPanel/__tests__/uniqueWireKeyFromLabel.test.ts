import { describe, expect, it } from 'vitest';
import { uniqueWireKeyFromLabel } from '../flowInterfaceDragTypes';

describe('uniqueWireKeyFromLabel', () => {
  it('slugifies label', () => {
    expect(uniqueWireKeyFromLabel('Nome Variabile', [], 'a')).toBe('nome_variabile');
  });

  it('adds suffix on collision', () => {
    const entries = [
      { id: 'x', wireKey: 'nome_variabile' },
      { id: 'y', wireKey: 'other' },
    ];
    expect(uniqueWireKeyFromLabel('Nome Variabile', entries, 'new')).toBe('nome_variabile_1');
  });

  it('ignores self id when checking collision', () => {
    const entries = [{ id: 'self', wireKey: 'nome_variabile' }];
    expect(uniqueWireKeyFromLabel('Nome Variabile', entries, 'self')).toBe('nome_variabile');
  });
});
