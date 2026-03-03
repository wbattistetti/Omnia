import { useState, useEffect, useCallback, RefObject } from 'react';
import { useReactFlow } from 'reactflow';
import { CoordinateConverter } from '../utils/coordinateUtils';

export interface EdgePositioningResult {
  midPointSvg: { x: number; y: number };
  midPointScreen: { x: number; y: number };
  labelScreenPosition: { x: number; y: number };
  sourceScreenPosition: { x: number; y: number };
}

/**
 * Hook for calculating edge positions (SVG and screen coordinates)
 * DETERMINISTICO: nessun polling, nessun hack globale, listener completi
 * ✅ PULITO: Usa labelPositionRelative invece di coordinate SVG assolute
 */
export function useEdgePositioning(
  pathRef: RefObject<SVGPathElement>,
  sourceX: number,
  sourceY: number,
  labelPositionRelative?: { t: number; offset: number } | null
): EdgePositioningResult {
  const reactFlowInstance = useReactFlow();
  const [positions, setPositions] = useState<EdgePositioningResult>({
    midPointSvg: { x: 0, y: 0 },
    midPointScreen: { x: 0, y: 0 },
    labelScreenPosition: { x: 0, y: 0 },
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
    let labelScreenPos: { x: number; y: number };
    if (labelPositionRelative) {
      // Converti { t, offset } → coordinate SVG → coordinate screen
      const labelSvg = converter.labelRelativeToAbsolute(labelPositionRelative);
      if (labelSvg) {
        labelScreenPos = converter.svgToScreen(labelSvg) || midPointScreen;
      } else {
        labelScreenPos = midPointScreen;
      }
    } else {
      labelScreenPos = midPointScreen;
    }

    setPositions({
      midPointSvg: { x: midPoint.x, y: midPoint.y },
      midPointScreen,
      labelScreenPosition: labelScreenPos,
      sourceScreenPosition: sourceScreen,
    });
  }, [pathRef, sourceX, sourceY, labelPositionRelative, reactFlowInstance]);

  // Aggiorna quando cambia il path
  useEffect(() => {
    updatePositions();
  }, [updatePositions]);

  // Aggiorna quando cambiano i nodi
  useEffect(() => {
    updatePositions();
  }, [sourceX, sourceY, updatePositions]);

  // ✅ Listener viewport (pan/zoom)
  useEffect(() => {
    if (!reactFlowInstance?.onViewportChange) {
      updatePositions();
      return;
    }

    updatePositions();
    const unsubscribe = reactFlowInstance.onViewportChange(() => {
      updatePositions();
    });

    return unsubscribe;
  }, [reactFlowInstance, updatePositions]);

  // ✅ Listener scroll (CRITICO)
  useEffect(() => {
    const handleScroll = () => updatePositions();
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [updatePositions]);

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
