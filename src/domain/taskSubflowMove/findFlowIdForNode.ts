/**
 * Resolves which workspace flow slice contains a React Flow node id (dual-pane / cross-canvas safe).
 */

import type { WorkspaceState } from '@flows/FlowTypes';

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
