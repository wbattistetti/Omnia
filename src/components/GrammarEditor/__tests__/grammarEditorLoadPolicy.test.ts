import { describe, it, expect } from 'vitest';
import type { Grammar } from '../types/grammarTypes';
import { semanticSetsSerializedEqual, storeLooksAheadOfInitialProp } from '../grammarEditorLoadPolicy';

function g(partial: Partial<Grammar>): Grammar {
  return {
    id: 'g1',
    nodes: [],
    edges: [],
    slots: [],
    semanticSets: [],
    ...partial,
  } as Grammar;
}

describe('storeLooksAheadOfInitialProp', () => {
  it('returns true when store has more nodes than initial prop', () => {
    expect(storeLooksAheadOfInitialProp(g({ nodes: [{ id: 'a' }] as any }), g({ nodes: [{ id: 'a' }, { id: 'b' }] as any }))).toBe(true);
  });

  it('returns false when counts are equal', () => {
    const same = g({ nodes: [{ id: 'a' }] as any });
    expect(storeLooksAheadOfInitialProp(same, same)).toBe(false);
  });

  it('returns false when initial is ahead', () => {
    expect(storeLooksAheadOfInitialProp(g({ nodes: [{}, {}] as any }), g({ nodes: [{}] as any }))).toBe(false);
  });

  it('returns true when store has more semantic values in the same number of sets', () => {
    const initial = g({
      semanticSets: [{ id: 's1', name: 'S', values: [{ id: 'v1', value: 'A', synonyms: ['a'] }] }],
    } as any);
    const store = g({
      semanticSets: [
        {
          id: 's1',
          name: 'S',
          values: [
            { id: 'v1', value: 'A', synonyms: ['a'] },
            { id: 'v2', value: 'B', synonyms: ['b'] },
          ],
        },
      ],
    } as any);
    expect(storeLooksAheadOfInitialProp(initial, store)).toBe(true);
  });
});

describe('semanticSetsSerializedEqual', () => {
  it('detects new values inside an existing set', () => {
    const a = g({
      semanticSets: [{ id: 's1', name: 'S', values: [{ id: 'v1', value: 'A', synonyms: [] }] }],
    } as any);
    const b = g({
      semanticSets: [
        { id: 's1', name: 'S', values: [{ id: 'v1', value: 'A', synonyms: [] }, { id: 'v2', value: 'B', synonyms: [] }] },
      ],
    } as any);
    expect(semanticSetsSerializedEqual(a, b)).toBe(false);
  });
});
