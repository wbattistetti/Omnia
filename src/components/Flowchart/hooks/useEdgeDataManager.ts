import { useCallback } from 'react';
import type { Edge, EdgeData } from '../types/flowTypes';

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
      console.log('[useEdgeDataManager][createOnUpdate] 🎯 START', {
        edgeId,
        updates,
        updatesData: updates.data,
        hasLabelPositionSvg: !!(updates.data?.labelPositionSvg)
      });

      let safeUpdates = { ...updates };

      // Normalize label if it's an object
      if (typeof updates.label === 'object' && updates.label !== null) {
        safeUpdates.label = updates.label.description || updates.label.name || '';
      }

      setEdges(prevEdges => {
        console.log('[useEdgeDataManager][createOnUpdate] 📊 Before update', {
          edgeId,
          totalEdges: prevEdges.length,
          targetEdge: prevEdges.find(e => e.id === edgeId),
          targetEdgeData: prevEdges.find(e => e.id === edgeId)?.data
        });

        const updatedEdges = prevEdges.map(edge => {
          if (edge.id === edgeId) {
            // CRITICAL: Preserve ALL existing data properties
            // This includes: linkStyle, labelPositionSvg, controlPoints, isElse, etc.
            const existingData = edge.data || {};
            const mergedData = {
              ...existingData,
              ...(safeUpdates.data || {})
            };

            // DEBUG: Log when labelPositionSvg is being updated
            if (safeUpdates.data?.labelPositionSvg) {
              console.log('[useEdgeDataManager][createOnUpdate] 🔄 Updating labelPositionSvg', {
                edgeId: edge.id,
                oldPosition: existingData.labelPositionSvg,
                newPosition: safeUpdates.data.labelPositionSvg,
                existingDataKeys: Object.keys(existingData),
                mergedDataKeys: Object.keys(mergedData),
                mergedData: mergedData
              });
            }

            const updatedEdge = {
              ...edge,
              ...safeUpdates,
              data: mergedData
            };

            console.log('[useEdgeDataManager][createOnUpdate] ✅ Updated edge', {
              edgeId: edge.id,
              updatedEdgeData: updatedEdge.data,
              hasLabelPositionSvg: !!(updatedEdge.data as any)?.labelPositionSvg,
              labelPositionSvg: (updatedEdge.data as any)?.labelPositionSvg
            });

            return updatedEdge;
          }
          return edge;
        });

        console.log('[useEdgeDataManager][createOnUpdate] 📊 After update', {
          edgeId,
          totalEdges: updatedEdges.length,
          targetEdge: updatedEdges.find(e => e.id === edgeId),
          targetEdgeData: updatedEdges.find(e => e.id === edgeId)?.data,
          targetEdgeLabelPosition: (updatedEdges.find(e => e.id === edgeId)?.data as any)?.labelPositionSvg
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
