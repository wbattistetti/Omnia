import { useState, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { findClosestSegment, getPathSegments, PathSegment, getSegmentMidpoint, distanceToSegment } from '../utils/pathUtils';

export interface EdgeHoverDuringDragResult {
  highlightedEdgeId: string | null;
  highlightedSegmentIndex: number | null;
  highlightedSegment: PathSegment | null;
  distanceToSegment: number | null; // ✅ NUOVO: distanza dal segmento
  distanceToMidpoint: number | null; // ✅ NUOVO: distanza dal midpoint
}

/**
 * Hook per evidenziare segmenti di edge durante il drag della label
 * Cerca in tutti gli edge della flowchart il segmento più vicino al mouse
 * PULITO: Non resetta durante il drag, solo quando isDragging === false
 */
export function useEdgeHoverDuringLabelDrag(
  mouseSvgPosition: { x: number; y: number } | null,
  currentEdgeId: string,
  snapThreshold: number = 30,
  isDragging: boolean = false // ✅ NUOVO: parametro per sapere se stiamo dragando
): EdgeHoverDuringDragResult {
  const reactFlowInstance = useReactFlow();
  const [result, setResult] = useState<EdgeHoverDuringDragResult>({
    highlightedEdgeId: null,
    highlightedSegmentIndex: null,
    highlightedSegment: null,
    distanceToSegment: null,
    distanceToMidpoint: null,
  });

  useEffect(() => {
    // ✅ PULITO: Non resettare se stiamo dragando (mouseSvgPosition potrebbe essere null temporaneamente)
    if (!mouseSvgPosition) {
      // Reset solo se NON stiamo dragando
      if (!isDragging) {
        setResult({
          highlightedEdgeId: null,
          highlightedSegmentIndex: null,
          highlightedSegment: null,
          distanceToSegment: null,
          distanceToMidpoint: null,
        });
      }
      return;
    }

    // Ottieni tutti gli edge
    const allEdges = reactFlowInstance.getEdges() || [];
    if (allEdges.length === 0) {
      setResult({
        highlightedEdgeId: null,
        highlightedSegmentIndex: null,
        highlightedSegment: null,
        distanceToSegment: null,
        distanceToMidpoint: null,
      });
      return;
    }

    let bestMatch: {
      edgeId: string;
      segmentIndex: number;
      segment: PathSegment;
      distance: number;
      distanceToMidpoint: number;
    } | null = null;

    // Cerca in tutti gli edge
    for (const edge of allEdges) {
      // ✅ MIGLIORATO: Prova più modi per trovare il path
      let pathElement: SVGPathElement | null = null;

      // Metodo 1: getElementById
      pathElement = document.getElementById(edge.id) as SVGPathElement;

      // Metodo 2: Se non trovato, cerca nel DOM React Flow
      if (!pathElement || pathElement.tagName !== 'path') {
        const reactFlowWrapper = document.querySelector('.react-flow');
        if (reactFlowWrapper) {
          pathElement = reactFlowWrapper.querySelector(`path#${edge.id}`) as SVGPathElement;
        }
      }

      // Metodo 3: Cerca per classe e id
      if (!pathElement || pathElement.tagName !== 'path') {
        const allPaths = document.querySelectorAll('path.react-flow__edge-path');
        for (const path of allPaths) {
          if (path.id === edge.id) {
            pathElement = path as SVGPathElement;
            break;
          }
        }
      }

      if (!pathElement || pathElement.tagName !== 'path') continue;

      // Verifica che il path sia valido e abbia lunghezza > 0
      try {
        const pathLength = pathElement.getTotalLength();
        if (pathLength === 0) continue;
      } catch (e) {
        continue;
      }

      // Estrai segmenti
      const segments = getPathSegments(pathElement);
      if (segments.length === 0) continue;

      // Trova segmento più vicino
      const closest = findClosestSegment(mouseSvgPosition, segments, snapThreshold);
      if (!closest) continue;

      // Calcola distanza dal midpoint
      const midpoint = getSegmentMidpoint(closest.segment);
      const distanceToMidpoint = Math.sqrt(
        Math.pow(mouseSvgPosition.x - midpoint.x, 2) +
        Math.pow(mouseSvgPosition.y - midpoint.y, 2)
      );

      // Se è il miglior match finora, salvalo
      if (!bestMatch || closest.distance < bestMatch.distance) {
        bestMatch = {
          edgeId: edge.id,
          segmentIndex: closest.segment.index,
          segment: closest.segment,
          distance: closest.distance,
          distanceToMidpoint,
        };
      }
    }

    // ✅ DEBUG: Verifica se abbiamo trovato un match (solo durante drag)
    if (isDragging) {
      if (bestMatch) {
        console.log('[EdgeHover] Match trovato:', {
          edgeId: bestMatch.edgeId,
          distance: bestMatch.distance,
          distanceToMidpoint: bestMatch.distanceToMidpoint,
          snapThreshold,
        });
      } else {
        console.log('[EdgeHover] Nessun match trovato per:', mouseSvgPosition);
      }
    }

    // Aggiorna risultato
    if (bestMatch) {
      setResult({
        highlightedEdgeId: bestMatch.edgeId,
        highlightedSegmentIndex: bestMatch.segmentIndex,
        highlightedSegment: bestMatch.segment,
        distanceToSegment: bestMatch.distance,
        distanceToMidpoint: bestMatch.distanceToMidpoint,
      });
    } else {
      setResult({
        highlightedEdgeId: null,
        highlightedSegmentIndex: null,
        highlightedSegment: null,
        distanceToSegment: null,
        distanceToMidpoint: null,
      });
    }
  }, [mouseSvgPosition, reactFlowInstance, snapThreshold, isDragging]);

  return result;
}
