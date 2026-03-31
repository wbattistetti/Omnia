/**
 * Rules for aligning TesterGrid rows with contract.testPhrases and persistence.
 */
import { describe, expect, it } from 'vitest';
import {
  contractPatchIncludesTestPhrases,
  derivePersistableTestPhrases,
  testPhrasesArrayFromContract,
} from '../testPhrasesContractGridSync';

describe('contractPatchIncludesTestPhrases', () => {
  it('is false for null/undefined', () => {
    expect(contractPatchIncludesTestPhrases(null)).toBe(false);
    expect(contractPatchIncludesTestPhrases(undefined)).toBe(false);
  });

  it('is true when testPhrases key exists (including empty array)', () => {
    expect(contractPatchIncludesTestPhrases({ testPhrases: [] } as any)).toBe(true);
    expect(contractPatchIncludesTestPhrases({ testPhrases: ['a'] } as any)).toBe(true);
  });

  it('is false when testPhrases is omitted', () => {
    expect(contractPatchIncludesTestPhrases({ engines: [] } as any)).toBe(false);
  });
});

describe('testPhrasesArrayFromContract', () => {
  it('returns [] for missing contract or testPhrases', () => {
    expect(testPhrasesArrayFromContract(null)).toEqual([]);
    expect(testPhrasesArrayFromContract({} as any)).toEqual([]);
  });

  it('copies array values', () => {
    const c = { testPhrases: ['x', 'y'] } as any;
    const out = testPhrasesArrayFromContract(c);
    expect(out).toEqual(['x', 'y']);
    out.push('z');
    expect(c.testPhrases).toEqual(['x', 'y']);
  });
});

describe('derivePersistableTestPhrases', () => {
  it('prefers non-empty grid over contract', () => {
    expect(
      derivePersistableTestPhrases({
        examplesList: ['g'],
        contractTestPhrases: ['c'],
        resolvedTestPhrases: ['r'],
      })
    ).toEqual(['g']);
  });

  it('uses contract when grid empty', () => {
    expect(
      derivePersistableTestPhrases({
        examplesList: [],
        contractTestPhrases: ['c'],
        resolvedTestPhrases: ['r'],
      })
    ).toEqual(['c']);
  });

  it('uses resolver when grid and contract empty', () => {
    expect(
      derivePersistableTestPhrases({
        examplesList: [],
        contractTestPhrases: undefined,
        resolvedTestPhrases: ['r'],
      })
    ).toEqual(['r']);
  });

  it('returns undefined when all sources empty', () => {
    expect(
      derivePersistableTestPhrases({
        examplesList: [],
        contractTestPhrases: [],
        resolvedTestPhrases: [],
      })
    ).toBeUndefined();
  });
});
