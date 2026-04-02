/**
 * Pure helpers to move a single flowchart row (task instance) between nodes/flows.
 * Updates ReactFlow node shape: node.data.rows[].
 */

import type { WorkspaceState } from '@flows/FlowTypes';

function nodeId(node: { id?: string }): string {
  return String(node?.id ?? '').trim();
}

/**
 * Removes the row with `rowId` from `sourceNodeId` in `sourceFlowId` and appends it to `targetNodeId` in `targetFlowId`.
 * Returns a shallow-copied `flows` object; nodes/rows are cloned where mutated.
 */
export function moveTaskRowBetweenFlows(
  flows: WorkspaceState['flows'],
  params: {
    sourceFlowId: string;
    targetFlowId: string;
    sourceNodeId: string;
    targetNodeId: string;
    rowId: string;
  }
): WorkspaceState['flows'] {
  const { sourceFlowId, targetFlowId, sourceNodeId, targetNodeId, rowId } = params;
  const rid = String(rowId || '').trim();
  if (!rid) return flows;

  const srcFlow = flows[sourceFlowId];
  const tgtFlow = flows[targetFlowId];
  if (!srcFlow?.nodes || !tgtFlow?.nodes) return flows;

  let removed: Record<string, unknown> | null = null;

  const srcNodes = (srcFlow.nodes as any[]).map((node) => {
    const nid = nodeId(node);
    if (nid !== sourceNodeId) return node;
    const data = node.data ?? {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    const idx = rows.findIndex((r) => String(r?.id || '').trim() === rid);
    if (idx < 0) return node;
    removed = rows[idx] as Record<string, unknown>;
    const nextRows = [...rows.slice(0, idx), ...rows.slice(idx + 1)];
    return { ...node, data: { ...data, rows: nextRows } };
  });

  if (!removed) return flows;

  const tgtNodes = (tgtFlow.nodes as any[]).map((node) => {
    const nid = nodeId(node);
    if (nid !== targetNodeId) return node;
    const data = node.data ?? {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    return { ...node, data: { ...data, rows: [...rows, removed] } };
  });

  return {
    ...flows,
    [sourceFlowId]: { ...srcFlow, nodes: srcNodes as any, hasLocalChanges: true },
    [targetFlowId]: { ...tgtFlow, nodes: tgtNodes as any, hasLocalChanges: true },
  };
}

/**
 * Removes a row by id from any node in `flowId` (no-op if already absent).
 */
export function removeRowByIdFromFlow(
  flows: WorkspaceState['flows'],
  flowId: string,
  rowId: string
): WorkspaceState['flows'] {
  const rid = String(rowId || '').trim();
  const f = flows[flowId];
  if (!rid || !f?.nodes) return flows;

  let changed = false;
  const nodes = (f.nodes as any[]).map((node) => {
    const data = node.data ?? {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    const idx = rows.findIndex((r) => String(r?.id || '').trim() === rid);
    if (idx < 0) return node;
    changed = true;
    const nextRows = [...rows.slice(0, idx), ...rows.slice(idx + 1)];
    return { ...node, data: { ...data, rows: nextRows } };
  });

  if (!changed) return flows;
  return { ...flows, [flowId]: { ...f, nodes: nodes as any, hasLocalChanges: true } };
}

/**
 * Appends a row to `targetNodeId` in `targetFlowId` (e.g. after the row was already removed upstream).
 */
export function appendRowToFlowNode(
  flows: WorkspaceState['flows'],
  params: {
    targetFlowId: string;
    targetNodeId: string;
    row: Record<string, unknown>;
  }
): WorkspaceState['flows'] {
  const { targetFlowId, targetNodeId, row } = params;
  const tid = String(targetNodeId || '').trim();
  const tgtFlow = flows[targetFlowId];
  if (!tid || !tgtFlow?.nodes) return flows;

  const tgtNodes = (tgtFlow.nodes as any[]).map((node) => {
    const nid = nodeId(node);
    if (nid !== tid) return node;
    const data = node.data ?? {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    return { ...node, data: { ...data, rows: [...rows, row] } };
  });

  return {
    ...flows,
    [targetFlowId]: { ...tgtFlow, nodes: tgtNodes as any, hasLocalChanges: true },
  };
}
