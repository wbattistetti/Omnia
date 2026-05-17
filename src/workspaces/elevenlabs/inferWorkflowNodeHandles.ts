/**
 * Picks React Flow handle sides from relative node positions (matches EL flow direction).
 */

import { Position } from 'reactflow';
import type { WorkspaceWorkflowEdge, WorkspaceWorkflowNode } from '../core/types';
import type { WorkflowNodePosition } from './workflowLayoutPositions';

export function inferNodeHandlePositions(
  nodeId: string,
  positions: ReadonlyMap<string, WorkflowNodePosition>,
  edges: readonly WorkspaceWorkflowEdge[]
): { sourcePosition: Position; targetPosition: Position } {
  const pos = positions.get(nodeId);
  if (!pos) {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }

  let dx = 0;
  let dy = 0;
  let n = 0;

  for (const e of edges) {
    if (e.sourceNodeId === nodeId) {
      const t = positions.get(e.targetNodeId);
      if (t) {
        dx += t.x - pos.x;
        dy += t.y - pos.y;
        n += 1;
      }
    }
  }
  if (n === 0) {
    for (const e of edges) {
      if (e.targetNodeId === nodeId) {
        const s = positions.get(e.sourceNodeId);
        if (s) {
          dx += pos.x - s.x;
          dy += pos.y - s.y;
          n += 1;
        }
      }
    }
  }

  if (n === 0) {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }

  if (Math.abs(dy) > Math.abs(dx) * 1.15) {
    return dy >= 0
      ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
      : { sourcePosition: Position.Top, targetPosition: Position.Bottom };
  }
  return dx >= 0
    ? { sourcePosition: Position.Right, targetPosition: Position.Left }
    : { sourcePosition: Position.Left, targetPosition: Position.Right };
}

export function buildPositionMapForHandleInference(
  nodes: readonly WorkspaceWorkflowNode[],
  resolvedPositions: ReadonlyMap<string, WorkflowNodePosition>
): Map<string, WorkflowNodePosition> {
  const map = new Map<string, WorkflowNodePosition>();
  for (const n of nodes) {
    const p = resolvedPositions.get(n.id) ?? n.position;
    if (p) map.set(n.id, p);
  }
  return map;
}
