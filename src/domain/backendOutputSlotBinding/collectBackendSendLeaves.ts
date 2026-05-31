/**
 * Aggrega leaf SEND OpenAPI da tutti i Backend Call collegati all'agente.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import {
  collectBackendSendLeavesFromTask,
  type BackendSendParamLeaf,
} from '@domain/openApi/backendSendParamCatalog';

export function collectBackendSendLeavesFromTasks(
  backendTaskIds: readonly string[],
  getTask: (taskId: string) => Task | null | undefined
): BackendSendParamLeaf[] {
  const byPath = new Map<string, BackendSendParamLeaf>();
  for (const id of backendTaskIds) {
    const taskId = String(id ?? '').trim();
    if (!taskId) continue;
    const task = getTask(taskId);
    if (!task || task.type !== TaskType.BackendCall) continue;
    for (const leaf of collectBackendSendLeavesFromTask(task)) {
      if (!byPath.has(leaf.path)) byPath.set(leaf.path, leaf);
    }
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}
