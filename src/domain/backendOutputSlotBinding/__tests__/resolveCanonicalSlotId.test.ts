import { describe, expect, it } from 'vitest';
import { normalizeProposalSlotId, resolveCanonicalSlotIdFromToken } from '../resolveCanonicalSlotId';

describe('resolveCanonicalSlotId (dynamic)', () => {
  it('accepts any valid snake_case slot id from proposals', () => {
    expect(normalizeProposalSlotId('medico_richiesto')).toBe('medico_richiesto');
    expect(normalizeProposalSlotId('specialita_medico')).toBe('specialita_medico');
    expect(normalizeProposalSlotId('bad id')).toBeNull();
    expect(normalizeProposalSlotId('undefined')).toBeNull();
  });

  it('resolves token base without static vocabulary mapping', () => {
    expect(resolveCanonicalSlotIdFromToken('medico_richiesto_1')).toBe('medico_richiesto');
    expect(resolveCanonicalSlotIdFromToken('giorno_2')).toBe('giorno');
  });
});
