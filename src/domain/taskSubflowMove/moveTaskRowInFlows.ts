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
 * After the last task row leaves a canvas node, the node becomes a useless empty shell.
 * Removes that node from the slice and drops edges incident to it (matches prior editor behavior).
 */
function pruneNodeWithEmptyRowsFromFlowSlice(
  slice: { nodes?: unknown[]; edges?: unknown[]; [key: string]: unknown },
  emptyNodeId: string
): typeof slice {
  const nid = String(emptyNodeId || '').trim();
  if (!nid || !Array.isArray(slice.nodes)) return slice;
  const nodes = slice.nodes as { id?: string; data?: { rows?: unknown[] } }[];
  const node = nodes.find((n) => nodeId(n) === nid);
  if (!node) return slice;
  const rows = Array.isArray(node?.data?.rows) ? (node.data!.rows as unknown[]) : [];
  if (rows.length > 0) return slice;
  const nextNodes = nodes.filter((n) => nodeId(n) !== nid);
  const edgesArr = Array.isArray(slice.edges) ? (slice.edges as { source?: string; target?: string }[]) : [];
  const nextEdges = edgesArr.filter((e) => {
    const s = String(e?.source ?? '').trim();
    const t = String(e?.target ?? '').trim();
    return s !== nid && t !== nid;
  });
  return { ...slice, nodes: nextNodes, edges: nextEdges };
}

/** If `sourceNodeId` is now rowless in `sourceFlowId`, remove the node from that flow slice. */
function pruneSourceNodeIfEmptyAfterRowMove(
  flows: WorkspaceState['flows'],
  sourceFlowId: string,
  sourceNodeId: string
): WorkspaceState['flows'] {
  const fid = String(sourceFlowId || '').trim();
  const slice = flows[fid];
  if (!slice) return flows;
  const nextSlice = pruneNodeWithEmptyRowsFromFlowSlice(
    slice as { nodes?: unknown[]; edges?: unknown[]; [key: string]: unknown },
    sourceNodeId
  );
  if (nextSlice === slice) return flows;
  return {
    ...flows,
    [fid]: { ...nextSlice, hasLocalChanges: true } as (typeof flows)[string],
  };
}

/** Insert `removed` into `rows` at index (omit = append). Clamps to [0, rows.length]. */
function insertRowAtIndex(rows: unknown[], removed: Record<string, unknown>, insertIndex?: number): unknown[] {
  const at =
    insertIndex === undefined || insertIndex === null || Number.isNaN(Number(insertIndex))
      ? rows.length
      : Math.max(0, Math.min(rows.length, Math.floor(Number(insertIndex))));
  return [...rows.slice(0, at), removed, ...rows.slice(at)];
}

/**
 * Returns true if any node in the flow slice has a row whose id equals `rowId`.
 */
