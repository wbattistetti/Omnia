/**
 * Character ranges in the designer draft that were added vs the agent baseline (for Monaco decorations).
 */

import { diffChars } from 'diff';

export type CharRange = { readonly start: number; readonly end: number };

/** Merges adjacent or overlapping ranges. */
export function mergeCharRanges(ranges: readonly CharRange[]): CharRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: CharRange[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.start <= last.end) {
      out[out.length - 1] = { start: last.start, end: Math.max(last.end, cur.end) };
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * UTF-16 ranges in `draft` that are not in `baseline` (added hunks only, phase 1).
 * Uses raw strings so offsets match Monaco model positions.
 */
export function computeDesignerAddedCharRanges(baseline: string, draft: string): CharRange[] {
  const base = String(baseline ?? '');
  if (!base.trim()) return [];
  const cur = String(draft ?? '');
  if (base === cur) return [];

  const changes = diffChars(base, cur);
  const ranges: CharRange[] = [];
  let draftOffset = 0;

  for (const part of changes) {
    const len = part.value.length;
    if (part.added) {
      if (len > 0) {
        ranges.push({ start: draftOffset, end: draftOffset + len });
      }
      draftOffset += len;
    } else if (part.removed) {
      // Removed text is not present in draft.
    } else {
      draftOffset += len;
    }
  }

  return mergeCharRanges(ranges);
}
