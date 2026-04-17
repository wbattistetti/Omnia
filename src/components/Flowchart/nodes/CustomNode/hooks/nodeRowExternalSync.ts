/**
 * Reconciles React Flow node row props (store-driven `displayRows`) with local `nodeRows` state.
 * When structural updates come only from the workspace (e.g. subflow portal path sets `_state.handled`),
 * local state must follow props without dropping in-progress edits on the active row.
 */

import type { NodeRowData } from '../../../../../types/project';

/**
 * When props and local state both have the same row id, prefer local `text` if it differs.
 * React Flow `data.rows` can lag one frame behind `onUpdate` commits; without this, a sync
 * triggered by reorder/new rows would re-apply stale labels from props.
 */
function overlayLocalTextOntoDisplayRow(dr: NodeRowData, nodeRows: NodeRowData[]): NodeRowData {
  const loc = nodeRows.find((r) => r.id === dr.id);
  if (!loc || loc.text === dr.text) {
    return dr;
  }
  return { ...dr, text: loc.text };
}

/** Merge store rows with the locally edited row so external adds/reorders still apply. */
export function mergeExternalRowsFromStore(
  displayRows: NodeRowData[],
  nodeRows: NodeRowData[],
  editingRowId: string | null
): NodeRowData[] {
  if (editingRowId) {
    const localEditing = nodeRows.find((r) => r.id === editingRowId);
    if (!localEditing) {
      return displayRows;
    }
    // Editing row: full local row. Siblings: store wins (external portal updates while typing).
    return displayRows.map((dr) => (dr.id === editingRowId ? localEditing : dr));
  }
  return displayRows.map((dr) => overlayLocalTextOntoDisplayRow(dr, nodeRows));
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

/** Result of comparing store `displayRows` with local node row state. */
export type ExternalRowSyncPlan = { shouldSync: false } | { shouldSync: true; nextRows: NodeRowData[] };

/**
 * Pure decision for whether to pull `displayRows` into local state (see useNodeRowManagement effect).
 * Keeps editing keystrokes safe when structure is unchanged and no row is being edited.
 */
export function planExternalRowSync(
  displayRows: NodeRowData[],
  localRows: NodeRowData[],
  editingRowId: string | null
): ExternalRowSyncPlan {
  if (localRows.length > displayRows.length) {
    return { shouldSync: false };
  }

  const merged = mergeExternalRowsFromStore(displayRows, localRows, editingRowId);
  if (rowListsShallowEqual(localRows, merged)) {
    return { shouldSync: false };
  }

  const localSig = localRows.map((r) => r.id).join('\0');
  const displaySig = displayRows.map((r) => r.id).join('\0');
  const structuralMismatch = localSig !== displaySig || displayRows.length !== localRows.length;
  const storeHasNewRow = displayRows.some((r) => !localRows.some((nr) => nr.id === r.id));

  if (!structuralMismatch && !storeHasNewRow && !editingRowId) {
    return { shouldSync: false };
  }

  return { shouldSync: true, nextRows: merged };
}
