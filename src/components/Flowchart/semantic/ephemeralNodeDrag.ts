/**
 * Ephemeral drag overlay — preview positions without FlowStore commits.
 */

import type { Node } from 'reactflow';

export type EphemeralDragSnapshot = Map<string, { x: number; y: number }>;

const POSITION_MATCH_EPS_PX = 0.01;

/** True when every pinned overlay entry matches the store node position. */
export function overlayMatchesStorePositions(
  nodes: readonly { id: string; position?: { x?: number; y?: number } }[],
  overlay: EphemeralDragSnapshot
): boolean {
  if (overlay.size === 0) return true;
  for (const [nodeId, expected] of overlay) {
    const p = nodes.find((n) => n.id === nodeId)?.position;
    if (
      !p ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      Math.abs(p.x - expected.x) > POSITION_MATCH_EPS_PX ||
      Math.abs(p.y - expected.y) > POSITION_MATCH_EPS_PX
    ) {
      return false;
    }
  }
  return true;
}

/** Snapshot of committed drag positions kept on the overlay until the store catches up. */
export function pinOverlayToPositions(updates: ReadonlyArray<{ nodeId: string; position: { x: number; y: number } }>): EphemeralDragSnapshot {
  const map = new Map<string, { x: number; y: number }>();
  for (const u of updates) {
    map.set(u.nodeId, { x: u.position.x, y: u.position.y });
  }
  return map;
}

export function mergeNodesWithDragOverlay<T extends Node>(
  nodes: readonly T[],
  overlay: EphemeralDragSnapshot
): T[] {
  if (overlay.size === 0) return nodes as T[];
  return nodes.map((n) => {
    const p = overlay.get(n.id);
    if (!p) return n;
    // Do NOT set dragging: true — RF controlled-mode reconciles with the nodes prop when dragging
    // changes, which can produce a one-frame flash of the old position before the FlowStore update
    // propagates. Keeping the node's own dragging state lets position updates flow smoothly.
    return { ...n, position: { x: p.x, y: p.y } };
  });
}

export function isEphemeralPositionChange(
  changes: readonly { type?: string; dragging?: boolean }[]
): boolean {
  if (changes.length === 0) return false;
  return changes.every((ch) => ch.type === 'position' && ch.dragging === true);
}
