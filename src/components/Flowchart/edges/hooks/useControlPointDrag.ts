import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ControlPointRelative, ControlPointAbsolute } from '../types/edgeTypes';
import { CoordinateConverter } from '../utils/coordinateUtils';
import { useReactFlow } from 'reactflow';

export interface UseControlPointDragOptions {
  controlPointsRelative: ControlPointRelative[];
  onControlPointsChange: (points: ControlPointRelative[]) => void;
  pathRef: React.RefObject<SVGPathElement>;
  enableSnapping?: boolean;
  snapDistance?: number;
}

export interface UseControlPointDragReturn {
  draggingPointId: string | null;
  controlPointsAbsolute: ControlPointAbsolute[];
  onMouseDown: (pointId: string, e: React.MouseEvent) => void;
  onMouseUp: () => void;
}

/**
 * Hook for dragging control points
 * Lavora in SVG assoluto durante il drag, salva in (t, offset) relativo
 */
export function useControlPointDrag(
  options: UseControlPointDragOptions
): UseControlPointDragReturn {
  const {
    controlPointsRelative,
    onControlPointsChange,
    pathRef,
    enableSnapping = false,
    snapDistance = 10,
  } = options;

  const reactFlowInstance = useReactFlow();
  const converter = new CoordinateConverter(reactFlowInstance, pathRef);

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    pointIndex: number;
    startSvg: { x: number; y: number };
  } | null>(null);

  // ✅ Converti sempre da relativo ad assoluto per rendering
  const controlPointsAbsolute: ControlPointAbsolute[] = useMemo(() => {
    return controlPointsRelative
      .map((rel, idx) => {
        const abs = converter.relativeToAbsolute(rel);
        return abs ? { ...abs, id: `cp-${idx}` } : null;
      })
      .filter((p): p is ControlPointAbsolute => p !== null);
  }, [controlPointsRelative, converter]);

  // Get snapped position (snap to grid)
  const getSnappedPosition = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      if (!enableSnapping) return { x, y };

      const gridSize = 10;
      const snappedX = Math.round(x / gridSize) * gridSize;
      const snappedY = Math.round(y / gridSize) * gridSize;

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

      const pointIndex = controlPointsAbsolute.findIndex((p) => p.id === pointId);
      if (pointIndex === -1) return;

      const startScreen = { x: e.clientX, y: e.clientY };
      const startSvg = converter.screenToSvg(startScreen);
      if (!startSvg) return;

      dragStartRef.current = { pointIndex, startSvg };
      setDraggingPointId(pointId);
    },
    [controlPointsAbsolute, converter]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingPointId || !dragStartRef.current || !pathRef.current) return;

      const mouseScreen = { x: e.clientX, y: e.clientY };
      const mouseSvg = converter.screenToSvg(mouseScreen);
      if (!mouseSvg) return;

      // Applica snapping se abilitato
      const snapped = getSnappedPosition(mouseSvg.x, mouseSvg.y);

      // Aggiorna in assoluto temporaneamente
      const updatedAbsolute = [...controlPointsAbsolute];
      updatedAbsolute[dragStartRef.current.pointIndex] = {
        ...updatedAbsolute[dragStartRef.current.pointIndex],
        x: snapped.x,
        y: snapped.y,
      };

      // ✅ Converti in relativo e salva
      const updatedRelative = updatedAbsolute.map((abs) => {
        const rel = converter.absoluteToRelative(abs);
        return rel || { t: 0.5, offset: 0 };
      });

      onControlPointsChange(updatedRelative);
    },
    [draggingPointId, controlPointsAbsolute, converter, pathRef, getSnappedPosition, onControlPointsChange]
  );

  const onMouseUp = useCallback(() => {
    setDraggingPointId(null);
    dragStartRef.current = null;
  }, []);

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
    controlPointsAbsolute,
    onMouseDown,
    onMouseUp,
  };
}
