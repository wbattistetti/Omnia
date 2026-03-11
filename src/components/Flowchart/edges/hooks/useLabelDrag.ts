import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import { findClosestSegment, getSegmentMidpoint, projectPointToSegment, getPathSegments, PathSegment } from '../utils/pathUtils';
import { CoordinateConverter } from '../utils/coordinateUtils';
import { useReactFlow } from 'reactflow';
import { useEdgeHoverDuringLabelDrag } from './useEdgeHoverDuringLabelDrag';

export interface UseLabelDragOptions {
  labelRef: RefObject<HTMLElement>;
  initialPosition: { x: number; y: number };
  onPositionChange: (position: { t: number; offset: number }) => void; // ✅ CAMBIATO: ora accetta { t, offset }
  pathRef: RefObject<SVGPathElement>;
  savedLabelSvgPosition?: { x: number; y: number } | null; // ✅ LEGACY: solo per calcolo iniziale
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
  const [mouseSvgPosition, setMouseSvgPosition] = useState<{ x: number; y: number } | null>(null);

  const dragStartRef = useRef<{
    startScreen: { x: number; y: number };
    startSvg: { x: number; y: number };
    currentSvg: { x: number; y: number };
    originalSvg: { x: number; y: number };
  } | null>(null);

  // ✅ Hook per highlight durante drag - passa isDragging per non resettare durante il drag
  const highlightResult = useEdgeHoverDuringLabelDrag(
    mouseSvgPosition,
    edgeId,
    snapThreshold,
    isDragging // ✅ PULITO: passa isDragging per evitare reset prematuri
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

      // ✅ FIX: Check if click is on toolbar (prevent drag)
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[data-toolbar]')) {
        return; // Don't start drag if clicking on toolbar button
      }

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
      // ✅ REFACTOR: EdgeLabelRenderer usa coordinate SVG
      // Converti initialPosition (screen) in SVG se necessario
      const initialSvg = converter.screenToSvg(initialPosition) || startSvg;
      setDragPosition(initialSvg);
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

      // ✅ REFACTOR: EdgeLabelRenderer usa coordinate SVG, non screen
      // Manteniamo coordinate SVG per dragPosition
      setDragPosition(mouseSvg);
    },
    [isDragging, pathRef, converter]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStartRef.current) return;

    // ✅ PULITO: Snapshot finale PRIMA di resettare qualsiasi cosa
    const currentMouseSvg = dragStartRef.current.currentSvg;
    const finalHighlight = highlightResult; // ✅ Usa highlightResult direttamente (ancora valido)
    const originalSvg = dragStartRef.current.originalSvg;

    // ✅ DEBUG: Verifica snapshot finale
    console.log('[LabelDrag] Mouse up - Snapshot finale:', {
      currentMouseSvg,
      finalHighlight: {
        highlightedSegment: finalHighlight.highlightedSegment ? 'ESISTE' : 'NULL',
        distanceToSegment: finalHighlight.distanceToSegment,
        distanceToMidpoint: finalHighlight.distanceToMidpoint,
      },
      originalSvg,
    });

    // ✅ PULITO: Validazione rilascio con 3 casi
    if (finalHighlight.highlightedSegment && finalHighlight.distanceToSegment !== null) {
      // CASO A e B: Rilascio dentro la fascia di un segmento
      let positionToSave: { x: number; y: number };

      // CASO B: Se vicino al midpoint → magnetismo
      if (
        finalHighlight.distanceToMidpoint !== null &&
        finalHighlight.distanceToMidpoint < midpointThreshold
      ) {
        // Snap al midpoint
        positionToSave = getSegmentMidpoint(finalHighlight.highlightedSegment);
        console.log('[LabelDrag] Snap al midpoint:', positionToSave);
      } else {
        // CASO A: Rilascio dentro fascia ma non vicino al midpoint → posizione esatta del mouse
        positionToSave = currentMouseSvg;
        console.log('[LabelDrag] Salva posizione mouse:', positionToSave);
      }

      // ✅ Converti coordinate SVG in { t, offset } e salva
      const relative = converter.labelAbsoluteToRelative(positionToSave);
      if (relative) {
        onPositionChange(relative);
        console.log('[LabelDrag] Posizione salvata (relativa):', relative);
      } else {
        console.error('[LabelDrag] Impossibile convertire posizione SVG in relativa');
      }
    } else {
      // CASO C: Rilascio fuori da qualsiasi fascia → ripristina posizione originale
      console.log('[LabelDrag] Rilascio fuori fascia, ripristino:', originalSvg);
      if (originalSvg) {
        const relative = converter.labelAbsoluteToRelative(originalSvg);
        if (relative) {
          onPositionChange(relative);
        }
      }
    }

    // ✅ Reset SOLO DOPO aver salvato
    setIsDragging(false);
    setDragPosition(null);
    // ✅ NON resettare mouseSvgPosition qui - sarà resettato quando isDragging diventa false
    dragStartRef.current = null;
  }, [isDragging, onPositionChange, midpointThreshold, highlightResult]);

  // ✅ Reset mouseSvgPosition quando il drag finisce
  useEffect(() => {
    if (!isDragging) {
      setMouseSvgPosition(null);
    }
  }, [isDragging]);

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
