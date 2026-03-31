import { describe, it, expect } from 'vitest';
import type { Grammar } from '../types/grammarTypes';
import { storeLooksAheadOfInitialProp } from '../grammarEditorLoadPolicy';

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
});
