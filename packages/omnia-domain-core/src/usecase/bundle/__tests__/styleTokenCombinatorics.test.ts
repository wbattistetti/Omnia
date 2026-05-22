/**
 * Combinatoria style token.
 */

import { describe, expect, it } from 'vitest';
import {
  buildMaterializedStylePhrases,
  buildStyleTokenCombinations,
  materializeStyleCombination,
} from '../styleTokenCombinatorics';
import type { AIAgentPhraseStyleToken } from '../schema';

const tokens: AIAgentPhraseStyleToken[] = [
  {
    styleTokenId: 'st-a',
    defaultSurface: 'A',
    variants: ['A', 'B'],
  },
  {
    styleTokenId: 'st-b',
    defaultSurface: 'X',
    variants: ['X', 'Y', 'Z'],
  },
];

describe('styleTokenCombinatorics', () => {
  it('builds cartesian product capped at max', () => {
    const { combinations, truncated } = buildStyleTokenCombinations(tokens, 4);
    expect(combinations).toHaveLength(4);
    expect(truncated).toBe(true);
  });

  it('materializes picks into guillemets', () => {
    const out = materializeStyleCombination('Ciao «A» e «X».', tokens, {
      'st-a': 'B',
      'st-b': 'Y',
    });
    expect(out).toBe('Ciao «B» e «Y».');
  });

  it('buildMaterializedStylePhrases returns all combos when under cap', () => {
    const { phrases, truncated } = buildMaterializedStylePhrases('«A» «X»', tokens, 30);
    expect(truncated).toBe(false);
    expect(phrases).toHaveLength(6);
    expect(phrases).toContain('A X');
    expect(phrases).toContain('B Z');
  });
});
