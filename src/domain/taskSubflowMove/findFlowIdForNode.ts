/**
 * Resolves which workspace flow slice contains a React Flow node id (dual-pane / cross-canvas safe).
 */

import type { WorkspaceState } from '@flows/FlowTypes';

/** All flow ids whose graph contains this node id (order: Object.entries iteration). */
export function findAllFlowIdsContainingNode(
  flows: WorkspaceState['flows'] | undefined,
  nodeId: string | undefined | null
): string[] {
  if (!flows || !nodeId) return [];
  const nid = String(nodeId).trim();
  if (!nid) return [];
  const out: string[] = [];
  for (const [fid, slice] of Object.entries(flows)) {
    const nodes = (slice as { nodes?: Array<{ id?: string }> })?.nodes ?? [];
    if (nodes.some((n) => String(n?.id) === nid)) out.push(fid);
  }
  return out;
}

/**
 * When the same node id exists in multiple flow slices (dual-pane / stale duplicates), prefer the
 * canvas id hinted by the drag source/target (`flowCanvasId` from React) so cross-flow moves use
 * the correct `moveTaskRowBetweenFlows` source/target flow ids.
 */
export function resolveFlowIdForNodeWithCanvasHint(
  flows: WorkspaceState['flows'] | undefined,
  nodeId: string | undefined | null,
  canvasHint: string | undefined | null
): string | null {
  const matches = findAllFlowIdsContainingNode(flows, nodeId);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const h = String(canvasHint ?? '').trim();
  if (h && matches.some((fid) => fid === h)) return h;
  const hMain = h || 'main';
  const prefer = matches.find((fid) => String(fid).trim() === hMain);
  return prefer ?? matches[0];
}

export function findFlowIdContainingNode(
  flows: WorkspaceState['flows'] | undefined,
  nodeId: string | undefined | null
): string | null {
  if (!flows || !nodeId) return null;
  const nid = String(nodeId).trim();
  if (!nid) return null;
  for (const [fid, slice] of Object.entries(flows)) {
    const nodes = (slice as { nodes?: Array<{ id?: string }> })?.nodes ?? [];
    if (nodes.some((n) => String(n?.id) === nid)) return fid;
  }
  return null;
}
