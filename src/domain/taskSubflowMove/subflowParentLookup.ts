/**
 * Resolves parent flow / portal row ids from subflow canvas ids (pure helpers, no orchestration).
 */

import type { WorkspaceState } from '@flows/FlowTypes';

const SUBFLOW_PREFIX = 'subflow_';

/** Parses `subflow_<rowId>` → subflow (portal) task row id. */
export function parseSubflowTaskRowIdFromChildCanvasId(childCanvasId: string): string | null {
  const s = String(childCanvasId || '').trim();
  if (!s.startsWith(SUBFLOW_PREFIX)) return null;
  const rest = s.slice(SUBFLOW_PREFIX.length).trim();
  return rest || null;
}

/**
 * Finds which flow slice contains a node row whose id is the Subflow portal task row.
 */
export function findParentFlowIdContainingSubflowRow(
  flows: WorkspaceState['flows'],
  subflowPortalRowTaskId: string
): string | null {
  const rid = String(subflowPortalRowTaskId || '').trim();
  if (!rid) return null;
  for (const [flowId, slice] of Object.entries(flows || {})) {
    const nodes = (slice as { nodes?: Array<{ data?: { rows?: unknown[] } }> })?.nodes || [];
    for (const node of nodes) {
      const rows = Array.isArray(node?.data?.rows) ? node.data!.rows! : [];
      if (rows.some((r) => String((r as { id?: string })?.id || '').trim() === rid)) {
        return flowId;
      }
    }
  }
  return null;
}
