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
 */
export function shouldLoadFlowFromServer(projectId: string | undefined, flow: Flow | undefined): boolean {
  if (!isRealProjectId(projectId)) return false;
  if (!flow) return false;
  if (flow.hydrated === true) return false;
  if (flow.hasLocalChanges === true) return false;
  const hasGraph = (flow.nodes?.length ?? 0) > 0 || (flow.edges?.length ?? 0) > 0;
  if (hasGraph) return false;
  return true;
}

export type FlowLoadApplyPayload<NodeT = unknown, EdgeT = unknown> = {
  nodes: NodeT[];
  edges: EdgeT[];
  meta?: { variables?: unknown[] };
};
