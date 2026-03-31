import { describe, it, expect } from 'vitest';
import type { Grammar } from '../types/grammarTypes';
import { grammarStructuralFingerprint } from '../grammarStructureFingerprint';

describe('grammarStructuralFingerprint', () => {
  it('ignores id so empty grammars with different uuids match', () => {
    const a = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      nodes: [],
      edges: [],
      slots: [],
      semanticSets: [],
    } as Grammar;
    const b = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      nodes: [],
      edges: [],
      slots: [],
      semanticSets: [],
    } as Grammar;
    expect(grammarStructuralFingerprint(a)).toBe(grammarStructuralFingerprint(b));
  });
});
