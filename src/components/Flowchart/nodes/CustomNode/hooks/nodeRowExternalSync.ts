/**
 * Reconciles React Flow node row props (store-driven `displayRows`) with transient `nodeRows` used by CustomNode.
 *
 * Structural truth lives in `displayRows` (FlowStore → RF props). Local rows follow props, with explicit exceptions:
 * - Text overlay while props lag one frame ({@link mergeExternalRowsFromStore})
 * - Row ids optimistically committed via `onUpdate` but not yet in props ({@link pendingHydrationIds})
 * - Row ids removed locally before props catch up ({@link pendingStructuralRemovalIds})
 * - Active editing row not yet materialized in props (new lazy row while `editingRowId` matches)
 *
 * No lazy-id pattern heuristics: pending rows are tracked only through explicit hydration ids.
 */

import type { NodeRowData } from '../../../../../types/project';
import { warnLocalGraphMutation } from '@domain/flowGraph';

let deriveSyncedNodeRowsWarnOnce = false;

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

/** Inputs for deriving the next local row list from authoritative props + optimistic state. */
export type SyncedNodeRowsInput = {
  displayRows: NodeRowData[];
  previousLocal: NodeRowData[];
  editingRowId: string | null;
  /** Ids introduced in the last parent commit and not yet visible in `displayRows`. */
  pendingHydrationIds: ReadonlySet<string>;
  /**
   * Ids removed in a local commit while `displayRows` may still list them until the next paint /
   * store round-trip (e.g. drag row to canvas — must not resurrect the row from stale props).
   */
  pendingStructuralRemovalIds: ReadonlySet<string>;
};

/**
 * Derives `nodeRows` aligned with store props while preserving in-flight UX:
 * overlays typing, pending commits, and the row currently being edited if absent from props.
 */
export function deriveSyncedNodeRows(input: SyncedNodeRowsInput): NodeRowData[] {
  if (!deriveSyncedNodeRowsWarnOnce) {
    deriveSyncedNodeRowsWarnOnce = true;
    warnLocalGraphMutation('nodeRowExternalSync:deriveSyncedNodeRows', {
      note: 'Local/store row merge — replace with RF viewer + FlowStore-only rows when migration completes.',
    });
  }
  const { displayRows, previousLocal, editingRowId, pendingHydrationIds, pendingStructuralRemovalIds } =
    input;
  const structuralDisplay = displayRows.filter((r) => !pendingStructuralRemovalIds.has(r.id));
  const displayIds = new Set(structuralDisplay.map((r) => r.id));
  const merged = mergeExternalRowsFromStore(structuralDisplay, previousLocal, editingRowId);

  const extras = previousLocal.filter((r) => {
    if (displayIds.has(r.id)) {
      return false;
    }
    return pendingHydrationIds.has(r.id) || r.id === editingRowId;
  });

  const mergedIds = new Set(merged.map((r) => r.id));
  const tail = extras.filter((r) => !mergedIds.has(r.id));
  return [...merged, ...tail];
}
