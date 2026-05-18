/**
 * Tests for alphabetical sort_order normalization in use case hierarchy.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  applySiblingReorderForPersist,
  collectUseCaseSubtreeIds,
  normalizeUseCaseSiblingOrder,
  normalizeUseCaseSortOrderAlphabetically,
  normalizeUseCaseSortOrderLogical,
  reorderUseCaseSibling,
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
  it('preserves object references when sort_order is already correct', () => {
    const input: AIAgentUseCase[] = [
      uc('r1', 'Alpha', null, 0),
      uc('r2', 'Beta', null, 1),
    ];
    const out = normalizeUseCaseSortOrderLogical(input);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(input[0]);
    expect(out[1]).toBe(input[1]);
  });

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

describe('reorderUseCaseSibling', () => {
  it('moves a root sibling before another and reindexes sort_order', () => {
    const input: AIAgentUseCase[] = [
      uc('a', 'A', null, 0),
      uc('b', 'B', null, 1),
      uc('c', 'C', null, 2),
    ];
    const out = reorderUseCaseSibling(input, 'c', 'a', 'before');
    const byId = new Map(out.map((x) => [x.id, x]));
    expect(byId.get('c')?.sort_order).toBe(0);
    expect(byId.get('a')?.sort_order).toBe(1);
    expect(byId.get('b')?.sort_order).toBe(2);
  });

  it('moves a root sibling after another', () => {
    const input: AIAgentUseCase[] = [
      uc('a', 'A', null, 0),
      uc('b', 'B', null, 1),
      uc('c', 'C', null, 2),
    ];
    const out = reorderUseCaseSibling(input, 'a', 'b', 'after');
    const byId = new Map(out.map((x) => [x.id, x]));
    expect(byId.get('b')?.sort_order).toBe(0);
    expect(byId.get('a')?.sort_order).toBe(1);
    expect(byId.get('c')?.sort_order).toBe(2);
  });

  it('reorders only within the same parent_id', () => {
    const input: AIAgentUseCase[] = [
      uc('p', 'P', null, 0),
      uc('c1', 'C1', 'p', 0),
      uc('c2', 'C2', 'p', 1),
      uc('x', 'X', null, 1),
    ];
    const out = reorderUseCaseSibling(input, 'c2', 'c1', 'before');
    const byId = new Map(out.map((x) => [x.id, x]));
    expect(byId.get('c2')?.sort_order).toBe(0);
    expect(byId.get('c1')?.sort_order).toBe(1);
    expect(byId.get('p')?.sort_order).toBe(0);
    expect(byId.get('x')?.sort_order).toBe(1);
  });

  it('returns a copy unchanged when parents differ', () => {
    const input: AIAgentUseCase[] = [uc('a', 'A', null, 0), uc('b', 'B', 'a', 0)];
    const out = reorderUseCaseSibling(input, 'a', 'b', 'before');
    expect(out).not.toBe(input);
    expect(out.find((x) => x.id === 'a')?.sort_order).toBe(0);
    expect(out.find((x) => x.id === 'b')?.sort_order).toBe(0);
  });
});

describe('applySiblingReorderForPersist', () => {
  it('mantiene il nuovo ordine dopo la normalizzazione per prima occorrenza (array piatto)', () => {
    const input: AIAgentUseCase[] = [
      uc('a', 'A', null, 0),
      uc('b', 'B', null, 1),
      uc('c', 'C', null, 2),
    ];
    const stepped = reorderUseCaseSibling(input, 'c', 'a', 'before');
    const naive = normalizeUseCaseSortOrderLogical(stepped);
    expect(naive.find((x) => x.id === 'c')?.sort_order).not.toBe(0);

    const fixed = applySiblingReorderForPersist(input, 'c', 'a', 'before');
    const afterLogical = normalizeUseCaseSortOrderLogical(fixed);
    expect(afterLogical.find((x) => x.id === 'c')?.sort_order).toBe(0);
    expect(afterLogical.find((x) => x.id === 'a')?.sort_order).toBe(1);
    expect(afterLogical.find((x) => x.id === 'b')?.sort_order).toBe(2);
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

