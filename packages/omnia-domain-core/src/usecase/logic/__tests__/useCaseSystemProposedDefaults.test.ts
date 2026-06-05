import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  applySystemProposedUseCaseDefaults,
  applySystemProposedUseCaseDefaultsBatch,
} from '../useCaseSystemProposedDefaults';

function minimalUseCase(id: string): AIAgentUseCase {
  return {
    id,
    label: id,
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('useCaseSystemProposedDefaults', () => {
  it('marks system-proposed use cases as excluded from conversations', () => {
    const uc = applySystemProposedUseCaseDefaults(minimalUseCase('a'));
    expect(uc.included_in_conversations).toBe(false);
  });

  it('applies batch defaults', () => {
    const out = applySystemProposedUseCaseDefaultsBatch([
      minimalUseCase('a'),
      minimalUseCase('b'),
    ]);
    expect(out.every((u) => u.included_in_conversations === false)).toBe(true);
  });
});
