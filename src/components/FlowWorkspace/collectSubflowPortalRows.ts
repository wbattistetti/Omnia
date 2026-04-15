/**
 * Collects Subflow (taskflow) portal rows on a flow canvas for the side panel.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { resolveChildFlowIdFromCanvasRow, resolveChildFlowIdFromTask } from '@utils/resolveSubflowChildFlowId';
import { isSubflowChildFlowLinkedAndNonEmpty } from '@utils/subflowChildFlowStatus';

export type SubflowPortalRow = {
  taskId: string;
  /** React Flow canvas node id containing this row (for same action as row gear). */
  canvasNodeId: string;
  /** Empty when the Subflow row exists on canvas but no child flow id is resolved yet. */
  childFlowId: string;
  /** Row label shown in the panel (row text). */
  rowLabel: string;
  /** True when child flow is linked and its slice has at least one node (colored icon). */
  isChildFlowActive: boolean;
  /** Node label + row text, dot-separated (internal / debug). */
  dotPath: string;
};

function sanitizeSegment(s: string): string {
  const t = String(s || '').trim();
  return t.replace(/\./g, '·') || '—';
}

/**
 * Whether this canvas row is a Subflow portal: authoritative task type when loaded, else row heuristics.
 */
export function isCanvasRowSubflowPortal(
  task: { type?: TaskType } | null,
  row: { heuristics?: { type?: TaskType }; text?: string }
): boolean {
  if (task) {
    return task.type === TaskType.Subflow;
  }
  return row.heuristics?.type === TaskType.Subflow;
}

/**
 * All task rows on the given canvas that represent a Subflow portal (task type or heuristics).
 * Child flow id comes from the task, then from row metadata, and may be empty until wired.
 */
export function collectSubflowPortalRows(
  flows: WorkspaceState['flows'],
  flowCanvasId: string
): SubflowPortalRow[] {
  const fid = String(flowCanvasId || '').trim();
  const flow = flows[fid];
  if (!flow?.nodes?.length) return [];
  const out: SubflowPortalRow[] = [];
  for (const node of flow.nodes as Array<{
    id?: string;
    data?: {
      label?: string;
      rows?: Array<{ id?: string; text?: string; heuristics?: { type?: TaskType }; meta?: Record<string, unknown> }>;
    };
  }>) {
    const canvasNodeId = String(node?.id || '').trim();
    const nodeLabel = sanitizeSegment(String(node?.data?.label || node?.id || 'node'));
    const rows = node?.data?.rows;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const taskId = String(row?.id || '').trim();
      if (!taskId) continue;
      const task = taskRepository.getTask(taskId);
      if (!isCanvasRowSubflowPortal(task, row)) continue;

      let childFlowId =
        task && task.type === TaskType.Subflow ? resolveChildFlowIdFromTask(task) : null;
      if (!childFlowId) {
        childFlowId = resolveChildFlowIdFromCanvasRow(row);
      }
      const safeChild = childFlowId ?? '';

      const rowLabelRaw = String(row?.text || (task && (task as { name?: string }).name) || 'Subflow').trim();
      const rowText = sanitizeSegment(rowLabelRaw || 'Subflow');
      const dotPath = `${nodeLabel}.${rowText}`;

      const isChildFlowActive = isSubflowChildFlowLinkedAndNonEmpty(flows, safeChild);

      out.push({
        taskId,
        canvasNodeId,
        childFlowId: safeChild,
        rowLabel: rowLabelRaw || rowText,
        isChildFlowActive,
        dotPath,
      });
    }
  }
  return out;
}
