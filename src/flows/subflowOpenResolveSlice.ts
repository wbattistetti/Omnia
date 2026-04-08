/**
 * When opening a subflow tab, finds an existing workspace slice without relying on a single ref read.
 * Prevents destructive `upsertFlow({ nodes: [], hydrated: false })` when the slice already exists
 * in FlowWorkspaceSnapshot or under an alternate flow id (e.g. task.flowId vs subflow_<taskId>).
 *
 * Debug: localStorage.setItem('omnia.subflowOpenTrace', '1')
 */

import type { Flow } from './FlowTypes';
import { FlowWorkspaceSnapshot } from './FlowWorkspaceSnapshot';
import { logSubflowOpenTrace } from '../utils/subflowCanvasDebug';

export type FlowsRefLike = { current: Record<string, unknown> };

function trySlice(
  flowId: string,
  flowsRef: FlowsRefLike,
  label: string
): Flow | undefined {
  const fromRef = flowsRef.current?.[flowId] as Flow | undefined;
  if (fromRef && typeof fromRef === 'object' && Array.isArray(fromRef.nodes)) {
    logSubflowOpenTrace(`resolveSlice:${label}:flowsRef`, {
      flowId,
      rfNodes: fromRef.nodes.length,
      hydrated: fromRef.hydrated,
      hasLocalChanges: fromRef.hasLocalChanges,
    });
    return fromRef;
  }
  const fromSnap = FlowWorkspaceSnapshot.getFlowById(flowId) as Flow | null | undefined;
  if (fromSnap && typeof fromSnap === 'object' && Array.isArray((fromSnap as Flow).nodes)) {
    logSubflowOpenTrace(`resolveSlice:${label}:snapshot`, {
      flowId,
      rfNodes: (fromSnap as Flow).nodes.length,
      hydrated: (fromSnap as Flow).hydrated,
      hasLocalChanges: (fromSnap as Flow).hasLocalChanges,
    });
    return fromSnap as Flow;
  }
  logSubflowOpenTrace(`resolveSlice:${label}:miss`, { flowId, refHasKey: Boolean(flowsRef.current?.[flowId]) });
  return undefined;
}

/**
 * Returns the existing flow slice for this subflow canvas id, or under alternateFlowId if provided
 * and different (repository may still point at a legacy id until updateTask runs).
 */
export function resolveExistingFlowSliceForSubflowOpen(
  flowId: string,
  flowsRef: FlowsRefLike,
  alternateFlowId?: string | null
): Flow | undefined {
  logSubflowOpenTrace('resolveExistingFlowSliceForSubflowOpen:start', {
    flowId,
    alternateFlowId: alternateFlowId ?? null,
    refFlowIds: flowsRef.current ? Object.keys(flowsRef.current).sort() : [],
  });
  const primary = trySlice(flowId, flowsRef, 'primary');
  if (primary) return primary;
  const alt = String(alternateFlowId ?? '').trim();
  if (alt && alt !== flowId) {
    const secondary = trySlice(alt, flowsRef, 'alternate');
    if (secondary) return secondary;
  }
  logSubflowOpenTrace('resolveExistingFlowSliceForSubflowOpen:noSlice', { flowId, alternateFlowId: alt || null });
  return undefined;
}
