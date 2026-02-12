import { useState, useCallback, useEffect, useRef, RefObject, useMemo } from 'react';
import {
  getPathSegments,
  findClosestSegment,
  getCurrentSegment,
  getSegmentMidpoint,
  projectPointToSegment,
  PathSegment,
} from '../utils/pathUtils';

export interface UseLabelDragOptions {
  labelRef: RefObject<HTMLElement>;
  initialPosition: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  pathRef: RefObject<SVGPathElement>;
  savedLabelSvgPosition?: { x: number; y: number } | null;
  enabled?: boolean;
  snapThreshold?: number; // Default 15-20px
}

export interface UseLabelDragReturn {
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Hook for intelligent edge label dragging
 * Automatically handles snap to segments, fine adjustment, and free positioning
 */
export function useLabelDrag(
  options: UseLabelDragOptions
): UseLabelDragReturn {
  const {
    labelRef,
    initialPosition,
    onPositionChange,
    pathRef,
    savedLabelSvgPosition,
    enabled = true,
    snapThreshold = 18, // Default 18px
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [pathSegments, setPathSegments] = useState<PathSegment[]>([]);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const currentSegmentRef = useRef<PathSegment | null>(null);
  const finalSvgPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Aggiorna i segmenti quando il path cambia
  useEffect(() => {
    if (pathRef.current) {
      setPathSegments(getPathSegments(pathRef.current));
    } else {
      setPathSegments([]);
    }
  }, [pathRef]);

  // Identifica il segmento corrente all'inizio del drag
  useEffect(() => {
    if (isDragging && pathRef.current && savedLabelSvgPosition) {
      currentSegmentRef.current = getCurrentSegment(
        savedLabelSvgPosition,
        pathSegments,
        snapThreshold
      );
    } else if (!isDragging) {
      currentSegmentRef.current = null;
    }
  }, [isDragging, pathRef, savedLabelSvgPosition, pathSegments, snapThreshold]);

  // Converti coordinate schermo → SVG
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

  // Converti coordinate SVG → schermo
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

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      e.preventDefault();
      e.stopPropagation();

      if (!labelRef.current) return;

      const rect = labelRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX,
        offsetY,
      };

      setIsDragging(true);
      setDragPosition(initialPosition);
    },
    [enabled, labelRef, initialPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !pathRef.current) return;

      // Converti posizione mouse in coordinate SVG
      const mouseSvg = screenToSvg(e.clientX, e.clientY);
      if (!mouseSvg) return;

      // Trova il segmento più vicino
      const closest = findClosestSegment(mouseSvg, pathSegments, snapThreshold);

      let finalPositionSvg: { x: number; y: number };

      if (closest) {
        // CASO 1 o 2: Entro la soglia di snap
        const isNewSegment = currentSegmentRef.current
          ? closest.segment.index !== currentSegmentRef.current.index
          : true;

        if (isNewSegment) {
          // CASO 1: Segmento diverso → snap al centro
          finalPositionSvg = getSegmentMidpoint(closest.segment);
        } else {
          // CASO 2: Stesso segmento → proiezione fine
          finalPositionSvg = projectPointToSegment(mouseSvg, closest.segment);
        }
      } else {
        // CASO 3: Fuori dalla soglia → posizione libera
        finalPositionSvg = mouseSvg;
      }

      // Salva la posizione SVG finale per il salvataggio
      finalSvgPositionRef.current = finalPositionSvg;

      // Converti SVG → schermo per il rendering
      const screenPos = svgToScreen(finalPositionSvg.x, finalPositionSvg.y);
      if (screenPos) {
        setDragPosition(screenPos);
      }
    },
    [isDragging, pathRef, pathSegments, snapThreshold, screenToSvg, svgToScreen]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    // Usa la posizione SVG finale salvata durante il drag
    if (finalSvgPositionRef.current) {
      onPositionChange(finalSvgPositionRef.current);
    }

    setIsDragging(false);
    setDragPosition(null);
    dragStartRef.current = null;
    currentSegmentRef.current = null;
    finalSvgPositionRef.current = null;
  }, [isDragging, onPositionChange]);

  // Attach global mouse events when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    isDragging,
    dragPosition,
    onMouseDown,
  };
}
