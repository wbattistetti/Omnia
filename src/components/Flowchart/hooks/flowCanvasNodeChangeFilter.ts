/**
 * Filters React Flow onNodesChange batches: layout via semantic events only;
 * workspace path may update selection / add / remove without touching positions.
 */

import { applyNodeChanges, type Node, type NodeChange } from 'reactflow';

export function isDraggingPositionChange(ch: NodeChange): boolean {
  return ch.type === 'position' && (ch as { dragging?: boolean }).dragging === true;
}

export function isNonDragPositionChange(ch: NodeChange): boolean {
  return ch.type === 'position' && (ch as { dragging?: boolean }).dragging !== true;
}

/**
 * Positions commit only via NODE_POSITION_COMMITTED; reset/replace are not user-driven.
 * Dimensions are written by NODE_LAYOUT_SETTLED (with updateNodeInternals) — drop them here
 * to avoid a redundant store update that skips the updateNodeInternals call.
 */
export function filterWorkspaceNodeChanges(changes: NodeChange[]): NodeChange[] {
  return changes.filter((ch) => {
    if (isDraggingPositionChange(ch) || isNonDragPositionChange(ch)) return false;
    if (ch.type === 'dimensions' || ch.type === 'replace' || ch.type === 'reset') return false;
    // 'select', 'add', 'remove' pass through.
    return true;
  });
}

/**
 * applyNodeChanges can merge stale RF-internal positions on dimensions/select;
 * always keep positions from the authoritative store snapshot (`prev`).
 */
export function applyWorkspaceNodeChangesPreservingPositions(
  prev: Node[],
  changes: NodeChange[]
): Node[] {
  if (changes.length === 0) return prev;
  const posById = new Map(
    prev.map((n) => [
      n.id,
      n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y)
        ? { x: n.position.x, y: n.position.y }
        : null,
    ])
  );
  const next = applyNodeChanges(changes, prev);
  return next.map((n) => {
    const p = posById.get(n.id);
    if (!p) return n;
    return { ...n, position: { x: p.x, y: p.y } };
  });
}
