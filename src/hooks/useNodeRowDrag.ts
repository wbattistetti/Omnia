import { useState } from 'react';
import { NodeRowData } from '../types/project';

export function useNodeRowDrag(nodeRows: NodeRowData[]) {
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [draggedRowOriginalIndex, setDraggedRowOriginalIndex] = useState<number | null>(null);
  const [draggedRowInitialClientX, setDraggedRowInitialClientX] = useState<number | null>(null);
  const [draggedRowInitialClientY, setDraggedRowInitialClientY] = useState<number | null>(null);
  const [draggedRowInitialRect, setDraggedRowInitialRect] = useState<DOMRect | null>(null);
  const [draggedRowCurrentClientX, setDraggedRowCurrentClientX] = useState<number | null>(null);
  const [draggedRowCurrentClientY, setDraggedRowCurrentClientY] = useState<number | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [visualSnapOffset, setVisualSnapOffset] = useState({ x: 0, y: 0 });

  // Puoi aggiungere qui eventuali handler per il drag&drop

  return {
    draggedRowId,
    setDraggedRowId,
    draggedRowOriginalIndex,
    setDraggedRowOriginalIndex,
    draggedRowInitialClientX,
    setDraggedRowInitialClientX,
    draggedRowInitialClientY,
    setDraggedRowInitialClientY,
    draggedRowInitialRect,
    setDraggedRowInitialRect,
    draggedRowCurrentClientX,
    setDraggedRowCurrentClientX,
    draggedRowCurrentClientY,
    setDraggedRowCurrentClientY,
    hoveredRowIndex,
    setHoveredRowIndex,
    visualSnapOffset,
    setVisualSnapOffset,
  };
} 