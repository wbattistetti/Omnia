import { describe, expect, it } from 'vitest';
import { computeSlotMappingValidation } from '../slotMappingValidation';
import { emptyProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

const baseUseCase: AIAgentUseCase = {
  id: 'uc1',
  label: 'Test',
  parent_id: null,
  dialogue: [{ role: 'assistant', content: 'ciao' }],
  phrases: [],
};

describe('computeSlotMappingValidation', () => {
  it('returns valid when all criteria met', () => {
    const lexicon = {
      ...emptyProjectSlotLexicon(),
      entries: [{ surface: 'domani', slot_id: 'data', approved: true }],
    };
    expect(computeSlotMappingValidation(lexicon, [baseUseCase]).status).toBe('valid');
  });

  it('flags generic slot_id', () => {
    const lexicon = {
      ...emptyProjectSlotLexicon(),
      entries: [{ surface: 'foo', slot_id: 'undefined', approved: true }],
    };
    const r = computeSlotMappingValidation(lexicon, [baseUseCase]);
    expect(r.status).toBe('invalid');
    expect(r.reasons.some((x) => x.includes('non classificata'))).toBe(true);
  });

  it('flags unapproved entries', () => {
    const lexicon = {
      ...emptyProjectSlotLexicon(),
      entries: [{ surface: 'foo', slot_id: 'nome', approved: false }],
    };
    expect(computeSlotMappingValidation(lexicon, [baseUseCase]).status).toBe('invalid');
  });
});
