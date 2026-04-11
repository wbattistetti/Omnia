/**
 * Step 3: When the workspace may fetch server flow data vs keep local-only state.
 * Used by FlowCanvasHost / FlowWorkspace to avoid load↔save races.
 *
 * If `loadFlow` returns an empty graph while the slice already has nodes and `hasLocalChanges`,
 * `FlowStore` APPLY_FLOW_LOAD_RESULT keeps local nodes/edges (see `flowLoadMergePolicy`).
 * `mergeFlowMetaOnServerLoad` preserves richer local `meta.flowInterface` on load/upsert when the
 * server document is stale or empty there (subflow id or `hasLocalChanges`).
 *
 * When the slice is not hydrated but already has local nodes and `hasLocalChanges`, we skip
 * fetching so an empty API response cannot race ahead of persist (hosts then mark `hydrated`).
 */

import type { Flow } from './FlowTypes';
import { logFlowHydrationTrace } from '../utils/flowHydrationTrace';

export function isRealProjectId(projectId: string | undefined): boolean {
  return Boolean(projectId && String(projectId).trim() !== '');
}

/**
 * Returns true only when we should call the API loadFlow and apply via APPLY_FLOW_LOAD_RESULT.
 * Never true without a real project id.
 *
 * Until the slice has a non-empty graph from a completed server round-trip, we may fetch.
 * Exception: if the slice already has nodes and `hasLocalChanges`, we skip the initial fetch so an
 * empty API response cannot race in-memory edits; hosts mark the slice `hydrated` (see FlowCanvasHost).
 * FIX-MAIN-EMPTY: `hydrated` alone no longer blocks fetch when the local graph is still empty.
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

  let result: { shouldLoad: boolean; reason: string; nodeCount: number; edgeCount: number };

  if (!isRealProjectId(projectId)) {
    result = { shouldLoad: false, reason: 'no_real_project_id', nodeCount, edgeCount };
  } else if (!flow) {
    result = { shouldLoad: false, reason: 'no_flow_slice_yet', nodeCount, edgeCount };
  } else if (flow.hydrated === true && (nodeCount > 0 || edgeCount > 0)) {
    // FIX-MAIN-EMPTY — Do not skip fetch merely because hydrated=true; only when we already have a non-empty graph.
    result = { shouldLoad: false, reason: 'already_hydrated_with_graph', nodeCount, edgeCount };
  } else if (
    flow.hydrated === true &&
    nodeCount === 0 &&
    edgeCount === 0 &&
    flow.serverHydrationApplied === true
  ) {
    // FIX-MAIN-EMPTY — Stable empty project after server confirmed: avoid refetch loops.
    result = { shouldLoad: false, reason: 'hydrated_empty_after_server_apply', nodeCount, edgeCount };
  } else if (flow.hasLocalChanges === true && nodeCount > 0) {
    result = {
      shouldLoad: false,
      reason: 'local_nonempty_skip_server_fetch',
      nodeCount,
      edgeCount,
    };
  } else {
    result = {
      shouldLoad: true,
      reason: 'not_hydrated_will_fetch_server',
      nodeCount,
      edgeCount,
    };
  }

  logFlowHydrationTrace('explainShouldLoadFlowFromServer', {
    projectId: projectId ?? null,
    flowId: flow?.id ?? null,
    shouldLoad: result.shouldLoad,
    reason: result.reason,
    nodeCount: result.nodeCount,
    edgeCount: result.edgeCount,
    sliceHydrated: flow?.hydrated,
    sliceHasLocalChanges: flow?.hasLocalChanges,
    sliceServerHydrationApplied: flow?.serverHydrationApplied,
  });

  return result;
}

export type FlowLoadApplyPayload<NodeT = unknown, EdgeT = unknown> = {
  nodes: NodeT[];
  edges: EdgeT[];
  meta?: Flow['meta'];
};
