import { useMemo, useState, useEffect, RefObject } from 'react';

/**
 * ✅ ARCHITECTURE PRINCIPLE #2: Single hook responsible for derived value
 *
 * This hook is the ONLY place that computes {x, y} from labelPositionRelative.
 *
 * Pure computation: relative → absolute based on current path.
 * No side effects, no state mutations, no complex guards.
 *
 * When path changes (nodes moved, control points changed), MutationObserver
 * forces recalculation by incrementing pathVersion.
 */
export function useLabelPosition(
  pathRef: RefObject<SVGPathElement>,
  labelPositionRelative: { t: number; offset: number } | null | undefined,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): { x: number; y: number } | null {
  // ✅ Track path DOM changes via MutationObserver to force recalculation
  // This handles cases where path changes without sourceX/Y/targetX/Y changing (e.g., control points)
  const [pathVersion, setPathVersion] = useState(0);

  useEffect(() => {
    if (!pathRef.current) return;

    const observer = new MutationObserver(() => {
      setPathVersion(v => v + 1); // Force recalculation when path 'd' attribute changes
    });

    observer.observe(pathRef.current, {
      attributes: true,
      attributeFilter: ['d'], // Only watch path 'd' attribute
      subtree: false,
    });

    return () => observer.disconnect();
  }, [pathRef]);

  // ✅ Pure computation: relative → absolute based on current path
  // Recalculates when:
  // - labelPositionRelative changes (new drop)
  // - sourceX/Y/targetX/Y change (nodes moved)
  // - pathVersion changes (path DOM changed, e.g., control points)
  return useMemo(() => {
    console.log('[useLabelPosition] 🔄 Computing absolute', {
      hasRelative: !!labelPositionRelative,
      relative: labelPositionRelative,
      hasPathRef: !!pathRef.current,
      pathVersion,
    });

    if (!labelPositionRelative) {
      console.log('[useLabelPosition] ❌ No relative position, returning null');
      return null;
    }

    // ✅ Access pathRef.current INSIDE useMemo (always reads current value)
    // pathRef is NOT in deps (RefObject reference never changes)
    const path = pathRef.current;
    if (!path) {
      console.log('[useLabelPosition] ❌ No path ref, returning null');
      return null;
    }

    const pathLength = path.getTotalLength();
    if (pathLength === 0) {
      console.log('[useLabelPosition] ❌ Path length is 0, returning null');
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

    const result = {
      x: basePoint.x + normal.x * labelPositionRelative.offset,
      y: basePoint.y + normal.y * labelPositionRelative.offset,
    };

    console.log('[useLabelPosition] ✅ Computed absolute:', result);
    return result;
  }, [labelPositionRelative, sourceX, sourceY, targetX, targetY, pathVersion]);
}
