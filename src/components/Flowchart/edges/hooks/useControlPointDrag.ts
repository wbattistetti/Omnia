import React, { useState, useCallback, useRef, useEffect } from 'react';

export interface ControlPoint {
  x: number;
  y: number;
  id: string;
}

export interface UseControlPointDragOptions {
  controlPoints: ControlPoint[];
  onControlPointsChange: (points: ControlPoint[]) => void;
  enableSnapping?: boolean;
  snapDistance?: number; // pixels
  pathRef?: React.RefObject<SVGPathElement>;
}

export interface UseControlPointDragReturn {
  draggingPointId: string | null;
  onMouseDown: (pointId: string, e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  getSnappedPosition: (x: number, y: number) => { x: number; y: number };
}

/**
 * Hook for dragging control points on edges
 * Supports optional snapping to grid or path
 */
export function useControlPointDrag(
  options: UseControlPointDragOptions
): UseControlPointDragReturn {
  const {
    controlPoints,
    onControlPointsChange,
    enableSnapping = false,
    snapDistance = 10,
    pathRef,
  } = options;

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; pointIndex: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Get SVG element from pathRef
  const getSvg = useCallback(() => {
    if (pathRef?.current?.ownerSVGElement) {
      return pathRef.current.ownerSVGElement;
    }
    return document.querySelector('svg') as SVGSVGElement | null;
  }, [pathRef]);

  // Convert screen coordinates to SVG coordinates
  const screenToSvg = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const svg = getSvg();
      if (!svg) return { x: screenX, y: screenY };

      const pt = svg.createSVGPoint();
      pt.x = screenX;
      pt.y = screenY;

      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: screenX, y: screenY };

      const svgPoint = pt.matrixTransform(ctm.inverse());
      return { x: svgPoint.x, y: svgPoint.y };
    },
    [getSvg]
  );

  // Get snapped position (snap to grid or path)
  const getSnappedPosition = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      if (!enableSnapping) return { x, y };

      // Snap to grid (10px grid)
      const gridSize = 10;
      const snappedX = Math.round(x / gridSize) * gridSize;
      const snappedY = Math.round(y / gridSize) * gridSize;

      // If snapping distance is within threshold, use snapped position
      const distance = Math.sqrt(
        Math.pow(x - snappedX, 2) + Math.pow(y - snappedY, 2)
      );
      if (distance <= snapDistance) {
        return { x: snappedX, y: snappedY };
      }

      return { x, y };
    },
    [enableSnapping, snapDistance]
  );

  const onMouseDown = useCallback(
    (pointId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const pointIndex = controlPoints.findIndex((p) => p.id === pointId);
      if (pointIndex === -1) return;

      const svg = getSvg();
      if (!svg) return;
      svgRef.current = svg;

      const svgPoint = screenToSvg(e.clientX, e.clientY);
      dragStartRef.current = {
        x: svgPoint.x,
        y: svgPoint.y,
        pointIndex,
      };

      setDraggingPointId(pointId);
    },
    [controlPoints, getSvg, screenToSvg]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingPointId || !dragStartRef.current) return;

      const svg = getSvg();
      if (!svg) return;

      const svgPoint = screenToSvg(e.clientX, e.clientY);
      const snapped = getSnappedPosition(svgPoint.x, svgPoint.y);

      const updatedPoints = [...controlPoints];
      updatedPoints[dragStartRef.current.pointIndex] = {
        ...updatedPoints[dragStartRef.current.pointIndex],
        x: snapped.x,
        y: snapped.y,
      };

      onControlPointsChange(updatedPoints);
    },
    [draggingPointId, controlPoints, getSvg, screenToSvg, getSnappedPosition, onControlPointsChange]
  );

  const onMouseUp = useCallback(() => {
    setDraggingPointId(null);
    dragStartRef.current = null;
  }, []);

  // Attach global mouse events when dragging
  useEffect(() => {
    if (draggingPointId) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [draggingPointId, onMouseMove, onMouseUp]);

  return {
    draggingPointId,
    onMouseDown,
    onMouseMove: onMouseMove as any, // Type cast for React.MouseEvent
    onMouseUp,
    getSnappedPosition,
  };
}
