/**
 * Tests for linear revision document, multi-hunk diff, and edit-to-batch conversion.
 */

import { describe, expect, it } from 'vitest';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import {
  buildLinearDocument,
  computeLinearDiffHunks,
  consolidateSpliceInsertsInBatch,
  linearEditToBatchOps,
  linearToBaseInsertPosition,
  resolveLinearInsertToBatchOp,
  type RevisionBatchOp,
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

function roundTrip(
  s: StructuredSectionRevisionSlice,
  nextLinear: string
): {
  ops: ReturnType<typeof linearEditToBatchOps>;
  s1: StructuredSectionRevisionSlice;
  linear1: string;
} {
  const d0 = buildLinearDocument(s.promptBaseText, s.deletedMask, s.inserts);
  const ops = linearEditToBatchOps(
    d0.linear,
    nextLinear,
    d0.meta,
    s.promptBaseText,
    s.deletedMask,
    s.inserts
  );
  const s1 = applyRevisionBatchToSlice(s, ops);
  const d1 = buildLinearDocument(s1.promptBaseText, s1.deletedMask, s1.inserts);
  return { ops, s1, linear1: d1.linear };
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

describe('computeLinearDiffHunks', () => {
  it('returns empty when strings are equal', () => {
    expect(computeLinearDiffHunks('abc', 'abc').every((h) => h.type === 'equal')).toBe(true);
  });

  it('classifies single-character replacement', () => {
    const h = computeLinearDiffHunks('hello', 'hallo').filter((x) => x.type !== 'equal');
    expect(h).toHaveLength(1);
    expect(h[0].type).toBe('replace');
    expect(h[0].aStart).toBe(1);
    expect(h[0].aEnd).toBe(2);
  });

  it('detects two disjoint change regions (non-contiguous)', () => {
    const hunks = computeLinearDiffHunks('aaa', 'axaya').filter((h) => h.type !== 'equal');
    expect(hunks.length).toBeGreaterThanOrEqual(2);
    const inserts = hunks.filter((h) => h.type === 'insert');
    expect(inserts.length).toBeGreaterThanOrEqual(2);
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
    const { ops, linear1 } = roundTrip(s0, nextLinear);
    expect(ops.some((o) => o.t === 'insert' && o.text === 'Z' && o.position === 2)).toBe(true);
    expect(linear1).toBe(nextLinear);
  });

  it('replaces whole word in base (golden)', () => {
    const s0 = slice('foo bar baz');
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const next = 'foo wiz baz';
    const { s1 } = roundTrip(s0, next);
    expect(effectiveFromRevisionMask(s1.promptBaseText, s1.deletedMask, s1.inserts)).toBe(next);
  });

  it('deletes whole word in base (golden)', () => {
    const s0 = slice('foo bar baz');
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const next = 'foo baz';
    const { linear1, s1, ops } = roundTrip(s0, next);
    expect(linear1).toBe(d0.linear);
    expect(effectiveFromRevisionMask(s1.promptBaseText, s1.deletedMask, s1.inserts)).toBe(next);
    const delCount = ops.filter((o) => o.t === 'delete_base').length;
    expect(delCount).toBeGreaterThanOrEqual(3);
    expect(s1.deletedMask.filter(Boolean).length).toBe(delCount);
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

  it('edits inside green insert without jumping (splice + trim)', () => {
    const s0: StructuredSectionRevisionSlice = {
      promptBaseText: 'a',
      deletedMask: [false],
      inserts: [{ id: 'ins1', position: 1, text: 'hello' }],
      refinementOpLog: [],
    };
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    expect(d0.linear).toBe('ahello');
    const nextLinear = 'ahelo';
    const { linear1, ops } = roundTrip(s0, nextLinear);
    expect(linear1).toBe(nextLinear);
    const trim = ops.find((o) => o.t === 'trim_insert_chars' && o.opId === 'ins1');
    expect(trim && trim.t === 'trim_insert_chars' ? [...trim.indices].sort((x, y) => x - y) : []).toEqual([3]);
  });

  it('types new chars inside middle of insert run (splice_insert)', () => {
    const s0: StructuredSectionRevisionSlice = {
      promptBaseText: 'x',
      deletedMask: [false],
      inserts: [{ id: 'i', position: 1, text: 'ab' }],
      refinementOpLog: [],
    };
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const nextLinear = 'xazb';
    const { linear1, ops } = roundTrip(s0, nextLinear);
    expect(linear1).toBe(nextLinear);
    expect(ops.some((o) => o.t === 'splice_insert' && o.text === 'z')).toBe(true);
  });

  it('selection spanning insert run only: replace XY with Z via set_insert_text', () => {
    const s0: StructuredSectionRevisionSlice = {
      promptBaseText: 'ab',
      deletedMask: [false, false],
      inserts: [{ id: 'ins', position: 1, text: 'XY' }],
      refinementOpLog: [],
    };
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    expect(d0.linear).toBe('aXYb');
    const nextLinear = 'aZb';
    const { linear1, ops } = roundTrip(s0, nextLinear);
    expect(linear1).toBe(nextLinear);
    expect(ops).toEqual([{ t: 'set_insert_text', opId: 'ins', text: 'Z' }]);
  });

  it('golden: replace spans last insert char and following base (textarea aXZ → linear aXZb + struck b)', () => {
    const s0: StructuredSectionRevisionSlice = {
      promptBaseText: 'ab',
      deletedMask: [false, false],
      inserts: [{ id: 'ins', position: 1, text: 'XY' }],
      refinementOpLog: [],
    };
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    expect(d0.linear).toBe('aXYb');
    const nextLinear = 'aXZ';
    const { linear1, s1 } = roundTrip(s0, nextLinear);
    expect(linear1).toBe('aXZb');
    expect(effectiveFromRevisionMask(s1.promptBaseText, s1.deletedMask, s1.inserts)).toBe('aXZ');
  });

  it('IME-style single-shot composition (wide replace segment)', () => {
    const s0 = slice('base');
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const nextLinear = 'ba汉字se';
    const { linear1 } = roundTrip(s0, nextLinear);
    expect(linear1).toBe(nextLinear);
  });

  it('paste: two disjoint insertions in one value change', () => {
    const s0 = slice('aaa');
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    const nextLinear = 'axaya';
    const { linear1, ops } = roundTrip(s0, nextLinear);
    expect(linear1).toBe(nextLinear);
    const inserts = ops.filter((o) => o.t === 'insert');
    expect(inserts.length).toBe(2);
  });

  it('simulated undo: jump back to previous linear snapshot', () => {
    let s = slice('hi');
    const dA = buildLinearDocument(s.promptBaseText, s.deletedMask, s.inserts);
    const afterType = `${dA.linear}!`;
    s = roundTrip(s, afterType).s1;
    const dB = buildLinearDocument(s.promptBaseText, s.deletedMask, s.inserts);
    const { linear1 } = roundTrip(s, dA.linear);
    expect(linear1).toBe(dA.linear);
    expect(dB.linear).toBe(afterType);
  });

  it('non-contiguous strike: delete one base letter with insert between unchanged', () => {
    const s0: StructuredSectionRevisionSlice = {
      promptBaseText: 'abcde',
      deletedMask: [false, false, false, false, false],
      inserts: [{ id: 'm', position: 2, text: '|' }],
      refinementOpLog: [],
    };
    const d0 = buildLinearDocument(s0.promptBaseText, s0.deletedMask, s0.inserts);
    expect(d0.linear).toBe('ab|cde');
    const nextLinear = 'ab|ce';
    const { linear1, ops, s1 } = roundTrip(s0, nextLinear);
    expect(linear1).toBe(d0.linear);
    expect(effectiveFromRevisionMask(s1.promptBaseText, s1.deletedMask, s1.inserts)).toBe(nextLinear);
    expect(ops.filter((o) => o.t === 'delete_base').length).toBe(1);
  });

  it('consecutive single-char inserts at same anchor stay in order', () => {
    const base = 'end';
    let s = slice(base);
    for (const ch of ['v', 'u', 'o', 'n']) {
      const d = buildLinearDocument(s.promptBaseText, s.deletedMask, s.inserts);
      const insertedSoFar = d.linear.length - base.length;
      const nextLinear = d.linear.slice(0, insertedSoFar) + ch + d.linear.slice(insertedSoFar);
      s = roundTrip(s, nextLinear).s1;
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

describe('consolidateSpliceInsertsInBatch', () => {
  it('merges consecutive splices on same op (pre-batch char indices + length shift)', () => {
    const inserts = [{ id: 'i', position: 0, text: 'hello' }];
    const raw: RevisionBatchOp[] = [
      { t: 'splice_insert', opId: 'i', atCharIndex: 1, text: 'X' },
      { t: 'splice_insert', opId: 'i', atCharIndex: 4, text: 'Y' },
    ];
    const merged = consolidateSpliceInsertsInBatch(raw, inserts);
    expect(merged).toEqual([{ t: 'set_insert_text', opId: 'i', text: 'hXellYo' }]);
  });

  it('leaves single splice and unrelated ops unchanged', () => {
    const inserts = [{ id: 'a', position: 0, text: 'z' }];
    const raw: RevisionBatchOp[] = [
      { t: 'delete_base', index: 0 },
      { t: 'splice_insert', opId: 'a', atCharIndex: 0, text: 'q' },
    ];
    expect(consolidateSpliceInsertsInBatch(raw, inserts)).toEqual(raw);
  });
});

describe('resolveLinearInsertToBatchOp', () => {
  it('splices at start of insert when inserting before first green char', () => {
    const { linear, meta } = buildLinearDocument('z', [], [{ id: 'g', position: 0, text: 'ab' }]);
    expect(linear).toBe('abz');
    const op = resolveLinearInsertToBatchOp(0, 'X', meta, 'z', [{ id: 'g', position: 0, text: 'ab' }]);
    expect(op).toEqual({ t: 'splice_insert', opId: 'g', atCharIndex: 0, text: 'X' });
  });
});
