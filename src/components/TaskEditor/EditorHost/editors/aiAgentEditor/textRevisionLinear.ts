/**
 * Linear document model for plaintext revisioning: base chars (incl. struck) + insert runs,
 * aligned 1:1 with a hidden textarea for caret/input (no Monaco).
 *
 * Edits map prev→next linear strings via character-level Myers diff (`diffChars`): ordered hunks
 * (equal | insert | delete | replace) in code units. No single-contiguous-region assumption;
 * paste, undo/redo, IME-style commits, and cross-insert/base edits collapse to one coherent batch.
 */

import { diffChars } from 'diff';
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
  | { t: 'splice_insert'; opId: string; atCharIndex: number; text: string }
  /** Atomically replace an insert op body (avoids trim-then-splice ordering bugs on the same op). */
  | { t: 'set_insert_text'; opId: string; text: string };

/** One diff hunk between previous and next linear strings (coordinates in code units). */
export type LinearDiffHunk = {
  type: 'equal' | 'insert' | 'delete' | 'replace';
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
};

type DiffChange = { value: string; added?: boolean; removed?: boolean };

/**
 * Character-level diff as ordered hunks (Myers via `diff` package).
 */
export function computeLinearDiffHunks(prev: string, next: string): LinearDiffHunk[] {
  if (prev === next) {
    return prev.length > 0 ? [{ type: 'equal', aStart: 0, aEnd: prev.length, bStart: 0, bEnd: next.length }] : [];
  }

  const changes = diffChars(prev, next) as DiffChange[];
  let a = 0;
  let b = 0;
  const hunks: LinearDiffHunk[] = [];
  let i = 0;

  while (i < changes.length) {
    const ch = changes[i];
    if (!ch.added && !ch.removed) {
      const len = ch.value.length;
      if (len > 0) {
        hunks.push({ type: 'equal', aStart: a, aEnd: a + len, bStart: b, bEnd: b + len });
      }
      a += len;
      b += len;
      i++;
      continue;
    }

    if (ch.removed) {
      const delStart = a;
      let delLen = 0;
      while (i < changes.length && changes[i].removed) {
        delLen += changes[i].value.length;
        i++;
      }
      const insStartB = b;
      let insLen = 0;
      if (i < changes.length && changes[i].added) {
        while (i < changes.length && changes[i].added) {
          insLen += changes[i].value.length;
          i++;
        }
        const delEnd = delStart + delLen;
        const insEndB = insStartB + insLen;
        if (insLen === 0) {
          hunks.push({ type: 'delete', aStart: delStart, aEnd: delEnd, bStart: insStartB, bEnd: insStartB });
        } else if (delLen === 0) {
          hunks.push({ type: 'insert', aStart: delStart, aEnd: delStart, bStart: insStartB, bEnd: insEndB });
        } else {
          hunks.push({ type: 'replace', aStart: delStart, aEnd: delEnd, bStart: insStartB, bEnd: insEndB });
        }
        a = delEnd;
        b = insEndB;
      } else {
        hunks.push({ type: 'delete', aStart: delStart, aEnd: delStart + delLen, bStart: b, bEnd: b });
        a = delStart + delLen;
      }
      continue;
    }

    if (ch.added) {
      const insStartB = b;
      let insLen = 0;
      while (i < changes.length && changes[i].added) {
        insLen += changes[i].value.length;
        i++;
      }
      hunks.push({ type: 'insert', aStart: a, aEnd: a, bStart: insStartB, bEnd: insStartB + insLen });
      b = insStartB + insLen;
      continue;
    }

    i++;
  }

  return hunks;
}

/**
 * If a replace hunk removes only a contiguous run inside one insert op, returns the new insert string.
 */
export function tryReplaceInsertRunOnly(
  h: LinearDiffHunk,
  meta: readonly RevisionCharMeta[],
  nextLinear: string,
  inserts: readonly InsertOp[]
): { opId: string; text: string } | null {
  if (h.type !== 'replace' || h.aEnd <= h.aStart) return null;
  const opIds = new Set<string>();
  const charIdx: number[] = [];
  for (let k = h.aStart; k < h.aEnd; k++) {
    const m = meta[k];
    if (!m || m.kind !== 'insert') return null;
    opIds.add(m.opId);
    if (opIds.size > 1) return null;
    charIdx.push(m.charIndex);
  }
  if (opIds.size !== 1) return null;
  const sorted = [...charIdx].sort((x, y) => x - y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return null;
  }
  const opId = [...opIds][0];
  const op = inserts.find((o) => o.id === opId);
  if (!op) return null;
  const minC = sorted[0];
  const maxC = sorted[sorted.length - 1];
  const inserted = nextLinear.slice(h.bStart, h.bEnd);
  const nextText = op.text.slice(0, minC) + inserted + op.text.slice(maxC + 1);
  return { opId, text: nextText };
}

/**
 * Maps a linear insertion point in `prev` (before applying this batch) to `insert` vs `splice_insert`.
 * Prefers extending the insert run to the left; otherwise attaches before the insert run on the right.
 */
