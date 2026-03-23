/**
 * Tests for base+effective → mask/inserts used for OT dual-layer display.
 * Verifies both round-trip correctness and the non-interlaced layout guarantee.
 */

import { describe, expect, it } from 'vitest';
import { buildLinearDocument } from './textRevisionLinear';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import { effectivePairToMaskAndInserts } from './otLinearDisplay';

function roundTrip(base: string, effective: string): void {
  const { deletedMask, inserts } = effectivePairToMaskAndInserts(base, effective);
  expect(effectiveFromRevisionMask(base, deletedMask, inserts)).toBe(effective);
}

/**
 * Builds the linear string and checks that no insert char appears between two deleted base chars
 * (i.e. green and red spans never interleave).
 */
function assertNonInterlaced(base: string, effective: string): void {
  const { deletedMask, inserts } = effectivePairToMaskAndInserts(base, effective);
  const { meta } = buildLinearDocument(base, deletedMask, inserts);

  // Find all contiguous runs: 'insert' or 'deleted-base' or 'kept-base'
  // A run is a maximal sequence of chars with the same color category.
  // The invariant: insert runs must not appear between deleted-base runs.
  type RunKind = 'insert' | 'deleted' | 'kept';
  const runs: RunKind[] = [];
  for (let i = 0; i < meta.length; i++) {
    const m = meta[i];
    let kind: RunKind;
    if (m.kind === 'insert') {
      kind = 'insert';
    } else {
      kind = deletedMask[m.baseIndex] ? 'deleted' : 'kept';
    }
    if (runs.length === 0 || runs[runs.length - 1] !== kind) {
      runs.push(kind);
    }
  }

  // No 'deleted' run should appear before an 'insert' run in the same "change region"
  // The simplest check: the sequence must not contain [..., deleted, ..., insert, ..., deleted, ...]
  for (let i = 1; i < runs.length - 1; i++) {
    if (runs[i] === 'insert') {
      const hadDeleteBefore = runs.slice(0, i).includes('deleted');
      const hasDeleteAfter = runs.slice(i + 1).includes('deleted');
      expect(
        hadDeleteBefore && hasDeleteAfter,
        `Interlaced pattern detected in runs: ${runs.join(',')} for base="${base}" effective="${effective}"`
      ).toBe(false);
    }
  }
}

describe('effectivePairToMaskAndInserts', () => {
  it('round-trips equal strings', () => {
    roundTrip('', '');
    roundTrip('abc', 'abc');
  });

  it('round-trips single replace', () => {
    roundTrip('hello', 'hallo');
  });

  it('round-trips insert at start', () => {
    roundTrip('end', 'vuonend');
  });

  it('round-trips delete only', () => {
    roundTrip('abcdef', 'abcef');
  });

  it('round-trips full replacement (World → Ciao)', () => {
    roundTrip('World', 'Ciao');
  });

  it('round-trips multi-char replacement in middle', () => {
    roundTrip('Hello World', 'Hello Planet');
  });

  it('round-trips insert at end', () => {
    roundTrip('abc', 'abcxyz');
  });

  it('round-trips delete all', () => {
    roundTrip('abc', '');
  });

  it('round-trips insert into empty', () => {
    roundTrip('', 'abc');
  });

  it('produces a single contiguous insert block (no interlacing) — World → Ciao', () => {
    const { deletedMask, inserts } = effectivePairToMaskAndInserts('World', 'Ciao');
    // All 5 base chars deleted, one insert at position 0
    expect(deletedMask).toEqual([true, true, true, true, true]);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].position).toBe(0);
    expect(inserts[0].text).toBe('Ciao');
    assertNonInterlaced('World', 'Ciao');
  });

  it('produces a single contiguous delete+insert block — hello → hallo', () => {
    const { deletedMask, inserts } = effectivePairToMaskAndInserts('hello', 'hallo');
    // prefix 'h', suffix 'llo', middle: delete 'e', insert 'a'
    expect(deletedMask).toEqual([false, true, false, false, false]);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].position).toBe(1);
    expect(inserts[0].text).toBe('a');
    assertNonInterlaced('hello', 'hallo');
  });

  it('no interlacing for multi-char middle replacement', () => {
    assertNonInterlaced('Hello World', 'Hello Planet');
  });

  it('no interlacing for insert at start', () => {
    assertNonInterlaced('end', 'vuonend');
  });

  it('no interlacing for delete only', () => {
    assertNonInterlaced('abcdef', 'abcef');
  });

  it('only marks the middle block — keep prefix and suffix', () => {
    // "abXYZef" → "abPQef": prefix "ab", suffix "ef", middle delete "XYZ" insert "PQ"
    const { deletedMask, inserts } = effectivePairToMaskAndInserts('abXYZef', 'abPQef');
    expect(deletedMask).toEqual([false, false, true, true, true, false, false]);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].position).toBe(2);
    expect(inserts[0].text).toBe('PQ');
    roundTrip('abXYZef', 'abPQef');
  });
});
