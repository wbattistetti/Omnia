/**
 * EdgeConditionUpdater - Synchronous edge condition updater
 *
 * This utility ensures that when a condition is created or updated,
 * the associated edge is immediately updated with the conditionId.
 * This happens synchronously, avoiding race conditions during save.
 */

import { FlowStateBridge } from './FlowStateBridge';
import type { Edge, EdgeData } from '../components/Flowchart/types/flowTypes';

/**
 * Updates an edge with a conditionId synchronously
 * This ensures the edge is updated immediately, before any save operation
 *
 * @param edgeId - The ID of the edge to update
 * @param conditionId - The ID of the condition to associate with the edge
 * @returns true if the edge was found and updated, false otherwise
 */
export function updateEdgeWithConditionId(edgeId: string, conditionId: string): boolean {
  try {
    const currentEdges = FlowStateBridge.getEdges();
    const edgeFound = currentEdges.find((e: Edge<EdgeData>) => e.id === edgeId);

    if (!edgeFound) {
      console.warn('[EdgeConditionUpdater] ⚠️ Edge not found', { edgeId });
      return false;
    }

    // ✅ Update edge with conditionId at top-level
    const updatedEdges = currentEdges.map((edge: Edge<EdgeData>) =>
      edge.id === edgeId
        ? {
            ...edge,
            conditionId: conditionId  // ✅ Top-level, not in data
          }
        : edge
    );

    // Update FlowStateBridge immediately
    FlowStateBridge.setEdges(updatedEdges);

    // Also update React Flow if setter is available
    const setEdgesFn = FlowStateBridge.getSetEdges();
    if (typeof setEdgesFn === 'function') {
      setEdgesFn(updatedEdges);
      console.log('[EdgeConditionUpdater] ✅ Updated React Flow edges synchronously');
    }

    console.log('[EdgeConditionUpdater] ✅ Edge updated with conditionId', {
      edgeId,
      conditionId,
      reactFlowUpdated: typeof setEdgesFn === 'function'
    });

    return true;
  } catch (e) {
    console.error('[EdgeConditionUpdater] ❌ Failed to update edge', {
      edgeId,
      conditionId,
      error: e
    });
    return false;
  }
}
