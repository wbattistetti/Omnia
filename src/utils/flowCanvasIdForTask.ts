/**
 * Resolves which flow canvas owns a task row (for flow-local translations and interface).
 */

import { taskRepository } from '@services/TaskRepository';
import { getTaskInstanceIdToFlowIdMap } from './variableScopeUtils';

export function getFlowCanvasIdForTaskRow(taskInstanceId: string): string | null {
  const tid = String(taskInstanceId || '').trim();
  if (!tid) return null;
  const fromGraph = getTaskInstanceIdToFlowIdMap().get(tid);
  if (fromGraph) return fromGraph;
  const task = taskRepository.getTask(tid);
  const af = String(task?.authoringFlowCanvasId ?? '').trim();
  return af || null;
}

/** Alias: flow canvas id for a task row / instance id. */
export const getFlowIdForTaskInstance = getFlowCanvasIdForTaskRow;
