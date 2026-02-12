import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useControlPointDrag, ControlPoint } from '../hooks/useControlPointDrag';

export interface EdgeControlPointsProps {
  controlPoints: ControlPoint[];
  onControlPointsChange: (points: ControlPoint[]) => void;
  pathRef: React.RefObject<SVGPathElement>;
  hovered?: boolean;
  selected?: boolean;
  enableSnapping?: boolean;
  snapDistance?: number;
  showDistance?: number; // Distance in pixels to show control point (default 10px)
}

/**
 * Edge control points component
 * Shows circles at vertices when mouse is near, allows dragging to modify path
 */
export const EdgeControlPoints: React.FC<EdgeControlPointsProps> = ({
  controlPoints,
  onControlPointsChange,
  pathRef,
  hovered = false,
  selected = false,
  enableSnapping = false,
  snapDistance = 10,
  showDistance = 10,
}) => {
  const [visiblePoints, setVisiblePoints] = useState<Set<string>>(new Set());
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  const {
    draggingPointId,
    onMouseDown,
    onMouseUp,
    getSnappedPosition,
  } = useControlPointDrag({
    controlPoints,
    onControlPointsChange,
    enableSnapping,
    snapDistance,
    pathRef,
  });

  // Convert SVG coordinates to screen coordinates
  const svgToScreen = useCallback(
    (svgX: number, svgY: number): { x: number; y: number } | null => {
      const svg = pathRef.current?.ownerSVGElement;
      if (!svg) return null;

      const pt = svg.createSVGPoint();
      pt.x = svgX;
      pt.y = svgY;

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;

      const screenPoint = pt.matrixTransform(ctm);
      return { x: screenPoint.x, y: screenPoint.y };
    },
    [pathRef]
  );

  // Convert screen coordinates to SVG coordinates
  const screenToSvg = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      const svg = pathRef.current?.ownerSVGElement;
      if (!svg) return null;

      const pt = svg.createSVGPoint();
      pt.x = screenX;
      pt.y = screenY;

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;

      const svgPoint = pt.matrixTransform(ctm.inverse());
      return { x: svgPoint.x, y: svgPoint.y };
    },
    [pathRef]
  );

  // Calculate distance between two points
  const distance = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    },
    []
  );

  // Update visible points based on mouse position
  useEffect(() => {
    if (!hovered && !selected) {
      setVisiblePoints(new Set());
      return;
    }

    if (!mousePosition) {
      setVisiblePoints(new Set());
      return;
    }

    const svg = pathRef.current?.ownerSVGElement;
    if (!svg) return;

    const mouseSvg = screenToSvg(mousePosition.x, mousePosition.y);
    if (!mouseSvg) return;

    const visible = new Set<string>();
    for (const point of controlPoints) {
      const dist = distance(mouseSvg, point);
      // Convert SVG distance to screen distance (approximate)
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const scale = Math.sqrt(ctm.a * ctm.a + ctm.b * ctm.b);
        const screenDist = dist * scale;
        if (screenDist <= showDistance) {
          visible.add(point.id);
        }
      }
    }

    setVisiblePoints(visible);
  }, [mousePosition, hovered, selected, controlPoints, pathRef, screenToSvg, distance, showDistance]);

  // Track mouse position
  useEffect(() => {
    if (!hovered && !selected) {
      setMousePosition(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hovered, selected]);

  // Always show points when dragging
  useEffect(() => {
    if (draggingPointId) {
      setVisiblePoints(new Set(controlPoints.map((p) => p.id)));
    }
  }, [draggingPointId, controlPoints]);

  if (controlPoints.length === 0) {
    return null;
  }

  return (
    <>
      {controlPoints.map((point) => {
        const isVisible = visiblePoints.has(point.id) || draggingPointId === point.id;
        if (!isVisible) return null;

        return (
          <g key={point.id}>
            {/* Control point circle */}
            <circle
              cx={point.x}
              cy={point.y}
              r={draggingPointId === point.id ? 6 : 4}
              fill={draggingPointId === point.id ? '#8b5cf6' : '#6b7280'}
              stroke="#fff"
              strokeWidth={1}
              style={{
                cursor: 'move',
                pointerEvents: 'auto',
                opacity: isVisible ? 1 : 0,
                transition: draggingPointId === point.id ? 'none' : 'opacity 0.2s, r 0.2s',
              }}
              onMouseDown={(e) => onMouseDown(point.id, e)}
              onMouseUp={onMouseUp}
            />
          </g>
        );
      })}
    </>
  );
};
