import { useState, useEffect, useCallback, RefObject } from 'react';
import { useReactFlow } from 'reactflow';
import { CoordinateConverter } from '../utils/coordinateUtils';

export interface EdgePositioningResult {
  midPointSvg: { x: number; y: number };
  midPointScreen: { x: number; y: number };
  labelScreenPosition: { x: number; y: number };
  labelSvgPosition: { x: number; y: number }; // ✅ NUOVO: coordinate SVG native per EdgeLabelRenderer
  sourceScreenPosition: { x: number; y: number };
}

/**
 * Hook for calculating edge positions (SVG and screen coordinates)
 * DETERMINISTICO: nessun polling, nessun hack globale, listener completi
 * ✅ PULITO: Usa labelPositionRelative invece di coordinate SVG assolute
 * ✅ FIX: Monitora anche targetX/targetY e usa MutationObserver per rilevare cambiamenti del path
 */
export function useEdgePositioning(
  pathRef: RefObject<SVGPathElement>,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  labelPositionRelative?: { t: number; offset: number } | null
): EdgePositioningResult {
  const reactFlowInstance = useReactFlow();
  const [positions, setPositions] = useState<EdgePositioningResult>({
    midPointSvg: { x: 0, y: 0 },
    midPointScreen: { x: 0, y: 0 },
    labelScreenPosition: { x: 0, y: 0 },
    labelSvgPosition: { x: 0, y: 0 }, // ✅ NUOVO
    sourceScreenPosition: { x: 0, y: 0 },
  });

  const updatePositions = useCallback(() => {
    if (!pathRef.current) return;

    const path = pathRef.current;
    const pathLength = path.getTotalLength();
    if (pathLength === 0) return;

    const converter = new CoordinateConverter(reactFlowInstance, pathRef);

    // Midpoint del path
    const midPoint = path.getPointAtLength(pathLength / 2);
    const midPointScreen = converter.svgToScreen(midPoint) || { x: 0, y: 0 };
    const sourceScreen = converter.flowToScreen({ x: sourceX, y: sourceY });

    // ✅ PULITO: Label position da labelPositionRelative
    let labelSvgPos: { x: number; y: number };
    let labelScreenPos: { x: number; y: number };

    if (labelPositionRelative) {
      // Converti { t, offset } → coordinate SVG
      const labelSvg = converter.labelRelativeToAbsolute(labelPositionRelative);
      if (labelSvg) {
        labelSvgPos = labelSvg;
        labelScreenPos = converter.svgToScreen(labelSvg) || midPointScreen;
      } else {
        labelSvgPos = { x: midPoint.x, y: midPoint.y };
        labelScreenPos = midPointScreen;
      }
    } else {
      labelSvgPos = { x: midPoint.x, y: midPoint.y };
      labelScreenPos = midPointScreen;
    }

    setPositions({
      midPointSvg: { x: midPoint.x, y: midPoint.y },
      midPointScreen,
      labelScreenPosition: labelScreenPos,
      labelSvgPosition: labelSvgPos, // ✅ NUOVO: coordinate SVG native
      sourceScreenPosition: sourceScreen,
    });
  }, [pathRef, sourceX, sourceY, targetX, targetY, labelPositionRelative, reactFlowInstance]);

  // ✅ CRITICO: Aggiorna quando cambia il path (rileva cambiamenti del DOM)
  useEffect(() => {
    if (!pathRef.current) return;

    // Usa MutationObserver per rilevare cambiamenti dell'attributo 'd' del path
    const observer = new MutationObserver(() => {
      updatePositions();
    });

    observer.observe(pathRef.current, {
      attributes: true,
      attributeFilter: ['d'], // Solo quando cambia l'attributo 'd'
      subtree: false,
    });

    // Anche un check iniziale
    updatePositions();

    return () => {
      observer.disconnect();
    };
  }, [pathRef, updatePositions]);

  // ✅ Aggiorna quando cambiano i nodi (source E target)
  useEffect(() => {
    updatePositions();
  }, [sourceX, sourceY, targetX, targetY, updatePositions]);

  // ✅ REFACTOR: EdgeLabelRenderer gestisce automaticamente pan/zoom/scroll
  // Non serve più listener per viewport/scroll - EdgeLabelRenderer trasforma le coordinate SVG automaticamente
  // Manteniamo solo i listener per cambiamenti strutturali (nodi, path)

  // ✅ Listener resize (CRITICO)
  useEffect(() => {
    const handleResize = () => updatePositions();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [updatePositions]);

  // ✅ PULITO: Aggiorna quando cambia labelPositionRelative
  useEffect(() => {
    updatePositions();
  }, [labelPositionRelative?.t, labelPositionRelative?.offset, updatePositions]);

  return positions;
}
