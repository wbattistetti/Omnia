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
 */
export function useEdgeHoverDuringLabelDrag(
  mouseSvgPosition: { x: number; y: number } | null,
  currentEdgeId: string,
  snapThreshold: number = 30
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
    if (!mouseSvgPosition) {
      setResult({
        highlightedEdgeId: null,
        highlightedSegmentIndex: null,
        highlightedSegment: null,
        distanceToSegment: null,
        distanceToMidpoint: null,
      });
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
      // Trova il path element per questo edge
      // Usa querySelector per trovare il path con id corrispondente
      const pathElement = document.getElementById(edge.id) as SVGPathElement;
      if (!pathElement || pathElement.tagName !== 'path') continue;

      // Verifica che il path sia valido e abbia lunghezza > 0
      try {
        const pathLength = pathElement.getTotalLength();
        if (pathLength === 0) continue;
      } catch (e) {
        // Path non valido, salta
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
  }, [mouseSvgPosition, reactFlowInstance, snapThreshold]);

  return result;
}
