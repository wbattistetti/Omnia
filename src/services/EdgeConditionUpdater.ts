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
  console.log('[EdgeConditionUpdater] 🔗 [TRACE] updateEdgeWithConditionId called', {
    timestamp: new Date().toISOString(),
    edgeId,
    conditionId
  });

  try {
    const setEdgesFn = FlowStateBridge.getSetEdges();
    if (typeof setEdgesFn !== 'function') {
      throw new Error('setEdges_not_available');
    }

    let updated = false;
    setEdgesFn((currentEdges: any[]) => {
      const hasEdge = currentEdges.some((edge: Edge<EdgeData>) => edge.id === edgeId);
      if (!hasEdge) return currentEdges as any;
      updated = true;
      return currentEdges.map((edge: Edge<EdgeData>) =>
        edge.id === edgeId ? { ...edge, conditionId } : edge
      ) as any;
    });

    if (!updated) return false;

    return true;
  } catch (e) {
    console.error('[EdgeConditionUpdater] ❌ [TRACE] Failed to update edge', {
      edgeId,
      conditionId,
      error: e,
      errorMessage: e instanceof Error ? e.message : String(e),
      errorStack: e instanceof Error ? e.stack : undefined
    });
    return false;
  }
}
