/**
 * Approximates a single contiguous "changed" region between two strings (prefix/suffix match).
 * Used for soft UI highlight after an AI prompt revision (no external diff library).
 */

export type TextHighlightRange = { start: number; end: number };

/**
 * Returns half-open ranges in `newText` to highlight as modified vs `oldText`.
 * If strings are equal, returns [].
 */
export function naiveChangedRangesInNewText(oldText: string, newText: string): TextHighlightRange[] {
  if (oldText === newText) return [];
  let i = 0;
  const a = oldText.length;
  const b = newText.length;
  while (i < a && i < b && oldText.charCodeAt(i) === newText.charCodeAt(i)) {
    i++;
  }
  let j = 0;
  while (
    j < a - i &&
    j < b - i &&
    oldText.charCodeAt(a - 1 - j) === newText.charCodeAt(b - 1 - j)
  ) {
    j++;
  }
  const start = i;
  const end = b - j;
  if (start >= end) {
    return [{ start: 0, end: b }];
  }
  return [{ start, end }];
}
