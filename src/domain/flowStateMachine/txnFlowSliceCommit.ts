/**
 * Transactional structural runs do not push slices through Dock adapters; FlowStore commits `flowsNext`
 * atomically (`COMMIT_WORKSPACE_SNAPSHOT`). This validates that every slice id listed by the orchestrator
 * exists on `flowsNext` before `flowStoreCommitOk` is reported.
 */

import type { WorkspaceState } from '@flows/FlowTypes';

/**
 * Returns true when every non-empty flow id in `flowIds` has a corresponding entry in `flowsNext`.
 * Empty `flowIds` is treated as vacuous success (nothing to validate).
 */
export function txnStructuralCommitFlowSlices(flowsNext: WorkspaceState['flows'], flowIds: string[]): boolean {
  const ids = flowIds.map((x) => String(x || '').trim()).filter(Boolean);
  if (ids.length === 0) {
    return true;
  }
  for (const id of ids) {
    const slice = flowsNext[id];
    if (slice == null || typeof slice !== 'object') {
      return false;
    }
  }
  return true;
}
