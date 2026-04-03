/**
 * Step 3: When the workspace may fetch server flow data vs keep local-only state.
 * Used by FlowCanvasHost / FlowWorkspace to avoid load↔save races.
 *
 * If `loadFlow` returns an empty graph while the slice already has nodes and `hasLocalChanges`,
 * `FlowStore` APPLY_FLOW_LOAD_RESULT keeps local nodes/edges (see `flowLoadMergePolicy`).
 *
 * When the slice is not hydrated but already has local nodes and `hasLocalChanges`, we skip
 * fetching so an empty API response cannot race ahead of persist (hosts then mark `hydrated`).
 */

import type { Flow } from './FlowTypes';

export function isRealProjectId(projectId: string | undefined): boolean {
  return Boolean(projectId && String(projectId).trim() !== '');
}

/**
 * Returns true only when we should call the API loadFlow and apply via APPLY_FLOW_LOAD_RESULT.
 * Never true without a real project id.
 *
 * Until `flow.hydrated === true`, the server is normally the source of truth.
 * Exception: if the slice already has nodes and `hasLocalChanges`, we skip the initial fetch so an
 * empty API response cannot race in-memory edits; hosts mark the slice `hydrated` (see FlowCanvasHost).
 * After hydration, we stop fetching until remount or explicit reload.
 */
export function shouldLoadFlowFromServer(projectId: string | undefined, flow: Flow | undefined): boolean {
  return explainShouldLoadFlowFromServer(projectId, flow).shouldLoad;
}

/**
 * Human-readable reason for load/skip (FlowSaveDebug and tests).
 */
export function explainShouldLoadFlowFromServer(
  projectId: string | undefined,
  flow: Flow | undefined
): {
  shouldLoad: boolean;
  reason: string;
  nodeCount: number;
  edgeCount: number;
} {
  const nodeCount = flow?.nodes?.length ?? 0;
  const edgeCount = flow?.edges?.length ?? 0;

  if (!isRealProjectId(projectId)) {
    return { shouldLoad: false, reason: 'no_real_project_id', nodeCount, edgeCount };
  }
  if (!flow) {
    return { shouldLoad: false, reason: 'no_flow_slice_yet', nodeCount, edgeCount };
  }
  if (flow.hydrated === true) {
    return { shouldLoad: false, reason: 'already_hydrated', nodeCount, edgeCount };
  }
  if (flow.hasLocalChanges === true && nodeCount > 0) {
    return {
      shouldLoad: false,
      reason: 'local_nonempty_skip_server_fetch',
      nodeCount,
      edgeCount,
    };
  }
  return {
    shouldLoad: true,
    reason: 'not_hydrated_will_fetch_server',
    nodeCount,
    edgeCount,
  };
}

export type FlowLoadApplyPayload<NodeT = unknown, EdgeT = unknown> = {
  nodes: NodeT[];
  edges: EdgeT[];
  meta?: { variables?: unknown[] };
};
