import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ControlPointAbsolute } from '../types/edgeTypes';
import { CoordinateConverter } from '../utils/coordinateUtils';
import { useReactFlow } from 'reactflow';

export interface EdgeControlPointsProps {
  controlPointsAbsolute: ControlPointAbsolute[];
  draggingPointId: string | null;
  onMouseDown: (pointId: string, e: React.MouseEvent) => void;
  onMouseUp: () => void;
  pathRef: React.RefObject<SVGPathElement>;
  hovered?: boolean;
  selected?: boolean;
  showDistance?: number; // Distance in pixels to show control point (default 10px)
}

/**
 * Edge control points component
 * Shows circles at vertices when mouse is near, allows dragging to modify path
 * Uses absolute coordinates for rendering (converted from relative in parent)
 */
export const EdgeControlPoints: React.FC<EdgeControlPointsProps> = ({
  controlPointsAbsolute,
  draggingPointId,
  onMouseDown,
  onMouseUp,
  pathRef,
  hovered = false,
  selected = false,
  showDistance = 10,
}) => {
  const reactFlowInstance = useReactFlow();
  const converter = new CoordinateConverter(reactFlowInstance, pathRef);

  const [visiblePoints, setVisiblePoints] = useState<Set<string>>(new Set());
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

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

    const mouseSvg = converter.screenToSvg(mousePosition);
    if (!mouseSvg) return;

    const visible = new Set<string>();
    for (const point of controlPointsAbsolute) {
      const dist = distance(mouseSvg, point);

      // Convert SVG distance to screen distance (approximate)
      const svg = pathRef.current?.ownerSVGElement;
      if (svg) {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const scale = Math.sqrt(ctm.a * ctm.a + ctm.b * ctm.b);
          const screenDist = dist * scale;
          if (screenDist <= showDistance) {
            visible.add(point.id);
          }
        }
      }
    }

    setVisiblePoints(visible);
  }, [mousePosition, hovered, selected, controlPointsAbsolute, pathRef, converter, distance, showDistance]);

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
      setVisiblePoints(new Set(controlPointsAbsolute.map((p) => p.id)));
    }
  }, [draggingPointId, controlPointsAbsolute]);

  if (controlPointsAbsolute.length === 0) {
    return null;
  }

  return (
    <>
      {controlPointsAbsolute.map((point) => {
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
