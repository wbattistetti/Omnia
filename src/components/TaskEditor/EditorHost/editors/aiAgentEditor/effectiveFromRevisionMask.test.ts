import { describe, expect, it } from 'vitest';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';

describe('effectiveFromRevisionMask', () => {
  it('returns base when no revisions', () => {
    expect(effectiveFromRevisionMask('abc', [], [])).toBe('abc');
  });

  it('removes deleted indices', () => {
    const del = [false, true, false];
    expect(effectiveFromRevisionMask('abc', del, [])).toBe('ac');
  });

  it('splices inserts at positions', () => {
    expect(
      effectiveFromRevisionMask('ac', [false, false], [{ id: '1', position: 1, text: 'x' }])
    ).toBe('axc');
  });
});
