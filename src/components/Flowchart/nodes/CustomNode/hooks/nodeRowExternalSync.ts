/**
 * Reconciles React Flow node row props (store-driven `displayRows`) with local `nodeRows` state.
 * When structural updates come only from the workspace (e.g. subflow portal path sets `_state.handled`),
 * local state must follow props without dropping in-progress edits on the active row.
 */

import type { NodeRowData } from '../../../../../types/project';

/** Merge store rows with the locally edited row so external adds/reorders still apply. */
export function mergeExternalRowsFromStore(
  displayRows: NodeRowData[],
  nodeRows: NodeRowData[],
  editingRowId: string | null
): NodeRowData[] {
  if (!editingRowId) {
    return displayRows;
  }
  const localEditing = nodeRows.find((r) => r.id === editingRowId);
  if (!localEditing) {
    return displayRows;
  }
  return displayRows.map((dr) => (dr.id === editingRowId ? localEditing : dr));
}

/** True if sync should skip setState (avoids loops and caret jumps). */
export function rowListsShallowEqual(a: NodeRowData[], b: NodeRowData[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) {
      return false;
    }
    if (stableRowJson(a[i]) !== stableRowJson(b[i])) {
      return false;
    }
  }
  return true;
}

function stableRowJson(r: NodeRowData): string {
  return JSON.stringify({
    id: r.id,
    text: r.text ?? '',
    included: r.included,
    taskId: (r as { taskId?: string }).taskId,
    type: (r as { type?: unknown }).type,
    isUndefined: r.isUndefined,
    heuristics: r.heuristics,
    meta: r.meta,
    factoryId: r.factoryId,
  });
}
