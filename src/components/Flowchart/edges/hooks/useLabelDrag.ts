import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import { findClosestSegment, getSegmentMidpoint, projectPointToSegment, getPathSegments, PathSegment } from '../utils/pathUtils';
import { CoordinateConverter } from '../utils/coordinateUtils';
import { useReactFlow } from 'reactflow';
import { useEdgeHoverDuringLabelDrag } from './useEdgeHoverDuringLabelDrag';

export interface UseLabelDragOptions {
  labelRef: RefObject<HTMLElement>;
  initialPosition: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  pathRef: RefObject<SVGPathElement>;
  savedLabelSvgPosition?: { x: number; y: number } | null;
  enabled?: boolean;
  snapThreshold?: number; // Fascia di aggancio (default 30px)
  midpointThreshold?: number; // Soglia per magnetismo al midpoint (default 15px)
  edgeId: string; // ✅ NUOVO: ID dell'edge corrente
}

export interface UseLabelDragReturn {
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  onMouseDown: (e: React.MouseEvent) => void;
  highlightedEdgeId: string | null;
  highlightedSegmentIndex: number | null;
  highlightedSegment: PathSegment | null;
  distanceToSegment: number | null; // ✅ NUOVO
  distanceToMidpoint: number | null; // ✅ NUOVO
}

/**
 * Hook for intelligent edge label dragging with free movement and magnetic zones
 * La caption segue liberamente il mouse, con highlight dei segmenti e validazione al rilascio
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
    snapThreshold = 30, // Fascia di aggancio
    midpointThreshold = 15, // Soglia per magnetismo al midpoint
    edgeId,
  } = options;

  const reactFlowInstance = useReactFlow();
  const converter = new CoordinateConverter(reactFlowInstance, pathRef);

  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [pathSegments, setPathSegments] = useState<any[]>([]);
  const [mouseSvgPosition, setMouseSvgPosition] = useState<{ x: number; y: number } | null>(null); // ✅ NUOVO

  const dragStartRef = useRef<{
    startScreen: { x: number; y: number };
    startSvg: { x: number; y: number };
    currentSvg: { x: number; y: number };
    originalSvg: { x: number; y: number }; // ✅ NUOVO: per ripristino
  } | null>(null);

  // ✅ NUOVO: Hook per highlight durante drag
  const highlightResult = useEdgeHoverDuringLabelDrag(
    mouseSvgPosition,
    edgeId,
    snapThreshold
  );

  // Aggiorna segmenti quando cambia il path
  useEffect(() => {
    if (pathRef.current) {
      setPathSegments(getPathSegments(pathRef.current));
    } else {
      setPathSegments([]);
    }
  }, [pathRef]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || !labelRef.current || !pathRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const startScreen = { x: e.clientX, y: e.clientY };
      const startSvg = converter.screenToSvg(startScreen) || savedLabelSvgPosition || { x: 0, y: 0 };

      // ✅ CRITICO: salva posizione originale per ripristino
      const originalSvg = savedLabelSvgPosition || startSvg;

      dragStartRef.current = {
        startScreen,
        startSvg,
        currentSvg: startSvg,
        originalSvg, // ✅ Salva per ripristino
      };

      setIsDragging(true);
      setDragPosition(initialPosition);
      setMouseSvgPosition(startSvg); // ✅ Inizializza posizione mouse
    },
    [enabled, labelRef, initialPosition, converter, savedLabelSvgPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !pathRef.current) return;

      const mouseScreen = { x: e.clientX, y: e.clientY };
      const mouseSvg = converter.screenToSvg(mouseScreen);
      if (!mouseSvg) return;

      // ✅ CRITICO: La caption segue liberamente il mouse
      // Aggiorna posizione mouse per highlight cross-edge
      setMouseSvgPosition(mouseSvg);

      // ✅ La posizione della caption è sempre quella del mouse (libero movimento)
      dragStartRef.current.currentSvg = mouseSvg;

      // Converti per rendering
      const screenPos = converter.svgToScreen(mouseSvg);
      if (screenPos) {
        setDragPosition(screenPos);
      }
    },
    [isDragging, pathRef, converter]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStartRef.current) return;

    const currentMouseSvg = dragStartRef.current.currentSvg;

    // ✅ CRITICO: Validazione rilascio con 3 casi
    if (highlightResult.highlightedSegment && highlightResult.distanceToSegment !== null) {
      // CASO A e B: Rilascio dentro la fascia di un segmento
      let positionToSave: { x: number; y: number };

      // CASO B: Se vicino al midpoint → magnetismo
      if (
        highlightResult.distanceToMidpoint !== null &&
        highlightResult.distanceToMidpoint < midpointThreshold
      ) {
        // Snap al midpoint
        const midpoint = getSegmentMidpoint(highlightResult.highlightedSegment);
        positionToSave = midpoint;
      } else {
        // CASO A: Rilascio dentro fascia ma non vicino al midpoint → posizione esatta del mouse
        positionToSave = currentMouseSvg;
      }

      // Salva la posizione
      onPositionChange(positionToSave);
    } else {
      // CASO C: Rilascio fuori da qualsiasi fascia → ripristina posizione originale
      const positionToRestore = dragStartRef.current.originalSvg;
      if (positionToRestore) {
        onPositionChange(positionToRestore);
      }
    }

    setIsDragging(false);
    setDragPosition(null);
    setMouseSvgPosition(null);
    dragStartRef.current = null;
  }, [isDragging, onPositionChange, highlightResult.highlightedSegment, highlightResult.distanceToSegment, highlightResult.distanceToMidpoint, midpointThreshold]);

  // Attach global mouse events
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
    highlightedEdgeId: highlightResult.highlightedEdgeId,
    highlightedSegmentIndex: highlightResult.highlightedSegmentIndex,
    highlightedSegment: highlightResult.highlightedSegment,
    distanceToSegment: highlightResult.distanceToSegment,
    distanceToMidpoint: highlightResult.distanceToMidpoint,
  };
}
