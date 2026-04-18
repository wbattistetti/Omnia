/**
 * After structural commit, React Flow may keep a stale node.data.rows reference even when FlowStore
 * already matches flowsNext. Validates against the orchestrator snapshot and notifies the canvas host
 * to patch the target node immutably (see FlowCanvasHost listener).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { logTaskSubflowMove } from './taskSubflowMoveDebug';
import { FLOW_GRAPH_MIGRATION } from '@domain/flowGraph/flowGraphMigrationConfig';

export const COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT = 'omnia:committedFlowNodeRowsSync';

export type CommittedFlowNodeRowsDetail = {
  flowCanvasId: string;
  nodeId: string;
  rowId: string;
  /** Rows taken from orchestrator flowsNext for this node — canonical post-commit shape. */
  rows: Record<string, unknown>[];
};

function norm(s: unknown): string {
  return String(s ?? '').trim();
}

/**
 * Finds the canvas node id in the committed slice that owns `rowId` (included rows only).
 * Prefer this over DnD `toNodeId`: the pointer can target an inner drop zone while the document
 * stores the row on the real RF node id (e.g. utterance container vs portal).
 */
export function findNodeIdInSliceOwningTaskRow(
  flowsNext: WorkspaceState['flows'],
  flowCanvasId: string,
  rowId: string
): string | null {
  const fid = norm(flowCanvasId);
  const rid = norm(rowId);
  if (!fid || !rid) return null;
  const slice = flowsNext[fid];
  const nodes = slice?.nodes as Array<{ id?: string; data?: { rows?: unknown[] } }> | undefined;
  if (!nodes?.length) return null;
  for (const node of nodes) {
    const rows = node?.data?.rows;
    if (!Array.isArray(rows)) continue;
    const hit = rows.some((r) => {
      if ((r as { included?: boolean }).included === false) return false;
      return norm((r as { id?: string })?.id) === rid;
    });
    if (hit) {
      const nid = norm(node?.id);
      return nid || null;
    }
  }
  return null;
}

/**
 * Returns true iff the committed slice lists `rowId` inside `nodeId`'s task rows (included rows only).
 */
export function committedSliceContainsTaskRowOnNode(
  flowsNext: WorkspaceState['flows'],
  flowCanvasId: string,
  nodeId: string,
  rowId: string
): boolean {
  const resolved = findNodeIdInSliceOwningTaskRow(flowsNext, flowCanvasId, rowId);
  return resolved !== null && resolved === norm(nodeId);
}

/**
 * Deep-enough copy of row objects for immutable React updates (avoid shared refs with store).
 */
export function cloneRowsForReactSync(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((r) =>
    typeof r === 'object' && r !== null ? { ...(r as Record<string, unknown>) } : ({} as Record<string, unknown>)
  );
}

function extractRowsFromCommittedSlice(
  flowsNext: WorkspaceState['flows'],
  flowCanvasId: string,
  nodeId: string
): Record<string, unknown>[] | null {
  const fid = norm(flowCanvasId);
  const nid = norm(nodeId);
  const slice = flowsNext[fid];
  const nodes = slice?.nodes as Array<{ id?: string; data?: { rows?: unknown[] } }> | undefined;
  const node = nodes?.find((n) => norm(n?.id) === nid);
  const rows = node?.data?.rows;
  return Array.isArray(rows) ? cloneRowsForReactSync(rows) : null;
}

/**
 * If flowsNext lists `rowId` on some node in `flowCanvasId`, schedules a microtask that dispatches
 * {@link COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT}. Node id is taken from the slice (not DnD hints).
 */
export function scheduleCommittedFlowNodeRowsSync(
  flowsNext: WorkspaceState['flows'],
  flowCanvasId: string,
  rowId: string
): boolean {
  if (FLOW_GRAPH_MIGRATION.DISABLE_SCHEDULE_COMMITTED_FLOW_NODE_ROWS_SYNC) {
    return false;
  }
  const resolvedNodeId = findNodeIdInSliceOwningTaskRow(flowsNext, flowCanvasId, rowId);
  if (!resolvedNodeId) return false;
  const rows = extractRowsFromCommittedSlice(flowsNext, flowCanvasId, resolvedNodeId);
  if (!rows) return false;

  queueMicrotask(() => {
    requestAnimationFrame(() => {
      try {
        const detail: CommittedFlowNodeRowsDetail = {
          flowCanvasId: norm(flowCanvasId),
          nodeId: resolvedNodeId,
          rowId: norm(rowId),
          rows,
        };
        document.dispatchEvent(
          new CustomEvent(COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT, {
            bubbles: true,
            detail,
          })
        );
        if (import.meta.env.DEV) {
          logTaskSubflowMove('committedSlice:scheduleNodeRowsSync', {
            flowCanvasId: detail.flowCanvasId,
            nodeId: detail.nodeId,
            rowId: detail.rowId,
            rowCount: detail.rows.length,
          });
        }
      } catch {
        /* noop */
      }
    });
  });
  return true;
}
