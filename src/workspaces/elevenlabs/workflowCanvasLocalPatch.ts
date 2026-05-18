/**
 * Local workflow canvas edits (copy/delete nodes) layered on API snapshot graph.
 */

import type { WorkspaceWorkflowGraph, WorkspaceWorkflowNode } from '../core/types';

export type WorkflowCanvasLocalPatch = {
  addedNodes: readonly WorkspaceWorkflowNode[];
  removedNodeIds: readonly string[];
};

export const EMPTY_WORKFLOW_CANVAS_PATCH: WorkflowCanvasLocalPatch = {
  addedNodes: [],
  removedNodeIds: [],
};

export const WORKFLOW_NODE_COPY_OFFSET = { x: 56, y: 56 } as const;

const MAX_TITLE_WORDS = 5;

/** Truncates label to at most `maxWords` words with ellipsis. */
export function truncateAgentLabel(label: string, maxWords = MAX_TITLE_WORDS): string {
  const trimmed = label.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

/** Merges local patch onto API workflow (removals, then additions). */
export function applyWorkflowCanvasLocalPatch(
  graph: WorkspaceWorkflowGraph,
  patch?: WorkflowCanvasLocalPatch
): WorkspaceWorkflowGraph {
  if (!patch) return graph;
  const removed = new Set(patch.removedNodeIds);
  const baseNodes = graph.nodes.filter((n) => !removed.has(n.id));
  const baseIds = new Set(baseNodes.map((n) => n.id));
  const added = patch.addedNodes.filter((n) => !removed.has(n.id) && !baseIds.has(n.id));
  const nodeIds = new Set([...baseNodes, ...added].map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
  );
  return { nodes: [...baseNodes, ...added], edges };
}

/** Clones a workflow node with new id, «(copia)» suffix, and offset position. */
export function duplicateWorkflowNode(
  source: WorkspaceWorkflowNode,
  sourcePosition: { x: number; y: number }
): WorkspaceWorkflowNode {
  const suffix = ' (copia)';
  const label = source.label.trim().endsWith(suffix)
    ? source.label.trim()
    : `${source.label.trim()}${suffix}`;
  return {
    ...source,
    id: `omnia-copy-${crypto.randomUUID()}`,
    label,
    position: {
      x: sourcePosition.x + WORKFLOW_NODE_COPY_OFFSET.x,
      y: sourcePosition.y + WORKFLOW_NODE_COPY_OFFSET.y,
    },
    edgeOrder: [],
  };
}

export function addNodeToWorkflowPatch(
  patch: WorkflowCanvasLocalPatch,
  node: WorkspaceWorkflowNode
): WorkflowCanvasLocalPatch {
  return {
    removedNodeIds: patch.removedNodeIds.filter((id) => id !== node.id),
    addedNodes: [...patch.addedNodes.filter((n) => n.id !== node.id), node],
  };
}

export function removeNodeFromWorkflowPatch(
  patch: WorkflowCanvasLocalPatch,
  nodeId: string
): WorkflowCanvasLocalPatch {
  return {
    addedNodes: patch.addedNodes.filter((n) => n.id !== nodeId),
    removedNodeIds: patch.removedNodeIds.includes(nodeId)
      ? patch.removedNodeIds
      : [...patch.removedNodeIds, nodeId],
  };
}
