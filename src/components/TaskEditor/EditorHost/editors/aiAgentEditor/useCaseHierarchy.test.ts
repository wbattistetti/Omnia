/**
 * Tests for alphabetical sort_order normalization in use case hierarchy.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  collectUseCaseSubtreeIds,
  normalizeUseCaseSiblingOrder,
  normalizeUseCaseSortOrderAlphabetically,
  normalizeUseCaseSortOrderLogical,
} from './useCaseHierarchy';

function uc(id: string, label: string, parent_id: string | null, sort_order: number): AIAgentUseCase {
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

describe('normalizeUseCaseSortOrderLogical', () => {
  it('keeps sibling order by first appearance in array (dialogue flow)', () => {
    const input: AIAgentUseCase[] = [
      uc('r2', 'Zeta', null, 9),
      uc('r1', 'Alpha', null, 8),
      uc('c2', 'Bravo child', 'r1', 0),
      uc('c1', 'Alpha child', 'r1', 1),
    ];
    const out = normalizeUseCaseSortOrderLogical(input);
    const byId = new Map(out.map((x) => [x.id, x]));

    expect(byId.get('r2')?.sort_order).toBe(0);
    expect(byId.get('r1')?.sort_order).toBe(1);
    expect(byId.get('c2')?.sort_order).toBe(0);
    expect(byId.get('c1')?.sort_order).toBe(1);
  });
});

describe('normalizeUseCaseSiblingOrder', () => {
  it('delegates to alphabetical when mode is alphabetical', () => {
    const input: AIAgentUseCase[] = [uc('r2', 'Zeta', null, 0), uc('r1', 'Alpha', null, 1)];
    const out = normalizeUseCaseSiblingOrder(input, 'alphabetical');
    expect(out.find((x) => x.id === 'r1')?.sort_order).toBe(0);
    expect(out.find((x) => x.id === 'r2')?.sort_order).toBe(1);
  });

  it('delegates to logical when mode is logical', () => {
    const input: AIAgentUseCase[] = [uc('r2', 'Zeta', null, 1), uc('r1', 'Alpha', null, 0)];
    const out = normalizeUseCaseSiblingOrder(input, 'logical');
    expect(out.find((x) => x.id === 'r2')?.sort_order).toBe(0);
    expect(out.find((x) => x.id === 'r1')?.sort_order).toBe(1);
  });
});

describe('normalizeUseCaseSortOrderAlphabetically', () => {
  it('reassigns root and child sort_order by alphabetical label', () => {
    const input: AIAgentUseCase[] = [
      uc('r2', 'Zeta', null, 0),
      uc('r1', 'Alpha', null, 1),
      uc('c2', 'Bravo child', 'r1', 0),
      uc('c1', 'Alpha child', 'r1', 1),
    ];
    const out = normalizeUseCaseSortOrderAlphabetically(input);
    const byId = new Map(out.map((x) => [x.id, x]));

    expect(byId.get('r1')?.sort_order).toBe(0);
    expect(byId.get('r2')?.sort_order).toBe(1);
    expect(byId.get('c1')?.sort_order).toBe(0);
    expect(byId.get('c2')?.sort_order).toBe(1);
  });
});

describe('collectUseCaseSubtreeIds', () => {
  it('includes root and all nested children', () => {
    const input: AIAgentUseCase[] = [
      uc('a', 'Root', null, 0),
      uc('b', 'Child', 'a', 0),
      uc('c', 'Grandchild', 'b', 0),
      uc('x', 'Other root', null, 1),
    ];
    const ids = collectUseCaseSubtreeIds(input, 'a');
    expect(ids).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns only the node when there are no children', () => {
    const input: AIAgentUseCase[] = [uc('solo', 'Solo', null, 0)];
    expect(collectUseCaseSubtreeIds(input, 'solo')).toEqual(new Set(['solo']));
  });
});

