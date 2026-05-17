/**
 * Workflow canvas positions: API layout from ConvAI + local session overrides.
 */

import type { WorkspaceWorkflowGraph } from '../core/types';

export type WorkflowNodePosition = { x: number; y: number };

export type WorkflowPositionOverrides = Readonly<Record<string, WorkflowNodePosition>>;

/** True when at least one node has coordinates from the remote workflow payload. */
export function graphHasRemoteLayout(graph: WorkspaceWorkflowGraph): boolean {
  return graph.nodes.some((n) => n.position != null);
}

/** Merges session/local overrides onto API positions (override wins). */
export function mergeWorkflowPositionOverrides(
  graph: WorkspaceWorkflowGraph,
  overrides?: WorkflowPositionOverrides
): WorkspaceWorkflowGraph {
  if (!overrides || Object.keys(overrides).length === 0) return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const o = overrides[n.id];
      if (!o) return n;
      return { ...n, position: { x: o.x, y: o.y } };
    }),
  };
}

export function positionsMapFromGraph(graph: WorkspaceWorkflowGraph): Map<string, WorkflowNodePosition> {
  const map = new Map<string, WorkflowNodePosition>();
  for (const n of graph.nodes) {
    if (n.position) map.set(n.id, { ...n.position });
  }
  return map;
}

export function overridesFromReactFlowNodes(
  nodes: readonly { id: string; position: { x: number; y: number } }[]
): WorkflowPositionOverrides {
  const out: Record<string, WorkflowNodePosition> = {};
  for (const n of nodes) {
    out[n.id] = { x: n.position.x, y: n.position.y };
  }
  return out;
}
