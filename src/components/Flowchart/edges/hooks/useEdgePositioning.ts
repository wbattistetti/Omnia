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
 */
export function useEdgePositioning(
  pathRef: RefObject<SVGPathElement>,
  sourceX: number,
  sourceY: number,
  savedLabelSvgPosition?: { x: number; y: number } | null
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

    // Label position
    let labelScreenPos: { x: number; y: number };
    if (savedLabelSvgPosition) {
      labelScreenPos = converter.svgToScreen(savedLabelSvgPosition) || midPointScreen;
    } else {
      labelScreenPos = midPointScreen;
    }

    setPositions({
      midPointSvg: { x: midPoint.x, y: midPoint.y },
      midPointScreen,
      labelScreenPosition: labelScreenPos,
      sourceScreenPosition: sourceScreen,
    });
  }, [pathRef, sourceX, sourceY, savedLabelSvgPosition, reactFlowInstance]);

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

  // Aggiorna quando cambia labelPositionSvg
  useEffect(() => {
    updatePositions();
  }, [savedLabelSvgPosition?.x, savedLabelSvgPosition?.y, updatePositions]);

  return positions;
}
