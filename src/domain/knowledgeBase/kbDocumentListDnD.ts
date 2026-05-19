/**
 * Flat-list reorder for KB document rows (same placement rules as sidebar DnD).
 */

export type KbListDropPlacement = 'before' | 'after';

export function reorderKbDocuments<T>(
  items: readonly T[],
  fromIndex: number,
  targetIndex: number,
  placement: KbListDropPlacement
): T[] {
  if (fromIndex < 0 || targetIndex < 0 || fromIndex >= items.length || targetIndex >= items.length) {
    return [...items];
  }
  if (fromIndex === targetIndex) return [...items];
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  let insertAt = targetIndex;
  if (fromIndex < targetIndex) insertAt -= 1;
  if (placement === 'after') insertAt += 1;
  insertAt = Math.max(0, Math.min(insertAt, next.length));
  next.splice(insertAt, 0, moved);
  return next;
}

/** Estimate list column width from longest filename (monospace-ish ~7px + chrome). */
export function estimateKbListWidthPx(
  documents: readonly { name: string }[],
  minPx: number,
  maxRatio: number,
  containerWidth: number
): number {
  const longest = documents.reduce((m, d) => Math.max(m, d.name.length), 0);
  const estimated = Math.ceil(longest * 7.2 + 88);
  const maxPx = Math.floor(containerWidth * maxRatio);
  return Math.min(maxPx, Math.max(minPx, estimated));
}
