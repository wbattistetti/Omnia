/**
 * Tests for prefix/suffix split used by OT display and linear hunk detection.
 */

import { describe, expect, it } from 'vitest';
import { commonPrefixLength, isSingleContiguousEdit, splitPrefixSuffixMiddle } from './revisionStringDiff';

describe('splitPrefixSuffixMiddle', () => {
  it('splits full replacement', () => {
    const s = splitPrefixSuffixMiddle('World', 'Ciao');
    expect(s.prefixLen).toBe(0);
    expect(s.suffixLen).toBe(0);
    expect(s.aMiddle).toBe('World');
    expect(s.bMiddle).toBe('Ciao');
  });

  it('splits shared prefix before differing middle', () => {
    const s = splitPrefixSuffixMiddle('Hello World', 'Hello Planet');
    expect(s.prefixLen).toBe(6);
    expect(s.suffixLen).toBe(0);
    expect(s.aMiddle).toBe('World');
    expect(s.bMiddle).toBe('Planet');
  });

  it('splits shared suffix after differing middle', () => {
    const s = splitPrefixSuffixMiddle('abXcd', 'abYcd');
    expect(s.prefixLen).toBe(2);
    expect(s.suffixLen).toBe(2);
    expect(s.aMiddle).toBe('X');
    expect(s.bMiddle).toBe('Y');
  });
});

describe('isSingleContiguousEdit', () => {
  it('is true when middle replacement reconstructs', () => {
    expect(isSingleContiguousEdit('hello', 'hallo')).toBe(true);
  });

  it('reconstructs aaa → axaya as one middle (string-level); computeLinearDiffHunks still keeps Myers insert-only)', () => {
    expect(isSingleContiguousEdit('aaa', 'axaya')).toBe(true);
  });
});

describe('commonPrefixLength', () => {
  it('counts UTF-16 code units', () => {
    expect(commonPrefixLength('ab', 'ac')).toBe(1);
  });
});
