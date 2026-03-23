/**
 * Unit tests for OT document helpers and diffToOps.
 */

import { describe, expect, it } from 'vitest';
import { diffToOps } from './otDiffToOps';
import {
  applyOperations,
  commitOperations,
  createOtDocument,
  v1SnapshotToOtDocument,
} from './otTextDocument';
import type { OtOp } from './otTypes';

function expectApply(prev: string, next: string): void {
  const ops = diffToOps(prev, next);
  expect(applyOperations(prev, ops)).toBe(next);
}

describe('diffToOps', () => {
  it('returns empty when strings are equal', () => {
    expect(diffToOps('abc', 'abc')).toEqual([]);
  });

  it('handles pure insert in the middle', () => {
    expectApply('hello world', 'hello brave world');
  });

  it('handles single-character replace', () => {
    expectApply('hello', 'hallo');
  });

  it('handles empty to non-empty', () => {
    expectApply('', 'hello');
  });

  it('handles non-empty to empty', () => {
    expectApply('hello', '');
  });

  it('handles surrogate pairs (emoji) as UTF-16 code units', () => {
    const a = 'hi😀';
    const b = 'hi😁';
    expectApply(a, b);
  });

  it('handles full-string reorder (non-overlapping contiguous edit)', () => {
    const prev = 'abc';
    const next = 'cba';
    const ops = diffToOps(prev, next);
    expect(applyOperations(prev, ops)).toBe(next);
    expect(ops.length).toBeGreaterThan(0);
  });
});

describe('applyOperations', () => {
  it('throws on invalid delete range', () => {
    expect(() => applyOperations('ab', [{ type: 'delete', start: 0, end: 3 }])).toThrow();
  });

  it('throws on invalid insert position', () => {
    expect(() => applyOperations('ab', [{ type: 'insert', position: 3, text: 'x' }])).toThrow();
  });
});

describe('commitOperations', () => {
  it('merges incremental ops by canonicalizing from base', () => {
    let doc = createOtDocument('abc');
    const step1: OtOp[] = diffToOps(doc.currentText, 'abx');
    doc = commitOperations(doc, step1);
    expect(doc.currentText).toBe('abx');
    expect(applyOperations(doc.revisionBase, doc.opLog)).toBe('abx');

    const step2: OtOp[] = diffToOps(doc.currentText, 'abxy');
    doc = commitOperations(doc, step2);
    expect(doc.currentText).toBe('abxy');
    expect(applyOperations(doc.revisionBase, doc.opLog)).toBe('abxy');
  });
});

describe('v1SnapshotToOtDocument', () => {
  it('maps mask/inserts to currentText and empty opLog', () => {
    const doc = v1SnapshotToOtDocument({
      base: 'ab',
      deletedMask: [false, false],
      inserts: [{ id: '1', position: 1, text: 'XY' }],
    });
    expect(doc.revisionBase).toBe('ab');
    expect(doc.currentText).toBe('aXYb');
    expect(doc.opLog).toEqual([]);
  });
});
