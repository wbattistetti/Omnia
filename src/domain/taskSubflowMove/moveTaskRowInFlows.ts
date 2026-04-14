/**
 * Pure helpers to move a single flowchart row (task instance) between nodes/flows.
 * Updates ReactFlow node shape: node.data.rows[].
 */

import { generateSafeGuid } from '@utils/idGenerator';
import type { WorkspaceState } from '@flows/FlowTypes';
import { logSubflowCanvasDebug } from '@utils/subflowCanvasDebug';

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
  /** Source must have nodes; target slice must exist (nodes may be [] or omitted — handled in cross-flow branch). */
  if (!srcFlow?.nodes || tgtFlow == null) return flows;

  /** Same flow slice: must remove then append on one `nodes` array (two spreads with same key overwrote removal). */
  if (sourceFlowId === targetFlowId) {
    let removed: Record<string, unknown> | null = null;
    const afterRemove = (srcFlow.nodes as any[]).map((node) => {
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

    const finalNodes = afterRemove.map((node) => {
      const nid = nodeId(node);
      if (nid !== targetNodeId) return node;
      const data = node.data ?? {};
      const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
      if (rows.some((r) => String((r as { id?: string })?.id || '').trim() === rid)) {
        return node;
      }
      return { ...node, data: { ...data, rows: [...rows, removed] } };
    });

    return {
      ...flows,
      [sourceFlowId]: { ...srcFlow, nodes: finalNodes as any, hasLocalChanges: true },
    };
  }

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

  const tgtNodesRaw = Array.isArray(tgtFlow.nodes) ? tgtFlow.nodes : [];
  const tgtNodes = (tgtNodesRaw as any[]).map((node) => {
    const nid = nodeId(node);
    if (nid !== targetNodeId) return node;
    const data = node.data ?? {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    return { ...node, data: { ...data, rows: [...rows, removed] } };
  });

  const flowsAfterCross = {
    ...flows,
    [sourceFlowId]: { ...srcFlow, nodes: srcNodes as any, hasLocalChanges: true },
    [targetFlowId]: { ...tgtFlow, nodes: tgtNodes as any, hasLocalChanges: true },
  };

  const landedInTarget = (flowsAfterCross[targetFlowId]?.nodes as any[])?.some((node) => {
    const rows = Array.isArray(node?.data?.rows) ? node.data.rows : [];
    return rows.some((r: any) => String(r?.id || '').trim() === rid);
  });

  /** Empty target canvas, unknown targetNodeId, or stale slice: ensure row is materialized via shared append helper. */
  if (!landedInTarget) {
    return appendRowToFlowNode(flowsAfterCross, {
      targetFlowId,
      targetNodeId,
      row: removed,
    });
  }

  return flowsAfterCross;
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
    /** When set, append to this node; if the child flow has no nodes yet, pass '' and a shell node is created. */
    targetNodeId: string;
    row: Record<string, unknown>;
  }
): WorkspaceState['flows'] {
  const { targetFlowId, targetNodeId, row } = params;
  const tid = String(targetNodeId || '').trim();
  let flowsBase = flows;
  let tgtFlow = flows[targetFlowId];
  const rowIdForLog = String((row as { id?: string }).id || '').trim();
  const hadSlice = !!tgtFlow;
  const incomingNodes = Array.isArray(tgtFlow?.nodes) ? tgtFlow!.nodes!.length : 0;

  logSubflowCanvasDebug('appendRowToFlowNode:enter', {
    targetFlowId,
    targetNodeId: tid || '(empty → shell)',
    rowId: rowIdForLog,
    hadSlice,
    incomingNodeCount: incomingNodes,
  });

  if (!tgtFlow) {
    tgtFlow = {
      id: targetFlowId,
      title: targetFlowId,
      nodes: [],
      edges: [],
      hasLocalChanges: true,
    } as any;
    flowsBase = { ...flows, [targetFlowId]: tgtFlow };
    logSubflowCanvasDebug('appendRowToFlowNode:createdMissingFlowSlice', { targetFlowId });
  }

  const newRowId = String((row as { id?: string }).id || '').trim();
  const nodesArr = Array.isArray(tgtFlow.nodes) ? ([...(tgtFlow.nodes as any[])] as any[]) : [];

  if (nodesArr.length === 0) {
    const shell: Record<string, unknown> = {
      id: generateSafeGuid(),
      type: 'custom',
      position: { x: 120, y: 120 },
      data: {
        label: '',
        rows: [row],
      },
    };
    logSubflowCanvasDebug('appendRowToFlowNode:createdShellFirstNode', {
      targetFlowId,
      shellNodeId: shell.id,
      rowId: rowIdForLog,
    });
    return {
      ...flowsBase,
      [targetFlowId]: { ...tgtFlow, nodes: [shell] as any, hasLocalChanges: true },
    };
  }

  const effectiveId =
    tid && nodesArr.some((node) => nodeId(node) === tid) ? tid : nodeId(nodesArr[0]);

  logSubflowCanvasDebug('appendRowToFlowNode:appendToExistingNode', {
    targetFlowId,
    effectiveTargetNodeId: effectiveId,
    usedFallbackFirstNode: effectiveId !== tid,
    rowId: rowIdForLog,
  });

  const tgtNodes = nodesArr.map((node) => {
    const nid = nodeId(node);
    if (nid !== effectiveId) return node;
    const data = node.data ?? {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    if (newRowId && rows.some((r) => String((r as { id?: string })?.id || '').trim() === newRowId)) {
      return node;
    }
    return { ...node, data: { ...data, rows: [...rows, row] } };
  });

  logSubflowCanvasDebug('appendRowToFlowNode:exit', {
    targetFlowId,
    resultNodeCount: tgtNodes.length,
    rowId: rowIdForLog,
  });

  return {
    ...flowsBase,
    [targetFlowId]: { ...tgtFlow, nodes: tgtNodes as any, hasLocalChanges: true },
  };
}
