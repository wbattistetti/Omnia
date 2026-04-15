/**
 * Finds the Subflow-type task whose child canvas id matches the given flow id (inverse of resolveChildFlowIdFromTask).
 */

import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';
import { resolveChildFlowIdFromTask } from '@utils/resolveSubflowChildFlowId';

export function findSubflowTaskByChildFlowId(childFlowId: string): Task | undefined {
  const fid = String(childFlowId || '').trim();
  if (!fid) return undefined;
  for (const t of taskRepository.getAllTasks()) {
    if (t.type !== TaskType.Subflow) continue;
    const cf = resolveChildFlowIdFromTask(t);
    if (cf && cf === fid) return t;
  }
  return undefined;
}
