import { useState, useEffect, useCallback, RefObject } from 'react';
import { useReactFlow } from 'reactflow';

export interface EdgePositioningResult {
  midPointSvg: { x: number; y: number };
  midPointScreen: { x: number; y: number };
  labelScreenPosition: { x: number; y: number };
  sourceScreenPosition: { x: number; y: number };
}

/**
 * Hook for calculating edge positions (SVG and screen coordinates)
 * Uses React Flow's flowToScreenPosition() for reliable Flow → Screen conversion
 */
export function useEdgePositioning(
  pathRef: RefObject<SVGPathElement>,
  edgePath: string,
  sourceX: number,
  sourceY: number,
  sourcePosition: string,
  savedLabelSvgPosition?: { x: number; y: number } | null
): EdgePositioningResult {
  const reactFlowInstance = useReactFlow();
  // ✅ Use flowToScreenPosition instead of deprecated project()
  // Fallback to project() for backward compatibility
  const flowToScreenPosition = reactFlowInstance.flowToScreenPosition || reactFlowInstance.project;

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

    // Midpoint del path
    const midPoint = path.getPointAtLength(pathLength / 2);

    // ✅ Use flowToScreenPosition instead of deprecated project()
    const midPointScreen = flowToScreenPosition({ x: midPoint.x, y: midPoint.y });
    const sourceScreen = flowToScreenPosition({ x: sourceX, y: sourceY });

    let labelScreenPos: { x: number; y: number };
    if (savedLabelSvgPosition) {
      labelScreenPos = flowToScreenPosition({
        x: savedLabelSvgPosition.x,
        y: savedLabelSvgPosition.y,
      });
    } else {
      labelScreenPos = midPointScreen;
    }

    setPositions({
      midPointSvg: { x: midPoint.x, y: midPoint.y },
      midPointScreen,
      labelScreenPosition: labelScreenPos,
      sourceScreenPosition: sourceScreen,
    });
  }, [pathRef, sourceX, sourceY, savedLabelSvgPosition, flowToScreenPosition]);

  // Aggiorna su mount e quando cambia edgePath
  useEffect(() => {
    updatePositions();
  }, [edgePath, updatePositions]);

  // Aggiorna quando si muovono i nodi (sourceX/sourceY)
  useEffect(() => {
    updatePositions();
  }, [sourceX, sourceY, updatePositions]);

  // Aggiorna su cambi di viewport (zoom/pan)
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

  return positions;
}
