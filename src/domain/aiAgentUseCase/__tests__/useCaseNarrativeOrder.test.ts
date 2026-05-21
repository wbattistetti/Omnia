import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { applyNarrativeOrder } from '../useCaseNarrativeOrder';

function row(
  id: string,
  label: string,
  parent_id: string | null,
  sort_order: number
): AIAgentUseCase {
  return {
    id,
    label,
    parent_id,
    sort_order,
    refinement_prompt: '',
    payoff: label,
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'x', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('applyNarrativeOrder', () => {
  it('reorders roots and reindexes sort_order', () => {
    const input = [
      row('r2', 'Zeta', null, 0),
      row('r1', 'Alpha', null, 1),
      row('c1', 'Child', 'r1', 0),
    ];
    const out = applyNarrativeOrder(input, ['r1', 'c1', 'r2']);
    const byId = new Map(out.map((u) => [u.id, u.sort_order]));
    expect(byId.get('r1')).toBe(0);
    expect(byId.get('r2')).toBe(1);
    expect(byId.get('c1')).toBe(0);
    expect(out.map((u) => u.id)).toEqual(['r1', 'c1', 'r2']);
  });

  it('throws when ids are missing', () => {
    const input = [row('a', 'A', null, 0), row('b', 'B', null, 1)];
    expect(() => applyNarrativeOrder(input, ['a'])).toThrow(/incomplete/i);
  });
});
