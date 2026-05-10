import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { serializeUseCaseListForWizardBaseline } from '../useCaseListBaseline';

function uc(partial: Partial<AIAgentUseCase> & Pick<AIAgentUseCase, 'id'>): AIAgentUseCase {
  return {
    label: 'L',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'hello', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...partial,
  };
}

describe('serializeUseCaseListForWizardBaseline', () => {
  it('is order-insensitive (sort_order wins)', () => {
    const a = uc({ id: 'a', sort_order: 1, label: 'A' });
    const b = uc({ id: 'b', sort_order: 0, label: 'B' });
    const s1 = serializeUseCaseListForWizardBaseline([a, b]);
    const s2 = serializeUseCaseListForWizardBaseline([b, a]);
    expect(s1).toBe(s2);
  });

  it('changes when assistant content changes', () => {
    const u = uc({ id: 'x', dialogue: [{ turn_id: 't1', role: 'assistant', content: 'a', editable: true }] });
    const v = uc({ id: 'x', dialogue: [{ turn_id: 't1', role: 'assistant', content: 'b', editable: true }] });
    expect(serializeUseCaseListForWizardBaseline([u])).not.toBe(serializeUseCaseListForWizardBaseline([v]));
  });

  it('changes when label changes', () => {
    const u = uc({ id: 'x', label: 'One' });
    const v = uc({ id: 'x', label: 'Two' });
    expect(serializeUseCaseListForWizardBaseline([u])).not.toBe(serializeUseCaseListForWizardBaseline([v]));
  });
});
