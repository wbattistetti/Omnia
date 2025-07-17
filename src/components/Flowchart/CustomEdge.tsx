import React, { useState, useEffect } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { Pencil, Trash2 } from 'lucide-react';
import { normalizeMarkerEnd } from '../../utils/markerUtils';

export type CustomEdgeProps = EdgeProps & {
  onDeleteEdge?: (edgeId: string) => void;
};

export const CustomEdge: React.FC<CustomEdgeProps> = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    onDeleteEdge,
    data,
  } = props;

  const [hovered, setHovered] = useState(false);

  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })[0];

  // Midpoint for icons
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // Icon size and box
  const ICON_SIZE = 18;
  const ICON_BOX = 28;

  // Normalizza markerEnd: accetta solo 'arrowhead'
  const getNormalizedMarkerEnd = (markerEnd: string | undefined) => {
    if (!markerEnd) return undefined;
    // Se contiene 'url(' o apici, restituisci solo 'arrowhead'
    if (markerEnd.includes('url(') || markerEnd.includes("'") || markerEnd.includes('"')) {
      return 'arrowhead';
    }
    return markerEnd;
  };

  // Prefer onDeleteEdge from data if present
  const handleDelete = (edgeId: string) => {
    if (data && typeof data.onDeleteEdge === 'function') {
      data.onDeleteEdge(edgeId);
    } else if (onDeleteEdge) {
      onDeleteEdge(edgeId);
    }
  };

  // LOG: ogni render, props e stile
  useEffect(() => {
    // Nuovo log: markerEnd e strokeDasharray
    console.log('[CustomEdge][RENDER]', {
      id,
      markerEnd,
      strokeDasharray: style?.strokeDasharray,
      style,
      props
    });
  });

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ pointerEvents: 'all' }}
    >
      {/* Edge path */}
      <path
        id={id}
        style={{ ...style, strokeDasharray: undefined }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd ? `url(#${getNormalizedMarkerEnd(markerEnd)})` : undefined}
        ref={el => {
          if (el) {
            // Nuovo log: markerEnd e strokeDasharray su SVG
            const dash = el.getAttribute('stroke-dasharray');
            const marker = el.getAttribute('marker-end');
            console.log('[CustomEdge][SVG]', { id, markerEnd: marker, strokeDasharray: dash });
          }
        }}
      />
      {/* Edge label/caption */}
      {props.label && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          fontSize={9}
          fill="#8b5cf6"
          fontWeight="normal"
          pointerEvents="none"
        >
          {props.label}
        </text>
      )}
      {/* Icons on hover */}
      <foreignObject
        x={midX - ICON_BOX}
        y={midY - ICON_BOX / 2}
        width={ICON_BOX * 2}
        height={ICON_BOX}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          {/* Pencil icon */}
          <button
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.85)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              marginRight: 2,
            }}
            onClick={e => {
              e.stopPropagation();
              alert('open intellisense');
            }}
            title="Modifica condizioni"
          >
            <Pencil size={14} color="#a16207" />
          </button>
          {/* Trash icon */}
          <button
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.85)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              marginLeft: 2,
            }}
            onClick={e => {
              e.stopPropagation();
              handleDelete(id);
            }}
            title="Elimina collegamento"
          >
            <Trash2 size={14} color="#dc2626" />
          </button>
        </div>
      </foreignObject>
    </g>
  );
};

export default CustomEdge; 