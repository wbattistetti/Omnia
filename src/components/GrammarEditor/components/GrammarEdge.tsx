// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow';
import type { GrammarEdge as GrammarEdgeType } from '../types/grammarTypes';

interface GrammarEdgeData {
  edge: GrammarEdgeType;
}

export function GrammarEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
  data,
  markerEnd,
}: EdgeProps<GrammarEdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#3b82f6' : '#6b7280',
          strokeWidth: selected ? 3 : 2,
        }}
      />
      {data?.edge?.label && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '12px',
            fill: '#374151',
            pointerEvents: 'none',
          }}
        >
          {data.edge.label}
        </text>
      )}
    </>
  );
}
