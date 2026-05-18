/**
 * RF-local node dimensions — not written to FlowStore (avoids layout→store→render loops).
 */

import type { Node } from 'reactflow';

export type NodeMeasuredSize = { width: number; height: number };

export const LAYOUT_SIZE_EPSILON_PX = 2;

export function measuredSizesEqual(
  a: NodeMeasuredSize,
  b: NodeMeasuredSize,
  epsilon = LAYOUT_SIZE_EPSILON_PX
): boolean {
  return (
    Math.abs(a.width - b.width) <= epsilon && Math.abs(a.height - b.height) <= epsilon
  );
}

/** Merge ephemeral measured sizes into nodes passed to React Flow (display layer only). */
export function mergeNodesWithMeasuredLayout<T extends Node>(
  nodes: readonly T[],
  layoutById: ReadonlyMap<string, NodeMeasuredSize>
): T[] {
  if (layoutById.size === 0) return nodes as T[];
  let changed = false;
  const next = nodes.map((n) => {
    const m = layoutById.get(n.id);
    if (!m || m.width < 1 || m.height < 1) return n;
    const prevW = Number(n.width) || 0;
    const prevH = Number(n.height) || 0;
    if (measuredSizesEqual({ width: prevW, height: prevH }, m)) return n;
    changed = true;
    return {
      ...n,
      width: m.width,
      height: m.height,
      style: { ...n.style, width: m.width, height: m.height },
    };
  });
  return changed ? next : (nodes as T[]);
}

export type ApplyNodeLayoutRuntimeArgs = {
  nodeId: string;
  width: number;
  height: number;
  layoutById: Map<string, NodeMeasuredSize>;
  updateNodeInternals: (nodeId: string) => void;
};

/** Record size and refresh RF handles; returns true when size changed beyond epsilon. */
export function applyNodeLayoutRuntime({
  nodeId,
  width,
  height,
  layoutById,
  updateNodeInternals,
}: ApplyNodeLayoutRuntimeArgs): boolean {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < 1 || h < 1) return false;

  const prev = layoutById.get(nodeId);
  if (prev && measuredSizesEqual(prev, { width: w, height: h })) return false;

  layoutById.set(nodeId, { width: w, height: h });
  try {
    updateNodeInternals(nodeId);
  } catch {
    /* RF may not be ready */
  }
  return true;
}
