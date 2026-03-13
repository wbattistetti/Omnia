/**
 * Drag Controller - Discrete model for label dragging
 * Uses hit-area based highlighting, no continuous calculations
 * Zero race conditions, zero async effects, zero delays
 */

import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import { useReactFlow } from 'reactflow';
import { CoordinateConverter } from '../utils/coordinateUtils';
import { PathSegment, getSegmentMidpoint } from '../utils/pathUtils';

export interface UseLabelDragOptions {
  labelRef: RefObject<HTMLElement>;
  pathRef: RefObject<SVGPathElement>;
  segments: PathSegment[]; // ✅ Segments for THIS edge only
  onPositionChange: (position: { x: number; y: number }) => void; // ✅ Absolute coordinates
  enabled?: boolean;
}

interface LabelDragState {
  isDragging: boolean;
  highlightedEdgeId: string | null;
  highlightSegment: {
    index: number;
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null;
  mouseSvg: { x: number; y: number } | null; // ✅ Position of mouse during drag
}

export interface UseLabelDragReturn {
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  onMouseDown: (e: React.MouseEvent) => void;
  highlightedEdgeId: string | null;
  highlightedSegment: PathSegment | null;
  onSegmentEnter: (edgeId: string, segment: PathSegment) => void;
  onSegmentLeave: () => void;
}

/**
 * Simplified label drag hook with discrete hit-area based highlighting
 * No continuous distance calculations, no orthogonal projections
 * Pure discrete model: hit-area → highlight → snap to midpoint on drop
 */
export function useLabelDrag(
  options: UseLabelDragOptions
): UseLabelDragReturn {
  const {
    labelRef,
    pathRef,
    segments,
    onPositionChange,
    enabled = true,
  } = options;

  const reactFlowInstance = useReactFlow();
  const converter = new CoordinateConverter(reactFlowInstance, pathRef);

  const [dragState, setDragState] = useState<LabelDragState>({
    isDragging: false,
    highlightedEdgeId: null,
    highlightSegment: null,
    mouseSvg: null,
  });

  // ✅ FIX: useRef per evitare stale closure in endDrag e onSegmentEnter/Leave
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState; // Aggiorna ad ogni render

  const isDraggingRef = useRef(false);
  isDraggingRef.current = dragState.isDragging; // Aggiorna ad ogni render

  const startDrag = useCallback((initialMouseSvg: { x: number; y: number }) => {
    setDragState({
      isDragging: true,
      highlightedEdgeId: null,
      highlightSegment: null,
      mouseSvg: initialMouseSvg, // ✅ Save initial mouse position
    });
  }, []);

  // ✅ FIX: endDrag ora legge sempre lo stato più recente tramite ref
  // Questo elimina la dipendenza da dragState → callback stabile → useEffect non si re-registra continuamente
  const endDrag = useCallback(() => {
    const state = dragStateRef.current; // ✅ Legge sempre lo stato più recente

    if (!state.isDragging || !pathRef.current) {
      setDragState({
        isDragging: false,
        highlightedEdgeId: null,
        highlightSegment: null,
        mouseSvg: null,
      });
      return;
    }

    // ✅ FIX: Snap to midpoint SOLO se c'è un segmento evidenziato
    // Se nessun segmento evidenziato → NON chiamare onPositionChange
    // La label torna automaticamente a labelPositionAbsolute (posizione prima del drag)
    // perché dragPosition diventa null quando isDragging = false
    if (state.highlightSegment) {
      // Snap to midpoint of highlighted segment
      const midpoint = getSegmentMidpoint({
        start: state.highlightSegment.start,
        end: state.highlightSegment.end,
        index: state.highlightSegment.index,
      });

      // ✅ Pass absolute coordinates directly - no t, no offset
      onPositionChange({ x: midpoint.x, y: midpoint.y });
    }
    // ✅ Se nessun segmento evidenziato → NON salvare nulla, la label torna alla posizione originale

    setDragState({
      isDragging: false,
      highlightedEdgeId: null,
      highlightSegment: null,
      mouseSvg: null,
    });
  }, [pathRef, onPositionChange]); // ✅ NO dragState dep! Ora è stabile

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || !labelRef.current || !pathRef.current) return;

      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[data-toolbar]')) {
        return; // Don't start drag if clicking on toolbar button
      }

      e.preventDefault();
      e.stopPropagation();

      // ✅ Convert initial mouse position to SVG
      const mouseScreen = { x: e.clientX, y: e.clientY };
      const mouseSvg = converter.screenToSvg(mouseScreen);
      if (!mouseSvg) {
        console.warn('[useLabelDrag] ❌ Failed to convert screen to SVG');
        return;
      }

      startDrag(mouseSvg);
    },
    [enabled, labelRef, converter, startDrag]
  );

  // ✅ FIX: Global mouse events - endDrag ora è stabile → effect si re-registra solo quando isDragging cambia
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // ✅ Update mouse position during drag (for visual feedback)
      const mouseScreen = { x: e.clientX, y: e.clientY };
      const mouseSvg = converter.screenToSvg(mouseScreen);

      if (mouseSvg) {
        setDragState((s) => ({
          ...s,
          mouseSvg, // ✅ Update mouse position
        }));
      }
    };

    const handleMouseUp = () => {
      endDrag(); // ✅ endDrag è stabile → non causa re-registrazione continua
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, converter, endDrag]); // ✅ endDrag ora è stabile → effect si re-registra solo quando isDragging cambia

  // ✅ FIX: onSegmentEnter/Leave usano ref per evitare stale closure
  const onSegmentEnter = useCallback((edgeId: string, segment: PathSegment) => {
    if (!isDraggingRef.current) return; // ✅ Legge sempre il valore più recente

    setDragState((s) => ({
      ...s,
      highlightedEdgeId: edgeId,
      highlightSegment: {
        index: segment.index,
        start: segment.start,
        end: segment.end,
      },
    }));
  }, []); // ✅ Ora è stabile - nessuna dep su dragState

  const onSegmentLeave = useCallback(() => {
    if (!isDraggingRef.current) return; // ✅ Legge sempre il valore più recente

    setDragState((s) => ({
      ...s,
      highlightedEdgeId: null,
      highlightSegment: null,
    }));
  }, []); // ✅ Ora è stabile - nessuna dep su dragState

  // ✅ CORRECT: dragPosition follows mouse during drag, not midpoint
  const dragPosition = dragState.mouseSvg;

  return {
    isDragging: dragState.isDragging,
    dragPosition,
    onMouseDown,
    highlightedEdgeId: dragState.highlightedEdgeId,
    highlightedSegment: dragState.highlightSegment
      ? {
          start: dragState.highlightSegment.start,
          end: dragState.highlightSegment.end,
          index: dragState.highlightSegment.index,
        }
      : null,
    onSegmentEnter,
    onSegmentLeave,
  };
}
