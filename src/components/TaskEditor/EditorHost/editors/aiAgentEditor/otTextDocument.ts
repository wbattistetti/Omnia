/**
 * OT-style text document: apply ops from a fixed revision base, commit new ops, migrate v1 snapshots.
 */

import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import { diffToOps } from './otDiffToOps';
import type { OtOp, OtTextDocument, V1SectionSnapshotLike } from './otTypes';

function assertUtf16Range(label: string, len: string, start: number, end: number): void {
  if (start < 0 || end > len.length || start > end) {
    throw new Error(`${label}: invalid range [${start}, ${end}) for length ${len.length}`);
  }
}

function assertInsertPosition(label: string, len: string, position: number): void {
  if (position < 0 || position > len.length) {
    throw new Error(`${label}: invalid insert position ${position} for length ${len.length}`);
  }
}

/**
 * Creates an empty document with no edits relative to {@link revisionBase}.
 */
export function createOtDocument(revisionBase: string): OtTextDocument {
  return {
    revisionBase,
    opLog: [],
    currentText: revisionBase,
  };
}

/**
 * Applies a single op to {@link text} and returns the new string (UTF-16 indices).
 */
export function applyOperation(text: string, op: OtOp): string {
  if (op.type === 'delete') {
    assertUtf16Range('applyOperation(delete)', text, op.start, op.end);
    return text.slice(0, op.start) + text.slice(op.end);
  }
  assertInsertPosition('applyOperation(insert)', text, op.position);
  return text.slice(0, op.position) + op.text + text.slice(op.position);
}

/**
 * Folds {@link ops} onto {@link revisionBase} in order (each op sees the result of the previous).
 */
export function applyOperations(revisionBase: string, ops: readonly OtOp[]): string {
  let s = revisionBase;
  for (const op of ops) {
    s = applyOperation(s, op);
  }
  return s;
}

/**
 * Applies {@link newOps} to {@link doc.currentText} (they are relative to the current body, not the base),
 * then rewrites {@link OtTextDocument.opLog} as {@link diffToOps}(revisionBase, nextText) so that
 * {@link applyOperations}(revisionBase, opLog) === nextText without OT transform of indices.
 */
export function commitOperations(doc: OtTextDocument, newOps: readonly OtOp[]): OtTextDocument {
  const nextText = applyOperations(doc.currentText, newOps);
  const opLog = diffToOps(doc.revisionBase, nextText);
  return {
    revisionBase: doc.revisionBase,
    opLog,
    currentText: nextText,
  };
}

/**
 * Migrates a v1 mask/insert snapshot to an OT document: same revision base, effective body as current text, empty op log.
 */
export function v1SnapshotToOtDocument(v1: V1SectionSnapshotLike): OtTextDocument {
  const base = v1.base;
  const currentText = effectiveFromRevisionMask(base, v1.deletedMask, v1.inserts);
  return {
    revisionBase: base,
    opLog: [],
    currentText,
  };
}
