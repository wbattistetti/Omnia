import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import { findClosestSegment, getSegmentMidpoint, projectPointToSegment, getPathSegments, PathSegment, distanceToSegment } from '../utils/pathUtils';
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

      // ✅ FIX: Usa il segmento trovato per calcolare t e offset correttamente
      if (!pathRef.current) {
        console.error('[LabelDrag] pathRef.current è null');
        return;
      }

      // Proietta il punto sul segmento trovato
      const projection = distanceToSegment(positionToSave, finalHighlight.highlightedSegment);

      // Calcola t basandoci sulla posizione del segmento nel path totale
      const pathLength = pathRef.current.getTotalLength();
      if (pathLength === 0) {
        console.error('[LabelDrag] pathLength è 0');
        return;
      }

      // Trova la lunghezza accumulata fino al segmento usando getPathSegments
      const segments = getPathSegments(pathRef.current);
      let accumulatedLength = 0;

      // Calcola la lunghezza approssimata fino al segmento
      for (let i = 0; i < finalHighlight.highlightedSegment.index && i < segments.length; i++) {
        const seg = segments[i];
        const segLength = Math.sqrt(
          Math.pow(seg.end.x - seg.start.x, 2) + Math.pow(seg.end.y - seg.start.y, 2)
        );
        accumulatedLength += segLength;
      }

      // Calcola la lunghezza del segmento corrente fino al punto proiettato
      const segmentStart = finalHighlight.highlightedSegment.start;
      const segmentEnd = finalHighlight.highlightedSegment.end;
      const segmentLength = Math.sqrt(
        Math.pow(segmentEnd.x - segmentStart.x, 2) + Math.pow(segmentEnd.y - segmentStart.y, 2)
      );

      // t locale sul segmento (0-1) dalla proiezione
      const localT = projection.t;

      // Lunghezza dal segmento start al punto proiettato
      const lengthToProjection = segmentLength * localT;

      // Lunghezza totale approssimata dal path start al punto proiettato
      const totalLengthApprox = accumulatedLength + lengthToProjection;

      // Normalizza usando la lunghezza totale del path
      // Calcola il rapporto tra lunghezza approssimata e lunghezza totale dei segmenti
      let totalSegmentsLength = 0;
      for (const seg of segments) {
        const segLen = Math.sqrt(
          Math.pow(seg.end.x - seg.start.x, 2) + Math.pow(seg.end.y - seg.start.y, 2)
        );
        totalSegmentsLength += segLen;
      }

      // Se i segmenti hanno lunghezza totale simile al path, usa il rapporto diretto
      // Altrimenti, cerca il punto più vicino sul path nella regione del segmento
      let globalT: number;

      if (totalSegmentsLength > 0 && Math.abs(totalSegmentsLength - pathLength) < pathLength * 0.1) {
        // I segmenti sono una buona approssimazione
        globalT = totalLengthApprox / totalSegmentsLength;
      } else {
        // Cerca il punto più vicino sul path nella regione del segmento
        // Stima la regione del path corrispondente al segmento
        const segmentIndexRatio = finalHighlight.highlightedSegment.index / segments.length;
        const estimatedPathT = segmentIndexRatio;

        // Cerca intorno a questa posizione
        const searchRange = 0.1; // 10% del path intorno alla posizione stimata
        const searchStart = Math.max(0, estimatedPathT - searchRange);
        const searchEnd = Math.min(1, estimatedPathT + searchRange);
        const searchSamples = 50;

        let minDistance = Infinity;
        let bestT = estimatedPathT;

        for (let i = 0; i <= searchSamples; i++) {
          const t = searchStart + (searchEnd - searchStart) * (i / searchSamples);
          const length = pathLength * t;
          const point = pathRef.current.getPointAtLength(length);

          const dist = Math.sqrt(
            Math.pow(projection.projectedPoint.x - point.x, 2) +
            Math.pow(projection.projectedPoint.y - point.y, 2)
          );

          if (dist < minDistance) {
            minDistance = dist;
            bestT = t;
          }
        }

        globalT = bestT;
      }

      const clampedT = Math.max(0, Math.min(1, globalT));

      // Calcola offset (distanza perpendicolare dal segmento)
      const dx = positionToSave.x - projection.projectedPoint.x;
      const dy = positionToSave.y - projection.projectedPoint.y;
      const offsetDistance = Math.sqrt(dx * dx + dy * dy);

      // Determina segno dell'offset (destra/sinistra rispetto alla direzione del segmento)
      const segmentDx = segmentEnd.x - segmentStart.x;
      const segmentDy = segmentEnd.y - segmentStart.y;
      const crossProduct = (dx * segmentDy - dy * segmentDx);
      const signedOffset = crossProduct >= 0 ? offsetDistance : -offsetDistance;

      const relative = {
        t: clampedT,
        offset: signedOffset,
      };

      onPositionChange(relative);
      console.log('[LabelDrag] Posizione salvata (relativa dal segmento):', relative, {
        segmentIndex: finalHighlight.highlightedSegment.index,
        localT: projection.t,
        globalT: clampedT,
        offset: signedOffset,
      });
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
