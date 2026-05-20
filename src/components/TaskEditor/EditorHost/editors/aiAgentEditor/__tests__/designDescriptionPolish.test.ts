import { describe, expect, it } from 'vitest';
import {
  countTextCharDelta,
  hasSignificantDesignDescriptionEdit,
} from '../designDescriptionPolish';

describe('designDescriptionPolish', () => {
  it('countTextCharDelta returns 0 for equal trimmed strings', () => {
    expect(countTextCharDelta('  abc  ', 'abc')).toBe(0);
  });

  it('countTextCharDelta sums length diff and per-char mismatches', () => {
    expect(countTextCharDelta('hello', 'hallo')).toBe(1);
    expect(countTextCharDelta('ab', 'abcd')).toBe(2);
  });

  it('hasSignificantDesignDescriptionEdit is false when below min length', () => {
    expect(hasSignificantDesignDescriptionEdit('short', '', 10, 40)).toBe(false);
  });

  it('hasSignificantDesignDescriptionEdit is true above char delta threshold', () => {
    const base = 'a'.repeat(40);
    const cur = `${base} ${'modifiche significative aggiunte dal designer in questa descrizione'.repeat(2)}`;
    expect(hasSignificantDesignDescriptionEdit(cur, base, 50)).toBe(true);
  });

  it('hasSignificantDesignDescriptionEdit is false for tiny edits', () => {
    const base = 'Prima visita o controllo: chiedere sempre se si tratta di prima visita.';
    const cur = `${base.slice(0, -1)}.`; // one char
    expect(hasSignificantDesignDescriptionEdit(cur, base, 50)).toBe(false);
  });
});
