/**
 * Whether a Subflow portal row should show as "active" (colored icon): child flow linked and graph has at least one node.
 */

import type { WorkspaceState } from '@flows/FlowTypes';

export function isSubflowChildFlowLinkedAndNonEmpty(
  flows: WorkspaceState['flows'],
  childFlowId: string | null | undefined
): boolean {
  const fid = String(childFlowId || '').trim();
  if (!fid) return false;
  const slice = flows[fid];
  return (slice?.nodes?.length ?? 0) > 0;
}
