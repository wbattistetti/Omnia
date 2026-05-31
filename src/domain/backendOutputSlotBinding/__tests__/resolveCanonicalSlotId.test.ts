import { describe, expect, it } from 'vitest';
import { normalizeProposalSlotId, resolveCanonicalSlotIdFromToken } from '../resolveCanonicalSlotId';

describe('resolveCanonicalSlotId', () => {
  it('normalizes token bases for IA proposals', () => {
    expect(normalizeProposalSlotId('giorno')).toBe('data');
    expect(normalizeProposalSlotId('giorno_1')).toBe('data');
    expect(normalizeProposalSlotId('data')).toBe('data');
    expect(normalizeProposalSlotId('unknown_xyz')).toBeNull();
  });

  it('resolves numbered tokens', () => {
    expect(resolveCanonicalSlotIdFromToken('giorno_2')).toBe('data');
  });

  it('resolves multi-segment token names', () => {
    expect(resolveCanonicalSlotIdFromToken('giorno_primo_slot')).toBe('data');
    expect(normalizeProposalSlotId('giorno_primo_slot')).toBe('data');
    expect(normalizeProposalSlotId('ora_primo_slot')).toBe('orario');
  });
});
