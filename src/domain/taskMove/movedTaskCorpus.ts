/**
 * Legacy: serializes the moved task for ad-hoc scans.
 * Prefer {@link referencedTaskVariablesForMovedTask} in `ReferencedTaskVariables.ts` for §3 structural extraction.
 */

import { taskRepository } from '../../services/TaskRepository';

export function movedTaskReferenceCorpus(taskInstanceId: string): string {
  const tid = String(taskInstanceId || '').trim();
  if (!tid) return '';
  const task = taskRepository.getTask(tid);
  if (!task) return '';
  try {
    return JSON.stringify(task);
  } catch {
    return '';
  }
}
