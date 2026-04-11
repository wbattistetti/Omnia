import { useState, useEffect, useCallback, useRef, RefObject } from 'react';
import { useReactFlow } from 'reactflow';
import { CoordinateConverter } from '../utils/coordinateUtils';

export interface EdgePositioningResult {
  midPointSvg: { x: number; y: number };
  midPointScreen: { x: number; y: number };
  labelScreenPosition: { x: number; y: number };
  labelSvgPosition: { x: number; y: number }; // ✅ Coordinate SVG native per EdgeLabelRenderer
  sourceScreenPosition: { x: number; y: number };
}

/**
 * Hook for calculating edge positions (SVG and screen coordinates)
 * ✅ NEW MODEL: Uses absolute coordinates directly, no conversion needed
 * ✅ EdgeLabelRenderer handles SVG→screen conversion automatically
 */
export function useEdgePositioning(
  pathRef: RefObject<SVGPathElement>,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  labelPositionAbsolute?: { x: number; y: number } | null // ✅ Absolute coordinates
): EdgePositioningResult {
  const reactFlowInstance = useReactFlow();
  /** useReactFlow() identity can change every render — must not be in useCallback deps or effects re-run forever. */
  const reactFlowRef = useRef(reactFlowInstance);
  reactFlowRef.current = reactFlowInstance;

  const [positions, setPositions] = useState<EdgePositioningResult>({
    midPointSvg: { x: 0, y: 0 },
    midPointScreen: { x: 0, y: 0 },
    labelScreenPosition: { x: 0, y: 0 },
    labelSvgPosition: { x: 0, y: 0 },
    sourceScreenPosition: { x: 0, y: 0 },
  });

  const updatePositions = useCallback(() => {
    if (!pathRef.current) return;

    const path = pathRef.current;
    const pathLength = path.getTotalLength();
    if (pathLength === 0) return;

    const converter = new CoordinateConverter(reactFlowRef.current, pathRef);

    // Midpoint del path (per EdgeControls)
    const midPoint = path.getPointAtLength(pathLength / 2);
    const midPointScreen = converter.svgToScreen(midPoint) || { x: 0, y: 0 };
    const sourceScreen = converter.flowToScreen({ x: sourceX, y: sourceY });

    // ✅ NEW MODEL: Use absolute coordinates directly
    // EdgeLabelRenderer handles SVG→screen conversion automatically
    let labelSvgPos: { x: number; y: number };
    let labelScreenPos: { x: number; y: number };

    if (labelPositionAbsolute) {
      // ✅ Direct use - EdgeLabelRenderer will convert SVG to screen
      labelSvgPos = labelPositionAbsolute;
      // ✅ Still calculate screen position for backward compatibility (if needed elsewhere)
      labelScreenPos = converter.svgToScreen(labelSvgPos) || midPointScreen;
    } else {
      labelSvgPos = { x: midPoint.x, y: midPoint.y };
      labelScreenPos = midPointScreen;
    }

    setPositions((prev) => {
      const next: EdgePositioningResult = {
        midPointSvg: { x: midPoint.x, y: midPoint.y },
        midPointScreen,
        labelScreenPosition: labelScreenPos,
        labelSvgPosition: labelSvgPos,
        sourceScreenPosition: sourceScreen,
      };
      const same =
        prev.midPointSvg.x === next.midPointSvg.x &&
        prev.midPointSvg.y === next.midPointSvg.y &&
        prev.midPointScreen.x === next.midPointScreen.x &&
        prev.midPointScreen.y === next.midPointScreen.y &&
        prev.labelScreenPosition.x === next.labelScreenPosition.x &&
        prev.labelScreenPosition.y === next.labelScreenPosition.y &&
        prev.labelSvgPosition.x === next.labelSvgPosition.x &&
        prev.labelSvgPosition.y === next.labelSvgPosition.y &&
        prev.sourceScreenPosition.x === next.sourceScreenPosition.x &&
        prev.sourceScreenPosition.y === next.sourceScreenPosition.y;
      return same ? prev : next;
    });
  }, [pathRef, sourceX, sourceY, targetX, targetY, labelPositionAbsolute]);

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

  // ✅ REMOVED: Label position is now calculated directly in CustomEdge render
  // No need to watch labelPositionAbsolute here - it causes lag
  // Label position is passed directly to EdgeLabel, bypassing this hook

  return positions;
}
