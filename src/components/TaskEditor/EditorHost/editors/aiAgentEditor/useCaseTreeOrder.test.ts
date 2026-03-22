/**
 * Tests for hierarchical use case ordering (depth-first, sort_order).
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { orderUseCasesWithDepth } from './useCaseTreeOrder';

function uc(
  id: string,
  parent_id: string | null,
  sort_order: number,
  label: string
): AIAgentUseCase {
  return {
    id,
    label,
    parent_id,
    sort_order,
    refinement_prompt: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('orderUseCasesWithDepth', () => {
  it('orders roots before children and respects sort_order', () => {
    const cases: AIAgentUseCase[] = [
      uc('c', 'a', 0, 'child'),
      uc('a', null, 1, 'root-b'),
      uc('b', null, 0, 'root-a'),
    ];
    const { ordered, depthById } = orderUseCasesWithDepth(cases);
    expect(ordered.map((u) => u.id)).toEqual(['b', 'a', 'c']);
    expect(depthById.b).toBe(0);
    expect(depthById.a).toBe(0);
    expect(depthById.c).toBe(1);
  });

  it('walks multiple branches', () => {
    const cases: AIAgentUseCase[] = [
      uc('r1', null, 0, 'R1'),
      uc('r2', null, 1, 'R2'),
      uc('c1', 'r1', 0, 'C1'),
      uc('c2', 'r1', 1, 'C2'),
    ];
    const { ordered } = orderUseCasesWithDepth(cases);
    expect(ordered.map((u) => u.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
  });
});
