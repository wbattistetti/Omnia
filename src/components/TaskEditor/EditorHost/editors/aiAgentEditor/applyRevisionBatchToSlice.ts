/**
 * Applies a batch of revision ops to one structured section slice (single reducer tick).
 */

import type { InsertOp } from './effectiveFromRevisionMask';
import type { StructuredSectionRevisionSlice } from './structuredSectionsRevisionReducer';
import type { RevisionBatchOp } from './textRevisionLinear';
import type { StructuredRefinementOp } from './structuredRefinementOps';

function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `ins-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Folds revision batch ops into a new slice (immutable).
 */
export function applyRevisionBatchToSlice(
  slice: StructuredSectionRevisionSlice,
  ops: readonly RevisionBatchOp[]
): StructuredSectionRevisionSlice {
  let base = slice.promptBaseText;
  let mask = [...slice.deletedMask];
  let ins = slice.inserts.map((x) => ({ ...x }));
  let log = [...slice.refinementOpLog];

  while (mask.length < base.length) mask.push(false);
  if (mask.length > base.length) mask.length = base.length;

  for (const op of ops) {
    if (op.t === 'delete_base') {
      const i = op.index;
      if (i < 0 || i >= base.length) continue;
      if (mask[i]) continue;
      mask[i] = true;
      log.push({ type: 'delete', start: i, end: i + 1, text: base[i] });
    } else if (op.t === 'undelete_base') {
      const i = op.index;
      if (i < 0 || i >= base.length) continue;
      if (!mask[i]) continue;
      mask[i] = false;
    } else if (op.t === 'trim_insert_chars') {
      const { opId, indices } = op;
      const ix = ins.findIndex((o) => o.id === opId);
      if (ix < 0) continue;
      const o = ins[ix];
      const remove = new Set(indices.filter((i) => i >= 0 && i < o.text.length));
      if (remove.size === 0) continue;
      const nextText = [...o.text].filter((_, i) => !remove.has(i)).join('');
      if (nextText === o.text) continue;
      const nextIns = [...ins];
      if (nextText.length === 0) {
        nextIns.splice(ix, 1);
      } else {
        nextIns[ix] = { ...o, text: nextText };
      }
      ins = nextIns;
    } else if (op.t === 'insert') {
      const pos = Math.max(0, Math.min(op.position, base.length));
      const text = op.text;
      if (!text) continue;
      const id = newId();
      ins = [...ins, { id, position: pos, text }];
      log.push({ type: 'insert', position: pos, text } as StructuredRefinementOp);
    } else if (op.t === 'splice_insert') {
      const { opId, atCharIndex, text } = op;
      if (!text) continue;
      const ix = ins.findIndex((o) => o.id === opId);
      if (ix < 0) continue;
      const o = ins[ix];
      const at = Math.max(0, Math.min(atCharIndex, o.text.length));
      const nextText = o.text.slice(0, at) + text + o.text.slice(at);
      const nextIns = [...ins];
      nextIns[ix] = { ...o, text: nextText };
      ins = nextIns;
      // Record for refine log at original base anchor
      log.push({ type: 'insert', position: o.position, text } as StructuredRefinementOp);
    } else if (op.t === 'set_insert_text') {
      const { opId, text } = op;
      const ix = ins.findIndex((o) => o.id === opId);
      if (ix < 0) continue;
      const o = ins[ix];
      const nextIns = [...ins];
      if (text.length === 0) {
        nextIns.splice(ix, 1);
      } else {
        nextIns[ix] = { ...o, text };
      }
      ins = nextIns;
      if (text.length > 0) {
        log.push({ type: 'insert', position: o.position, text } as StructuredRefinementOp);
      }
    }
  }

  return {
    ...slice,
    promptBaseText: base,
    deletedMask: mask,
    inserts: ins,
    refinementOpLog: log,
  };
}
