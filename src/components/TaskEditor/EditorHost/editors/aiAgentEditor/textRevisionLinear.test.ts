/**
 * Tests for linear revision document + edit-to-batch conversion.
 */

import { describe, expect, it } from 'vitest';
import {
  buildLinearDocument,
  linearEditToBatchOps,
  linearToBaseInsertPosition,
  singleContiguousEditBounds,
} from './textRevisionLinear';
import { applyRevisionBatchToSlice } from './applyRevisionBatchToSlice';
import type { StructuredSectionRevisionSlice } from './structuredSectionsRevisionReducer';

function slice(base: string): StructuredSectionRevisionSlice {
  return {
    promptBaseText: base,
    deletedMask: new Array(base.length).fill(false),
    inserts: [],
    refinementOpLog: [],
  };
}

describe('buildLinearDocument', () => {
  it('interleaves inserts at anchor positions', () => {
    const { linear, meta } = buildLinearDocument('ab', [], [
      { id: 'i1', position: 1, text: 'XY' },
    ]);
    expect(linear).toBe('aXYb');
    expect(meta[0]).toEqual({ kind: 'base', baseIndex: 0 });
    expect(meta[1]).toEqual({ kind: 'insert', opId: 'i1', charIndex: 0 });
    expect(meta[2]).toEqual({ kind: 'insert', opId: 'i1', charIndex: 1 });
    expect(meta[3]).toEqual({ kind: 'base', baseIndex: 1 });
  });

  it('keeps every base character in linear string', () => {
    const { linear } = buildLinearDocument('hi', [true, false], []);
    expect(linear).toBe('hi');
  });
});

describe('singleContiguousEditBounds', () => {
  it('returns null when strings are equal', () => {
    expect(singleContiguousEditBounds('abc', 'abc')).toBeNull();
  });

  it('finds single replacement', () => {
    const b = singleContiguousEditBounds('hello', 'hallo');
    expect(b).toEqual({ a: 1, oldEnd: 2, newEnd: 2 });
  });
});

describe('linearToBaseInsertPosition', () => {
  it('maps index inside leading insert to anchor 0', () => {
    const pos = linearToBaseInsertPosition(1, 'ab', [{ id: 'x', position: 0, text: 'ZZ' }]);
    expect(pos).toBe(0);
  });
});

describe('linearEditToBatchOps + applyRevisionBatchToSlice', () => {
  it('applies typed insert at end', () => {
    const base = 'ab';
    const s0 = slice(base);
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const nextLinear = `${d0.linear}Z`;
    const ops = linearEditToBatchOps(
      d0.linear,
      nextLinear,
      d0.meta,
      s0.promptBaseText,
      s0.deletedMask,
      s0.inserts
    );
    expect(ops.some((o) => o.t === 'insert' && o.text === 'Z' && o.position === 2)).toBe(true);
    const s1 = applyRevisionBatchToSlice(s0, ops);
    const d1 = buildLinearDocument(s1.promptBaseText, s1.deletedMask, s1.inserts);
    expect(d1.linear).toBe(nextLinear);
  });

  it('toggles delete on one base character (linear length unchanged)', () => {
    const base = 'ab';
    const s0 = slice(base);
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const nextLinear = d0.linear.slice(0, 1) + d0.linear.slice(2);
    const ops = linearEditToBatchOps(
      d0.linear,
      nextLinear,
      d0.meta,
      s0.promptBaseText,
      s0.deletedMask,
      s0.inserts
    );
    expect(ops).toContainEqual({ t: 'delete_base', index: 1 });
    const s1 = applyRevisionBatchToSlice(s0, ops);
    expect(s1.deletedMask[1]).toBe(true);
    const d1 = buildLinearDocument(s1.promptBaseText, s1.deletedMask, s1.inserts);
    expect(d1.linear).toBe(d0.linear);
  });

  it('consecutive single-char inserts at same anchor stay in order', () => {
    const base = 'end';
    let s = slice(base);
    // Simulate typing 'v', 'u', 'o', 'n' one char at a time before 'end'
    for (const ch of ['v', 'u', 'o', 'n']) {
      const d = buildLinearDocument(s.promptBaseText, s.deletedMask, s.inserts);
      const insertedSoFar = d.linear.length - base.length;
      const nextLinear = d.linear.slice(0, insertedSoFar) + ch + d.linear.slice(insertedSoFar);
      const ops = linearEditToBatchOps(
        d.linear,
        nextLinear,
        d.meta,
        s.promptBaseText,
        s.deletedMask,
        s.inserts
      );
      s = applyRevisionBatchToSlice(s, ops);
    }
    const final = buildLinearDocument(s.promptBaseText, s.deletedMask, s.inserts);
    expect(final.linear).toBe('vuonend');
  });

  it('trims multiple characters from one insert op in one batch', () => {
    const s0: StructuredSectionRevisionSlice = {
      promptBaseText: 'a',
      deletedMask: [false],
      inserts: [{ id: 'ins1', position: 1, text: 'hello' }],
      refinementOpLog: [],
    };
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const nextLinear = 'aheo';
    const ops = linearEditToBatchOps(
      d0.linear,
      nextLinear,
      d0.meta,
      s0.promptBaseText,
      s0.deletedMask,
      s0.inserts
    );
    const trim = ops.find((o) => o.t === 'trim_insert_chars' && o.opId === 'ins1');
    expect(trim && trim.t === 'trim_insert_chars' ? [...trim.indices].sort((x, y) => x - y) : []).toEqual(
      [2, 3]
    );
    const s1 = applyRevisionBatchToSlice(s0, ops);
    expect(s1.inserts.find((i) => i.id === 'ins1')?.text).toBe('heo');
  });
});