export function flowContainsTaskRow(
  flows: WorkspaceState['flows'],
  flowId: string,
  rowId: string
): boolean {
  const flow = flows[flowId];
  const rid = String(rowId || '').trim();
  if (!flow?.nodes || !rid) return false;
  for (const node of flow.nodes as Array<{ data?: { rows?: unknown[] } }>) {
    const rows = Array.isArray(node?.data?.rows) ? node.data.rows : [];
    if (rows.some((r) => String((r as { id?: string })?.id || '').trim() === rid)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves which canvas node actually holds `rowId` when DnD supplies `preferredNodeId` that may be stale
 * (e.g. row merged onto portal node after reverse while pointer still targets another node id).
 */
export function resolveSourceNodeIdForRowMove(
  flows: WorkspaceState['flows'],
  flowId: string,
  rowId: string,
  preferredNodeId: string
): string | null {
  const fid = String(flowId || '').trim();
  const rid = String(rowId || '').trim();
  const pref = String(preferredNodeId || '').trim();
  if (!fid || !rid) return null;

  const flow = flows[fid];
  const nodes = Array.isArray(flow?.nodes)
    ? (flow!.nodes as Array<{ id?: string; data?: { rows?: unknown[] } }>)
    : [];

  if (pref) {
    const preferred = nodes.find((n) => nodeId(n) === pref);
    const rows = Array.isArray(preferred?.data?.rows) ? preferred!.data!.rows! : [];
    if (rows.some((r) => String((r as { id?: string }).id || '').trim() === rid)) {
      return pref;
    }
  }

  for (const node of nodes) {
    const nid = nodeId(node);
    if (!nid) continue;
    const rows = Array.isArray(node?.data?.rows) ? node.data.rows : [];
    if (rows.some((r) => String((r as { id?: string }).id || '').trim() === rid)) {
      return nid;
    }
  }

  return null;
}

/**
 * Appends or inserts a new canvas shell node carrying `row` at `position`, unless a node with `shellNodeId` already exists (then append row to it).
 */
function appendShellRowToTargetFlow(
  flows: WorkspaceState['flows'],
  targetFlowId: string,
  shellNodeId: string,
  row: Record<string, unknown>,
  position: { x: number; y: number }
): WorkspaceState['flows'] {
  const tf = String(targetFlowId || '').trim();
  const sid = String(shellNodeId || '').trim();
  if (!tf || !sid) return flows;

  let slice = flows[tf];
  if (slice == null) {
    slice = {
      id: tf,
      title: tf,
      nodes: [],
      edges: [],
      hasLocalChanges: true,
    } as any;
    flows = { ...flows, [tf]: slice };
  }
  const nodesNow = Array.isArray(slice.nodes) ? ([...(slice.nodes as any[])] as any[]) : [];
  if (nodesNow.some((n) => nodeId(n) === sid)) {
    return appendRowToFlowNode(flows, { targetFlowId: tf, targetNodeId: sid, row });
  }
  const shell = {
    id: sid,
    type: 'custom',
    position: { x: position.x, y: position.y },
    data: {
      label: '',
      rows: [row],
    },
  };
  return {
    ...flows,
    [tf]: { ...slice, nodes: [...nodesNow, shell] as any, hasLocalChanges: true },
  };
}

/**
 * Guarantees `rowId` appears on `targetFlowId` when `removed` was extracted from the parent (cross- or same-flow invariant).
 */
function ensureRowLandedOnTargetFlow(
  flows: WorkspaceState['flows'],
  params: {
    targetFlowId: string;
    targetNodeId: string;
    rowId: string;
    removed: Record<string, unknown>;
    createTargetNodeIfMissing?: { x: number; y: number };
    targetRowInsertIndex?: number;
  }
): WorkspaceState['flows'] {
  const rid = String(params.rowId || '').trim();
  if (!rid || flowContainsTaskRow(flows, params.targetFlowId, rid)) return flows;

  if (params.createTargetNodeIfMissing) {
    return appendShellRowToTargetFlow(
      flows,
      params.targetFlowId,
      params.targetNodeId,
      params.removed,
      params.createTargetNodeIfMissing
    );
  }
  return appendRowToFlowNode(flows, {
    targetFlowId: params.targetFlowId,
    targetNodeId: params.targetNodeId,
    row: params.removed,
    targetRowInsertIndex: params.targetRowInsertIndex,
  });
}

function assertRowOnFlowOrThrow(flows: WorkspaceState['flows'], flowId: string, rowId: string, phase: string): void {
  if (!flowContainsTaskRow(flows, flowId, rowId)) {
    throw new Error(`[moveTaskRowBetweenFlows] ${phase}: row "${rowId}" must appear on flow "${flowId}"`);
  }
}

/**
 * Removes the row with `rowId` from `sourceNodeId` in `sourceFlowId` and inserts it into `targetNodeId` in `targetFlowId`.
 * Optional `targetRowInsertIndex`: position in target node's rows (same semantics as same-node reorder — 0 = before first row).
 *
 * When the source node has no rows left after removal, it is dropped from the graph (with incident edges).
 */
export function moveTaskRowBetweenFlows(
  flows: WorkspaceState['flows'],
  params: {
    sourceFlowId: string;
    targetFlowId: string;
    sourceNodeId: string;
    targetNodeId: string;
    rowId: string;
    targetRowInsertIndex?: number;
    /** When the target RF node id does not exist yet (pane drop → new node), create it at this flow position. */
    createTargetNodeIfMissing?: { x: number; y: number };
  }
): WorkspaceState['flows'] {
  const {
    sourceFlowId,
    targetFlowId,
    sourceNodeId,
    targetNodeId,
    rowId,
    targetRowInsertIndex,
    createTargetNodeIfMissing,
  } = params;
  const rid = String(rowId || '').trim();
  if (!rid) return flows;

  /** Cross-canvas drops (e.g. main → subflow tab) must work even before the target slice was hydrated in `flows`. */
  let workspaceFlows: WorkspaceState['flows'] = flows;
  const tfId = String(targetFlowId || '').trim();
  if (tfId && workspaceFlows[tfId] == null) {
    workspaceFlows = {
      ...workspaceFlows,
      [tfId]: {
        id: tfId,
        title: tfId,
        nodes: [],
        edges: [],
        hasLocalChanges: true,
      } as any,
    };
  }

  const srcFlow = workspaceFlows[sourceFlowId];
  const tgtFlow = workspaceFlows[targetFlowId];
  /** Source must have nodes; target slice is ensured above for multi-flow moves. */
  if (!srcFlow?.nodes || tgtFlow == null) return workspaceFlows;

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
    if (!removed) return workspaceFlows;

    const finalNodes = afterRemove.map((node) => {
      const nid = nodeId(node);
      if (nid !== targetNodeId) return node;
      const data = node.data ?? {};
      const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
      if (rows.some((r) => String((r as { id?: string })?.id || '').trim() === rid)) {
        return node;
      }
      return { ...node, data: { ...data, rows: insertRowAtIndex(rows, removed, targetRowInsertIndex) } };
    });

    const landedSameFlow = finalNodes.some((node: any) => {
      const rows = Array.isArray(node?.data?.rows) ? node.data.rows : [];
      return rows.some((r: any) => String(r?.id || '').trim() === rid);
    });

    let nextFlows: WorkspaceState['flows'] = {
      ...workspaceFlows,
      [sourceFlowId]: { ...srcFlow, nodes: finalNodes as any, hasLocalChanges: true },
    };

    if (
      !landedSameFlow &&
      createTargetNodeIfMissing &&
      !finalNodes.some((n: any) => nodeId(n) === targetNodeId)
    ) {
      nextFlows = appendShellRowToTargetFlow(
        nextFlows,
        sourceFlowId,
        targetNodeId,
        removed,
        createTargetNodeIfMissing
      );
    }

    nextFlows = ensureRowLandedOnTargetFlow(nextFlows, {
      targetFlowId: sourceFlowId,
      targetNodeId,
      rowId: rid,
      removed,
      createTargetNodeIfMissing,
      targetRowInsertIndex,
    });
    assertRowOnFlowOrThrow(nextFlows, sourceFlowId, rid, 'same-flow');

    nextFlows = pruneSourceNodeIfEmptyAfterRowMove(nextFlows, sourceFlowId, sourceNodeId);
    return nextFlows;
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

  if (!removed) return workspaceFlows;

  const tgtNodesRaw = Array.isArray(tgtFlow.nodes) ? tgtFlow.nodes : [];
  const tgtNodes = (tgtNodesRaw as any[]).map((node) => {
    const nid = nodeId(node);
    if (nid !== targetNodeId) return node;
    const data = node.data ?? {};
    const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
    return { ...node, data: { ...data, rows: insertRowAtIndex(rows, removed, targetRowInsertIndex) } };
  });

  let flowsAfterCross: WorkspaceState['flows'] = {
    ...workspaceFlows,
    [sourceFlowId]: { ...srcFlow, nodes: srcNodes as any, hasLocalChanges: true },
    [targetFlowId]: { ...tgtFlow, nodes: tgtNodes as any, hasLocalChanges: true },
  };

  flowsAfterCross = ensureRowLandedOnTargetFlow(flowsAfterCross, {
    targetFlowId,
    targetNodeId,
    rowId: rid,
    removed,
    createTargetNodeIfMissing,
    targetRowInsertIndex,
  });
  assertRowOnFlowOrThrow(flowsAfterCross, targetFlowId, rid, 'cross-flow');

  return pruneSourceNodeIfEmptyAfterRowMove(flowsAfterCross, sourceFlowId, sourceNodeId);
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
    /** Insert position in existing rows (omit = append). */
    targetRowInsertIndex?: number;
  }
): WorkspaceState['flows'] {
  const { targetFlowId, targetNodeId, row, targetRowInsertIndex } = params;
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
    return { ...node, data: { ...data, rows: insertRowAtIndex(rows, row, targetRowInsertIndex) } };
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

/**
 * Deep-clones the row payload from a specific canvas node before a destructive graph move (recovery path).
 */
export function extractTaskRowDeepCloneFromNode(
  flows: WorkspaceState['flows'],
  flowId: string,
  nodeId: string,
  rowId: string
): Record<string, unknown> | null {
  const fid = String(flowId || '').trim();
  const nid = String(nodeId || '').trim();
  const rid = String(rowId || '').trim();
  if (!fid || !nid || !rid) return null;
  const flow = flows[fid];
  if (!Array.isArray(flow?.nodes)) return null;
  for (const node of flow.nodes as Array<{ id?: string; data?: { rows?: unknown[] } }>) {
    if (String(node?.id || '').trim() !== nid) continue;
    const rows = Array.isArray(node?.data?.rows) ? node.data.rows : [];
    const found = rows.find((r) => String((r as { id?: string })?.id || '').trim() === rid);
    if (found) {
      return JSON.parse(JSON.stringify(found)) as Record<string, unknown>;
    }
  }
  return null;
}

/**
 * Recovers when {@link moveTaskRowBetweenFlows} stripped the row from the parent slice but failed to land it on the
 * target subflow canvas (orphan row). Uses the pre-move snapshot for row JSON and {@link appendRowToFlowNode} /
 * explicit shell placement aligned with `moveTaskRowToCanvas`.
 */
export function healOrphanMoveTaskRowToCanvas(params: {
  flowsBeforeMove: WorkspaceState['flows'];
  flowsAfterMove: WorkspaceState['flows'];
  sourceFlowId: string;
  sourceNodeId: string;
  targetFlowId: string;
  rowId: string;
  newNodeId: string;
  position: { x: number; y: number };
}): WorkspaceState['flows'] {
  const rid = String(params.rowId || '').trim();
  const tf = String(params.targetFlowId || '').trim();
  const shellId = String(params.newNodeId || '').trim();
  if (!rid || !tf || !shellId) return params.flowsAfterMove;

  const resolvedSource =
    resolveSourceNodeIdForRowMove(
      params.flowsBeforeMove,
      params.sourceFlowId,
      rid,
      params.sourceNodeId
    ) ?? params.sourceNodeId;

  let payload = extractTaskRowDeepCloneFromNode(
    params.flowsBeforeMove,
    params.sourceFlowId,
    resolvedSource,
    rid
  );
  if (!payload) return params.flowsAfterMove;

  if (flowContainsTaskRow(params.flowsAfterMove, tf, rid)) {
    return params.flowsAfterMove;
  }

  const sliceForShell = params.flowsAfterMove[tf];
  const nodesForShell = Array.isArray(sliceForShell?.nodes)
    ? (sliceForShell!.nodes as Array<{ id?: string }>)
    : [];
  const hasShellSlot = nodesForShell.some((n) => String(n?.id || '').trim() === shellId);

  /**
   * Cross-flow move failed to strip the row (e.g. wrong `sourceNodeId` while row still on parent): land on target then remove from source.
   */
  if (flowContainsTaskRow(params.flowsAfterMove, params.sourceFlowId, rid)) {
    let next = hasShellSlot
      ? appendRowToFlowNode(params.flowsAfterMove, {
          targetFlowId: tf,
          targetNodeId: shellId,
          row: payload,
        })
      : appendShellRowToTargetFlow(
          params.flowsAfterMove,
          tf,
          shellId,
          payload,
          { x: params.position.x, y: params.position.y }
        );
    next = removeRowByIdFromFlow(next, params.sourceFlowId, rid);
    return next;
  }

  if (hasShellSlot) {
    return appendRowToFlowNode(params.flowsAfterMove, {
      targetFlowId: tf,
      targetNodeId: shellId,
      row: payload,
    });
  }

  return appendShellRowToTargetFlow(
    params.flowsAfterMove,
    tf,
    shellId,
    payload,
    { x: params.position.x, y: params.position.y }
  );
}
