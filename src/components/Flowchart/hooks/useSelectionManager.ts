import { useState, useCallback } from 'react';
import { Edge } from 'reactflow';

export function useSelectionManager() {
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectionMenu, setSelectionMenu] = useState<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 });

  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEdgeId(null);
    setSelectedNodeIds([]);
    setSelectionMenu({ show: false, x: 0, y: 0 });
  }, []);

  return {
    selectedEdgeId,
    setSelectedEdgeId,
    selectedNodeIds, 
    setSelectedNodeIds,
    selectionMenu,
    setSelectionMenu,
    handleEdgeClick,
    handlePaneClick,
    clearSelection
  };
}
