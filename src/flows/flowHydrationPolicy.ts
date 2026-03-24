/**
 * Step 3: When the workspace may fetch server flow data vs keep local-only state.
 * Used by FlowCanvasHost / FlowWorkspace to avoid load↔save races.
 */

import type { Flow } from './FlowTypes';

export function isRealProjectId(projectId: string | undefined): boolean {
  return Boolean(projectId && String(projectId).trim() !== '');
}

/**
 * Returns true only when we should call the API loadFlow and apply via APPLY_FLOW_LOAD_RESULT.
 * Never true without a real project id.
 *
 * Until `flow.hydrated === true`, the server is the source of truth for an opened project.
 * We do NOT skip load because of local nodes or hasLocalChanges: those flags can be wrong
 * (race, stale upsert) and would block existing projects from ever loading from the API.
 * After APPLY_FLOW_LOAD_RESULT sets hydrated, we stop fetching until remount or explicit reload.
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
