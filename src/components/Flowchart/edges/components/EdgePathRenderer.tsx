import React, { forwardRef, useMemo } from 'react';

/** Fascia invisibile intorno al tratto (~9px per lato) per hover/click più tolleranti. */
const EDGE_POINTER_HIT_STROKE_PX = 18;
import { getBezierPath, getSmoothStepPath } from 'reactflow';
import { LinkStyle } from '../../types/flowTypes';
import { Highlight } from '../../executionHighlight/executionHighlightConstants';
import { buildPathFromVertices, PathSegment } from '../utils/pathUtils';
import {
  getRoundedAutoOrthoPath,
  getRoundedVHVPath,
  getRoundedHVHPath,
  ORTHO_CORNER_RADIUS_PX,
} from '../utils/edgeRouting';

export interface EdgePathRendererProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
  linkStyle: LinkStyle;
  controlPoints?: Array<{ x: number; y: number }>;
  style?: React.CSSProperties;
  markerEnd?: string;
  hovered?: boolean;
  selected?: boolean;
  executionHighlight?: {
    stroke?: string;
    strokeWidth?: number;
    isError?: boolean;
  };
  trashHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onCtrlClick?: (e: React.MouseEvent) => void;
  onShiftClick?: (e: React.MouseEvent) => void;
  highlightedSegment?: PathSegment | null; // ✅ Segmento da evidenziare durante drag label
  // ✅ NEW MODEL: Props per hit-area (integrate nell'SVG)
  hitAreaSegments?: PathSegment[];
  hitAreaWidth?: number;
  onSegmentEnter?: (edgeId: string, segment: PathSegment) => void;
  onSegmentLeave?: () => void;
  isDragging?: boolean;
}

/**
 * Pure SVG path renderer for edges
 * Handles path calculation and rendering only
 */
