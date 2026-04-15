/**
 * Builds the argument tuple for opening a Subflow flow tab from a canvas row (gear icon or rail list).
 * Uses the task repository as source of truth for child flow id and label fallbacks.
 */

import { taskRepository } from '@services/TaskRepository';
import { resolveChildFlowIdFromTask } from '@utils/resolveSubflowChildFlowId';

export type SubflowOpenArgsFromRow = {
  taskId: string;
  existingFlowId: string | undefined;
  rowLabel: string;
  canvasNodeId: string;
};

/**
 * Same inputs as a Subflow portal row: task id, React Flow node id, and visible row text.
 * Resolves `existingFlowId` from the persisted task (root `flowId` or `parameters` entry).
 */
export function getSubflowOpenArgsFromTaskAndRowText(
  taskId: string,
  canvasNodeId: string,
  rowText: string
): SubflowOpenArgsFromRow {
  const tid = String(taskId || '').trim();
  const nid = String(canvasNodeId || '').trim();
  const task = taskRepository.getTask(tid) ?? null;
  const resolved = task != null ? resolveChildFlowIdFromTask(task) : null;
  const existingFlowId = resolved && resolved.trim() ? resolved.trim() : undefined;
  const rowLabel =
    String(rowText || '').trim() ||
    String((task as { name?: string } | null)?.name || '').trim() ||
    'Subflow';
  return { taskId: tid, existingFlowId, rowLabel, canvasNodeId: nid };
}
