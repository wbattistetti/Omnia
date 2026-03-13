import { useEffect, RefObject } from 'react';
import { useReactFlow } from 'reactflow';

/**
 * Hook for migrating legacy label position format {t, offset} to absolute {x, y}
 * Isolated migration logic to keep CustomEdge clean
 * Idempotent: only migrates if labelPositionAbsolute is not already set
 */
export function useMigrateLabelPosition(
  pathRef: RefObject<SVGPathElement>,
  labelPositionAbsolute: { x: number; y: number } | null | undefined,
  labelPositionRelative: { t: number; offset: number } | null | undefined,
  labelPositionSvg: { x: number; y: number } | null | undefined,
  updateEdgeData: (updates: any) => void
) {
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    // Skip if already have absolute position
    if (labelPositionAbsolute) return;

    // Priority 1: Migrate from labelPositionRelative {t, offset}
    if (labelPositionRelative && pathRef.current) {
      const path = pathRef.current;
      const pathLength = path.getTotalLength();
      if (pathLength === 0) return;

      // Convert legacy {t, offset} to absolute {x, y}
      const t = Math.max(0, Math.min(1, labelPositionRelative.t));
      const length = pathLength * t;
      const basePoint = path.getPointAtLength(length);

      // Calculate normal for offset
      const epsilon = 1;
      const point1 = path.getPointAtLength(Math.max(0, length - epsilon));
      const point2 = path.getPointAtLength(Math.min(pathLength, length + epsilon));
      const dx = point2.x - point1.x;
      const dy = point2.y - point1.y;
      const length_tangent = Math.sqrt(dx * dx + dy * dy);

      let normal = { x: 0, y: 1 };
      if (length_tangent >= 1e-10) {
        normal = { x: -dy / length_tangent, y: dx / length_tangent };
      }

      const absolute = {
        x: basePoint.x + normal.x * labelPositionRelative.offset,
        y: basePoint.y + normal.y * labelPositionRelative.offset,
      };

      updateEdgeData({
        labelPositionAbsolute: absolute,
        labelPositionRelative: undefined,
        labelPositionSvg: undefined,
      });

      console.log('[useMigrateLabelPosition] ✅ Migrated labelPositionRelative → labelPositionAbsolute:', absolute);
      return;
    }

    // Priority 2: Migrate from labelPositionSvg (legacy absolute)
    if (labelPositionSvg) {
      updateEdgeData({
        labelPositionAbsolute: labelPositionSvg,
        labelPositionRelative: undefined,
        labelPositionSvg: undefined,
      });

      console.log('[useMigrateLabelPosition] ✅ Migrated labelPositionSvg → labelPositionAbsolute:', labelPositionSvg);
      return;
    }
  }, [labelPositionAbsolute, labelPositionRelative, labelPositionSvg, pathRef, updateEdgeData, reactFlowInstance]);
}
