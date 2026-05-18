/**
 * Guards for flow coordinates — prevents NaN from reaching React Flow / MiniMap SVG.
 */

import type { Node } from 'reactflow';

export function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function isFinitePoint(p: { x: unknown; y: unknown } | null | undefined): boolean {
  return !!p && isFiniteCoord(p.x) && isFiniteCoord(p.y);
}

export function isFinitePosition(position: { x: unknown; y: unknown } | null | undefined): boolean {
  return isFinitePoint(position);
}

/** True when every node has a valid position (required before MiniMap renders rects). */
export function nodesHaveFinitePositions(nodes: readonly Node[]): boolean {
  if (nodes.length === 0) return true;
  return nodes.every((n) => isFinitePosition(n.position));
}

export type ViewportTransform = readonly [number, number, number];

/** React Flow store is ready for screenToFlowPosition / MiniMap bounds. */
export function isReactFlowViewportReady(
  width: number,
  height: number,
  transform: ViewportTransform
): boolean {
  const zoom = transform[2];
  return width >= 2 && height >= 2 && isFiniteCoord(zoom) && zoom > 0;
}