export const EdgePathRenderer = forwardRef<SVGPathElement, EdgePathRendererProps>(
  (
    {
      id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      linkStyle,
      controlPoints,
      style = {},
      markerEnd,
      hovered = false,
      selected = false,
      executionHighlight,
      trashHovered = false,
      onMouseEnter,
      onMouseLeave,
      onContextMenu,
      onShiftClick,
      highlightedSegment,
      hitAreaSegments = [],
      hitAreaWidth = 25,
      onSegmentEnter,
      onSegmentLeave,
      isDragging = false,
    },
    ref
  ) => {
    // Calculate path based on link style or control points
    let edgePath = '';

    // If control points exist, use them to build custom path
    if (controlPoints && controlPoints.length > 0) {
      const allVertices = [
        { x: sourceX, y: sourceY, id: 'source' },
        ...controlPoints.map((cp, idx) => ({ x: cp.x, y: cp.y, id: `cp-${idx}` })),
        { x: targetX, y: targetY, id: 'target' },
      ];
      edgePath = buildPathFromVertices(allVertices);
    } else {
      // Otherwise, use link style
      switch (linkStyle) {
      case LinkStyle.AutoOrtho:
        edgePath = getRoundedAutoOrthoPath(sourceX, sourceY, targetX, targetY, ORTHO_CORNER_RADIUS_PX);
        break;

      case LinkStyle.VHV:
        edgePath = getRoundedVHVPath(sourceX, sourceY, targetX, targetY, ORTHO_CORNER_RADIUS_PX);
        break;

      case LinkStyle.HVH:
        edgePath = getRoundedHVHPath(sourceX, sourceY, targetX, targetY, ORTHO_CORNER_RADIUS_PX);
        break;

      case LinkStyle.Bezier:
        edgePath = getBezierPath({
          sourceX,
          sourceY,
          sourcePosition: sourcePosition as any,
          targetX,
          targetY,
          targetPosition: targetPosition as any,
        })[0];
        break;

      case LinkStyle.Step: {
        const preferHV = Math.abs(sourceX - targetX) > Math.abs(sourceY - targetY);
        if (preferHV) {
          edgePath = getRoundedHVHPath(sourceX, sourceY, targetX, targetY, ORTHO_CORNER_RADIUS_PX);
        } else {
          edgePath = getRoundedVHVPath(sourceX, sourceY, targetX, targetY, ORTHO_CORNER_RADIUS_PX);
        }
        break;
      }

      case LinkStyle.SmoothStep:
      default:
        edgePath = getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition: sourcePosition as any,
          targetX,
          targetY,
          targetPosition: targetPosition as any,
          borderRadius: 8,
          offset: 4,
        })[0];
        break;
      }
    }

    // Normalize markerEnd
    const getNormalizedMarkerEnd = (markerEnd: string | undefined) => {
      if (!markerEnd) return undefined;
      if (markerEnd.includes('url(') || markerEnd.includes("'") || markerEnd.includes('"')) {
        return 'arrowhead';
      }
      return markerEnd;
    };

    const handleClick = (e: React.MouseEvent) => {
      // Ignora click normali - lascia che React Flow gestisca la selezione
      if (!e.shiftKey) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.shiftKey) onShiftClick?.(e);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e);
    };

    const strokeColor = executionHighlight?.isError
      ? Highlight.Edge.multipleValidError
      : trashHovered
      ? '#dc2626'
      : executionHighlight?.stroke || style.stroke || '#8b5cf6';

    const strokeWidth =
      executionHighlight?.isError || (executionHighlight?.strokeWidth && executionHighlight.strokeWidth > 1.5)
        ? executionHighlight.strokeWidth
        : hovered || selected
        ? 3
        : 1.5;

    const dimOpacity = hovered || selected ? 0.95 : 0.85;
    const explicitOpacity =
      typeof style.opacity === 'number'
        ? style.opacity
        : typeof style.opacity === 'string' && style.opacity !== ''
          ? Number.parseFloat(style.opacity)
          : undefined;
    const pathOpacity =
      explicitOpacity !== undefined && !Number.isNaN(explicitOpacity) ? explicitOpacity : dimOpacity;

    // ✅ Genera path per segmento evidenziato
    const highlightPath = highlightedSegment
      ? `M ${highlightedSegment.start.x},${highlightedSegment.start.y} L ${highlightedSegment.end.x},${highlightedSegment.end.y}`
      : null;

    // ✅ NEW MODEL: Genera hit-areas per segmenti (solo durante drag)
    const hitAreas = useMemo(() => {
      if (!isDragging || !hitAreaSegments.length) return [];

      return hitAreaSegments.map((segment) => {
        const { start, end } = segment;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        // Filter out degenerate segments
        if (length < 1e-10) return null;

        // Normalize direction vector
        const nx = dx / length;
        const ny = dy / length;

        // Perpendicular vector (for width)
        const perpX = -ny;
        const perpY = nx;

        // Half width
        const halfWidth = hitAreaWidth / 2;

        // Rectangle corners
        const p1 = { x: start.x + perpX * halfWidth, y: start.y + perpY * halfWidth };
        const p2 = { x: start.x - perpX * halfWidth, y: start.y - perpY * halfWidth };
        const p3 = { x: end.x - perpX * halfWidth, y: end.y - perpY * halfWidth };
        const p4 = { x: end.x + perpX * halfWidth, y: end.y + perpY * halfWidth };

        return {
          segment,
          path: `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`,
        };
      }).filter((area): area is { segment: PathSegment; path: string } => area !== null);
    }, [hitAreaSegments, hitAreaWidth, isDragging]);

    return (
      <>
        {/* Path visibile: niente pointer-events (la fascia sotto riceve i puntatori) */}
        <path
          ref={ref}
          id={id}
          className="react-flow__edge-path"
          d={edgePath}
          style={{
            ...style,
            strokeDasharray: undefined,
            stroke: strokeColor,
            strokeWidth,
            opacity: pathOpacity,
            transition: 'stroke 0.15s',
            cursor: 'default',
            pointerEvents: 'none',
          }}
          markerEnd={markerEnd ? `url(#${getNormalizedMarkerEnd(markerEnd)})` : undefined}
        />

        {/* Fascia invisibile più larga sullo stesso d — hover anche vicino al segmento */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={EDGE_POINTER_HIT_STROKE_PX}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            pointerEvents: 'stroke',
            cursor: 'default',
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onContextMenu={handleContextMenu}
          onClick={handleClick}
        />

        {/* ✅ Overlay segmento evidenziato */}
        {highlightPath && (
          <path
            d={highlightPath}
            stroke="#8b5cf6"
            strokeWidth={5}
            fill="none"
            opacity={0.6}
            style={{
              pointerEvents: 'none',
              transition: 'opacity 0.15s',
            }}
          />
        )}

        {/* ✅ NEW MODEL: Hit-areas per segmenti (solo durante drag, dentro l'SVG) */}
        {/* ✅ FIX: fill="transparent" invece di fill="none" per garantire pointer-events in tutti i browser */}
        {isDragging && hitAreas.map(({ segment, path }) => (
          <path
            key={`hit-${id}-${segment.index}`}
            d={path}
            fill="transparent"
            stroke="transparent"
            opacity={0}
            pointerEvents="all"
            style={{
              cursor: 'move',
            }}
            onMouseEnter={() => onSegmentEnter?.(id, segment)}
            onMouseLeave={onSegmentLeave}
          />
        ))}
      </>
    );
  }
);

EdgePathRenderer.displayName = 'EdgePathRenderer';
