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
    const currentEdges = FlowStateBridge.getEdges();
    console.log('[EdgeConditionUpdater] 🔍 [TRACE] Current edges state', {
      totalEdges: currentEdges.length,
      edgesWithConditionId: currentEdges.filter((e: any) => e.conditionId).map((e: any) => ({
        id: e.id,
        conditionId: e.conditionId
      }))
    });

    const edgeFound = currentEdges.find((e: Edge<EdgeData>) => e.id === edgeId);

    if (!edgeFound) {
      console.warn('[EdgeConditionUpdater] ❌ [TRACE] Edge not found', {
        edgeId,
        availableEdgeIds: currentEdges.map((e: any) => e.id)
      });
      return false;
    }

    console.log('[EdgeConditionUpdater] ✅ [TRACE] Edge found', {
      edgeId,
      currentConditionId: (edgeFound as any).conditionId,
      newConditionId: conditionId,
      willUpdate: (edgeFound as any).conditionId !== conditionId
    });

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
    console.log('[EdgeConditionUpdater] ✅ [TRACE] FlowStateBridge.setEdges called', {
      edgeId,
      conditionId
    });

    // Also update React Flow if setter is available
    const setEdgesFn = FlowStateBridge.getSetEdges();
    if (typeof setEdgesFn === 'function') {
      setEdgesFn(updatedEdges);
      console.log('[EdgeConditionUpdater] ✅ [TRACE] React Flow edges updated synchronously', {
        edgeId,
        conditionId
      });
    } else {
      console.warn('[EdgeConditionUpdater] ⚠️ [TRACE] React Flow setter not available', {
        edgeId,
        conditionId
      });
    }

    // Verify the update
    const verifyEdges = FlowStateBridge.getEdges();
    const verifyEdge = verifyEdges.find((e: Edge<EdgeData>) => e.id === edgeId);
    const verifyConditionId = (verifyEdge as any)?.conditionId;

    if (verifyConditionId === conditionId) {
      console.log('[EdgeConditionUpdater] ✅ [TRACE] Edge update verified successfully', {
        edgeId,
        conditionId: verifyConditionId
      });
    } else {
      console.error('[EdgeConditionUpdater] ❌ [TRACE] Edge update verification FAILED', {
        edgeId,
        expectedConditionId: conditionId,
        actualConditionId: verifyConditionId
      });
    }

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
