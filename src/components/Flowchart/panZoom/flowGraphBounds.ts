/**
 * Flow-coordinate rectangles for graph nodes (PanZoom / viewport checks).
 */

import type { Node } from 'reactflow';

export type FlowRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Matches CustomNode min width — avoids overstating footprint vs visible card. */
const DEFAULT_NODE_WIDTH = 140;
const DEFAULT_NODE_MIN_HEIGHT = 40;
const ROW_LINE_HEIGHT = 24;
const NODE_CHROME = 40;

/** Estimated node footprint in flow space. */
export function computeNodeFlowRect(node: Node): FlowRect {
  const x = node.position.x;
  const y = node.position.y;
  const w =
    Number((node as Node & { measured?: { width?: number } }).measured?.width) ||
    Number(node.width) ||
    DEFAULT_NODE_WIDTH;
  const rows = (node.data as { rows?: unknown[] } | undefined)?.rows;
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  const h =
    Number((node as Node & { measured?: { height?: number } }).measured?.height) ||
    Number(node.height) ||
    DEFAULT_NODE_MIN_HEIGHT + rowCount * ROW_LINE_HEIGHT + NODE_CHROME;

  return { minX: x, minY: y, maxX: x + w, maxY: y + h };
}

/** True when `inner` lies entirely inside `outer` (with optional tolerance). */
export function isFlowRectFullyInside(inner: FlowRect, outer: FlowRect, epsilon = 2): boolean {
  return (
    inner.minX >= outer.minX - epsilon &&
    inner.maxX <= outer.maxX + epsilon &&
    inner.minY >= outer.minY - epsilon &&
    inner.maxY <= outer.maxY + epsilon
  );
}

/** True if at least one node is not fully inside the visible flow rectangle. */
export function hasAnyNodeOutsideFlowRect(
  nodes: readonly Node[],
  visible: FlowRect,
  epsilon = 2
): boolean {
  if (nodes.length === 0) return false;
  return nodes.some((n) => !isFlowRectFullyInside(computeNodeFlowRect(n), visible, epsilon));
}

/**
 * Visible flow bounds from the RF store (width/height + viewport transform).
 * Matches how React Flow maps the on-screen pane to flow coordinates.
 */
export function visibleFlowRectFromViewportStore(
  viewport: { x: number; y: number; zoom: number },
  width: number,
  height: number
): FlowRect | null {
  const zoom = viewport.zoom;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;
  if (!Number.isFinite(viewport.x) || !Number.isFinite(viewport.y)) return null;
  if (width < 2 || height < 2) return null;
  return {
    minX: -viewport.x / zoom,
    minY: -viewport.y / zoom,
    maxX: (width - viewport.x) / zoom,
    maxY: (height - viewport.y) / zoom,
  };
}
