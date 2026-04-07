import { describe, expect, it } from 'vitest';
import { uniqueInternalPathFromLabel } from '../flowInterfaceDragTypes';

describe('uniqueInternalPathFromLabel', () => {
  it('returns slug for unused label', () => {
    expect(uniqueInternalPathFromLabel('Nome Variabile', [], 'a')).toBe('nome_variabile');
  });

  it('increments when slug collides', () => {
    const entries = [
      { id: 'x', internalPath: 'nome_variabile' },
      { id: 'y', internalPath: 'other' },
    ];
    expect(uniqueInternalPathFromLabel('Nome Variabile', entries, 'new')).toBe('nome_variabile_1');
  });

  it('ignores entry being replaced', () => {
    const entries = [{ id: 'self', internalPath: 'nome_variabile' }];
    expect(uniqueInternalPathFromLabel('Nome Variabile', entries, 'self')).toBe('nome_variabile');
  });
});
