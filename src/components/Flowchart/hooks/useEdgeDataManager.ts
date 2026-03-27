import { useCallback } from 'react';
import type { Edge, EdgeData } from '@components/Flowchart/types/flowTypes';
import { mergeEdgePatch } from '../utils/mergeEdgePatch';

/**
 * Hook for managing edge data updates with safe merging
 *
 * Uses the same `mergeEdgePatch` as FlowActionsContext so label, conditionId and data stay aligned.
 */
export function useEdgeDataManager(
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>,
  onDeleteEdge: (edgeId?: string) => void
) {
  const createOnUpdate = useCallback(
    (edgeId: string) => {
      return (updates: any) => {
        setEdges((prevEdges) =>
          prevEdges.map((edge) =>
            edge.id === edgeId ? mergeEdgePatch(edge, updates as Record<string, any>) : edge
          )
        );
      };
    },
    [setEdges]
  );

  const updateEdgeData = useCallback(
    (edgeId: string, updates: any) => {
      const onUpdate = createOnUpdate(edgeId);
      onUpdate(updates);
    },
    [createOnUpdate]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      onDeleteEdge(edgeId);
    },
    [onDeleteEdge]
  );

  return {
    createOnUpdate,
    updateEdgeData,
    deleteEdge,
  };
}