export function resolveLinearInsertToBatchOp(
  aStart: number,
  text: string,
  meta: readonly RevisionCharMeta[],
  baseText: string,
  inserts: readonly InsertOp[]
): RevisionBatchOp {
  if (text.length === 0) {
    throw new Error('resolveLinearInsertToBatchOp: empty text');
  }
  const left = aStart > 0 ? meta[aStart - 1] : undefined;
  const right = aStart < meta.length ? meta[aStart] : undefined;
  if (left?.kind === 'insert') {
    return {
      t: 'splice_insert',
      opId: left.opId,
      atCharIndex: left.charIndex + 1,
      text,
    };
  }
  if (right?.kind === 'insert') {
    return {
      t: 'splice_insert',
      opId: right.opId,
      atCharIndex: right.charIndex,
      text,
    };
  }
  return {
    t: 'insert',
    position: linearToBaseInsertPosition(aStart, baseText, inserts),
    text,
  };
}

/**
 * Converts a linear textarea edit into batch ops (delete/undelete base, trim inserts, insert text).
 * Supports multiple disjoint regions (paste, undo/redo, IME, cross-insert/base selection).
 */
export function linearEditToBatchOps(
  prevLinear: string,
  nextLinear: string,
  meta: readonly RevisionCharMeta[],
  baseText: string,
  deletedMask: readonly boolean[],
  inserts: readonly InsertOp[]
): RevisionBatchOp[] {
  if (prevLinear === nextLinear) return [];

  const hunks = computeLinearDiffHunks(prevLinear, nextLinear);
  const actionable = hunks.filter((h) => h.type !== 'equal');
  if (actionable.length === 0) return [];

  if (actionable.length === 1 && actionable[0].type === 'replace') {
    const shortcut = tryReplaceInsertRunOnly(actionable[0], meta, nextLinear, inserts);
    if (shortcut) {
      return [{ t: 'set_insert_text', opId: shortcut.opId, text: shortcut.text }];
    }
  }

  const insertRemovalByOp = new Map<string, Set<number>>();
  const baseOps: RevisionBatchOp[] = [];

  const absorbDeleteRange = (aStart: number, aEnd: number) => {
    for (let k = aEnd - 1; k >= aStart; k--) {
      const m = meta[k];
      if (!m) continue;
      if (m.kind === 'base') {
        const bi = m.baseIndex;
        const isDel = bi < deletedMask.length && deletedMask[bi];
        if (isDel) {
          baseOps.push({ t: 'undelete_base', index: bi });
        } else {
          baseOps.push({ t: 'delete_base', index: bi });
        }
      } else {
        if (!insertRemovalByOp.has(m.opId)) insertRemovalByOp.set(m.opId, new Set());
        insertRemovalByOp.get(m.opId)!.add(m.charIndex);
      }
    }
  };

  type InsertJob = { aStart: number; text: string; bStart: number };
  const insertJobs: InsertJob[] = [];

  const sortedHunks = [...actionable].sort((x, y) => x.aStart - y.aStart || x.bStart - y.bStart);

  for (const h of sortedHunks) {
    if (h.type === 'delete') {
      absorbDeleteRange(h.aStart, h.aEnd);
    } else if (h.type === 'replace') {
      absorbDeleteRange(h.aStart, h.aEnd);
      const text = nextLinear.slice(h.bStart, h.bEnd);
      if (text.length > 0) {
        insertJobs.push({ aStart: h.aStart, text, bStart: h.bStart });
      }
    } else if (h.type === 'insert') {
      const text = nextLinear.slice(h.bStart, h.bEnd);
      if (text.length > 0) {
        insertJobs.push({ aStart: h.aStart, text, bStart: h.bStart });
      }
    }
  }

  const ops: RevisionBatchOp[] = [...baseOps];
  for (const [opId, idxSet] of insertRemovalByOp) {
    const indices = [...idxSet].sort((x, y) => x - y);
    if (indices.length > 0) {
      ops.push({ t: 'trim_insert_chars', opId, indices });
    }
  }

  insertJobs.sort((x, y) => x.aStart - y.aStart || x.bStart - y.bStart);
  for (const job of insertJobs) {
    ops.push(resolveLinearInsertToBatchOp(job.aStart, job.text, meta, baseText, inserts));
  }

  return consolidateSpliceInsertsInBatch(ops, inserts);
}

type SpliceInsertOp = Extract<RevisionBatchOp, { t: 'splice_insert' }>;

/**
 * Merges consecutive splice_insert ops targeting the same InsertOp into one set_insert_text.
 * atCharIndex values refer to the insert string before this batch; later splices must account
 * length added by earlier splices (same batch).
 */
export function consolidateSpliceInsertsInBatch(
  ops: RevisionBatchOp[],
  inserts: readonly InsertOp[]
): RevisionBatchOp[] {
  const out: RevisionBatchOp[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.t !== 'splice_insert') {
      out.push(op);
      i += 1;
      continue;
    }
    const run: SpliceInsertOp[] = [];
    const opId = op.opId;
    while (i < ops.length && ops[i].t === 'splice_insert' && ops[i].opId === opId) {
      run.push(ops[i] as SpliceInsertOp);
      i += 1;
    }
    if (run.length === 1) {
      out.push(run[0]);
      continue;
    }
    const orig = inserts.find((o) => o.id === opId);
    if (!orig) {
      out.push(...run);
      continue;
    }
    const sorted = [...run].sort((a, b) => a.atCharIndex - b.atCharIndex);
    let text = orig.text;
    let addedBefore = 0;
    for (const s of sorted) {
      const pos = s.atCharIndex + addedBefore;
      const at = Math.max(0, Math.min(pos, text.length));
      text = text.slice(0, at) + s.text + text.slice(at);
      addedBefore += s.text.length;
    }
    out.push({ t: 'set_insert_text', opId, text });
  }
  return out;
}
