/**
 * Ensures each row `id` appears at most once (first occurrence wins). Prevents React duplicate-key
 * crashes when transient merges produce duplicated row ids on the same node.
 */

import type { NodeRowData } from '../../../../../types/project';

export function dedupeNodeRowsById(rows: NodeRowData[] | undefined | null): NodeRowData[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const seen = new Set<string>();
  const out: NodeRowData[] = [];
  for (const r of rows) {
    const id = String(r?.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

/** Same as {@link dedupeNodeRowsById}; logs once in dev when duplicates were present. */
export function dedupeNodeRowsByIdWithDevLog(
  rows: NodeRowData[] | undefined | null,
  context: string,
  nodeId: string,
): NodeRowData[] {
  const deduped = dedupeNodeRowsById(rows);
  if (
    import.meta.env.DEV &&
    Array.isArray(rows) &&
    rows.length > deduped.length
  ) {
    console.warn(
      `[dedupeNodeRows] node ${nodeId}: dropped ${rows.length - deduped.length} duplicate row id(s) (${context})`,
    );
  }
  return deduped;
}
