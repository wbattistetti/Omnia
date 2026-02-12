import React, { forwardRef } from 'react';
import { getBezierPath, getSmoothStepPath } from 'reactflow';
import { LinkStyle } from '../../types/flowTypes';
import { Highlight } from '../../executionHighlight/executionHighlightConstants';
import { buildPathFromVertices } from '../utils/pathUtils';

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

      case LinkStyle.Step:
        // Orthogonal with single elbow (auto HV or VH)
        const preferHV = Math.abs(sourceX - targetX) > Math.abs(sourceY - targetY);
        if (preferHV) {
          const midX = (sourceX + targetX) / 2;
          edgePath = `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`;
        } else {
          const midY = (sourceY + targetY) / 2;
          edgePath = `M ${sourceX},${sourceY} L ${sourceX},${midY} L ${targetX},${midY} L ${targetX},${targetY}`;
        }
        break;

      case LinkStyle.HVH:
        const midX = (sourceX + targetX) / 2;
        edgePath = `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`;
        break;

      case LinkStyle.VHV:
        const midY = (sourceY + targetY) / 2;
        edgePath = `M ${sourceX},${sourceY} L ${sourceX},${midY} L ${targetX},${midY} L ${targetX},${targetY}`;
        break;

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

    return (
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
          opacity: hovered || selected ? 0.95 : 0.85,
          transition: 'stroke 0.15s',
          cursor: 'default', // Normal cursor, not pointer
        }}
        markerEnd={markerEnd ? `url(#${getNormalizedMarkerEnd(markerEnd)})` : undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
      />
    );
  }
);

EdgePathRenderer.displayName = 'EdgePathRenderer';
