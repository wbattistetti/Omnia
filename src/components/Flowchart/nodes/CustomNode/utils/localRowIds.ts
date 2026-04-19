/**
 * Stable id scheme for lazily appended node rows before a task exists in the store.
 * Matches legacy `makeRowId` shape so ghost rows (task ids removed externally) stay distinguishable.
 */

/** Creates a pending-row id scoped to this React Flow node (`${nodeId}-${Date.now()}-${random}`). */
export function makePendingLocalRowId(nodeId: string): string {
  return `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * True if `rowId` matches the structural shape of {@link makePendingLocalRowId} for **any** node id
 * (`${nodeId}-${Date.now()}-${random}`). Used for sync so draft rows moved cross-node keep their id
 * (prefix still references the source node) and are not mistaken for store orphans.
 *
 * Task UUIDs do not match (timestamp segment is not 10+ digits).
 */
export function isLazyDraftRowId(rowId: string): boolean {
  const firstDash = rowId.indexOf('-');
  if (firstDash <= 0) {
    return false;
  }
  const rest = rowId.slice(firstDash + 1);
  const secondDash = rest.indexOf('-');
  if (secondDash <= 0) {
    return false;
  }
  const tsPart = rest.slice(0, secondDash);
  const tail = rest.slice(secondDash + 1);
  return (
    /^\d{10,}$/.test(tsPart) &&
    /^[a-z0-9]{4,16}$/i.test(tail)
  );
}

/**
 * True if `rowId` was produced by {@link makePendingLocalRowId} for this `nodeId`.
 * Task-backed rows use task UUIDs and must not match this pattern.
 */
export function isPendingLocalRowId(rowId: string, nodeId: string): boolean {
  return rowId.startsWith(`${nodeId}-`) && isLazyDraftRowId(rowId);
}
