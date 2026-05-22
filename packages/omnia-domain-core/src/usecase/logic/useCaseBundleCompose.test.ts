/**
 * Unit tests for review-portal bundle compose helpers.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  createBlankUseCaseInList,
  deleteUseCaseFromList,
  duplicateUseCaseInList,
  moveUseCaseAmongSiblings,
} from './useCaseBundleCompose';

function uc(id: string, parent: string | null, sort: number, label = id): AIAgentUseCase {
  return {
    id,
    label,
    parent_id: parent,
    sort_order: sort,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: `t-${id}`, role: 'assistant', content: '', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('useCaseBundleCompose', () => {
  it('createBlankUseCaseInList appends root with next sort_order', () => {
    const { useCases, newId } = createBlankUseCaseInList([uc('a', null, 0)]);
    expect(useCases).toHaveLength(2);
    const added = useCases.find((u) => u.id === newId);
    expect(added?.parent_id).toBeNull();
    expect(added?.sort_order).toBe(1);
  });

  it('deleteUseCaseFromList removes subtree', () => {
    const input = [uc('a', null, 0), uc('b', 'a', 0), uc('c', null, 1)];
    const next = deleteUseCaseFromList(input, 'a');
    expect(next.map((u) => u.id)).toEqual(['c']);
  });

  it('duplicateUseCaseInList clones subtree with new ids', () => {
    const input = [uc('a', null, 0, 'Root'), uc('b', 'a', 0, 'Child')];
    const { useCases, newRootId } = duplicateUseCaseInList(input, 'a');
    expect(newRootId).toBeTruthy();
    expect(useCases).toHaveLength(4);
    const cloneRoot = useCases.find((u) => u.id === newRootId);
    expect(cloneRoot?.label).toContain('copia');
    const cloneChild = useCases.find((u) => u.parent_id === newRootId);
    expect(cloneChild).toBeTruthy();
    expect(cloneChild?.id).not.toBe('b');
  });

  it('moveUseCaseAmongSiblings swaps order among siblings only', () => {
    const input = [uc('a', null, 0), uc('b', null, 1), uc('c', 'a', 0)];
    const down = moveUseCaseAmongSiblings(input, 'a', 'down');
    const aDown = down.find((u) => u.id === 'a')!;
    const bDown = down.find((u) => u.id === 'b')!;
    expect(aDown.sort_order).toBeGreaterThan(bDown.sort_order);
    const up = moveUseCaseAmongSiblings(down, 'a', 'up');
    const aUp = up.find((u) => u.id === 'a')!;
    const bUp = up.find((u) => u.id === 'b')!;
    expect(aUp.sort_order).toBeLessThan(bUp.sort_order);
    expect(up.find((u) => u.id === 'c')?.parent_id).toBe('a');
  });
});
