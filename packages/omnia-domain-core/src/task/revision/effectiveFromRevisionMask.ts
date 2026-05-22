/**
 * Derives the effective prompt from immutable base text, per-character delete mask, and insert ops.
 * Positions are indices in the original base (0..base.length).
 */

export interface InsertOp {
  id: string;
  position: number;
  text: string;
}

/**
 * Effective string: base without deleted code units, with inserts spliced at original-base positions.
 */
export function effectiveFromRevisionMask(
  baseText: string,
  deleted: readonly boolean[],
  inserts: readonly InsertOp[]
): string {
  const ordered = [...inserts].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.id.localeCompare(b.id);
  });
  let out = '';
  let ip = 0;
  for (let i = 0; i <= baseText.length; i++) {
    while (ip < ordered.length && ordered[ip].position === i) {
      out += ordered[ip].text;
      ip++;
    }
    if (i < baseText.length) {
      const del = i < deleted.length ? deleted[i] : false;
      if (!del) {
        out += baseText[i];
      }
    }
  }
  return out;
}
