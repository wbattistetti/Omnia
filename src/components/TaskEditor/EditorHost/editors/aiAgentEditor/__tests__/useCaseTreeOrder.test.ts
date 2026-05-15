/**
 * Ordinamento albero use case: radici orfane (parent assente / vuoto) devono comparire.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { orderUseCasesWithDepth } from '../useCaseTreeOrder';

function uc(id: string, parent_id: string | null, sort_order: number): AIAgentUseCase {
  return {
    id,
    label: id,
    parent_id,
    sort_order,
    refinement_prompt: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('orderUseCasesWithDepth', () => {
  it('tratta parent_id "" come radice (LLM / payload legacy)', () => {
    const { ordered } = orderUseCasesWithDepth([uc('x', '', 0)]);
    expect(ordered.map((u) => u.id)).toEqual(['x']);
  });

  it('promuove a radice se parent_id non esiste nel catalogo', () => {
    const { ordered } = orderUseCasesWithDepth([
      uc('child', 'missing-parent', 0),
      uc('root', null, 1),
    ]);
    expect(ordered.map((u) => u.id)).toContain('child');
    expect(ordered[0].id).toBe('child');
  });
});
