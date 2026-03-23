/**
 * Shared UTF-16 string diff helpers for revisioning: longest common prefix/suffix split
 * used for non-interlaced visual diffs (OT display + linear textarea hunk detection).
 */

/**
 * Longest common prefix length between {@link a} and {@link b} (code units).
 */
export function commonPrefixLength(a: string, b: string): number {
  let p = 0;
  const n = Math.min(a.length, b.length);
  while (p < n && a[p] === b[p]) {
    p++;
  }
  return p;
}

/**
 * Longest common suffix length after {@link prefixLen}, without overlapping the prefix regions.
 */
export function commonSuffixLength(a: string, b: string, prefixLen: number): number {
  let s = 0;
  while (
    s < a.length - prefixLen &&
    s < b.length - prefixLen &&
    a[a.length - 1 - s] === b[b.length - 1 - s]
  ) {
    s++;
  }
  return s;
}

/**
 * Splits two strings into shared prefix, shared suffix, and differing middles (UTF-16).
 * Invariant: {@link a} === prefix + aMiddle + suffix (as substrings) and same for {@link b} with bMiddle.
 */
export function splitPrefixSuffixMiddle(
  a: string,
  b: string
): { prefixLen: number; suffixLen: number; aMiddle: string; bMiddle: string } {
  const prefixLen = commonPrefixLength(a, b);
  const suffixLen = commonSuffixLength(a, b, prefixLen);
  return {
    prefixLen,
    suffixLen,
    aMiddle: a.slice(prefixLen, a.length - suffixLen),
    bMiddle: b.slice(prefixLen, b.length - suffixLen),
  };
}

/**
 * True if {@link b} equals {@link a} with its middle replaced by {@link bMiddle}
 * (same prefix/suffix boundaries as {@link splitPrefixSuffixMiddle}).
 */
export function isSingleContiguousEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const { prefixLen, suffixLen, bMiddle } = splitPrefixSuffixMiddle(a, b);
  const reconstructed = a.slice(0, prefixLen) + bMiddle + a.slice(a.length - suffixLen);
  return reconstructed === b;
}
