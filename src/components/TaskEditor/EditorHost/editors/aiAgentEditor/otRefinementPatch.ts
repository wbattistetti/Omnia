/**
 * Maps base vs effective body to {@link StructuredRefinementOp} for design-time Refine API payloads.
 */

import type { StructuredRefinementOp } from './structuredRefinementOps';

/**
 * Emits at most one delete + one insert on the IA base (UTF-16), matching the contiguous diff model.
 */
export function baseRelativeDiffToRefinementOps(base: string, current: string): StructuredRefinementOp[] {
  if (base === current) {
    return [];
  }
  const n = base.length;
  const m = current.length;

  let i = 0;
  while (i < n && i < m && base.charCodeAt(i) === current.charCodeAt(i)) {
    i++;
  }

  let k = 0;
  while (k < n - i && k < m - i && base.charCodeAt(n - 1 - k) === current.charCodeAt(m - 1 - k)) {
    k++;
  }

  if (i + k > n || i + k > m) {
    const out: StructuredRefinementOp[] = [];
    if (n > 0) {
      out.push({ type: 'delete', start: 0, end: n, text: base });
    }
    if (current.length > 0) {
      out.push({ type: 'insert', position: 0, text: current });
    }
    return out;
  }

  const out: StructuredRefinementOp[] = [];
  const delEnd = n - k;
  if (delEnd > i) {
    out.push({ type: 'delete', start: i, end: delEnd, text: base.slice(i, delEnd) });
  }
  const ins = current.slice(i, m - k);
  if (ins.length > 0) {
    out.push({ type: 'insert', position: i, text: ins });
  }
  return out;
}
