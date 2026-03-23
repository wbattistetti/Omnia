/**
 * Maps two UTF-16 strings to a minimal op sequence (single contiguous region, else full replace).
 */

import type { OtOp } from './otTypes';

/**
 * Builds ops such that {@link applyOperations}(prev, ops) === next when applied in order.
 * Uses longest common prefix + longest common suffix on the tails; if they overlap, falls back
 * to delete-all + insert-all.
 */
export function diffToOps(prev: string, next: string): OtOp[] {
  if (prev === next) {
    return [];
  }

  const n = prev.length;
  const m = next.length;

  let i = 0;
  while (i < n && i < m && prev.charCodeAt(i) === next.charCodeAt(i)) {
    i++;
  }

  let k = 0;
  while (k < n - i && k < m - i && prev.charCodeAt(n - 1 - k) === next.charCodeAt(m - 1 - k)) {
    k++;
  }

  if (i + k > n || i + k > m) {
    return fallbackReplaceAll(prev, next);
  }

  const delStart = i;
  const delEnd = n - k;
  const insertText = next.slice(i, m - k);

  const ops: OtOp[] = [];
  if (delEnd > delStart) {
    ops.push({ type: 'delete', start: delStart, end: delEnd });
  }
  if (insertText.length > 0) {
    ops.push({ type: 'insert', position: delStart, text: insertText });
  }

  return ops;
}

function fallbackReplaceAll(prev: string, next: string): OtOp[] {
  const ops: OtOp[] = [];
  if (prev.length > 0) {
    ops.push({ type: 'delete', start: 0, end: prev.length });
  }
  if (next.length > 0) {
    ops.push({ type: 'insert', position: 0, text: next });
  }
  return ops;
}
