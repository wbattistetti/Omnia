import { useCallback } from 'react';
import type { Edge, EdgeData } from '@components/Flowchart/types/flowTypes';

/**
 * Hook for managing edge data updates with safe merging
 *
 * This hook provides a stable `createOnUpdate` function that safely merges
 * edge data updates while preserving all existing properties (linkStyle,
 * labelPositionSvg, controlPoints, isElse, etc.).
 *
 * @param setEdges - React state setter for edges array
 * @param onDeleteEdge - Callback to delete an edge by ID
 * @returns Object with createOnUpdate, updateEdgeData, and deleteEdge functions
 */
export function useEdgeDataManager(
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>,
  onDeleteEdge: (edgeId?: string) => void
) {
  /**
   * Creates a memoized onUpdate function for a specific edge
   *
   * This function safely merges updates with existing edge data,
   * preserving all properties that are not explicitly updated.
   *
   * @param edgeId - The ID of the edge to update
   * @returns A function that accepts updates and applies them to the edge
   */
  const createOnUpdate = useCallback((edgeId: string) => {
    return (updates: any) => {
      // ✅ Separate persistent fields from data-only fields
      const persistentFields = [
        'conditionId',
        'isElse',
        'linkStyle',
        'controlPoints',
        'labelPositionRelative',
        'labelPositionSvg'
      ];

      const persistentUpdates: any = {};
      const dataOnlyUpdates: any = {};

      Object.keys(updates).forEach(key => {
        if (key === 'data') {
          // data updates are always non-persistent callbacks
          dataOnlyUpdates.data = updates.data;
        } else if (persistentFields.includes(key)) {
          // Persistent fields go to top-level
          persistentUpdates[key] = updates[key];
        } else if (key !== 'label') {
          // Other top-level fields (except label which is handled separately)
          persistentUpdates[key] = updates[key];
        }
      });

      let safeUpdates = { ...updates };

      // Normalize label if it's an object
      if (typeof updates.label === 'object' && updates.label !== null) {
        safeUpdates.label = updates.label.description || updates.label.name || '';
      }

      setEdges(prevEdges => {
        const updatedEdges = prevEdges.map(edge => {
          if (edge.id === edgeId) {
            // ✅ Merge persistent fields at top-level
            const updatedEdge = {
              ...edge,
              ...persistentUpdates,
              label: safeUpdates.label !== undefined ? safeUpdates.label : edge.label
            };

            // ✅ Merge data-only fields (callbacks)
            if (Object.keys(dataOnlyUpdates).length > 0 || safeUpdates.data) {
              updatedEdge.data = {
                ...(edge.data || {}),
                ...(safeUpdates.data || {}),
                ...dataOnlyUpdates.data
              };
            }

            return updatedEdge;
          }
          return edge;
        });

        return updatedEdges;
      });
    };
  }, [setEdges]);

  /**
   * Directly updates edge data for a specific edge
   *
   * @param edgeId - The ID of the edge to update
   * @param updates - Partial updates to apply to the edge
   */
  const updateEdgeData = useCallback((edgeId: string, updates: any) => {
    const onUpdate = createOnUpdate(edgeId);
    onUpdate(updates);
  }, [createOnUpdate]);

  /**
   * Deletes an edge by ID
   *
   * @param edgeId - The ID of the edge to delete
   */
  const deleteEdge = useCallback((edgeId: string) => {
    onDeleteEdge(edgeId);
  }, [onDeleteEdge]);

  return {
    createOnUpdate,
    updateEdgeData,
    deleteEdge
  };
}
