import { describe, expect, it } from 'vitest';
import { slugifyInternalPath } from '../flowInterfaceDragTypes';

describe('flowInterfaceDragTypes', () => {
  it('slugifyInternalPath normalizes labels', () => {
    expect(slugifyInternalPath('Chiedi via')).toBe('chiedi_via');
    expect(slugifyInternalPath('  ')).toBe('field');
    expect(slugifyInternalPath('A')).toBe('a');
  });
});
