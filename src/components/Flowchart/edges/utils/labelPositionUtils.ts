import { RefObject } from 'react';

/**
 * ✅ ZERO-LAG ARCHITECTURE: Pure function called during render
 *
 * Calculates absolute position from relative position directly in render cycle.
 * No useState, no useEffect, no useLayoutEffect, no MutationObserver.
 *
 * This eliminates all lag because:
 * - Path is already updated by ReactFlow
 * - Calculation happens in same render cycle
 * - Label and path are painted in same frame
 */
export function computeAbsoluteFromRelative(
  pathRef: RefObject<SVGPathElement>,
  labelPositionRelative: { t: number; offset: number } | null | undefined
): { x: number; y: number } | null {
  if (!labelPositionRelative) {
    return null;
  }

  const path = pathRef.current;
  if (!path) {
    return null;
  }

  const pathLength = path.getTotalLength();
  if (pathLength === 0) {
    return null;
  }

  const t = Math.max(0, Math.min(1, labelPositionRelative.t));
  const length = pathLength * t;
  const basePoint = path.getPointAtLength(length);

  // Calculate normal for offset
  const epsilon = 1;
  const point1 = path.getPointAtLength(Math.max(0, length - epsilon));
  const point2 = path.getPointAtLength(Math.min(pathLength, length + epsilon));
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const lenTangent = Math.sqrt(dx * dx + dy * dy);

  let normal = { x: 0, y: 1 };
  if (lenTangent >= 1e-10) {
    normal = { x: -dy / lenTangent, y: dx / lenTangent };
  }

  return {
    x: basePoint.x + normal.x * labelPositionRelative.offset,
    y: basePoint.y + normal.y * labelPositionRelative.offset,
  };
}
