/**
 * Linear document model for plaintext revisioning: base chars (incl. struck) + insert runs,
 * aligned 1:1 with a hidden textarea for caret/input (no Monaco).
 */

import type { InsertOp } from './effectiveFromRevisionMask';

export type RevisionCharMeta =
  | { kind: 'base'; baseIndex: number }
  | { kind: 'insert'; opId: string; charIndex: number };

export interface LinearDocument {
  linear: string;
  meta: RevisionCharMeta[];
}

function sortedInserts(inserts: readonly InsertOp[]): InsertOp[] {
  return [...inserts].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Builds the plain string and per-character metadata (base vs insert) shown to the user.
 */
export function buildLinearDocument(
  baseText: string,
  deletedMask: readonly boolean[],
  inserts: readonly InsertOp[]
): LinearDocument {
  const ordered = sortedInserts(inserts);
  let ip = 0;
  let linear = '';
  const meta: RevisionCharMeta[] = [];
  for (let i = 0; i <= baseText.length; i++) {
    while (ip < ordered.length && ordered[ip].position === i) {
      const op = ordered[ip];
      for (let j = 0; j < op.text.length; j++) {
        linear += op.text[j];
        meta.push({ kind: 'insert', opId: op.id, charIndex: j });
      }
      ip++;
    }
    if (i < baseText.length) {
      linear += baseText[i];
      meta.push({ kind: 'base', baseIndex: i });
    }
  }
  return { linear, meta };
}

/**
 * Base index before which a new insert should attach when the user edits at linear index L
 * (uses document state before the edit).
 */
export function linearToBaseInsertPosition(
  L: number,
  baseText: string,
  inserts: readonly InsertOp[]
): number {
  const ordered = sortedInserts(inserts);
  let ip = 0;
  let pos = 0;
  for (let i = 0; i <= baseText.length; i++) {
    while (ip < ordered.length && ordered[ip].position === i) {
      const op = ordered[ip];
      const len = op.text.length;
      if (L <= pos) return i;
      if (L < pos + len) return i;
      pos += len;
      ip++;
    }
    if (i < baseText.length) {
      if (L === pos) return i;
      pos += 1;
    }
  }
  return baseText.length;
}

/** Internal batch op for APPLY_REVISION_OPS reducer. */
export type RevisionBatchOp =
  | { t: 'delete_base'; index: number }
  | { t: 'undelete_base'; index: number }
  | { t: 'trim_insert_chars'; opId: string; indices: number[] }
  | { t: 'insert'; position: number; text: string }
  /** Splice new text into an existing InsertOp at a given char position (avoids multi-op collisions). */
  | { t: 'splice_insert'; opId: string; atCharIndex: number; text: string };

/**
 * Detects a single contiguous edit between two linear strings (prefix/suffix match).
 */
export function singleContiguousEditBounds(
  prev: string,
  next: string
): { a: number; oldEnd: number; newEnd: number } | null {
  let a = 0;
  const max = Math.min(prev.length, next.length);
  while (a < max && prev[a] === next[a]) a++;
  let bo = prev.length - 1;
  let bn = next.length - 1;
  while (bo >= a && bn >= a && prev[bo] === next[bn]) {
    bo--;
    bn--;
  }
  const oldEnd = bo + 1;
  const newEnd = bn + 1;
  if (a === prev.length && a === next.length) return null;
  return { a, oldEnd, newEnd };
}

/**
 * Converts a linear textarea edit into batch ops (delete/undelete base, trim inserts, insert text).
 */
export function linearEditToBatchOps(
  prevLinear: string,
  nextLinear: string,
  meta: readonly RevisionCharMeta[],
  baseText: string,
  deletedMask: readonly boolean[],
  inserts: readonly InsertOp[]
): RevisionBatchOp[] {
  const bounds = singleContiguousEditBounds(prevLinear, nextLinear);
  if (!bounds) return [];
  const { a, oldEnd, newEnd } = bounds;
  const insertedText = nextLinear.slice(a, newEnd);

  const ops: RevisionBatchOp[] = [];
  const insertRemovalByOp = new Map<string, Set<number>>();

  for (let i = oldEnd - 1; i >= a; i--) {
    const m = meta[i];
    if (!m) continue;
    if (m.kind === 'base') {
      const bi = m.baseIndex;
      const isDel = bi < deletedMask.length && deletedMask[bi];
      if (isDel) {
        ops.push({ t: 'undelete_base', index: bi });
      } else {
        ops.push({ t: 'delete_base', index: bi });
      }
    } else {
      if (!insertRemovalByOp.has(m.opId)) insertRemovalByOp.set(m.opId, new Set());
      insertRemovalByOp.get(m.opId)!.add(m.charIndex);
    }
  }

  for (const [opId, idxSet] of insertRemovalByOp) {
    const indices = [...idxSet].sort((x, y) => x - y);
    if (indices.length > 0) {
      ops.push({ t: 'trim_insert_chars', opId, indices });
    }
  }

  if (insertedText.length > 0) {
    // If the cursor is immediately after an existing insert char, splice into that op
    // so chars always stay in insertion order (no UUID-sort ambiguity).
    const prevMeta = a > 0 ? meta[a - 1] : undefined;
    if (prevMeta?.kind === 'insert') {
      ops.push({
        t: 'splice_insert',
        opId: prevMeta.opId,
        atCharIndex: prevMeta.charIndex + 1,
        text: insertedText,
      });
    } else {
      const pos = linearToBaseInsertPosition(a, baseText, inserts);
      ops.push({ t: 'insert', position: pos, text: insertedText });
    }
  }

  return ops;
}
